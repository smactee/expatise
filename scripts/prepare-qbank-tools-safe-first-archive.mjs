#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_PLAN = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-tools-archive-plan.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const OUT_JSON = path.join(REPORTS_DIR, "qbank-tools-safe-first-archive-plan.json");
const OUT_MD = path.join(REPORTS_DIR, "qbank-tools-safe-first-archive-plan.md");
const INCLUDED_CATEGORIES = new Set(["regenerable-cache", "obsolete-preview"]);
const EXCLUDED_NAME_PATTERNS = [
  /decision/i,
  /memory/i,
  /manual/i,
  /workbench/i,
  /apply/i,
];
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const sourcePlan = readJson(SOURCE_PLAN);
const included = [];
const excluded = [];

for (const item of Array.isArray(sourcePlan.planned) ? sourcePlan.planned : []) {
  const result = evaluate(item);
  if (result.include) {
    included.push({
      ...item,
      safeReason: result.reason,
    });
  } else {
    excluded.push({
      ...item,
      excludeReason: result.reason,
    });
  }
}

included.sort((left, right) => right.size - left.size || left.sourcePath.localeCompare(right.sourcePath));
excluded.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

const report = {
  generatedAt: new Date().toISOString(),
  sourcePlan: rel(SOURCE_PLAN),
  dryRunOnly: true,
  rules: {
    includeCategories: [...INCLUDED_CATEGORIES],
    excludeFilenamePatterns: EXCLUDED_NAME_PATTERNS.map((pattern) => String(pattern)),
    excludeModifiedWithinHours: 24,
  },
  summary: {
    filesIncluded: included.length,
    filesExcluded: excluded.length,
    totalSize: included.reduce((sum, item) => sum + item.size, 0),
  },
  top20LargestIncludedFiles: included.slice(0, 20),
  included,
  excluded,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Safe first archive candidates: ${report.summary.filesIncluded}`);
console.log(`Total size: ${formatBytes(report.summary.totalSize)}`);

function evaluate(item) {
  if (!INCLUDED_CATEGORIES.has(item.category)) {
    return { include: false, reason: `category ${item.category} is excluded from conservative first pass` };
  }
  const basename = path.basename(item.sourcePath);
  const matchedPattern = EXCLUDED_NAME_PATTERNS.find((pattern) => pattern.test(basename));
  if (matchedPattern) {
    return { include: false, reason: `filename matches excluded pattern ${matchedPattern}` };
  }
  if (item.category === "staging-decision-archive-candidate") {
    return { include: false, reason: "staging decision archive candidates are excluded from first pass" };
  }
  if (item.sourcePath.toLowerCase().endsWith(".html")) {
    return { include: false, reason: "generated HTML workbenches/reports are excluded from first pass" };
  }
  if (!item.safeToArchive) {
    return { include: false, reason: "source archive plan did not mark safeToArchive" };
  }
  const absolute = path.join(ROOT, item.sourcePath);
  if (!fs.existsSync(absolute)) {
    return { include: false, reason: "source file no longer exists" };
  }
  const stats = fs.statSync(absolute);
  const ageMs = now - stats.mtime.getTime();
  if (ageMs < TWENTY_FOUR_HOURS_MS) {
    return { include: false, reason: "modified within the last 24 hours" };
  }
  return { include: true, reason: `${item.category} file older than 24 hours with no decision/memory/manual/workbench/apply markers` };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank Tools Safe First Archive Plan", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push("- Dry-run only: true");
  lines.push(`- Files included: ${report.summary.filesIncluded}`);
  lines.push(`- Files excluded: ${report.summary.filesExcluded}`);
  lines.push(`- Total size: ${formatBytes(report.summary.totalSize)}`);
  lines.push("", "## Top 20 Largest Included Files", "");
  lines.push(...table(report.top20LargestIncludedFiles.map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    size: formatBytes(item.size),
    reason: item.safeReason,
  })), ["sourcePath", "category", "size", "reason"]));
  lines.push("", "## Included Files", "");
  lines.push(...table(report.included.slice(0, 300).map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    size: formatBytes(item.size),
    reason: item.safeReason,
  })), ["sourcePath", "category", "size", "reason"]));
  lines.push("", "## Excluded Files", "");
  lines.push(...table(report.excluded.slice(0, 300).map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    size: formatBytes(item.size),
    reason: item.excludeReason,
  })), ["sourcePath", "category", "size", "reason"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
