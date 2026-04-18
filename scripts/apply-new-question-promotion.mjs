#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  DEFAULT_DATASET,
  ROOT,
  fileExists,
  getDatasetPaths,
  getNewQuestionFiles,
  normalizeBatchId,
  normalizeLang,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

sharp.cache(false);

const YES_NO_VALUES = new Set(["yes", "no", "right", "wrong", "true", "false"]);

const args = parseArgs();
const lang = normalizeLang(args.lang ?? "ja");
const batchId = normalizeBatchId(args.batch ?? args.batchId ?? "batch-001");
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const configPath = args["config-path"]
  ? path.resolve(String(args["config-path"]))
  : path.join(ROOT, "qbank-tools", "generated", "staging", `new-question-promotion-config.${lang}.${batchId}.json`);

const datasetPaths = getDatasetPaths(dataset, lang);
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const rawDoc = readJson(datasetPaths.rawQuestionsPath);
const rawQuestions = Array.isArray(rawDoc?.questions) ? rawDoc.questions : [];
const translationDoc = fileExists(datasetPaths.translationPath)
  ? readJson(datasetPaths.translationPath)
  : { meta: { locale: lang }, questions: {} };
const translationQuestions = translationDoc?.questions && typeof translationDoc.questions === "object"
  ? translationDoc.questions
  : {};
const candidatesDoc = readJson(newQuestionFiles.candidatesPath);
const previewDoc = readJson(newQuestionFiles.promotionPreviewPath);
const decisionsDoc = readJson(newQuestionFiles.decisionsPath);
const configDoc = fileExists(configPath)
  ? readJson(configPath)
  : { candidates: {} };
const configByCandidateId = configDoc?.candidates && typeof configDoc.candidates === "object"
  ? configDoc.candidates
  : {};

const previewByCandidateId = new Map(
  (Array.isArray(previewDoc?.items) ? previewDoc.items : []).map((item) => [String(item?.candidateId ?? ""), item]),
);
const sourceBatchByImage = buildSourceBatchByImage(Array.isArray(decisionsDoc?.items) ? decisionsDoc.items : []);
const existingQids = new Set(rawQuestions.map((question) => String(question?.id ?? "")));

await fs.mkdir(datasetPaths.imagesDir, { recursive: true });

const appendedQuestions = [];
const nextTranslationQuestions = { ...translationQuestions };
const promoted = [];

for (const candidate of Array.isArray(candidatesDoc?.items) ? candidatesDoc.items : []) {
  const candidateId = String(candidate?.candidateId ?? "").trim();
  if (!candidateId) {
    throw new Error("Encountered new-question candidate without candidateId.");
  }

  const previewItem = previewByCandidateId.get(candidateId);
  if (!previewItem) {
    throw new Error(`Preview item not found for candidate ${candidateId}.`);
  }

  const number = Number(previewItem?.proposedMasterNumber);
  if (!Number.isFinite(number)) {
    throw new Error(`Preview item ${candidateId} is missing a valid proposedMasterNumber.`);
  }

  const qid = `q${String(number).padStart(4, "0")}`;
  if (existingQids.has(qid)) {
    throw new Error(`Refusing to overwrite existing master question ${qid}.`);
  }

  const overrides = configByCandidateId[candidateId] ?? {};
  const sourceBatchId = normalizeSourceBatchId(
    overrides.sourceBatchId ?? sourceBatchByImage.get(normalizeText(candidate?.sourceImage)),
  );
  const screenshotPath = resolveScreenshotPath({
    lang,
    sourceBatchId,
    sourceImage: candidate?.sourceImage,
  });

  const type = resolveCanonicalType(candidate, overrides);
  const asset = await maybeCreateAsset({
    dataset,
    datasetPaths,
    screenshotPath,
    crop: normalizeCrop(overrides.assetCrop),
  });
  const region = await buildRegion({
    screenshotPath,
    asset,
  });
  const canonicalPrompt = normalizeText(overrides.promptGlossEn ?? candidate?.promptGlossEn);
  const sourcePrompt = normalizeText(overrides.promptRawJa ?? candidate?.promptRawJa);

  if (!canonicalPrompt) {
    throw new Error(`Candidate ${candidateId} is missing canonical English prompt text.`);
  }
  if (!sourcePrompt) {
    throw new Error(`Candidate ${candidateId} is missing localized prompt text.`);
  }

  const question = buildCanonicalQuestion({
    qid,
    number,
    candidate,
    type,
    canonicalPrompt,
    region,
    asset,
    pdf: rawDoc?.meta?.pdf ?? "2023 Driving test 1.pdf",
  });

  appendedQuestions.push(question);
  existingQids.add(qid);

  nextTranslationQuestions[qid] = buildTranslationEntry({
    qid,
    candidate,
    type,
    sourcePrompt,
    canonicalQuestion: question,
  });

  promoted.push({
    candidateId,
    qid,
    number,
    type,
    hasAsset: Boolean(asset),
  });
}

