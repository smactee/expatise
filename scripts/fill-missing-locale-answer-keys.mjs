#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const MASTER_PATH = path.join(DATASET_DIR, "questions.json");
const KO_TRANSLATIONS_PATH = path.join(DATASET_DIR, "translations.ko.json");
const REPORT_JSON_PATH = path.join(
  ROOT,
  "qbank-tools",
  "generated",
  "reports",
  "fill-missing-locale-answer-keys.ko.json"
);
const REPORT_MD_PATH = path.join(
  ROOT,
  "qbank-tools",
  "generated",
  "reports",
  "fill-missing-locale-answer-keys.ko.md"
);

const MCQ_KEYS = new Set(["A", "B", "C", "D"]);
const args = parseArgs(process.argv.slice(2));
const apply = booleanArg(args.apply);
const generatedAt = new Date().toISOString();

const masterDoc = await readJson(MASTER_PATH);
const koDoc = await readJson(KO_TRANSLATIONS_PATH);
const masterQuestions = questionArray(masterDoc);
const translations = translationQuestions(koDoc);
const masterByQid = new Map(
  masterQuestions
    .map((question) => [normalizeQid(question?.id ?? question?.qid), question])
    .filter(([qid]) => qid)
);

const nextQuestions = {};
const changedQids = [];
const skipped = [];
let mcqEntriesScanned = 0;
let alreadyHadLocaleCorrectOptionKey = 0;

for (const [rawQid, entry] of Object.entries(translations)) {
  const qid = normalizeQid(rawQid);
  const nextEntry = cloneJson(entry);
  nextQuestions[rawQid] = nextEntry;

  if (!nextEntry || typeof nextEntry !== "object" || Array.isArray(nextEntry)) {
    skipped.push({ qid, reason: "translation entry is not an object" });
    continue;
  }

  const masterQuestion = masterByQid.get(qid);
  if (!masterQuestion) {
    skipped.push({ qid, reason: "qid not found in English master questions.json" });
    continue;
  }

  if (questionType(masterQuestion) !== "mcq") {
    continue;
  }

  mcqEntriesScanned += 1;

  if (hasLocaleCorrectOptionKey(nextEntry)) {
    alreadyHadLocaleCorrectOptionKey += 1;
    continue;
  }

  const inference = inferLocaleCorrectOptionKey(masterQuestion, nextEntry);
  if (!inference.safe) {
    skipped.push({ qid, reason: inference.reason });
    continue;
  }

  nextEntry.localeCorrectOptionKey = inference.localeCorrectOptionKey;
  changedQids.push(qid);
}

const report = {
  generatedAt,
  dataset: DATASET,
  lang: "ko",
  mode: apply ? "apply" : "dry-run",
  applyRequested: apply,
  productionModified: apply && changedQids.length > 0,
  sourcePaths: {
    masterQuestions: relative(MASTER_PATH),
    koTranslations: relative(KO_TRANSLATIONS_PATH),
  },
  reportPaths: {
    json: relative(REPORT_JSON_PATH),
    markdown: relative(REPORT_MD_PATH),
  },
  counts: {
    totalKoEntriesScanned: Object.keys(translations).length,
    mcqEntriesScanned,
    alreadyHadLocaleCorrectOptionKey,
    filledCount: changedQids.length,
    skippedCount: skipped.length,
  },
  changedQids: changedQids.sort(compareQid),
  skippedQids: skipped.sort((left, right) => compareQid(left.qid, right.qid)),
};

if (apply && changedQids.length > 0) {
  await writeJson(KO_TRANSLATIONS_PATH, {
    ...koDoc,
    questions: nextQuestions,
  });
}

