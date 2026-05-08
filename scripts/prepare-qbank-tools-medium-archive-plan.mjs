#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  REPORTS_DIR,
  ROOT,
  ensureDir,
  fileExists,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const OLD_WORKBENCH_MS = 3 * DAY_MS;
const INCLUDE_CATEGORIES = new Set([
  "regenerable-report",
  "obsolete-preview",
  "staging-decision-archive-candidate",
]);
const HARD_EXCLUDE_CATEGORIES = new Set([
  "keep-active",
  "keep-history",
  "regenerable-cache",
  "staging-decision-current",
]);

const now = new Date();
const today = now.toISOString().slice(0, 10);
const auditPath = path.join(REPORTS_DIR, "qbank-tools-file-audit.json");
const safeFirstPlanPath = path.join(REPORTS_DIR, "qbank-tools-safe-first-archive-plan.json");
const decisionMemoryPath = path.join(ROOT, "qbank-tools", "history", "decision-memory.json");
const archiveRoot = path.join(ROOT, "qbank-tools", "generated", "archive", `medium-cleanup-${today}`);
const reportJsonPath = path.join(REPORTS_DIR, "qbank-tools-medium-archive-plan.json");
const reportMdPath = path.join(REPORTS_DIR, "qbank-tools-medium-archive-plan.md");

if (!fileExists(auditPath)) {
  throw new Error(`Missing file audit: ${relative(auditPath)}`);
}
if (!fileExists(safeFirstPlanPath)) {
  throw new Error(`Missing safe-first archive plan: ${relative(safeFirstPlanPath)}`);
}

const fileAudit = readJson(auditPath);
const safeFirstPlan = readJson(safeFirstPlanPath);
const auditFiles = Array.isArray(fileAudit?.files) ? fileAudit.files : [];
const safeFirstIncluded = new Set((Array.isArray(safeFirstPlan?.included) ? safeFirstPlan.included : [])
  .map((entry) => normalizePath(entry?.sourcePath))
  .filter(Boolean));
const decisionMemoryText = fileExists(decisionMemoryPath)
  ? fs.readFileSync(decisionMemoryPath, "utf8")
  : "";

const included = [];
const skippedDueToMemoryReference = [];
const excluded = [];

for (const auditEntry of auditFiles) {
  const sourcePath = normalizePath(auditEntry?.path);
  if (!sourcePath) {
    continue;
  }

  const absoluteSourcePath = path.join(ROOT, sourcePath);
  if (!fileExists(absoluteSourcePath)) {
    excluded.push(exclusionRecord(auditEntry, sourcePath, "source file no longer exists"));
    continue;
  }

  const stat = fs.statSync(absoluteSourcePath);
  const lastModified = stat.mtime.toISOString();
  const size = stat.size;
  const category = String(auditEntry.category ?? "unknown-review-needed");
  const referencedInDecisionMemory = isReferencedInDecisionMemory(sourcePath);
  const baseRecord = buildRecord({
    auditEntry,
    sourcePath,
    category,
    reason: String(auditEntry.reason ?? ""),
    lastModified,
    size,
    referencedInDecisionMemory,
  });

  const hardExcludeReason = hardExcludeReasonFor({
    sourcePath,
    category,
    modifiedAt: stat.mtime,
    safeFirstIncluded,
  });
  if (hardExcludeReason) {
    excluded.push({ ...baseRecord, safeToArchive: false, confidence: "high", excludeReason: hardExcludeReason });
    continue;
  }

  const include = includeReasonFor({ auditEntry, sourcePath, category, modifiedAt: stat.mtime });
  if (!include) {
    excluded.push({ ...baseRecord, safeToArchive: false, confidence: "medium", excludeReason: "not in medium archive include set" });
    continue;
  }

  if (referencedInDecisionMemory) {
    skippedDueToMemoryReference.push({
      ...baseRecord,
      category: include.category,
      reason: include.reason,
      safeToArchive: false,
      confidence: "high",
      excludeReason: "referenced in decision-memory.json",
    });
    continue;
  }

  included.push({
    ...baseRecord,
    category: include.category,
    reason: include.reason,
    safeToArchive: true,
    confidence: include.confidence,
  });
}

included.sort(sortByPath);
skippedDueToMemoryReference.sort(sortByPath);
excluded.sort(sortByPath);

