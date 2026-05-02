#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const ARCHIVE_DIR = path.join(ROOT, "qbank-tools", "generated", "archive");
const HISTORY_DIR = path.join(ROOT, "qbank-tools", "history");
const DECISIONS_DIR = path.join(HISTORY_DIR, "decisions");
const FINALIZED_RUNS_DIR = path.join(HISTORY_DIR, "finalized-runs");
const DATASET_DIR = path.join(ROOT, "public", "qbank", "2023-test1");

const args = parseArgs();
const lang = normalizeLang(args.lang ?? "ru");
const apply = booleanArg(args, "apply", false);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const runArchiveDir = path.join(ARCHIVE_DIR, "finalized-runs", lang, timestamp);
const manifestJsonPath = path.join(FINALIZED_RUNS_DIR, `${lang}-finalization-${timestamp}.json`);
const manifestMdPath = path.join(FINALIZED_RUNS_DIR, `${lang}-finalization-${timestamp}.md`);

const validation = buildValidation();
const plan = buildPlan();
const safeToApply = validation.readyToFinalize;
const applied = apply && safeToApply;

const manifest = {
  generatedAt: new Date().toISOString(),
  lang,
  applyRequested: apply,
  applied,
  safeToApply,
  validation,
  plan,
  results: {
    filesMovedToHistory: [],
    filesMovedToArchive: [],
    filesDeleted: [],
    filesKeptActive: plan.keepActive,
    skipped: [],
  },
};

if (apply && !safeToApply) {
  manifest.results.skipped.push({ reason: "Validation failed; no files were moved.", validation });
}

if (applied) {
  await applyPlan(manifest);
}

