#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const REPORT_JSON_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-integrity-audit.json");
const REPORT_MD_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-integrity-audit.md");

const MCQ_KEYS = new Set(["A", "B", "C", "D"]);
const ROW_KEYS = new Set(["Right", "Wrong"]);
const ROW_FORBIDDEN_TRANSLATION_KEYS = new Set(["localeCorrectOptionKey", "correctOptionKey", "confirmedAsCorrectKey"]);

const args = parseArgs();
const strict = booleanArg(args, "strict", false);

const masterPath = path.join(DATASET_DIR, "questions.json");
const rawPath = path.join(DATASET_DIR, "questions.raw.json");
const tagsPath = path.join(DATASET_DIR, "tags.patch.json");
const imageTagsPath = path.join(DATASET_DIR, "image-color-tags.json");

const masterDoc = readJson(masterPath);
const rawDoc = readJson(rawPath);
const tagsPatch = readJsonIfExists(tagsPath, {});
const imageColorTags = readJsonIfExists(imageTagsPath, { questions: {} });
const translationPaths = listTranslationPaths(DATASET_DIR);

const masterQuestions = questionArray(masterDoc);
const rawQuestions = questionArray(rawDoc);
const masterByQid = questionMap(masterQuestions);
const rawByQid = questionMap(rawQuestions);
const masterQids = new Set(masterByQid.keys());
const rawQids = new Set(rawByQid.keys());

const masterRaw = auditMasterRawConsistency();
const masterAnswers = auditMasterAnswerIntegrity();
const translations = auditTranslations();
const images = auditImages();
const duplicates = auditDuplicates();
const tags = auditTags();

const criticalBlockers = [
  ...masterAnswers.invalidRowAnswers.map((issue) => critical("invalid-row-answer", issue.qid, issue.reason, issue)),
  ...masterAnswers.invalidMcqAnswers.map((issue) => critical("invalid-mcq-answer", issue.qid, issue.reason, issue)),
  ...translations.flatMap((langReport) => [
    ...langReport.invalidLocaleAnswerKeys.map((issue) => critical("invalid-locale-answer-key", issue.qid, `${langReport.lang}: ${issue.reason}`, issue)),
    ...langReport.rowTranslationsWithMcqAnswerKeys.map((issue) => critical("row-translation-mcq-answer-key", issue.qid, `${langReport.lang}: ROW translation contains MCQ answer-key metadata`, issue)),
    ...langReport.malformedObjects.map((issue) => critical("malformed-translation-object", issue.qid, `${langReport.lang}: translation entry is malformed`, issue)),
  ]),
  ...images.missingAssetReferences.map((issue) => critical("missing-image-asset", issue.qid, `Missing image asset ${issue.src}`, issue)),
];

const warnings = [
  ...masterRaw.rawOnlyQids.map((qid) => warning("raw-only-qid", qid, "qid exists in questions.raw.json but not questions.json")),
  ...masterRaw.masterOnlyQids.map((qid) => warning("master-only-qid", qid, "qid exists in questions.json but not questions.raw.json")),
  ...masterRaw.typeMismatches.map((issue) => warning("master-raw-type-mismatch", issue.qid, "question type differs between master and raw", issue)),
  ...masterRaw.optionCountMismatches.map((issue) => warning("master-raw-option-count-mismatch", issue.qid, "MCQ option count differs between master and raw", issue)),
  ...translations.flatMap((langReport) => [
    ...langReport.missingQids.map((qid) => warning("translation-missing-qid", qid, `${langReport.lang}: missing production translation`)),
    ...langReport.extraQids.map((qid) => warning("translation-extra-qid", qid, `${langReport.lang}: translation qid is not in questions.json`)),
    ...langReport.mcqMissingOptions.map((issue) => warning("translation-mcq-missing-options", issue.qid, `${langReport.lang}: translated MCQ has no options`, issue)),
    ...langReport.mcqMissingLocaleAnswerKey.map((issue) => warning("translation-mcq-missing-locale-answer-key", issue.qid, `${langReport.lang}: translated MCQ has no localeCorrectOptionKey`, issue)),
    ...langReport.emptyTextIssues.map((issue) => warning("translation-empty-text", issue.qid, `${langReport.lang}: suspicious empty text`, issue)),
  ]),
  ...tags.tagPatchQidsNotInMaster.map((qid) => warning("tags-patch-qid-not-in-master", qid, "tags.patch.json has qid not in questions.json")),
  ...tags.imageTagQidsNotInMaster.map((qid) => warning("image-tags-qid-not-in-master", qid, "image-color-tags.json has qid not in questions.json")),
  ...tags.questionsWithImageButNoImageTags.map((qid) => warning("image-question-missing-tags", qid, "question has image assets but no image color/object tag entry")),
  ...tags.questionsWithNoImageButImageTags.map((qid) => warning("image-tags-without-image", qid, "question has image tags but no master image asset")),
  ...tags.questionsWithImageButNoObjectTags.map((qid) => warning("image-question-missing-object-tags", qid, "question has image assets but no objectTags")),
  ...duplicates.candidates.filter((candidate) => candidate.confidence !== "low").map((candidate) => warning("duplicate-candidate", candidate.qids.join(","), `${candidate.confidence} confidence duplicate candidate`, candidate)),
];

