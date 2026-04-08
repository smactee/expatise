#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import OpenAI from "openai";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  batchOptionsFromArgs,
  ensureDir,
  ensurePipelineDirs,
  fileExists,
  getBatchDir,
  getBatchFiles,
  listBatchScreenshotFiles,
  normalizeLang,
  normalizeWhitespace,
  parseArgs,
  readJson,
  stableNow,
  stringArg,
  summarizeExtractionItems,
  unique,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const DEFAULT_MODEL = "gpt-4.1";
const IMAGE_DETAIL = "high";
const SYSTEM_PROMPT = `
You extract driving-test question content from a screenshot.

Return JSON only with this exact shape:
{
  "typeHint": "MCQ" | "ROW" | null,
  "hasEmbeddedQuestionImage": true | false | null,
  "promptRaw": string,
  "optionsRaw": string[],
  "correctKeyRaw": string | null,
  "correctAnswerRaw": string | null,
  "promptTranslated": string,
  "optionsTranslated": string[],
  "correctAnswerTranslated": string | null,
  "status": "success" | "partial" | "failed",
  "confidence": "high" | "medium" | "low",
  "notes": string[]
}

Rules:
- Read only what is actually visible in the screenshot.
- Do not invent missing text. If unreadable, leave the field empty or null and explain in notes.
- Preserve the screenshot language in promptRaw/optionsRaw/correct*Raw.
- Translate visible question text into concise English in promptTranslated/optionsTranslated/correctAnswerTranslated when possible.
- typeHint is MCQ only when multiple answer options are visibly present. Use ROW only for right/wrong style statements without a visible option list. Otherwise return null.
- hasEmbeddedQuestionImage should be true only when the screenshot contains a separate sign, symbol, diagram, dashboard light, or scene image that belongs to the question content.
- If the screenshot is too cropped, blurry, or incomplete, prefer status "partial" or "failed" over guessing.
- For MCQ, keep optionsRaw/optionsTranslated in visual order.
- correctKeyRaw is only for visible labels like A/B/C/D or similar. If the answer key is not visible, return null.
- correctAnswerRaw and correctAnswerTranslated are only for answers that are directly visible in the screenshot.
`.trim();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const { lang, batchId, dataset } = batchOptionsFromArgs(args);
  const batchPathArg = stringArg(args, "batch-path", null);
  const overwrite = stringArg(args, "overwrite", "true") !== "false";
  const model = stringArg(args, "model", DEFAULT_MODEL);
  const limit = Number(stringArg(args, "limit", "")) || null;

  const batchDir = batchPathArg
    ? path.resolve(process.cwd(), batchPathArg)
    : getBatchDir(lang, batchId);

  await ensurePipelineDirs({ lang, batchId });
  await ensureDir(batchDir);

  const batchFiles = batchPathArg
    ? {
        batchDir,
        intakePath: path.join(batchDir, "intake.json"),
        extractionReportPath: path.join(batchDir, "extraction-report.json"),
      }
    : getBatchFiles(lang, batchId);

  const screenshotFiles = listBatchScreenshotFiles(batchDir);
  const targetFiles = limit ? screenshotFiles.slice(0, limit) : screenshotFiles;
  const existing = loadExistingIntake(batchFiles.intakePath, lang, batchId, dataset);

  if (targetFiles.length === 0) {
    const intakeDoc = buildIntakeDocument({
      lang,
      batchId,
      dataset,
      batchDir,
      items: Array.isArray(existing.items) ? existing.items : [],
      model: null,
      extractionRunAt: stableNow(),
      extractionNotes: [
        "No screenshot files were found in the batch directory.",
        "Add image files to the batch directory and rerun extract-screenshot-intake.",
      ],
    });
    await writeJson(batchFiles.intakePath, intakeDoc);
    await writeExtractionReport(batchFiles.extractionReportPath, {
      lang,
      batchId,
      dataset,
      model: null,
      batchDir,
      items: intakeDoc.items,
    });
    console.log(`No screenshots found in ${path.relative(process.cwd(), batchDir)}. Intake metadata was refreshed.`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY ?? (await readOpenAIKeyFromDotenv());
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not found in environment or .env.local");
  }

  const client = new OpenAI({ apiKey });
  const extractedItems = [];

  for (const screenshotPath of targetFiles) {
    const relativeFile = path.relative(batchDir, screenshotPath);
    const existingItem = findExistingItem(existing.items, relativeFile);
    const extracted = await extractOneScreenshot({
      client,
      model,
      lang,
      batchDir,
      screenshotPath,
    });

    extractedItems.push(mergeIntakeItem(existingItem, extracted, { overwrite }));
  }

  const untouchedItems = existing.items.filter((item) => {
    const file = normalizeWhitespace(item.file ?? item.sourceImage ?? "");
    return file && !targetFiles.some((candidate) => path.relative(batchDir, candidate) === file);
  });

  const intakeItems = [...extractedItems, ...untouchedItems].sort((left, right) =>
    String(left.file ?? "").localeCompare(String(right.file ?? "")),
  );

  const intakeDoc = buildIntakeDocument({
    lang,
    batchId,
    dataset,
    batchDir,
    items: intakeItems,
    model,
    extractionRunAt: stableNow(),
    extractionNotes: [
      "Generated from raw screenshots with OpenAI Responses API image inputs.",
      "Low-confidence screenshots are preserved for manual review instead of forced extraction.",
    ],
  });

  await writeJson(batchFiles.intakePath, intakeDoc);
  await writeExtractionReport(batchFiles.extractionReportPath, {
    lang,
    batchId,
    dataset,
    model,
    batchDir,
    items: intakeItems,
  });
  await writeJson(path.join(REPORTS_DIR, `extract-screenshot-intake-${normalizeLang(lang)}-${batchId}.json`), {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    batchDir: path.relative(process.cwd(), batchDir),
    reportPath: path.relative(process.cwd(), batchFiles.extractionReportPath),
    intakePath: path.relative(process.cwd(), batchFiles.intakePath),
    summary: summarizeExtractionItems(intakeItems),
  });

  const summary = summarizeExtractionItems(intakeItems);
  console.log(
    `Extracted ${summary.totalScreenshots} screenshot(s): ${summary.successfullyExtracted} success, ${summary.partialExtraction} partial, ${summary.failedExtraction} failed.`,
  );
}