const nextRawQuestions = [...rawQuestions, ...appendedQuestions].sort((left, right) => {
  const leftNumber = Number(left?.number) || 0;
  const rightNumber = Number(right?.number) || 0;
  return leftNumber - rightNumber || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
});

const nextRawDoc = {
  ...rawDoc,
  meta: {
    ...(rawDoc?.meta ?? {}),
    questionCount: nextRawQuestions.length,
  },
  questions: nextRawQuestions,
};

const nextTranslationDoc = {
  meta: {
    ...(translationDoc?.meta ?? {}),
    locale: lang,
    translatedQuestions: Object.keys(nextTranslationQuestions).length,
    generatedAt: stableNow(),
    localeAnswerKeySupport: true,
    mergedBatches: Array.isArray(translationDoc?.meta?.mergedBatches)
      ? Array.from(new Set([...translationDoc.meta.mergedBatches, batchId].map((value) => String(value))))
      : translationDoc?.meta?.mergedBatches,
  },
  questions: sortObjectByKey(nextTranslationQuestions),
};

await writeJson(datasetPaths.rawQuestionsPath, nextRawDoc);
await writeJson(datasetPaths.translationPath, nextTranslationDoc);

console.log(
  `Promoted ${promoted.length} new question(s) for ${lang} ${batchId}: ${promoted.map((item) => item.qid).join(", ")}.`,
);

function buildSourceBatchByImage(items) {
  const map = new Map();

  for (const item of items) {
    const sourceImage = normalizeText(item?.sourceImage);
    const sourceBatchId = normalizeSourceBatchId(String(item?.itemId ?? "").split(":")[0]);
    if (!sourceImage || !sourceBatchId) {
      continue;
    }

    if (map.has(sourceImage) && map.get(sourceImage) !== sourceBatchId) {
      throw new Error(`Ambiguous source batch for screenshot ${sourceImage}.`);
    }

    map.set(sourceImage, sourceBatchId);
  }

  return map;
}

function normalizeSourceBatchId(value) {
  const text = normalizeText(value);
  return text ? normalizeBatchId(text) : null;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePromptText(value) {
  return normalizeText(value);
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]$/.test(text) ? text : null;
}

function normalizeCrop(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const left = Number(value.left);
  const top = Number(value.top);
  const width = Number(value.width);
  const height = Number(value.height);

  if (![left, top, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function resolveScreenshotPath({ lang, sourceBatchId, sourceImage }) {
  const normalizedSourceImage = normalizeText(sourceImage);
  if (!normalizedSourceImage || !sourceBatchId) {
    return null;
  }

  return path.join(ROOT, "imports", normalizeLang(lang), sourceBatchId, normalizedSourceImage);
}

function resolveCanonicalType(candidate, overrides) {
  const explicit = normalizeQuestionType(overrides.type ?? candidate?.effectiveQuestionType);
  if (explicit) {
    return explicit;
  }

  const options = buildVisibleChoices(candidate);
  if (options.length === 2 && options.every((choice) => YES_NO_VALUES.has(normalizeAnswerBody(choice.body)))) {
    return "row";
  }

  return options.length > 0 ? "mcq" : "row";
}

function normalizeQuestionType(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "row") return "row";
  if (text === "mcq") return "mcq";
  return null;
}

function normalizeAnswerBody(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseChoice(value, index) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return {
      key: String.fromCharCode(65 + index),
      fullText: null,
      body: null,
    };
  }

  const match = raw.match(/^([A-Z])(?:[\s.:：、．\)\]-]+)(.*)$/i);
  if (match) {
    return {
      key: normalizeChoiceKey(match[1]) ?? String.fromCharCode(65 + index),
      fullText: raw,
      body: String(match[2] ?? "").trim() || null,
    };
  }

  return {
    key: String.fromCharCode(65 + index),
    fullText: raw,
    body: raw,
  };
}

function buildVisibleChoices(candidate) {
  const rawOptions = Array.isArray(candidate?.optionsRawJa) ? candidate.optionsRawJa : [];
  const glossOptions = Array.isArray(candidate?.optionsGlossEn) ? candidate.optionsGlossEn : [];
  const optionCount = Math.max(rawOptions.length, glossOptions.length);
  const choices = [];

  for (let index = 0; index < optionCount; index += 1) {
    const rawChoice = parseChoice(rawOptions[index], index);
    const glossChoice = parseChoice(glossOptions[index], index);

    choices.push({
      key: rawChoice.key ?? glossChoice.key,
      rawText: rawChoice.fullText,
      rawBody: rawChoice.body,
      glossText: glossChoice.fullText,
      glossBody: glossChoice.body,
    });
  }

  return choices.filter((choice) => choice.key);
}