const totalSize = included.reduce((sum, entry) => sum + entry.size, 0);
const top20LargestFiles = [...included].sort((left, right) => right.size - left.size).slice(0, 20);
const report = {
  generatedAt: now.toISOString(),
  dryRun: true,
  action: "archive-plan-only",
  sourceInputs: {
    fileAudit: relative(auditPath),
    safeFirstArchivePlan: relative(safeFirstPlanPath),
    decisionMemory: relative(decisionMemoryPath),
  },
  archiveDestination: relative(archiveRoot),
  rules: {
    includes: [
      "regenerable-report",
      "obsolete-preview",
      "old workbench HTML older than 3 days",
      "old batch reports that are not current",
      "staging-decision-archive-candidate only when not referenced by decision memory",
    ],
    excludes: [
      "keep-active",
      "keep-history",
      "decision-memory.json",
      "decision-memory.schema.json",
      "current staging decisions",
      "files modified in the last 24 hours",
      "files referenced in qbank-tools/history/decision-memory.json",
      "production qbank files",
      "imports/** raw batch data",
      "imports/** review-needed.json, matched.json, unresolved.json",
      "already-archived generated files",
      "cache-only cleanup candidates already covered by the safe-first plan",
    ],
  },
  summary: {
    totalFiles: included.length,
    totalSize,
    totalSizeHuman: formatBytes(totalSize),
    skippedDueToMemoryReference: skippedDueToMemoryReference.length,
    skippedDueToMemoryReferenceSize: skippedDueToMemoryReference.reduce((sum, entry) => sum + entry.size, 0),
    excludedFiles: excluded.length,
    candidatesByCategory: countBy(included, "category"),
  },
  top20LargestFiles,
  skippedDueToMemoryReference,
  candidates: included,
  excluded,
};

await ensureDir(path.dirname(reportJsonPath));
await writeJson(reportJsonPath, report);
await writeText(reportMdPath, renderMarkdown(report));

console.log(`Wrote ${relative(reportJsonPath)}`);
console.log(`Wrote ${relative(reportMdPath)}`);
console.log(`Medium archive candidates: ${report.summary.totalFiles}`);
console.log(`Total size: ${report.summary.totalSizeHuman}`);
console.log(`Skipped due to memory reference: ${report.summary.skippedDueToMemoryReference}`);
console.log("Dry run only: yes");

function hardExcludeReasonFor({ sourcePath, category, modifiedAt, safeFirstIncluded }) {
  if (HARD_EXCLUDE_CATEGORIES.has(category)) return `hard-excluded category: ${category}`;
  if (safeFirstIncluded.has(sourcePath)) return "already covered by safe-first cache-only archive plan";
  if (sourcePath.startsWith("qbank-tools/generated/archive/")) return "already under qbank-tools/generated/archive";
  if (sourcePath.startsWith("public/qbank/")) return "production qbank file";
  if (sourcePath.startsWith("imports/")) return "imports raw or batch data is excluded";
  if (/^qbank-tools\/history\/decision-memory(?:\.schema)?\.json$/.test(sourcePath)) return "decision memory file";
  if (/^qbank-tools\/generated\/staging\/.*decisions.*\.json$/.test(sourcePath)) return "current staging decisions are excluded";
  if (now.getTime() - modifiedAt.getTime() < DAY_MS) return "modified in the last 24 hours";
  return null;
}

function includeReasonFor({ auditEntry, sourcePath, category, modifiedAt }) {
  const ageMs = now.getTime() - modifiedAt.getTime();
  const isOldWorkbenchHtml = /\.html$/i.test(sourcePath)
    && /workbench/i.test(path.basename(sourcePath))
    && ageMs >= OLD_WORKBENCH_MS;
  if (isOldWorkbenchHtml) {
    return {
      category: "old-workbench-html",
      reason: "Workbench HTML is older than 3 days and not protected by hard exclusions.",
      confidence: "medium",
    };
  }

  const isOldBatchReport = isBatchReport(sourcePath) && ageMs >= OLD_WORKBENCH_MS && !isCurrentBatchReport(sourcePath);
  if (isOldBatchReport) {
    return {
      category: "old-batch-report",
      reason: "Batch report is older than 3 days and not current.",
      confidence: "medium",
    };
  }

  if (category === "staging-decision-archive-candidate") {
    return {
      category,
      reason: "Staging decision archive candidate not protected by current staging or decision-memory rules.",
      confidence: "medium",
    };
  }

  if (INCLUDE_CATEGORIES.has(category)) {
    return {
      category,
      reason: String(auditEntry.reason ?? "Generated artifact classified as medium-risk archive candidate."),
      confidence: category === "regenerable-report" ? "high" : "medium",
    };
  }

  return null;
}

