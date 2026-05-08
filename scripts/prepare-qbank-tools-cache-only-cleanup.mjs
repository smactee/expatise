#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const AUDIT_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-tools-file-audit.json");
const SAFE_FIRST_PLAN_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-tools-safe-first-archive-plan.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const OUT_JSON = path.join(REPORTS_DIR, "qbank-tools-cache-only-cleanup-plan.json");
const OUT_MD = path.join(REPORTS_DIR, "qbank-tools-cache-only-cleanup-plan.md");
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const audit = readJson(AUDIT_PATH);
const safeFirstPlan = readJsonIfExists(SAFE_FIRST_PLAN_PATH, { included: [] });
const safeFirstSet = new Set((safeFirstPlan.included ?? []).map((item) => item.sourcePath));
const included = [];
const excluded = [];

for (const file of Array.isArray(audit.files) ? audit.files : []) {
  const result = evaluate(file);
  if (result.include) {
    included.push({
      sourcePath: file.path,
      category: file.category,
      size: file.size,
      reason: file.reason,
      exactRegenerationCommand: result.command,
      confidence: result.confidence,
      safeReason: result.reason,
    });
  } else {
    excluded.push({
      sourcePath: file.path,
      category: file.category,
      size: file.size,
      reason: result.reason,
    });
  }
}

included.sort((left, right) => right.size - left.size || left.sourcePath.localeCompare(right.sourcePath));
excluded.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

const report = {
  generatedAt: new Date().toISOString(),
  dryRunOnly: true,
  sources: {
    fileAudit: rel(AUDIT_PATH),
    safeFirstArchivePlan: rel(SAFE_FIRST_PLAN_PATH),
  },
  summary: {
    cacheOnlyCandidates: included.length,
    excludedFiles: excluded.length,
    excludedReviewFilesCount: excluded.filter((item) => isReviewFile(item.sourcePath)).length,
    totalSize: included.reduce((sum, item) => sum + item.size, 0),
  },
  included,
  excluded,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Cache-only candidates: ${report.summary.cacheOnlyCandidates}`);
console.log(`Total size: ${formatBytes(report.summary.totalSize)}`);
console.log(`Excluded review files: ${report.summary.excludedReviewFilesCount}`);

function evaluate(file) {
  if (!file?.path) return exclude("missing file path");
  if (!safeFirstSet.has(file.path) && file.category !== "regenerable-cache") {
    return exclude("not present in safe-first plan and not classified regenerable-cache");
  }
  if (file.category !== "regenerable-cache") {
    return exclude(`category ${file.category} is not cache-only`);
  }
  if (isReviewFile(file.path)) {
    return exclude("review/intermediate batch files are excluded from cache-only cleanup");
  }
  if (/(decision|memory|manual|workbench|apply)/i.test(path.basename(file.path))) {
    return exclude("filename contains excluded decision/memory/manual/workbench/apply marker");
  }
  if (!file.safeToArchive) return exclude("file audit did not mark safeToArchive");
  const absolute = path.join(ROOT, file.path);
  if (!fs.existsSync(absolute)) return exclude("source file no longer exists");
  const modifiedAge = now - fs.statSync(absolute).mtime.getTime();
  if (modifiedAge < TWENTY_FOUR_HOURS_MS) return exclude("modified within last 24 hours");

  const regeneration = regenerationInfo(file.path);
  if (!regeneration) return exclude("no exact regeneration command known");
  return {
    include: true,
    reason: `clearly regenerable cache/index; ${regeneration.reason}`,
    command: regeneration.command,
    confidence: regeneration.confidence,
  };
}

function regenerationInfo(filePath) {
  if (filePath === "qbank-tools/generated/match-index.json") {
    return { command: "npm run build-match-index", confidence: "high", reason: "build-match-index writes match-index.json" };
  }
  if (filePath === "qbank-tools/generated/match-index.ja.synthetic.json") {
    return { command: "npm run build-match-index", confidence: "high", reason: "build-match-index writes match-index.ja.synthetic.json" };
  }
  if (filePath === "qbank-tools/generated/cache/image-replacement-screenshot-descriptors.json") {
    return {
      command: "node scripts/generate-image-replacement-second-pass-workbench.mjs --reuse-cache false --force-rebuild-cache true",
      confidence: "high",
      reason: "second-pass image replacement workbench rebuilds screenshot descriptor cache",
    };
  }
  if (/^qbank-tools\/generated\/.*index.*\.json$/i.test(filePath)) {
    return { command: "inspect owning script before regenerating", confidence: "low", reason: "index-like generated JSON without exact script mapping" };
  }
  return null;
}

function isReviewFile(filePath) {
  return /imports\/.*\/batch-[^/]+\/(?:review-needed|unresolved|matched|intake)\.json$/i.test(filePath) ||
    /(?:review|workbench|decision|apply|manual|memory)/i.test(path.basename(filePath));
}

function exclude(reason) {
  return { include: false, reason };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank Tools Cache-Only Cleanup Plan", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push("- Dry-run only: true");
  lines.push(`- Cache-only candidates: ${report.summary.cacheOnlyCandidates}`);
  lines.push(`- Total size: ${formatBytes(report.summary.totalSize)}`);
  lines.push(`- Excluded review files: ${report.summary.excludedReviewFilesCount}`);
  lines.push("", "## Included Files", "");
  lines.push(...table(report.included.map((item) => ({
    sourcePath: item.sourcePath,
    size: formatBytes(item.size),
    confidence: item.confidence,
    command: item.exactRegenerationCommand,
    reason: item.safeReason,
  })), ["sourcePath", "size", "confidence", "command", "reason"]));
  lines.push("", "## Excluded Files", "");
  lines.push(...table(report.excluded.slice(0, 300).map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    size: formatBytes(item.size),
    reason: item.reason,
  })), ["sourcePath", "category", "size", "reason"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
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

function table(rows, columns) {
  if (!rows.length) return ["None."];
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => markdownCell(row[column])).join(" | ")} |`),
  ];
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