function loadExistingIntake(intakePath, lang, batchId, dataset) {
  if (!path.isAbsolute(intakePath) || !path.isAbsolute(path.dirname(intakePath))) {
    throw new Error(`Expected absolute intake path, received ${intakePath}`);
  }

  if (!fileExists(intakePath)) {
    return buildEmptyIntake(lang, batchId, dataset);
  }

  try {
    return readJson(intakePath);
  } catch {
    return buildEmptyIntake(lang, batchId, dataset);
  }
}

function buildEmptyIntake(lang, batchId, dataset) {
  return {
    lang,
    batchId,
    dataset,
    createdAt: null,
    extractionNotes: [],
    items: [],
  };
}

function findExistingItem(items, relativeFile) {
  return (Array.isArray(items) ? items : []).find((item) => {
    const file = normalizeWhitespace(item.file ?? item.sourceImage ?? "");
    return file === relativeFile;
  }) ?? null;
}

async function extractOneScreenshot({ client, model, lang, batchDir, screenshotPath }) {
  const relativeFile = path.relative(batchDir, screenshotPath);
  const mimeType = mimeTypeForFile(screenshotPath);
  const fileData = await fs.readFile(screenshotPath);
  const dataUrl = `data:${mimeType};base64,${fileData.toString("base64")}`;
  const userPrompt = [
    `Batch language: ${lang}`,
    `Screenshot file: ${relativeFile}`,
    "Extract the visible question text and translate it into English for matching.",
    "If the screenshot is unreadable or incomplete, return partial/failed with notes instead of guessing.",
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              { type: "input_image", image_url: dataUrl, detail: IMAGE_DETAIL },
            ],
          },
        ],
      });

      const parsed = parseJsonObject(String(response.output_text ?? "").trim());
      return normalizeExtractedItem(parsed, { file: relativeFile, lang });
    } catch (error) {
      if (attempt >= 3) {
        return fallbackFailedExtraction(relativeFile, lang, error);
      }
      await sleep(1200 * attempt);
    }
  }

  return fallbackFailedExtraction(relativeFile, lang, new Error("Unreachable extraction state"));
}

function normalizeExtractedItem(raw, { file, lang }) {
  const typeHint = normalizeTypeHint(raw?.typeHint);
  const promptRaw = normalizeWhitespace(raw?.promptRaw);
  const optionsRaw = normalizeTextArray(raw?.optionsRaw);
  const correctKeyRaw = normalizeNullableText(raw?.correctKeyRaw);
  const correctAnswerRaw = normalizeNullableText(raw?.correctAnswerRaw);
  const promptTranslated = normalizeWhitespace(raw?.promptTranslated);
  const optionsTranslated = normalizeTextArray(raw?.optionsTranslated);
  const correctAnswerTranslated = normalizeNullableText(raw?.correctAnswerTranslated);
  const confidence = normalizeConfidence(raw?.confidence);
  const notes = normalizeNotes(raw?.notes);
  const status = classifyExtractionStatus({
    status: raw?.status,
    promptRaw,
    optionsRaw,
    promptTranslated,
    typeHint,
  });

  return {
    itemId: file,
    file,
    sourceImage: file,
    lang,
    typeHint,
    questionType: typeHint,
    hasImage: normalizeBoolean(raw?.hasEmbeddedQuestionImage),
    promptRaw,
    optionsRaw,
    correctKeyRaw,
    correctAnswerRaw,
    promptTranslated,
    translatedPrompt: promptTranslated,
    optionsTranslated,
    translatedOptions: optionsTranslated,
    correctAnswerTranslated,
    translatedCorrectAnswer: correctAnswerTranslated,
    localizedPrompt: promptRaw,
    localizedOptions: optionsRaw,
    localizedCorrectAnswer: correctAnswerRaw,
    localizedExplanation: "",
    productionAssetHints: [],
    topicHints: [],
    extractionStatus: status,
    extractionConfidence: confidence,
    manualReview: status !== "success" || confidence !== "high",
    notes: notes.join(" "),
    extractionNotes: notes,
  };
}

