#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MEMORY_PATH = path.join(ROOT, "qbank-tools", "history", "decision-memory.json");
const args = parseArgs(process.argv.slice(2));
const memory = readJson(MEMORY_PATH);
const records = Array.isArray(memory.records) ? memory.records : [];

const filtered = records.filter((record) => {
  if (args.qid && normalizeQid(record.qid) !== normalizeQid(args.qid)) return false;
  if (args.type && getType(record) !== args.type) return false;
  if (args.outcome && getOutcome(record) !== args.outcome) return false;
  if (args.hasNotes === "true" && !hasNotes(record)) return false;
  if (args.hasNotes === "false" && hasNotes(record)) return false;
  return true;
});

console.log(`Decision memory matches: ${filtered.length}`);
for (const record of filtered.slice(0, Number(args.limit ?? 50))) {
  console.log(renderRecord(record));
}
if (filtered.length > Number(args.limit ?? 50)) {
  console.log(`... ${filtered.length - Number(args.limit ?? 50)} more. Use --limit to show more.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Unable to read ${path.relative(ROOT, filePath)}: ${error.message}`);
    process.exitCode = 1;
    return { records: [] };
  }
}

function renderRecord(record) {
  const lines = [
    "",
    `- id: ${record.id}`,
    `  type: ${getType(record) ?? "unknown"}`,
    `  qid: ${record.qid ?? "none"}`,
    `  outcome: ${getOutcome(record) ?? "unknown"}`,
  ];
  const fields = [
    ["decision", record.decision ?? record.finalDecision],
    ["operation", record.operation],
    ["dataset", record.dataset],
    ["language", record.language ?? record.lang],
    ["source", record.source ?? record.sourceSystem],
    ["approvedSourcePath", record.approvedSourcePath],
    ["approvedPreviewPath", record.approvedPreviewPath],
    ["finalAssetPath", record.finalAssetPath],
    ["previousAssetPath", record.previousAssetPath],
    ["referencedQid", record.referencedQid],
    ["referencedImagePath", record.referencedImagePath],
    ["candidateScore", record.candidateScore],
    ["validationStatus", record.validationStatus],
    ["reviewerNotes", record.reviewerNotes],
    ["reason", record.reason],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`  ${label}: ${formatValue(value)}`);
  }
  if (Array.isArray(record.warnings) && record.warnings.length) {
    lines.push(`  warnings: ${record.warnings.join(" | ")}`);
  }
  if (Array.isArray(record.errors) && record.errors.length) {
    lines.push(`  errors: ${record.errors.join(" | ")}`);
  }
  if (Array.isArray(record.sourceFiles) && record.sourceFiles.length) {
    lines.push(`  sourceFiles: ${record.sourceFiles.join(", ")}`);
  } else if (record.sourceFile) {
    lines.push(`  sourceFile: ${record.sourceFile}`);
  }
  return lines.join("\n");
}

function getType(record) {
  return record.type ?? record.decisionType ?? null;
}

function getOutcome(record) {
  return record.outcome ?? record.finalDecision ?? null;
}

function hasNotes(record) {
  return hasText(record.reviewerNotes) || hasText(record.reason) || hasText(record.notes);
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function normalizeQid(value) {
  if (value == null) return null;
  const match = String(value).match(/q?(\d{1,4})/i);
  if (!match) return null;
  return `q${match[1].padStart(4, "0")}`;
}

function formatValue(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return JSON.stringify(value);
}