await fsp.mkdir(FINALIZED_RUNS_DIR, { recursive: true });
await fsp.writeFile(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
await fsp.writeFile(manifestMdPath, renderMarkdown(manifest));

console.log(`Wrote ${rel(manifestJsonPath)}`);
console.log(`Wrote ${rel(manifestMdPath)}`);
console.log(`Apply requested: ${apply ? "yes" : "no"}`);
console.log(`Safe to apply: ${safeToApply ? "yes" : "no"}`);
console.log(`Applied: ${applied ? "yes" : "no"}`);
console.log(`History moves planned/applied: ${plan.toHistory.length}/${manifest.results.filesMovedToHistory.length}`);
console.log(`Archive moves planned/applied: ${plan.toArchive.length}/${manifest.results.filesMovedToArchive.length}`);

if (apply && !safeToApply) {
  process.exitCode = 1;
}

function buildValidation() {
  const masterPath = path.join(DATASET_DIR, "questions.json");
  const translationsPath = path.join(DATASET_DIR, `translations.${lang}.json`);
  const master = questionArray(readJson(masterPath));
  const translations = translationQuestions(readJsonIfExists(translationsPath, { questions: {} }));
  const masterQids = new Set(master.map((question) => normalizeQid(question.id ?? question.qid)).filter(Boolean));
  const translationQids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
  const missingQids = [...masterQids].filter((qid) => !translationQids.has(qid)).sort(compareQid);
  const extraQids = [...translationQids].filter((qid) => !masterQids.has(qid)).sort(compareQid);
  const shipReportPath = path.join(REPORTS_DIR, `${lang}-ship-readiness-report.json`);
  const ruShipReportPath = path.join(REPORTS_DIR, "ru-ship-readiness-report.json");
  const shipReport = readJsonIfExists(fs.existsSync(shipReportPath) ? shipReportPath : ruShipReportPath, null);
  const integrityPath = path.join(REPORTS_DIR, "qbank-integrity-audit.json");
  const integrity = readJsonIfExists(integrityPath, null);
  const trackedScreenshots = trackedScreenshotFiles();
  const decisionMemory = readJsonIfExists(path.join(HISTORY_DIR, "decision-memory.json"), null);
  const criticalBlockers = Array.isArray(integrity?.criticalBlockers) ? integrity.criticalBlockers : null;
  const targetCriticalBlockers = criticalBlockers
    ? criticalBlockers.filter((issue) => isGlobalIntegrityIssue(issue) || String(issue.reason ?? "").startsWith(`${lang}:`))
    : null;

  const checks = {
    missingBackfillQids: missingQids.length,
    extraTranslationQids: extraQids.length,
    shipReadinessRecommendation: shipReport?.recommendation ?? null,
    integrityCriticalBlockers: criticalBlockers?.length ?? null,
    targetIntegrityCriticalBlockers: targetCriticalBlockers?.length ?? null,
    trackedScreenshots: trackedScreenshots.length,
    decisionMemoryRecords: decisionMemory?.summary?.totalRecords ?? decisionMemory?.records?.length ?? null,
  };

  return {
    checks,
    readyToFinalize: checks.missingBackfillQids === 0
      && checks.extraTranslationQids === 0
      && checks.shipReadinessRecommendation === "ship"
      && checks.targetIntegrityCriticalBlockers === 0
      && checks.trackedScreenshots === 0,
    missingQids,
    extraQids,
    trackedScreenshots,
    shipReportPath: shipReport ? rel(fs.existsSync(shipReportPath) ? shipReportPath : ruShipReportPath) : null,
    integrityReportPath: integrity ? rel(integrityPath) : null,
    targetCriticalBlockers: targetCriticalBlockers ?? [],
  };
}

function isGlobalIntegrityIssue(issue) {
  const reason = String(issue?.reason ?? "");
  return !/^[a-z]{2,3}:/.test(reason);
}

function buildPlan() {
  const keepActive = [
    rel(path.join(REPORTS_DIR, "ru-ship-readiness-report.json")),
    rel(path.join(REPORTS_DIR, "ru-ship-readiness-report.md")),
    rel(path.join(REPORTS_DIR, "qbank-integrity-audit.json")),
    rel(path.join(REPORTS_DIR, "qbank-integrity-audit.md")),
  ];
  const toHistory = [];
  const toArchive = [];
  const deleteJunk = [];

  for (const filePath of walkFiles(STAGING_DIR)) {
    const base = path.basename(filePath);
    if (base === ".DS_Store" || base === "") {
      deleteJunk.push(filePath);
      continue;
    }
    if (!isLangRelated(filePath, lang)) continue;
    if (isDecisionLike(filePath)) {
      toHistory.push({
        from: filePath,
        to: historyDestination(filePath),
        reason: "decision intelligence from active staging",
      });
    } else {
      toArchive.push({
        from: filePath,
        to: path.join(runArchiveDir, "staging", path.relative(STAGING_DIR, filePath)),
        reason: "regenerable staging artifact",
      });
    }
  }

  for (const filePath of walkFiles(REPORTS_DIR)) {
    const base = path.basename(filePath);
    if (keepActive.includes(rel(filePath))) continue;
    if (base === ".DS_Store") {
      deleteJunk.push(filePath);
      continue;
    }
    if (!isLangRelated(filePath, lang)) continue;
    if (isDecisionLike(filePath) && filePath.endsWith(".json")) {
      toHistory.push({
        from: filePath,
        to: historyDestination(filePath),
        reason: "decision/report intelligence",
      });
    } else {
      toArchive.push({
        from: filePath,
        to: path.join(runArchiveDir, "reports", path.relative(REPORTS_DIR, filePath)),
        reason: "regenerable report artifact",
      });
    }
  }

  return {
    toHistory: dedupeMoves(toHistory),
    toArchive: dedupeMoves(toArchive),
    deleteJunk,
    keepActive,
    archiveRoot: rel(runArchiveDir),
    manifestPaths: {
      json: rel(manifestJsonPath),
      md: rel(manifestMdPath),
    },
  };
}

async function applyPlan(manifest) {
  for (const filePath of manifest.plan.deleteJunk) {
    if (!fs.existsSync(filePath)) continue;
    await fsp.rm(filePath, { force: true });
    manifest.results.filesDeleted.push(rel(filePath));
  }

  for (const move of manifest.plan.toHistory) {
    if (!fs.existsSync(move.from)) {
      manifest.results.skipped.push({ from: rel(move.from), reason: "source missing" });
      continue;
    }
    const destination = await uniqueDestination(move.to, move.from);
    await moveFile(move.from, destination);
    manifest.results.filesMovedToHistory.push({ from: rel(move.from), to: rel(destination), reason: move.reason });
  }

  for (const move of manifest.plan.toArchive) {
    if (!fs.existsSync(move.from)) {
      manifest.results.skipped.push({ from: rel(move.from), reason: "source missing" });
      continue;
    }
    const destination = await uniqueDestination(move.to, move.from);
    await moveFile(move.from, destination);
    manifest.results.filesMovedToArchive.push({ from: rel(move.from), to: rel(destination), reason: move.reason });
  }
}

async function moveFile(from, to) {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.rename(from, to);
}

async function uniqueDestination(destination, source) {
  if (!fs.existsSync(destination)) return destination;
  if (sha256File(destination) === sha256File(source)) {
    const archivedDuplicate = `${destination}.${timestamp}.duplicate`;
    return archivedDuplicate;
  }
  const ext = path.extname(destination);
  const base = destination.slice(0, -ext.length);
  return `${base}.${timestamp}${ext}`;
}

function isLangRelated(filePath, targetLang) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes(`${targetLang}-`) || name.includes(`.${targetLang}.`) || name.includes(`${targetLang}_`)) return true;
  if (name.includes("backfill") && name.includes(targetLang)) return true;
  if (targetLang === "ru" && name.includes("russian")) return true;
  return false;
}