function mergeIntakeItem(existingItem, extractedItem, { overwrite }) {
  if (!existingItem) {
    return extractedItem;
  }

  const base = { ...existingItem };
  const next = { ...extractedItem };

  if (!overwrite) {
    for (const [key, value] of Object.entries(base)) {
      if (isFilled(value)) {
        next[key] = value;
      }
    }
  } else {
    next.topicHints = Array.isArray(base.topicHints) && base.topicHints.length > 0
      ? unique([...(next.topicHints ?? []), ...base.topicHints])
      : next.topicHints;
    next.productionAssetHints = Array.isArray(base.productionAssetHints) && base.productionAssetHints.length > 0
      ? unique([...(next.productionAssetHints ?? []), ...base.productionAssetHints])
      : next.productionAssetHints;
  }

  return {
    ...base,
    ...next,
  };
}

function buildIntakeDocument({ lang, batchId, dataset, batchDir, items, model, extractionRunAt, extractionNotes }) {
  const summary = summarizeExtractionItems(items);

  return {
    lang,
    batchId,
    dataset: dataset ?? DEFAULT_DATASET,
    createdAt: null,
    extractionRunAt,
    extractionModel: model,
    extractionSourceDir: path.relative(process.cwd(), batchDir),
    extractionNotes,
    extractionSummary: summary,
    items,
  };
}

async function writeExtractionReport(reportPath, { lang, batchId, dataset, model, batchDir, items }) {
  await writeJson(reportPath, {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    model,
    batchDir: path.relative(process.cwd(), batchDir),
    summary: summarizeExtractionItems(items),
    manualReviewFiles: items
      .filter((item) => item.manualReview)
      .map((item) => ({
        file: item.file,
        extractionStatus: item.extractionStatus,
        extractionConfidence: item.extractionConfidence,
        notes: item.extractionNotes ?? [],
      })),
  });
}

function normalizeTypeHint(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MCQ" || normalized === "ROW") {
    return normalized;
  }
  return null;
}

function normalizeConfidence(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "low";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function normalizeTextArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeWhitespace(entry)).filter(Boolean)
    : [];
}

function normalizeNullableText(value) {
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) {
    const single = normalizeWhitespace(value);
    return single ? [single] : [];
  }

  return value.map((entry) => normalizeWhitespace(entry)).filter(Boolean);
}

function classifyExtractionStatus({ status, promptRaw, optionsRaw, promptTranslated, typeHint }) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "success" || normalized === "partial" || normalized === "failed") {
    return normalized;
  }

  if (typeHint === "MCQ" && promptRaw && promptTranslated && optionsRaw.length >= 2) {
    return "success";
  }

  if (typeHint === "ROW" && promptRaw && promptTranslated) {
    return "success";
  }

  if (promptRaw || promptTranslated || optionsRaw.length > 0) {
    return "partial";
  }

  return "failed";
}

function fallbackFailedExtraction(file, lang, error) {
  return {
    itemId: file,
    file,
    sourceImage: file,
    lang,
    typeHint: null,
    questionType: null,
    hasImage: null,
    promptRaw: "",
    optionsRaw: [],
    correctKeyRaw: null,
    correctAnswerRaw: null,
    promptTranslated: "",
    translatedPrompt: "",
    optionsTranslated: [],
    translatedOptions: [],
    correctAnswerTranslated: null,
    translatedCorrectAnswer: null,
    localizedPrompt: "",
    localizedOptions: [],
    localizedCorrectAnswer: null,
    localizedExplanation: "",
    productionAssetHints: [],
    topicHints: [],
    extractionStatus: "failed",
    extractionConfidence: "low",
    manualReview: true,
    notes: `Extraction failed. ${normalizeWhitespace(error?.message ?? error)}`,
    extractionNotes: [`Extraction failed. ${normalizeWhitespace(error?.message ?? error)}`],
  };
}

function isFilled(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return value !== null && value !== undefined && String(value).trim() !== "";
}

function mimeTypeForFile(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function readOpenAIKeyFromDotenv() {
  const dotenvPath = path.join(process.cwd(), ".env.local");

  try {
    const raw = await fs.readFile(dotenvPath, "utf8");
    const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
    if (!match) {
      return null;
    }
    return match[1].trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
