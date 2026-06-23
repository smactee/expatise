#!/usr/bin/env node
/**
 * verify-intake-binding.mjs
 *
 * File<->pixel integrity gate for screenshot intake.
 *
 * The extractor (extract-screenshot-intake.mjs) is per-image and stamps each
 * result with the filename it read. But screenshot files can be re-copied /
 * deduped AFTER extraction, which silently desyncs intake.promptRaw from the
 * pixels now on disk (observed: zh batch-004 14.32.17 <-> 14.32.18 swapped).
 *
 * This gate re-reads each screenshot with a MINIMAL vision call (just the
 * in-app question number + the question's first line), and:
 *   1. flags any item whose actual prompt does not match intake.promptRaw
 *   2. flags any break in the strictly-increasing question-number ordering
 *      (files are timestamp-named == capture order == question order)
 *
 * It does NOT mutate intake. It writes a report; fixes are applied separately.
 *
 * Usage: node scripts/verify-intake-binding.mjs --lang zh --batch batch-004
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import OpenAI from "openai";

import {
  REPORTS_DIR,
  batchOptionsFromArgs,
  getBatchDir,
  getBatchFiles,
  normalizeLang,
  normalizeWhitespace,
  parseArgs,
  readJson,
  stableNow,
  stringArg,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const MODEL = "gpt-4.1";
const IMAGE_DETAIL = "high";
const CONCURRENCY = 6;
const SIMILARITY_FLOOR = 0.5; // below this => treat as a content mismatch

const SYSTEM_PROMPT = [
  "You are a precise OCR transcriber for a Chinese driving-test quiz app.",
  "Given one app screenshot, return ONLY a compact JSON object:",
  '{"questionNumber": <integer shown at the bottom as "N / 1325", or null if absent>,',
  ' "prompt": "<the main question text exactly as written, first line is enough, no options>"}',
  "Transcribe the prompt verbatim in the original language. Do not translate. Do not guess.",
].join("\n");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const { lang, batchId } = batchOptionsFromArgs(args);
  const limit = Number.parseInt(stringArg(args, "limit", "0"), 10) || 0; // 0 = all
  const batchDir = getBatchDir(lang, batchId);
  const batchFiles = getBatchFiles(lang, batchId);

  const intake = await readJson(batchFiles.intakePath);
  const items = (intake.items ?? []).filter((it) => it.file || it.sourceImage);
  const targets = limit > 0 ? items.slice(0, limit) : items;

  const apiKey = await readOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not found in env or .env.local");
  const client = new OpenAI({ apiKey });

  console.log(
    `Verifying ${targets.length} item(s) for ${lang}/${batchId} against pixels...`,
  );

  const results = await runPool(targets, CONCURRENCY, async (item, idx) => {
    const rel = normalizeWhitespace(item.file ?? item.sourceImage ?? "");
    const abs = path.resolve(batchDir, rel);
    let actual;
    try {
      actual = await ocrScreenshot(client, abs);
    } catch (error) {
      return {
        index: idx,
        file: rel,
        error: String(error?.message ?? error),
      };
    }
    const intakePrompt = normalizeWhitespace(item.promptRaw ?? "");
    const sim = similarity(normPrompt(actual.prompt), normPrompt(intakePrompt));
    return {
      index: idx,
      file: rel,
      questionNumber: actual.questionNumber,
      actualPrompt: actual.prompt,
      intakePrompt,
      similarity: Number(sim.toFixed(3)),
      promptMismatch: sim < SIMILARITY_FLOOR,
    };
  });

  results.sort((a, b) => a.index - b.index);

  // Ordering check: question numbers should strictly increase in array order
  // (array is filename-sorted == capture order). A drop or duplicate is a flag.
  const orderingBreaks = [];
  let prev = null;
  let prevFile = null;
  for (const r of results) {
    if (typeof r.questionNumber === "number") {
      if (prev !== null && r.questionNumber <= prev) {
        orderingBreaks.push({
          file: r.file,
          prevFile,
          questionNumber: r.questionNumber,
          previousNumber: prev,
        });
      }
      prev = r.questionNumber;
      prevFile = r.file;
    }
  }

  const mismatches = results.filter((r) => r.promptMismatch);
  const errors = results.filter((r) => r.error);

  const report = {
    generatedAt: stableNow(),
    lang,
    batchId,
    model: MODEL,
    totalChecked: results.length,
    promptMismatchCount: mismatches.length,
    orderingBreakCount: orderingBreaks.length,
    errorCount: errors.length,
    promptMismatches: mismatches.map((m) => ({
      file: m.file,
      questionNumber: m.questionNumber,
      similarity: m.similarity,
      actualPrompt: m.actualPrompt,
      intakePrompt: m.intakePrompt,
    })),
    orderingBreaks,
    errors,
    results,
  };

  const outPath = path.join(
    REPORTS_DIR,
    `verify-intake-binding-${normalizeLang(lang)}-${batchId}.json`,
  );
  await writeJson(outPath, report);

  console.log(
    `Checked ${report.totalChecked}: ${report.promptMismatchCount} prompt mismatch, ` +
      `${report.orderingBreakCount} ordering break, ${report.errorCount} error(s).`,
  );
  if (mismatches.length) {
    console.log("\nPROMPT MISMATCHES (file -> actual vs intake):");
    for (const m of mismatches) {
      console.log(
        `  ${m.file} [Q${m.questionNumber ?? "?"}] sim=${m.similarity}\n` +
          `    actual: ${snippet(m.actualPrompt)}\n` +
          `    intake: ${snippet(m.intakePrompt)}`,
      );
    }
  }
  if (orderingBreaks.length) {
    console.log("\nORDERING BREAKS:");
    for (const b of orderingBreaks) {
      console.log(`  ${b.file} Q${b.questionNumber} after ${b.prevFile} Q${b.previousNumber}`);
    }
  }
  console.log(`\nReport: ${path.relative(process.cwd(), outPath)}`);
}

async function ocrScreenshot(client, absPath) {
  const bytes = await fs.readFile(absPath);
  const mime = absPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model: MODEL,
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Transcribe this screenshot." },
              { type: "input_image", image_url: dataUrl, detail: IMAGE_DETAIL },
            ],
          },
        ],
      });
      const parsed = parseJsonObject(String(response.output_text ?? "").trim());
      const qn = parsed.questionNumber;
      return {
        questionNumber: Number.isFinite(Number(qn)) ? Number(qn) : null,
        prompt: normalizeWhitespace(String(parsed.prompt ?? "")),
      };
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(1000 * attempt);
    }
  }
  throw new Error("unreachable");
}

// --- helpers ---

function normPrompt(s) {
  return String(s ?? "")
    .replace(/[\s]+/g, "")
    .replace(/[？?。．.，,、；;：:！!（）()【】\[\]"'""'']/g, "");
}

// Sorensen-Dice over character bigrams; robust to minor OCR noise.
function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ma = bigrams(a);
  const mb = bigrams(b);
  let overlap = 0;
  for (const [g, ca] of ma) {
    const cb = mb.get(g) ?? 0;
    overlap += Math.min(ca, cb);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function snippet(s) {
  const t = String(s ?? "");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

async function runPool(items, concurrency, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function spin() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await worker(items[i], i);
      if ((i + 1) % 10 === 0) console.log(`  ...${i + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, spin));
  return out;
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

async function readOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
    return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
