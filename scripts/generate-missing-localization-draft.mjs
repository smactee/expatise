#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import {
  BACKFILL_SOURCE,
  backfillPaths,
  generatedOptionsSkeleton,
  normalizeLang,
  parseLimit,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  booleanArg,
  fileExists,
  parseArgs,
  readJson,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const SYSTEM_PROMPT = `
You translate English driving-test questions into Russian for a localization backfill.

English master is the source of truth.

Non-negotiable rules:
- Return JSON only.
- Preserve every qid exactly.
- Translate into natural, exam-appropriate Russian.
- Preserve answer logic exactly.
- Preserve option keys exactly. Do not reorder, remap, rename, or omit options.
- Preserve all numbers, distances, speed limits, penalties, dates, vehicle categories, road signs, dashboard symbols, and legal thresholds exactly.
- Do not add details that are not in the English source.
- For ROW / true-false questions, translate the statement only. Do not add answer options.
- For MCQ, translate every option text, keyed by the exact option id supplied.
- If the English explanation is empty, return an empty explanation string.
- Use consistent Russian driving/legal terminology. If meaning is uncertain, keep a warning rather than guessing.
- All items still require human review.
`.trim();

const args = parseArgs();
const lang = normalizeLang(args.lang);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const limit = parseLimit(args.limit);
const apply = booleanArg(args, "apply", false);
const noAi = booleanArg(args, "no-ai", false);
const model = String(args.model ?? "gpt-5-mini").trim() || "gpt-5-mini";
const batchSize = parseBatchSize(args["batch-size"] ?? 10);
const paths = backfillPaths({ lang, dataset, input: args.input });
const inputPath = args.input ? paths.generatedDraftPath : paths.missingItemsPath;

if (!fileExists(inputPath)) {
  throw new Error(`Backfill input not found: ${relative(inputPath)}`);
}

const inputDoc = readJson(inputPath);
const sourceItems = Array.isArray(inputDoc?.items) ? inputDoc.items : [];
const items = limit ? sourceItems.slice(0, limit) : sourceItems;
const apiKey = noAi ? null : process.env.OPENAI_API_KEY ?? (await readOpenAIKeyFromDotenv());
const client = apiKey ? new OpenAI({ apiKey }) : null;
const generatedItems = client
  ? await generateWithOpenAI({ client, model, lang, items, batchSize })
  : items.map((item) => placeholderItem(item, {
      provider: null,
      model: null,
      warning: noAi
        ? "AI generation disabled by --no-ai true; no translation text was produced."
        : "OPENAI_API_KEY not found in environment or .env.local; no translation text was produced.",
    }));

const generatedCount = generatedItems.filter((item) => item.generationStatus === "generated").length;
const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: BACKFILL_SOURCE,
    lang,
    dataset,
    applyRequested: apply,
    aiGenerationUsed: Boolean(client),
    generationModel: client ? model : null,
    productionModified: false,
    inputPath: relative(inputPath),
    outputPath: relative(paths.generatedDraftPath),
    limit,
    batchSize,
    note: client
      ? "Generated from English master. All items still require human review before merge."
      : "No AI generation was available; output contains fail-closed placeholders only.",
  },
  counts: {
    inputItems: sourceItems.length,
    emittedItems: generatedItems.length,
    generatedItems: generatedCount,
    notGeneratedItems: generatedItems.length - generatedCount,
  },
  items: generatedItems,
};

await writeJson(paths.generatedDraftPath, output);

console.log(`Wrote ${relative(paths.generatedDraftPath)}`);
console.log(`Draft items: ${generatedItems.length}`);
console.log(`AI generation used: ${client ? "yes" : "no"}`);
console.log(`Generated translations: ${generatedCount}`);
console.log("Production translations modified: no");

async function generateWithOpenAI({ client, model, lang, items, batchSize }) {
  const out = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    try {
      const parsed = await translateBatch({ client, model, lang, batch });
      const byQid = new Map(parsed.items.map((item) => [String(item.qid ?? "").trim(), item]));
      for (const sourceItem of batch) {
        const generated = byQid.get(sourceItem.qid);
        if (!generated) {
          out.push(placeholderItem(sourceItem, {
            provider: "openai",
            model,
            warning: "OpenAI response omitted this qid; no trusted translation was produced.",
          }));
          continue;
        }
        out.push(normalizeGeneratedItem(sourceItem, generated, { provider: "openai", model }));
      }
    } catch (error) {
      for (const sourceItem of batch) {
        out.push(placeholderItem(sourceItem, {
          provider: "openai",
          model,
          warning: `OpenAI generation failed for this batch: ${error.message ?? error}`,
        }));
      }
    }
  }
  return out;
}

