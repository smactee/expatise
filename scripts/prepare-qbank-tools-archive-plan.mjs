#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const AUDIT_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "qbank-tools-file-audit.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const PLAN_JSON = path.join(REPORTS_DIR, "qbank-tools-archive-plan.json");
const PLAN_MD = path.join(REPORTS_DIR, "qbank-tools-archive-plan.md");
const APPLY_JSON = path.join(REPORTS_DIR, "qbank-tools-archive-apply-report.json");
const APPLY_MD = path.join(REPORTS_DIR, "qbank-tools-archive-apply-report.md");
const ARCHIVE_ROOT_REL = `qbank-tools/generated/archive/cleanup-${new Date().toISOString().slice(0, 10)}`;
const ARCHIVE_ROOT = path.join(ROOT, ARCHIVE_ROOT_REL);

const ALLOWED_CATEGORIES = new Set([
  "regenerable-report",
  "regenerable-cache",
  "obsolete-preview",
  "staging-decision-archive-candidate",
]);
const NEVER_ARCHIVE_CATEGORIES = new Set([
  "keep-active",
  "keep-history",
  "manual-review-critical",
  "unknown-review-needed",
  "staging-decision-current",
]);
const NEVER_ARCHIVE_PATHS = new Set([
  "qbank-tools/history/decision-memory.json",
  "qbank-tools/history/decision-memory.schema.json",
]);

const args = parseArgs();
const apply = booleanArg(args, "apply", false);
const audit = readJson(AUDIT_PATH);
const planned = [];
const excluded = [];

for (const file of Array.isArray(audit.files) ? audit.files : []) {
  const decision = shouldArchive(file);
  if (!decision.archive) {
    excluded.push({
      sourcePath: file.path,
      category: file.category,
      reason: decision.reason,
      size: file.size,
    });
    continue;
  }
  planned.push({
    sourcePath: file.path,
    archivePath: archivePathFor(file.path),
    category: file.category,
    reason: file.reason,
    size: file.size,
    safeToArchive: file.safeToArchive === true,
    safeToDeleteLater: file.safeToDelete === true,
  });
}

planned.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
excluded.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

const plan = {
  generatedAt: new Date().toISOString(),
  apply,
  auditPath: rel(AUDIT_PATH),
  archiveRoot: ARCHIVE_ROOT_REL,
  summary: {
    archiveCandidatesPlanned: planned.length,
    excludedFiles: excluded.length,
    totalArchiveSize: planned.reduce((sum, item) => sum + item.size, 0),
    safeToDeleteLaterCount: planned.filter((item) => item.safeToDeleteLater).length,
  },
  planned,
  excluded,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await writeJson(PLAN_JSON, plan);
await fsp.writeFile(PLAN_MD, renderMarkdown(plan, { title: "QBank Tools Archive Plan" }), "utf8");

if (apply) {
  const moved = [];
  const failed = [];
  await fsp.mkdir(ARCHIVE_ROOT, { recursive: true });
  for (const item of planned) {
    try {
      const source = path.join(ROOT, item.sourcePath);
      const target = path.join(ROOT, item.archivePath);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.rename(source, target);
      moved.push(item);
    } catch (error) {
      failed.push({ ...item, error: error.message });
    }
  }
  const applyReport = {
    ...plan,
    appliedAt: new Date().toISOString(),
    moved,
    failed,
    summary: {
      ...plan.summary,
      moved: moved.length,
      failed: failed.length,
    },
  };
  await writeJson(APPLY_JSON, applyReport);
  await fsp.writeFile(APPLY_MD, renderMarkdown(applyReport, { title: "QBank Tools Archive Apply Report" }), "utf8");
}

console.log(`Wrote ${rel(PLAN_JSON)}`);
console.log(`Wrote ${rel(PLAN_MD)}`);
console.log(`Apply: ${apply}`);
console.log(`Archive candidates planned: ${plan.summary.archiveCandidatesPlanned}`);
console.log(`Excluded files: ${plan.summary.excludedFiles}`);
console.log(`Total archive size: ${formatBytes(plan.summary.totalArchiveSize)}`);

function shouldArchive(file) {
  if (!file?.path) return { archive: false, reason: "missing file path" };
  if (NEVER_ARCHIVE_PATHS.has(file.path)) return { archive: false, reason: "explicitly protected path" };
  if (file.path.startsWith("public/qbank/")) return { archive: false, reason: "production qbank path is never archived by this tool" };
  if (file.path.includes("/images/") && file.path.startsWith("public/")) return { archive: false, reason: "production image asset is never archived by this tool" };
  if (NEVER_ARCHIVE_CATEGORIES.has(file.category)) return { archive: false, reason: `excluded category ${file.category}` };
  if (!ALLOWED_CATEGORIES.has(file.category)) return { archive: false, reason: `category ${file.category} is not in archive allow-list` };
  if (file.safeToArchive !== true) return { archive: false, reason: "audit did not mark file safeToArchive" };
  return { archive: true, reason: "allowed cleanup category and safeToArchive=true" };
}

function archivePathFor(sourcePath) {
  return `${ARCHIVE_ROOT_REL}/${sourcePath}`.split(path.sep).join("/");
}

function renderMarkdown(report, { title }) {
  const lines = [];
  lines.push(`# ${title}`, "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Apply: ${report.apply}`);
  lines.push(`- Archive root: ${report.archiveRoot}`);
  lines.push(`- Archive candidates planned: ${report.summary.archiveCandidatesPlanned}`);
  lines.push(`- Excluded files: ${report.summary.excludedFiles}`);
  lines.push(`- Total archive size: ${formatBytes(report.summary.totalArchiveSize)}`);
  lines.push(`- Safe-to-delete-later candidates: ${report.summary.safeToDeleteLaterCount}`);
  if ("moved" in report.summary) lines.push(`- Moved: ${report.summary.moved}`);
  if ("failed" in report.summary) lines.push(`- Failed: ${report.summary.failed}`);
  lines.push("", "## Planned Archive Files", "");
  lines.push(...table(report.planned.slice(0, 300).map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    size: formatBytes(item.size),
    safeToDeleteLater: item.safeToDeleteLater,
  })), ["sourcePath", "category", "size", "safeToDeleteLater"]));
  lines.push("", "## Excluded Files", "");
  lines.push(...table(report.excluded.slice(0, 200).map((item) => ({
    sourcePath: item.sourcePath,
    category: item.category,
    reason: item.reason,
  })), ["sourcePath", "category", "reason"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs() {
  const parsed = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