const report = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET,
  sourcePaths: {
    questions: rel(masterPath),
    rawQuestions: rel(rawPath),
    tagsPatch: rel(tagsPath),
    imageColorTags: rel(imageTagsPath),
    translations: translationPaths.map(rel),
  },
  fileHashes: Object.fromEntries([masterPath, rawPath, tagsPath, imageTagsPath, ...translationPaths].map((file) => [rel(file), sha256File(file)])),
  summary: {
    masterQids: masterQids.size,
    rawQids: rawQids.size,
    translationLanguages: translations.length,
    criticalBlockers: criticalBlockers.length,
    warnings: warnings.length,
    duplicateCandidates: duplicates.candidates.length,
    missingImageAssets: images.missingAssetReferences.length,
  },
  criticalBlockers,
  warnings,
  masterRaw,
  masterAnswers,
  translations,
  images,
  duplicates,
  tags,
  recommendedNextActions: recommendedNextActions(),
};

await fsp.mkdir(path.dirname(REPORT_JSON_PATH), { recursive: true });
await fsp.writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
await fsp.writeFile(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Wrote ${rel(REPORT_JSON_PATH)}`);
console.log(`Wrote ${rel(REPORT_MD_PATH)}`);
console.log(`Critical blockers: ${criticalBlockers.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Languages audited: ${translations.map((entry) => entry.lang).join(", ") || "none"}`);

if (strict && criticalBlockers.length > 0) {
  process.exitCode = 1;
}

function auditMasterRawConsistency() {
  const masterOnlyQids = [...masterQids].filter((qid) => !rawQids.has(qid)).sort(compareQid);
  const rawOnlyQids = [...rawQids].filter((qid) => !masterQids.has(qid)).sort(compareQid);
  const typeMismatches = [];
  const optionCountMismatches = [];
  const promptMismatches = [];

  for (const qid of [...masterQids].filter((id) => rawQids.has(id)).sort(compareQid)) {
    const master = masterByQid.get(qid);
    const raw = rawByQid.get(qid);
    const masterType = questionType(master);
    const rawType = questionType(raw);
    if (masterType !== rawType) {
      typeMismatches.push({ qid, masterType, rawType });
    }
    const masterOptions = optionRecords(master);
    const rawOptions = optionRecords(raw);
    if (masterType === "mcq" || rawType === "mcq") {
      if (masterOptions.length !== rawOptions.length) {
        optionCountMismatches.push({ qid, masterOptionCount: masterOptions.length, rawOptionCount: rawOptions.length });
      }
    }
    const masterPrompt = normalizeText(master?.prompt);
    const rawPrompt = normalizeText(raw?.prompt);
    if (masterPrompt && rawPrompt && masterPrompt !== rawPrompt) {
      const distance = Math.abs(masterPrompt.length - rawPrompt.length);
      if (distance > 12 || !rawPrompt.includes(masterPrompt.slice(0, 40))) {
        promptMismatches.push({ qid, masterPrompt: truncate(master?.prompt, 140), rawPrompt: truncate(raw?.prompt, 140) });
      }
    }
  }

  return {
    masterOnlyQids,
    rawOnlyQids,
    typeMismatches,
    optionCountMismatches,
    promptMismatches: promptMismatches.slice(0, 100),
    counts: {
      masterOnlyQids: masterOnlyQids.length,
      rawOnlyQids: rawOnlyQids.length,
      typeMismatches: typeMismatches.length,
      optionCountMismatches: optionCountMismatches.length,
      promptMismatches: promptMismatches.length,
    },
  };
}

function auditMasterAnswerIntegrity() {
  const invalidRowAnswers = [];
  const invalidMcqAnswers = [];
  const mcqMissingOptions = [];

  for (const [sourceName, byQid] of [["questions.json", masterByQid], ["questions.raw.json", rawByQid]]) {
    for (const [qid, question] of byQid) {
      const type = questionType(question);
      if (type === "row") {
        const normalized = normalizeRowKey(question?.answerRaw ?? question?.correctRow);
        if (!normalized) {
          invalidRowAnswers.push({
            qid,
            sourceName,
            answerRaw: question?.answerRaw,
            correctRow: question?.correctRow,
            reason: "ROW answer is not Right/Wrong-compatible",
          });
        }
      } else {
        const options = optionRecords(question);
        if (options.length === 0) {
          mcqMissingOptions.push({ qid, sourceName, reason: "MCQ has no options" });
        }
        const key = masterCorrectOptionKey(question);
        const optionKeys = new Set(options.map((option) => option.key).filter(Boolean));
        if (!key || !optionKeys.has(key)) {
          invalidMcqAnswers.push({
            qid,
            sourceName,
            answerRaw: question?.answerRaw,
            correctOptionId: question?.correctOptionId,
            inferredCorrectOptionKey: key,
            optionKeys: [...optionKeys],
            reason: "MCQ correct answer does not resolve to an existing option key",
          });
        }
      }
    }
  }

  return {
    invalidRowAnswers,
    invalidMcqAnswers,
    mcqMissingOptions,
    counts: {
      invalidRowAnswers: invalidRowAnswers.length,
      invalidMcqAnswers: invalidMcqAnswers.length,
      mcqMissingOptions: mcqMissingOptions.length,
    },
  };
}

function auditTranslations() {
  return translationPaths.map((translationPath) => {
    const lang = path.basename(translationPath).match(/^translations\.([^.]+)\.json$/)?.[1] ?? "unknown";
    const doc = readJson(translationPath);
    const translations = translationQuestions(doc);
    const qids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
    const missingQids = [...masterQids].filter((qid) => !qids.has(qid)).sort(compareQid);
    const extraQids = [...qids].filter((qid) => !masterQids.has(qid)).sort(compareQid);
    const invalidLocaleAnswerKeys = [];
    const mcqMissingOptions = [];
    const mcqMissingLocaleAnswerKey = [];
    const localeAnswerKeyNotInOptions = [];
    const rowTranslationsWithMcqAnswerKeys = [];
    const malformedObjects = [];
    const emptyTextIssues = [];

    for (const [rawQid, entry] of Object.entries(translations)) {
      const qid = normalizeQid(rawQid);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        malformedObjects.push({ qid, valueType: Array.isArray(entry) ? "array" : typeof entry });
        continue;
      }
      const prompt = String(entry.prompt ?? entry.statement ?? "").trim();
      if (!prompt) {
        emptyTextIssues.push({ qid, field: "prompt", reason: "translation prompt/statement is empty" });
      }
      const master = masterByQid.get(qid);
      if (!master) continue;
      const type = questionType(master);
      if (type === "row") {
        const forbidden = findForbiddenRowKeys(entry);
        if (forbidden.length > 0) {
          rowTranslationsWithMcqAnswerKeys.push({ qid, forbiddenKeys: forbidden });
        }
      } else {
        const options = entry.options && typeof entry.options === "object" && !Array.isArray(entry.options) ? entry.options : null;
        if (!options || Object.keys(options).length === 0) {
          mcqMissingOptions.push({ qid, reason: "translated MCQ options object is missing or empty" });
        }
        const localeKey = normalizeMcqKey(entry.localeCorrectOptionKey);
        if (!localeKey) {
          mcqMissingLocaleAnswerKey.push({ qid, localeCorrectOptionKey: entry.localeCorrectOptionKey ?? null });
        } else if (!MCQ_KEYS.has(localeKey)) {
          invalidLocaleAnswerKeys.push({ qid, localeCorrectOptionKey: entry.localeCorrectOptionKey, reason: "localeCorrectOptionKey must be A/B/C/D" });
        } else {
          const sourceKeys = sourceOptionKeys(entry);
          if (sourceKeys.size > 0 && !sourceKeys.has(localeKey)) {
            localeAnswerKeyNotInOptions.push({ qid, localeCorrectOptionKey: localeKey, sourceKeys: [...sourceKeys].sort() });
          }
        }
        for (const [optionId, optionText] of Object.entries(options ?? {})) {
          if (String(optionText ?? "").trim() === "") {
            emptyTextIssues.push({ qid, field: `options.${optionId}`, reason: "translated option is empty" });
          }
        }
      }
    }

    return {
      lang,
      path: rel(translationPath),
      translatedQids: qids.size,
      coveragePercent: percent(qids.size, masterQids.size),
      missingQids,
      extraQids,
      invalidLocaleAnswerKeys,
      mcqMissingOptions,
      mcqMissingLocaleAnswerKey,
      localeAnswerKeyNotInOptions,
      rowTranslationsWithMcqAnswerKeys,
      malformedObjects,
      emptyTextIssues,
      counts: {
        translatedQids: qids.size,
        missingQids: missingQids.length,
        extraQids: extraQids.length,
        invalidLocaleAnswerKeys: invalidLocaleAnswerKeys.length,
        mcqMissingOptions: mcqMissingOptions.length,
        mcqMissingLocaleAnswerKey: mcqMissingLocaleAnswerKey.length,
        localeAnswerKeyNotInOptions: localeAnswerKeyNotInOptions.length,
        rowTranslationsWithMcqAnswerKeys: rowTranslationsWithMcqAnswerKeys.length,
        malformedObjects: malformedObjects.length,
        emptyTextIssues: emptyTextIssues.length,
      },
    };
  }).sort((a, b) => a.lang.localeCompare(b.lang));
}

function auditImages() {
  const assetReferences = [];
  const missingAssetReferences = [];
  const masterImageQids = new Set();

  for (const [qid, question] of masterByQid) {
    const assets = imageAssets(question);
    if (assets.length > 0) masterImageQids.add(qid);
    for (const asset of assets) {
      const src = String(asset.src ?? "");
      const filePath = resolveAssetPath(src);
      const exists = filePath ? fs.existsSync(filePath) : false;
      const record = { qid, src, path: filePath ? rel(filePath) : null, exists };
      assetReferences.push(record);
      if (!exists) missingAssetReferences.push(record);
    }
  }

  const translatedImageCompatibility = translations.map((langReport) => {
    const doc = readJson(path.join(DATASET_DIR, `translations.${langReport.lang}.json`));
    const qids = new Set(Object.keys(translationQuestions(doc)).map(normalizeQid).filter(Boolean));
    return {
      lang: langReport.lang,
      translatedQidsWithMasterImages: [...masterImageQids].filter((qid) => qids.has(qid)).length,
      untranslatedQidsWithMasterImages: [...masterImageQids].filter((qid) => !qids.has(qid)).length,
    };
  });

  return {
    masterImageQidCount: masterImageQids.size,
    assetReferenceCount: assetReferences.length,
    missingAssetReferences,
    translatedImageCompatibility,
  };
}

function auditDuplicates() {
  const groups = new Map();
  for (const [qid, question] of masterByQid) {
    const options = optionRecords(question).map((option) => normalizeText(option.text)).join("|");
    const images = imageAssets(question).map((asset) => path.basename(String(asset.src ?? ""))).sort().join("|");
    const objectTags = Array.isArray(imageColorTags?.questions?.[qid]?.objectTags)
      ? imageColorTags.questions[qid].objectTags.map(normalizeText).sort().join("|")
      : "";
    const answer = questionType(question) === "row" ? normalizeRowKey(question.answerRaw ?? question.correctRow) : masterCorrectOptionKey(question);
    const highKey = [normalizeText(question.prompt), options, answer, images].join("::");
    const mediumKey = [normalizeText(question.prompt), answer, objectTags].join("::");
    addGroup(groups, `high:${highKey}`, qid, question, "high");
    addGroup(groups, `medium:${mediumKey}`, qid, question, "medium");
  }

  const seen = new Set();
  const candidates = [];
  for (const group of groups.values()) {
    if (group.items.length < 2) continue;
    const qids = group.items.map((item) => item.qid).sort(compareQid);
    const dedupeKey = `${group.confidence}:${qids.join(",")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    candidates.push({
      confidence: group.confidence,
      qids,
      prompts: group.items.map((item) => ({ qid: item.qid, prompt: truncate(item.question.prompt, 120) })),
      answerLogic: [...new Set(group.items.map((item) => questionType(item.question) === "row" ? normalizeRowKey(item.question.answerRaw ?? item.question.correctRow) : masterCorrectOptionKey(item.question)))],
      imageRefs: [...new Set(group.items.flatMap((item) => imageAssets(item.question).map((asset) => asset.src)).filter(Boolean))],
    });
  }

  candidates.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.confidence] - rank[b.confidence] || a.qids[0].localeCompare(b.qids[0]);
  });

  return {
    candidates: candidates.slice(0, 250),
    truncated: candidates.length > 250,
    counts: {
      totalCandidates: candidates.length,
      high: candidates.filter((item) => item.confidence === "high").length,
      medium: candidates.filter((item) => item.confidence === "medium").length,
      low: candidates.filter((item) => item.confidence === "low").length,
    },
  };
}