function isBatchReport(sourcePath) {
  return sourcePath.startsWith("qbank-tools/generated/reports/")
    && /\.(?:json|md|html|csv)$/i.test(sourcePath)
    && /(?:^|[-_.])batch[-_]?0*\d+/i.test(path.basename(sourcePath));
}

function isCurrentBatchReport(sourcePath) {
  const name = path.basename(sourcePath).toLowerCase();
  return /batch-?15/.test(name) || /current|active|second-pass|image-replacement/.test(name);
}

function buildRecord({ auditEntry, sourcePath, category, reason, lastModified, size, referencedInDecisionMemory }) {
  return {
    sourcePath,
    archivePath: relative(path.join(archiveRoot, sourcePath)),
    category,
    reason,
    lastModified,
    size,
    referencedInDecisionMemory,
    safeToArchive: false,
    confidence: "low",
    originalCategory: auditEntry.category ?? null,
  };
}

function exclusionRecord(auditEntry, sourcePath, excludeReason) {
  return {
    sourcePath,
    archivePath: relative(path.join(archiveRoot, sourcePath)),
    category: String(auditEntry?.category ?? "unknown-review-needed"),
    reason: String(auditEntry?.reason ?? ""),
    lastModified: auditEntry?.modifiedTime ?? null,
    size: Number(auditEntry?.size ?? 0),
    referencedInDecisionMemory: isReferencedInDecisionMemory(sourcePath),
    safeToArchive: false,
    confidence: "high",
    originalCategory: auditEntry?.category ?? null,
    excludeReason,
  };
}

function isReferencedInDecisionMemory(sourcePath) {
  if (!decisionMemoryText) return false;
  const normalized = normalizePath(sourcePath);
  return decisionMemoryText.includes(normalized)
    || decisionMemoryText.includes(path.join(ROOT, normalized))
    || decisionMemoryText.includes(normalized.replace(/^qbank-tools\/generated\//, "qbank-tools/generated/archive/"));
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank Tools Medium Archive Plan", "");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Dry run: ${report.dryRun ? "yes" : "no"}`);
  lines.push(`Archive destination: ${report.archiveDestination}`);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(`- Medium archive candidates: ${report.summary.totalFiles}`);
  lines.push(`- Total size: ${report.summary.totalSizeHuman} (${report.summary.totalSize} bytes)`);
  lines.push(`- Skipped due to decision-memory reference: ${report.summary.skippedDueToMemoryReference}`);
  lines.push(`- Excluded files: ${report.summary.excludedFiles}`);
  lines.push("");
  lines.push("## Candidates By Category", "");
  lines.push(...markdownTable(Object.entries(report.summary.candidatesByCategory).map(([category, count]) => ({ category, count })), ["category", "count"]));
  lines.push("");
  lines.push("## Top 20 Largest Candidates", "");
  lines.push(...markdownTable(report.top20LargestFiles.map((entry) => ({
    sourcePath: entry.sourcePath,
    category: entry.category,
    size: entry.size,
    sizeHuman: formatBytes(entry.size),
    confidence: entry.confidence,
  })), ["sourcePath", "category", "size", "sizeHuman", "confidence"]));
  lines.push("");
  lines.push("## Skipped Due To Decision Memory", "");
  if (report.skippedDueToMemoryReference.length === 0) {
    lines.push("None.");
  } else {
    lines.push(...markdownTable(report.skippedDueToMemoryReference.slice(0, 50).map((entry) => ({
      sourcePath: entry.sourcePath,
      category: entry.category,
      size: entry.size,
    })), ["sourcePath", "category", "size"]));
    if (report.skippedDueToMemoryReference.length > 50) {
      lines.push(``, `_Truncated to first 50 of ${report.skippedDueToMemoryReference.length} files._`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function markdownTable(rows, columns) {
  if (!rows.length) return ["None."];
  const lines = [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${columns.map((column) => escapeMarkdownCell(row[column])).join(" | ")} |`);
  }
  return lines;
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function countBy(values, key) {
  const counts = {};
  for (const value of values) {
    const countKey = String(value[key] ?? "unknown");
    counts[countKey] = (counts[countKey] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sortByPath(left, right) {
  return left.sourcePath.localeCompare(right.sourcePath);
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes ?? 0);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
