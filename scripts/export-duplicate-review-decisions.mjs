#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const HISTORY_DIR = path.join(ROOT, "qbank-tools", "history");
const INPUT_PATH = path.join(STAGING_DIR, "duplicate-review-decisions.json");
const MEMORY_PATH = path.join(HISTORY_DIR, "decision-memory.json");
const REPORT_JSON_PATH = path.join(REPORTS_DIR, "duplicate-review-memory-report.json");
const REPORT_MD_PATH = path.join(REPORTS_DIR, "duplicate-review-memory-report.md");
const VALID_DECISIONS = new Set(["notDuplicate", "duplicate", "sameImageDifferentQuestion", "relatedButValid", "unsure"]);

const now = new Date().toISOString();
const input = readJson(INPUT_PATH);
const memory = readJsonIfExists(MEMORY_PATH, { meta: {}, summary: {}, records: [] });
if (!Array.isArray(memory.records)) memory.records = [];

const created = [];
const updated = [];
const skipped = [];
const index = new Map();
for (const record of memory.records) {
  if ((record.type ?? record.decisionType) !== "duplicate-detection") continue;
  const key = duplicateKey(record.dataset ?? "2023-test1", record.qid, record.pairedQid);
  if (key) index.set(key, record);
}

for (const decision of input.decisions ?? []) {
  const normalized = normalizeDecisionRecord(decision, input);
  if (!normalized) {
    skipped.push({ decision, reason: "invalid duplicate review decision" });
    continue;
  }
  const key = duplicateKey(normalized.dataset, normalized.qid, normalized.pairedQid);
  const existing = index.get(key);
  if (existing) {
    const before = JSON.stringify(existing);
    Object.assign(existing, {
      ...existing,
      ...normalized,
      id: existing.id,
      createdAt: existing.createdAt ?? normalized.createdAt,
      updatedAt: now,
      sourceFiles: unique([...(existing.sourceFiles ?? []), ...normalized.sourceFiles]),
    });
    if (JSON.stringify(existing) !== before) updated.push(existing);
    continue;
  }
  memory.records.push(normalized);
  index.set(key, normalized);
  created.push(normalized);
}

memory.meta = {
  ...(memory.meta ?? {}),
  updatedAt: now,
};
memory.summary = {
  ...(memory.summary ?? {}),
  totalRecords: memory.records.length,
  duplicateDetectionRecords: memory.records.filter((record) => (record.type ?? record.decisionType) === "duplicate-detection").length,
};

const duplicateRecords = memory.records.filter((record) => (record.type ?? record.decisionType) === "duplicate-detection");
const report = {
  generatedAt: now,
  inputPath: rel(INPUT_PATH),
  memoryPath: rel(MEMORY_PATH),
  created: created.length,
  updated: updated.length,
  skipped,
  totalDuplicateDetectionRecords: duplicateRecords.length,
  byDecision: countBy(duplicateRecords, (record) => record.decision ?? "unknown"),
  reviewedPairs: [...created, ...updated].map((record) => ({
    qid: record.qid,
    pairedQid: record.pairedQid,
    decision: record.decision,
    outcome: record.outcome,
    reason: record.reason,
    scoreAtReview: record.scoreAtReview,
    categoryAtReview: record.categoryAtReview,
  })),
};

await fsp.mkdir(HISTORY_DIR, { recursive: true });
await fsp.mkdir(REPORTS_DIR, { recursive: true });
await writeJson(MEMORY_PATH, memory);
await writeJson(REPORT_JSON_PATH, report);
await fsp.writeFile(REPORT_MD_PATH, renderMarkdown(report), "utf8");

console.log(`Wrote ${rel(MEMORY_PATH)}`);
console.log(`Wrote ${rel(REPORT_JSON_PATH)}`);
console.log(`Wrote ${rel(REPORT_MD_PATH)}`);
console.log(`Duplicate review memory created: ${created.length}`);
console.log(`Duplicate review memory updated: ${updated.length}`);

function normalizeDecisionRecord(decision, doc) {
  const qidA = safeNormalizeQid(decision.qidA);
  const qidB = safeNormalizeQid(decision.qidB);
  const reviewDecision = String(decision.decision ?? "").trim();
  if (!qidA || !qidB || qidA === qidB || !VALID_DECISIONS.has(reviewDecision)) return null;
  const [qid, pairedQid] = [qidA, qidB].sort();
  const dataset = doc.dataset ?? "2023-test1";
  return {
    id: `duplicate-detection:${dataset}:${qid}:${pairedQid}:${hash(`${dataset}:${qid}:${pairedQid}`)}`,
    type: "duplicate-detection",
    dataset,
    qid,
    pairedQid,
    decision: reviewDecision,
    outcome: outcomeFor(reviewDecision),
    reason: String(decision.reason ?? "").trim(),
    scoreAtReview: numberOrNull(decision.scoreAtReview),
    categoryAtReview: decision.categoryAtReview ?? null,
    createdAt: decision.createdAt ?? doc.generatedAt ?? now,
    updatedAt: now,
    sourceFiles: [rel(INPUT_PATH)],
  };
}

function outcomeFor(decision) {
  switch (decision) {
    case "duplicate":
      return "approved";
    case "notDuplicate":
      return "rejected";
    case "sameImageDifferentQuestion":
    case "relatedButValid":
      return "skipped";
    default:
      return "manual_review";
  }
}

function duplicateKey(dataset, qidA, qidB) {
  const left = safeNormalizeQid(qidA);
  const right = safeNormalizeQid(qidB);
  if (!left || !right || left === right) return null;
  return `${dataset}:${[left, right].sort().join("::")}`;
}

function safeNormalizeQid(value) {
  const match = String(value ?? "").match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  try {
    return readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function renderMarkdown(report) {
  const lines = [
    "# Duplicate Review Memory Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Created: ${report.created}`,
    `- Updated: ${report.updated}`,
    `- Total duplicate-detection records: ${report.totalDuplicateDetectionRecords}`,
    "",
    "## Decisions",
    "",
    "| qid | paired qid | decision | scoreAtReview | categoryAtReview | reason |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...report.reviewedPairs.map((record) =>
      `| ${record.qid} | ${record.pairedQid} | ${record.decision} | ${record.scoreAtReview ?? ""} | ${record.categoryAtReview ?? ""} | ${escapeMarkdown(record.reason)} |`,
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
