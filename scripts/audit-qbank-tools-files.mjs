#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const OUT_JSON = path.join(REPORTS_DIR, "qbank-tools-file-audit.json");
const OUT_MD = path.join(REPORTS_DIR, "qbank-tools-file-audit.md");

const SCAN_ROOTS = [
  "qbank-tools/generated",
  "qbank-tools/history",
  "imports",
  "scripts",
];

const CATEGORIES = [
  "keep-active",
  "keep-history",
  "regenerable-report",
  "regenerable-cache",
  "staging-decision-current",
  "staging-decision-archive-candidate",
  "obsolete-preview",
  "manual-review-critical",
  "unknown-review-needed",
];

const files = [];
for (const scanRoot of SCAN_ROOTS) {
  const absolute = path.join(ROOT, scanRoot);
  if (!fs.existsSync(absolute)) continue;
  for (const filePath of walkFiles(absolute)) {
    const relativePath = rel(filePath);
    if (scanRoot === "imports" && !/\/batch-[^/]+\//.test(relativePath)) continue;
    const stats = fs.statSync(filePath);
    files.push({
      path: relativePath,
      ...classify(relativePath),
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
    });
  }
}

files.sort((left, right) => left.category.localeCompare(right.category) || left.path.localeCompare(right.path));

const countsByCategory = Object.fromEntries(CATEGORIES.map((category) => [
  category,
  files.filter((file) => file.category === category).length,
]));
const summary = {
  generatedAt: new Date().toISOString(),
  filesAudited: files.length,
  countsByCategory,
  keepActiveCount: countsByCategory["keep-active"],
  keepHistoryCount: countsByCategory["keep-history"],
  archiveCandidates: files.filter((file) => file.safeToArchive).length,
  deleteCandidates: files.filter((file) => file.safeToDelete).length,
  unknownReviewNeededCount: countsByCategory["unknown-review-needed"],
  totalBytes: files.reduce((sum, file) => sum + file.size, 0),
};

const report = {
  generatedAt: summary.generatedAt,
  scanRoots: SCAN_ROOTS,
  summary,
  files,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Files audited: ${summary.filesAudited}`);
console.log(`keep-active: ${summary.keepActiveCount}`);
console.log(`keep-history: ${summary.keepHistoryCount}`);
console.log(`archive candidates: ${summary.archiveCandidates}`);
console.log(`delete candidates: ${summary.deleteCandidates}`);
console.log(`unknown-review-needed: ${summary.unknownReviewNeededCount}`);

function classify(filePath) {
  const base = path.basename(filePath);
  const lower = filePath.toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (base === ".DS_Store" || lower.endsWith("/.ds_store")) {
    return entry("regenerable-cache", "macOS metadata file.", "delete", true, true, false);
  }

  if (lower.startsWith("scripts/")) {
    return entry("keep-active", "Repository automation script.", "keep in repo", false, false, true);
  }

  if (lower === "qbank-tools/history/decision-memory.json" || lower === "qbank-tools/history/decision-memory.schema.json") {
    return entry("keep-history", "Core normalized decision memory store/schema.", "keep in history", false, false, true);
  }

  if (lower.startsWith("qbank-tools/history/")) {
    if (isDecisionIntelligence(lower) || lower.includes("/finalized-runs/") || lower.endsWith("match-history.jsonl") || lower.endsWith("qid-feature-store.json") || lower.endsWith("correction-rules.json")) {
      return entry("keep-history", "Historical decision or matching intelligence.", "keep in history", false, false, true);
    }
    return entry("unknown-review-needed", "History file did not match a known intelligence pattern.", "review manually", false, false, true);
  }

  if (lower.startsWith("qbank-tools/generated/cache/")) {
    return entry("regenerable-cache", "Generated cache artifact.", "archive or delete if space is needed", true, true, false);
  }

  if (lower.startsWith("qbank-tools/generated/archive/")) {
    return entry("regenerable-report", "Already archived generated artifact.", "keep archived or prune later with explicit retention policy", true, false, false);
  }

  if (lower.startsWith("qbank-tools/generated/staging/")) {
    if (isDecisionIntelligence(lower)) {
      const active = isCurrentStagingDecision(lower);
      return active
        ? entry("staging-decision-current", "Current active staging decision/review artifact.", "keep active until workflow completes", false, false, true)
        : entry("staging-decision-archive-candidate", "Decision-like staging artifact that should be promoted to history after workflow completion.", "move to qbank-tools/history/decisions when finalized", true, false, true);
    }
    if (isPreviewOrDryRun(lower)) {
      return entry("obsolete-preview", "Staging preview/dry-run output is regenerable.", "archive after confirming no active workflow depends on it", true, false, false);
    }
    return entry("unknown-review-needed", "Staging file does not match known decision or preview patterns.", "review manually", false, false, false);
  }

  if (lower.startsWith("qbank-tools/generated/reports/")) {
    if (lower.includes("/image-replacement-second-pass-assets/") || lower.includes("/image-replacement-workbench-assets/")) {
      return entry("regenerable-report", "Generated report preview image asset.", "archive or regenerate with workbench", true, true, false);
    }
    if (isManualReviewCritical(lower)) {
      return entry("manual-review-critical", "Report/workbench may contain active manual review or exported decision context.", "keep until manually finalized", false, false, true);
    }
    if (isApplyOrShipReport(lower)) {
      return entry("keep-history", "Apply/ship/audit report documents production or release state.", "preserve in history or active reports", true, false, true);
    }
    if ([".html", ".json", ".md", ".csv"].includes(ext)) {
      return entry("regenerable-report", "Generated report output.", "archive when no longer actively referenced", true, false, false);
    }
    return entry("unknown-review-needed", "Generated report with unrecognized extension/pattern.", "review manually", false, false, false);
  }

  if (lower.startsWith("qbank-tools/generated/")) {
    if (base.includes("match-index") || base.includes("asset-rename")) {
      return entry("regenerable-cache", "Generated index/rename helper output.", "regenerate from scripts when needed", true, false, false);
    }
    return entry("unknown-review-needed", "Generated file outside standard report/staging/cache/archive folders.", "review manually", false, false, false);
  }

  if (lower.startsWith("imports/") && /\/batch-[^/]+\//.test(lower)) {
    if (lower.includes("/screenshots/")) {
      return entry("regenerable-cache", "Raw imported screenshot artifact; should stay untracked/local or archived.", "archive locally; do not commit", true, true, false);
    }
    if (isDecisionIntelligence(lower)) {
      return entry("keep-history", "Import batch decision/intelligence file.", "preserve in history/decisions if batch is complete", true, false, true);
    }
    if (/(intake|matched|review-needed|unresolved|diagnostic|manifest)\.json$/.test(lower)) {
      return entry("obsolete-preview", "Batch processing intermediate; valuable only while batch is active.", "archive after batch completion", true, false, false);
    }
    return entry("unknown-review-needed", "Import batch file with unknown role.", "review manually", false, false, false);
  }

  return entry("unknown-review-needed", "No classification rule matched.", "review manually", false, false, false);
}

function entry(category, reason, recommendedAction, safeToArchive, safeToDelete, neededForFutureMemory) {
  return {
    category,
    reason,
    recommendedAction,
    safeToArchive,
    safeToDelete,
    neededForFutureMemory,
  };
}

function isDecisionIntelligence(lower) {
  return /(?:workbench-decisions|answer-key-decisions|existing-qid-decisions|review-decisions|unresolved-decisions|new-question-decisions|new-question-candidates|follow-up-review|duplicate-review-decisions|image-replacement.*decisions|backfill\.[^.]+\.reviewed|backfill\.[^.]+\.needs-fix|generated-draft|decision-memory|quality-review)/.test(lower);
}

function isCurrentStagingDecision(lower) {
  return /(?:image-replacement.*decisions|duplicate-review-decisions|backfill\.ja\.)/.test(lower);
}

function isPreviewOrDryRun(lower) {
  return /(?:preview|dry-run|merge-dry-run|validation|missing-qids|cache|diagnostic)/.test(lower);
}

function isManualReviewCritical(lower) {
  return /(?:workbench|review-workbench|image-tag-review|duplicate-candidate-audit|new-question-promotion-review)/.test(lower);
}

function isApplyOrShipReport(lower) {
  return /(?:apply-report|production-merge|ship-readiness|qbank-integrity-audit|decision-memory-report|quality-review|backfill-production-merge|tag-intelligence-report|missing-image-object-tags-backfill|duplicate-review-memory-report)/.test(lower);
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(filePath));
    } else if (entry.isFile()) {
      out.push(filePath);
    }
  }
  return out;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank Tools File Audit", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Files audited: ${report.summary.filesAudited}`);
  lines.push(`- keep-active: ${report.summary.keepActiveCount}`);
  lines.push(`- keep-history: ${report.summary.keepHistoryCount}`);
  lines.push(`- archive candidates: ${report.summary.archiveCandidates}`);
  lines.push(`- delete candidates: ${report.summary.deleteCandidates}`);
  lines.push(`- unknown-review-needed: ${report.summary.unknownReviewNeededCount}`);
  lines.push(`- total size: ${formatBytes(report.summary.totalBytes)}`);
  lines.push("", "## Counts By Category", "");
  lines.push(...table(Object.entries(report.summary.countsByCategory).map(([category, count]) => ({ category, count })), ["category", "count"]));
  lines.push("", "## Unknown Review Needed", "");
  lines.push(...table(report.files.filter((file) => file.category === "unknown-review-needed").slice(0, 200).map(summaryRow), ["path", "size", "reason", "recommendedAction"]));
  lines.push("", "## Archive Candidates", "");
  lines.push(...table(report.files.filter((file) => file.safeToArchive).slice(0, 200).map(summaryRow), ["path", "category", "size", "recommendedAction"]));
  lines.push("", "## Delete Candidates", "");
  lines.push(...table(report.files.filter((file) => file.safeToDelete).slice(0, 200).map(summaryRow), ["path", "category", "size", "recommendedAction"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summaryRow(file) {
  return {
    path: file.path,
    category: file.category,
    size: formatBytes(file.size),
    reason: file.reason,
    recommendedAction: file.recommendedAction,
  };
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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