function isDecisionLike(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return [
    "workbench-decisions",
    "answer-key-decisions",
    "existing-qid-decisions",
    "review-decisions",
    "unresolved-decisions",
    "new-question-decisions",
    "new-question-candidates",
    "follow-up-review",
    "discrepancy-review-decisions",
    "discrepancy-review-items",
    "discrepancy-create-new-candidates",
    "discrepancy-missing-production-merge-candidates",
    "quality-review",
    "reviewed",
    "generated-draft",
    "production-merge",
    "full-batch-merge-review",
    "apply-workbench-decisions",
    "apply-answer-key-decisions",
    "apply-unresolved-decisions",
  ].some((pattern) => name.includes(pattern));
}

function historyDestination(filePath) {
  return path.join(DECISIONS_DIR, path.basename(filePath));
}

function dedupeMoves(moves) {
  const seen = new Set();
  return moves.filter((move) => {
    const key = rel(move.from);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderMarkdown(data) {
  const lines = [];
  lines.push(`# ${data.lang.toUpperCase()} Localization Run Finalization`, "");
  lines.push(`Generated: ${data.generatedAt}`, "");
  lines.push(`Apply requested: ${data.applyRequested ? "yes" : "no"}`);
  lines.push(`Applied: ${data.applied ? "yes" : "no"}`);
  lines.push(`Safe to apply: ${data.safeToApply ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Validation", "");
  for (const [key, value] of Object.entries(data.validation.checks)) {
    lines.push(`- ${key}: ${Array.isArray(value) ? value.length : value}`);
  }
  lines.push("");
  lines.push("## Planned Moves", "");
  lines.push(`- To history/decisions: ${data.plan.toHistory.length}`);
  lines.push(`- To archive: ${data.plan.toArchive.length}`);
  lines.push(`- Junk deletes: ${data.plan.deleteJunk.length}`);
  lines.push("");
  lines.push("## Applied Results", "");
  lines.push(`- Files moved to history: ${data.results.filesMovedToHistory.length}`);
  lines.push(`- Files moved to archive: ${data.results.filesMovedToArchive.length}`);
  lines.push(`- Files deleted: ${data.results.filesDeleted.length}`);
  lines.push("");
  if (data.results.filesMovedToHistory.length) {
    lines.push("### History", "");
    lines.push(...markdownTable(data.results.filesMovedToHistory, ["from", "to", "reason"]));
    lines.push("");
  }
  if (data.results.filesMovedToArchive.length) {
    lines.push("### Archive", "");
    lines.push(...markdownTable(data.results.filesMovedToArchive, ["from", "to", "reason"]));
    lines.push("");
  }
  if (data.results.skipped.length) {
    lines.push("### Skipped", "");
    lines.push(...markdownTable(data.results.skipped, ["from", "reason"]));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function trackedScreenshotFiles() {
  try {
    const output = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
    return output.split(/\r?\n/).filter((line) => line.includes("/screenshots/"));
  } catch {
    return [];
  }
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(filePath));
    else if (entry.isFile()) out.push(filePath);
  }
  return out.sort();
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions) ? doc.questions : {};
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : raw || null;
}

function compareQid(left, right) {
  const a = Number(String(left).replace(/^q/i, ""));
  const b = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
  return String(left).localeCompare(String(right));
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

function normalizeLang(value) {
  return String(value ?? "").trim().toLowerCase() || "ru";
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
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