async function translateBatch({ client, model, lang, batch }) {
  const payload = batch.map((item) => ({
    qid: item.qid,
    number: item.number,
    type: item.type,
    topic: item.topic ?? null,
    subtopic: item.subtopic ?? null,
    imageContext: {
      image: item.image ?? null,
      objectTags: item.objectTags ?? [],
      colorTags: item.imageTags?.colorTags ?? [],
    },
    correctOptionKey: item.correctOptionKey,
    englishPrompt: item.englishPrompt,
    englishOptions: item.englishOptions ?? [],
    englishExplanation: item.englishExplanation ?? "",
  }));
  const prompt = [
    `Target language: ${lang}`,
    "Translate this batch.",
    "Return this exact JSON shape:",
    '{ "items": [ { "qid": "q0001", "prompt": "Russian text", "options": { "q0001_o1": "Russian option" }, "explanation": "", "warnings": [] } ] }',
    "",
    JSON.stringify({ items: payload }, null, 2),
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
            content: [{ type: "input_text", text: prompt }],
          },
        ],
      });
      const parsed = parseJsonObject(String(response.output_text ?? "").trim());
      validateBatchResponse(batch, parsed);
      return parsed;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`Generation retry ${attempt} failed: ${error.message ?? error}`);
      await sleep(1200 * attempt);
    }
  }

  throw new Error("Unreachable generation retry state");
}

function validateBatchResponse(batch, parsed) {
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("Response JSON is missing an items array");
  }
  const expectedQids = new Set(batch.map((item) => item.qid));
  const responseQids = new Set(parsed.items.map((item) => String(item?.qid ?? "").trim()));
  for (const qid of expectedQids) {
    if (!responseQids.has(qid)) {
      throw new Error(`Response is missing qid ${qid}`);
    }
  }
  for (const item of parsed.items) {
    const qid = String(item?.qid ?? "").trim();
    if (!expectedQids.has(qid)) {
      throw new Error(`Response included unexpected qid ${qid}`);
    }
  }
}

function normalizeGeneratedItem(sourceItem, generated, { provider, model }) {
  const expectedOptions = Array.isArray(sourceItem.englishOptions) ? sourceItem.englishOptions : [];
  const responseOptions = generated?.options && typeof generated.options === "object" && !Array.isArray(generated.options)
    ? generated.options
    : {};
  const options = {};
  const warnings = Array.isArray(generated?.warnings) ? generated.warnings.map((entry) => String(entry)).filter(Boolean) : [];
  let complete = true;

  for (const option of expectedOptions) {
    const value = String(responseOptions[option.id] ?? "").trim();
    options[option.id] = value;
    if (!value) {
      complete = false;
      warnings.push(`Missing generated option text for ${option.id}.`);
    }
  }

  const prompt = String(generated?.prompt ?? "").trim();
  if (!prompt) {
    complete = false;
    warnings.push("Missing generated prompt.");
  }

  const explanation = sourceItem.englishExplanation
    ? String(generated?.explanation ?? "").trim()
    : "";
  if (sourceItem.englishExplanation && !explanation) {
    warnings.push("English explanation exists but generated explanation is empty.");
  }

  return baseGeneratedItem(sourceItem, {
    generatedTranslation: { prompt, options, explanation },
    generationStatus: complete ? "generated" : "partial",
    provider,
    model,
    warnings,
  });
}

function placeholderItem(sourceItem, { provider, model, warning }) {
  return baseGeneratedItem(sourceItem, {
    generatedTranslation: {
      prompt: "",
      options: generatedOptionsSkeleton(sourceItem),
      explanation: "",
    },
    generationStatus: "not_generated",
    provider,
    model,
    warnings: [warning],
  });
}

function baseGeneratedItem(sourceItem, { generatedTranslation, generationStatus, provider, model, warnings }) {
  return {
    qid: sourceItem.qid,
    number: sourceItem.number,
    source: BACKFILL_SOURCE,
    lang,
    type: sourceItem.type,
    topic: sourceItem.topic ?? null,
    subtopic: sourceItem.subtopic ?? null,
    tags: sourceItem.tags ?? null,
    image: sourceItem.image ?? null,
    imageAssets: sourceItem.imageAssets ?? [],
    imageTags: sourceItem.imageTags ?? null,
    objectTags: sourceItem.objectTags ?? [],
    englishPrompt: sourceItem.englishPrompt,
    englishOptions: sourceItem.englishOptions ?? [],
    englishExplanation: sourceItem.englishExplanation ?? "",
    correctOptionKey: sourceItem.correctOptionKey,
    generatedTranslation,
    generationStatus,
    generationProvider: provider,
    generationModel: model,
    needsHumanReview: true,
    reviewStatus: "pending",
    warnings,
  };
}

async function readOpenAIKeyFromDotenv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), fileName), "utf8");
      const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Try the next conventional env file.
    }
  }
  return null;
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function parseBatchSize(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 25) {
    throw new Error(`Invalid --batch-size: ${value}. Use 1-25.`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relative(filePath) {
  return filePath.replace(`${process.cwd()}/`, "");
}