function auditTags() {
  const tagPatchQids = new Set(Object.keys(tagsPatch ?? {}).map(normalizeQid).filter(Boolean));
  const imageTagQids = new Set(Object.keys(imageColorTags?.questions ?? {}).map(normalizeQid).filter(Boolean));
  const qidsWithImages = new Set([...masterByQid].filter(([, question]) => imageAssets(question).length > 0).map(([qid]) => qid));

  return {
    tagPatchQidsNotInMaster: [...tagPatchQids].filter((qid) => !masterQids.has(qid)).sort(compareQid),
    imageTagQidsNotInMaster: [...imageTagQids].filter((qid) => !masterQids.has(qid)).sort(compareQid),
    questionsWithImageButNoImageTags: [...qidsWithImages].filter((qid) => !imageTagQids.has(qid)).sort(compareQid),
    questionsWithNoImageButImageTags: [...imageTagQids].filter((qid) => masterQids.has(qid) && !qidsWithImages.has(qid)).sort(compareQid),
    questionsWithImageButNoObjectTags: [...qidsWithImages].filter((qid) => {
      const tags = imageColorTags?.questions?.[qid];
      return !Array.isArray(tags?.objectTags) || tags.objectTags.length === 0;
    }).sort(compareQid),
  };
}

function recommendedNextActions() {
  const actions = [];
  if (criticalBlockers.length > 0) actions.push("Resolve critical blockers before shipping or starting another language.");
  if (masterRaw.rawOnlyQids.length > 0) actions.push("Review raw-only qids and decide whether each is intentional source retention or should be removed/backfilled into questions.json.");
  if (duplicates.counts.high > 0) actions.push("Manually review high-confidence duplicate candidates; do not auto-delete.");
  if (warnings.length > 0) actions.push("Review warning tables before the next language run, especially tag/image mismatches.");
  if (actions.length === 0) actions.push("No blockers found. Run decision memory build before starting the next language.");
  return actions;
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# QBank Integrity Audit", "");
  lines.push(`Generated: ${data.generatedAt}`, "");
  lines.push("## Executive Summary", "");
  lines.push(`- Master qids: ${data.summary.masterQids}`);
  lines.push(`- Raw qids: ${data.summary.rawQids}`);
  lines.push(`- Translation languages audited: ${data.summary.translationLanguages}`);
  lines.push(`- Critical blockers: ${data.summary.criticalBlockers}`);
  lines.push(`- Warnings: ${data.summary.warnings}`);
  lines.push(`- Duplicate candidates: ${data.summary.duplicateCandidates}`);
  lines.push("");
  lines.push("## Critical Blockers", "");
  if (data.criticalBlockers.length === 0) lines.push("None.");
  else lines.push(...markdownTable(data.criticalBlockers, ["type", "qid", "reason"]));
  lines.push("");
  lines.push("## Warnings", "");
  if (data.warnings.length === 0) lines.push("None.");
  else lines.push(...markdownTable(data.warnings.slice(0, 100), ["type", "qid", "reason"]));
  if (data.warnings.length > 100) lines.push(``, `_Warning table truncated to 100 of ${data.warnings.length}._`);
  lines.push("");
  lines.push("## Language Coverage", "");
  lines.push(...markdownTable(data.translations.map((entry) => ({
    lang: entry.lang,
    translated: entry.counts.translatedQids,
    coverage: `${entry.coveragePercent}%`,
    missing: entry.counts.missingQids,
    extra: entry.counts.extraQids,
    invalidLocaleKeys: entry.counts.invalidLocaleAnswerKeys,
    rowMcqKeys: entry.counts.rowTranslationsWithMcqAnswerKeys,
  })), ["lang", "translated", "coverage", "missing", "extra", "invalidLocaleKeys", "rowMcqKeys"]));
  lines.push("");
  lines.push("## Raw/Master Mismatch", "");
  lines.push(`- qids in questions.json only: ${data.masterRaw.counts.masterOnlyQids}`);
  lines.push(`- qids in questions.raw.json only: ${data.masterRaw.counts.rawOnlyQids}${data.masterRaw.rawOnlyQids.length ? ` (${data.masterRaw.rawOnlyQids.join(", ")})` : ""}`);
  lines.push(`- type mismatches: ${data.masterRaw.counts.typeMismatches}`);
  lines.push(`- option count mismatches: ${data.masterRaw.counts.optionCountMismatches}`);
  lines.push("");
  lines.push("## Invalid Answer Tables", "");
  lines.push("### Master ROW/MCQ");
  const answerIssues = [...data.masterAnswers.invalidRowAnswers, ...data.masterAnswers.invalidMcqAnswers];
  if (answerIssues.length === 0) lines.push("None.");
  else lines.push(...markdownTable(answerIssues, ["sourceName", "qid", "reason", "answerRaw", "correctRow", "correctOptionId"]));
  lines.push("");
  lines.push("### Translation Answer Issues");
  const translationAnswerIssues = data.translations.flatMap((entry) => [
    ...entry.invalidLocaleAnswerKeys.map((issue) => ({ lang: entry.lang, ...issue })),
    ...entry.rowTranslationsWithMcqAnswerKeys.map((issue) => ({ lang: entry.lang, qid: issue.qid, reason: issue.forbiddenKeys.map((k) => k.path).join(", ") })),
  ]);
  if (translationAnswerIssues.length === 0) lines.push("None.");
  else lines.push(...markdownTable(translationAnswerIssues, ["lang", "qid", "reason", "localeCorrectOptionKey"]));
  lines.push("");
  lines.push("## Duplicate Candidate Table", "");
  if (data.duplicates.candidates.length === 0) lines.push("None.");
  else lines.push(...markdownTable(data.duplicates.candidates.slice(0, 50).map((candidate) => ({
    confidence: candidate.confidence,
    qids: candidate.qids.join(", "),
    answerLogic: candidate.answerLogic.join(", "),
    prompt: candidate.prompts[0]?.prompt ?? "",
  })), ["confidence", "qids", "answerLogic", "prompt"]));
  lines.push("");
  lines.push("## Image Asset Issues", "");
  lines.push(`- Master qids with images: ${data.images.masterImageQidCount}`);
  lines.push(`- Image asset references: ${data.images.assetReferenceCount}`);
  lines.push(`- Missing asset references: ${data.images.missingAssetReferences.length}`);
  if (data.images.missingAssetReferences.length > 0) {
    lines.push(...markdownTable(data.images.missingAssetReferences, ["qid", "src", "path"]));
  }
  lines.push("");
  lines.push("## Tag Consistency", "");
  lines.push(`- tags.patch qids not in master: ${data.tags.tagPatchQidsNotInMaster.length}`);
  lines.push(`- image-color-tags qids not in master: ${data.tags.imageTagQidsNotInMaster.length}`);
  lines.push(`- image questions missing image tags: ${data.tags.questionsWithImageButNoImageTags.length}`);
  lines.push(`- questions without images but with image tags: ${data.tags.questionsWithNoImageButImageTags.length}`);
  lines.push(`- image questions missing objectTags: ${data.tags.questionsWithImageButNoObjectTags.length}`);
  lines.push("");
  lines.push("## Recommended Next Actions", "");
  for (const action of data.recommendedNextActions) lines.push(`- ${action}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function addGroup(groups, key, qid, question, confidence) {
  if (!key || key.includes("::") && key.split("::")[0] === "") return;
  if (!groups.has(key)) groups.set(key, { confidence, items: [] });
  groups.get(key).items.push({ qid, question });
}

function findForbiddenRowKeys(value, currentPath = "") {
  if (!value || typeof value !== "object") return [];
  const out = [];
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = currentPath ? `${currentPath}.${key}` : key;
    if (ROW_FORBIDDEN_TRANSLATION_KEYS.has(key)) out.push({ path: nestedPath, value: nested });
    out.push(...findForbiddenRowKeys(nested, nestedPath));
  }
  return out;
}

function sourceOptionKeys(entry) {
  const keys = new Set();
  if (Array.isArray(entry.localeOptionOrder)) {
    for (const option of entry.localeOptionOrder) {
      const key = normalizeMcqKey(option?.sourceKey ?? option?.canonicalOptionKey);
      if (key) keys.add(key);
    }
  }
  return keys;
}

function imageAssets(question) {
  return Array.isArray(question?.assets)
    ? question.assets.filter((asset) => asset?.src && (!asset.kind || asset.kind === "image"))
    : [];
}

function resolveAssetPath(src) {
  if (!src) return null;
  if (src.startsWith("/qbank/")) return path.join(ROOT, "public", src.replace(/^\/+/, ""));
  if (src.startsWith("qbank/")) return path.join(ROOT, "public", src);
  return path.join(DATASET_DIR, "images", path.basename(src));
}

function questionMap(questions) {
  return new Map(questions.map((question) => [normalizeQid(question?.id ?? question?.qid), question]).filter(([qid]) => qid));
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions) ? doc.questions : {};
}

function questionType(question) {
  return String(question?.type ?? "").trim().toLowerCase() === "row" ? "row" : "mcq";
}

function optionRecords(question) {
  return Array.isArray(question?.options)
    ? question.options.map((option, index) => ({
        id: String(option?.id ?? "").trim(),
        key: normalizeMcqKey(option?.originalKey) ?? keyFromIndex(index),
        text: String(option?.text ?? "").trim(),
      }))
    : [];
}

function masterCorrectOptionKey(question) {
  if (questionType(question) === "row") return normalizeRowKey(question?.answerRaw ?? question?.correctRow);
  const options = optionRecords(question);
  const correctOptionId = String(question?.correctOptionId ?? "").trim();
  const byId = options.find((option) => option.id === correctOptionId);
  return byId?.key ?? normalizeMcqKey(question?.answerRaw);
}

function normalizeRowKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["r", "right", "true", "correct"].includes(raw)) return "Right";
  if (["w", "wrong", "false", "incorrect"].includes(raw)) return "Wrong";
  return null;
}

function normalizeMcqKey(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return MCQ_KEYS.has(raw) ? raw : null;
}

function keyFromIndex(index) {
  return ["A", "B", "C", "D"][index] ?? null;
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

function compareQid(left, right) {
  const a = Number(String(left).replace(/^q/i, ""));
  const b = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return String(left).localeCompare(String(right));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function listTranslationPaths(dir) {
  return fs.readdirSync(dir)
    .filter((name) => /^translations\.[^.]+\.json$/.test(name))
    .map((name) => path.join(dir, name))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseArgs() {
  const parsed = {};
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function booleanArg(source, key, fallback = false) {
  const value = source[key];
  if (value === undefined) return fallback;
  if (value === true) return true;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function percent(part, whole) {
  return whole ? Number(((part / whole) * 100).toFixed(2)) : 0;
}

function truncate(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function critical(type, qid, reason, details = {}) {
  return { type, qid, reason, details };
}

function warning(type, qid, reason, details = {}) {
  return { type, qid, reason, details };
}

function markdownTable(rows, columns) {
  if (!rows.length) return ["None."];
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escape(row[column])).join(" | ")} |`),
  ];
}