function buildCanonicalQuestion({ qid, number, candidate, type, canonicalPrompt, region, asset, pdf }) {
  if (type === "row") {
    const correctKey = normalizeChoiceKey(candidate?.newQuestionLocalAnswerKey);
    if (correctKey !== "A" && correctKey !== "B") {
      throw new Error(`ROW candidate ${qid} must use A/B local answer key.`);
    }

    return {
      id: qid,
      number,
      type,
      prompt: canonicalPrompt,
      options: [],
      correctRow: correctKey === "A" ? "R" : "W",
      correctOptionId: null,
      answerRaw: correctKey === "A" ? "Right" : "Wrong",
      regions: [region],
      assets: asset ? [asset] : [],
      source: { pdf },
      explanation: "",
    };
  }

  const choices = buildVisibleChoices(candidate);
  if (choices.length === 0) {
    throw new Error(`MCQ candidate ${qid} has no visible options.`);
  }

  const options = choices.map((choice, index) => ({
    id: `${qid}_o${index + 1}`,
    originalKey: choice.key,
    text: normalizePromptText(choice.glossBody ?? choice.glossText ?? choice.rawBody ?? choice.rawText) ?? choice.key,
  }));
  const correctKey = normalizeChoiceKey(candidate?.newQuestionLocalAnswerKey);
  const correctOption = options.find((option) => option.originalKey === correctKey);

  if (!correctOption) {
    throw new Error(`MCQ candidate ${qid} is missing a valid local answer key.`);
  }

  return {
    id: qid,
    number,
    type,
    prompt: canonicalPrompt,
    options,
    correctRow: null,
    correctOptionId: correctOption.id,
    answerRaw: correctOption.originalKey,
    regions: [region],
    assets: asset ? [asset] : [],
    source: { pdf },
    explanation: "",
  };
}

function buildTranslationEntry({ qid, candidate, type, sourcePrompt, canonicalQuestion }) {
  const base = {
    prompt: sourcePrompt,
    explanation: "",
    sourceMode: "direct",
    confidence: "high",
    reviewStatus: "ready",
  };

  if (type !== "mcq") {
    return base;
  }

  const choices = buildVisibleChoices(candidate);
  const correctKey = normalizeChoiceKey(candidate?.newQuestionLocalAnswerKey);
  const options = {};
  const localeOptionOrder = [];
  const optionMeaningMap = [];

  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index];
    const canonicalOption = canonicalQuestion.options[index];
    options[canonicalOption.id] = normalizePromptText(choice.rawBody ?? choice.rawText) ?? canonicalOption.text;

    const entry = {
      sourceIndex: index,
      sourceKey: choice.key,
      sourceText: choice.rawText ?? normalizePromptText(choice.rawBody) ?? choice.key,
      sourceTextBody: normalizePromptText(choice.rawBody ?? choice.rawText) ?? choice.key,
      canonicalOptionId: canonicalOption.id,
      canonicalOptionKey: canonicalOption.originalKey,
      canonicalOptionText: canonicalOption.text,
      alignmentScore: 1,
      alignmentMethod: choice.key === correctKey ? "manual-answer-key-confirmed" : "reviewed-gloss-meaning",
      manualAnswerKeyConfirmed: choice.key === correctKey ? true : undefined,
      confirmedAsCorrectKey: choice.key === correctKey ? true : undefined,
    };

    localeOptionOrder.push(entry);
    optionMeaningMap.push(entry);
  }

  return {
    ...base,
    options,
    localeOptionOrder,
    optionMeaningMap,
    localeCorrectOptionKey: correctKey,
  };
}

async function buildRegion({ screenshotPath, asset }) {
  if (asset) {
    return {
      page: 1,
      colIndex: 0,
      bbox: asset.bbox,
    };
  }

  if (!screenshotPath || !fileExists(screenshotPath)) {
    return {
      page: 1,
      colIndex: 0,
      bbox: [0, 0, 0, 0],
    };
  }

  const metadata = await sharp(screenshotPath).metadata();
  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;

  return {
    page: 1,
    colIndex: 0,
    bbox: [0, 0, width, height],
  };
}

async function maybeCreateAsset({ dataset, datasetPaths, screenshotPath, crop }) {
  if (!crop) {
    return null;
  }
  if (!screenshotPath || !fileExists(screenshotPath)) {
    throw new Error(`Screenshot not found for asset crop: ${screenshotPath ?? "unknown-path"}`);
  }

  const buffer = await sharp(screenshotPath)
    .rotate()
    .extract(crop)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();

  const hash = crypto.createHash("md5").update(buffer).digest("hex");
  const fileName = `img_${hash}.jpeg`;
  const outputPath = path.join(datasetPaths.imagesDir, fileName);

  if (!fileExists(outputPath)) {
    await fs.writeFile(outputPath, buffer);
  }

  return {
    kind: "image",
    src: `/qbank/${dataset}/images/${fileName}`,
    page: 1,
    bbox: [crop.left, crop.top, crop.left + crop.width, crop.top + crop.height],
    hash,
  };
}

function sortObjectByKey(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}