await writeJson(REPORT_JSON_PATH, report);
await writeText(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Wrote ${relative(REPORT_JSON_PATH)}`);
console.log(`Wrote ${relative(REPORT_MD_PATH)}`);
console.log(`Mode: ${report.mode}`);
console.log(`KO entries scanned: ${report.counts.totalKoEntriesScanned}`);
console.log(`MCQ entries scanned: ${report.counts.mcqEntriesScanned}`);
console.log(`Already had localeCorrectOptionKey: ${report.counts.alreadyHadLocaleCorrectOptionKey}`);
console.log(`Filled: ${report.counts.filledCount}`);
console.log(`Skipped: ${report.counts.skippedCount}`);
console.log(`Production translations modified: ${report.productionModified ? "yes" : "no"}`);

function inferLocaleCorrectOptionKey(masterQuestion, translationEntry) {
  const masterOptions = optionRecords(masterQuestion);
  const masterCorrectKey = masterCorrectOptionKey(masterQuestion);
  if (!masterCorrectKey) {
    return { safe: false, reason: "master correct option key could not be resolved" };
  }

  if (!translationEntry.options || typeof translationEntry.options !== "object" || Array.isArray(translationEntry.options)) {
    return { safe: false, reason: "translated options object is missing" };
  }

  const localizedOptionIds = Object.keys(translationEntry.options);
  const masterOptionIds = masterOptions.map((option) => option.id);
  if (masterOptionIds.length === 0) {
    return { safe: false, reason: "master MCQ options are missing" };
  }

  if (localizedOptionIds.length !== masterOptionIds.length) {
    return { safe: false, reason: "localized option count differs from master option count" };
  }

  for (const [index, masterOptionId] of masterOptionIds.entries()) {
    if (localizedOptionIds[index] !== masterOptionId) {
      return { safe: false, reason: "localized option ids/order differ from master" };
    }
    if (String(translationEntry.options[masterOptionId] ?? "").trim() === "") {
      return { safe: false, reason: `localized option text is empty for ${masterOptionId}` };
    }
  }

  return {
    safe: true,
    localeCorrectOptionKey: masterCorrectKey,
    reason: "localized option ids/order match master",
  };
}

function hasLocaleCorrectOptionKey(entry) {
  return normalizeMcqKey(entry?.localeCorrectOptionKey) !== null;
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
  const options = optionRecords(question);
  const correctOptionId = String(question?.correctOptionId ?? "").trim();
  const byId = options.find((option) => option.id === correctOptionId);
  return byId?.key ?? normalizeMcqKey(question?.correctOptionKey ?? question?.answerRaw);
}

function questionType(question) {
  return String(question?.type ?? "").trim().toLowerCase() === "row" ? "row" : "mcq";
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions)
    ? doc.questions
    : {};
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

function normalizeMcqKey(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return MCQ_KEYS.has(raw) ? raw : null;
}

function keyFromIndex(index) {
  return ["A", "B", "C", "D"][index] ?? null;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      out[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function booleanArg(value) {
  if (value === true) return true;
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# KO Missing Locale Answer Key Fill Report", "");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Mode: ${data.mode}`);
  lines.push(`Production translations modified: ${data.productionModified ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(`- Total KO entries scanned: ${data.counts.totalKoEntriesScanned}`);
  lines.push(`- MCQ entries scanned: ${data.counts.mcqEntriesScanned}`);
  lines.push(`- Already had localeCorrectOptionKey: ${data.counts.alreadyHadLocaleCorrectOptionKey}`);
  lines.push(`- Filled count: ${data.counts.filledCount}`);
  lines.push(`- Skipped count: ${data.counts.skippedCount}`);
  lines.push("");
  lines.push("## Changed QIDs", "");
  lines.push(data.changedQids.length ? data.changedQids.join(", ") : "None.");
  lines.push("");
  lines.push("## Skipped QIDs", "");
  if (data.skippedQids.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| QID | Reason |", "| --- | --- |");
    for (const item of data.skippedQids) {
      lines.push(`| ${item.qid} | ${escapeMarkdownCell(item.reason)} |`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function compareQid(left, right) {
  const a = Number(String(left).replace(/^q/i, ""));
  const b = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return String(left).localeCompare(String(right));
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
