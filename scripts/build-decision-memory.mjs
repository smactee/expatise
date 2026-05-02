#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const HISTORY_DIR = path.join(ROOT, "qbank-tools", "history");
const DECISIONS_DIR = path.join(HISTORY_DIR, "decisions");
const GENERATED_DIR = path.join(ROOT, "qbank-tools", "generated");
const REPORTS_DIR = path.join(GENERATED_DIR, "reports");
const STAGING_DIR = path.join(GENERATED_DIR, "staging");
const ARCHIVE_DIR = path.join(GENERATED_DIR, "archive");
const IMPORTS_RU_DIR = path.join(ROOT, "imports", "ru");
const RU_TRANSLATIONS_PATH = path.join(ROOT, "public", "qbank", "2023-test1", "translations.ru.json");
const OUT_JSON = path.join(HISTORY_DIR, "decision-memory.json");
const OUT_MD = path.join(HISTORY_DIR, "decision-memory.md");

const files = unique([
  ...walkJsonFiles(DECISIONS_DIR),
  ...walkJsonFiles(REPORTS_DIR),
  ...walkJsonFiles(STAGING_DIR),
  ...walkJsonFiles(ARCHIVE_DIR),
  ...walkJsonFiles(IMPORTS_RU_DIR),
].filter((file) => !file.endsWith(path.join("history", "decision-memory.json"))));

const records = [];
const seen = new Set();

for (const filePath of files) {
  const doc = readJsonSafe(filePath);
  if (!doc) continue;
  collectRecordsFromFile(filePath, doc);
}

collectProductionStateRecords();

const sortedRecords = records.sort((a, b) => {
  const qidCompare = String(a.qid ?? "").localeCompare(String(b.qid ?? ""));
  if (qidCompare) return qidCompare;
  return a.id.localeCompare(b.id);
});

const summary = {
  generatedAt: new Date().toISOString(),
  totalRecords: sortedRecords.length,
  byDecisionType: countBy(sortedRecords, (record) => record.decisionType),
  bySourceSystem: countBy(sortedRecords, (record) => record.sourceSystem),
  byFinalDecision: countBy(sortedRecords, (record) => record.finalDecision),
  highRiskQids: unique(sortedRecords.filter((record) => record.tags.includes("high-risk")).map((record) => record.qid).filter(Boolean)).sort(compareQid),
  masterDataIssueQids: unique(sortedRecords.filter((record) => record.decisionType === "master-data-fix" || record.tags.includes("master-data")).map((record) => record.qid).filter(Boolean)).sort(compareQid),
  rejectedOrNeedsFixQids: unique(sortedRecords.filter((record) => ["rejected", "needs_fix"].includes(record.finalDecision)).map((record) => record.qid).filter(Boolean)).sort(compareQid),
};

const output = {
  meta: {
    generatedAt: summary.generatedAt,
    sourceRoots: [DECISIONS_DIR, REPORTS_DIR, STAGING_DIR, ARCHIVE_DIR, IMPORTS_RU_DIR, RU_TRANSLATIONS_PATH].map(rel),
    schemaVersion: 1,
  },
  summary,
  records: sortedRecords,
};

await fsp.mkdir(HISTORY_DIR, { recursive: true });
await fsp.writeFile(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
await fsp.writeFile(OUT_MD, renderMarkdown(output));

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Decision memory records: ${sortedRecords.length}`);

function collectRecordsFromFile(filePath, doc) {
  const relPath = rel(filePath);
  const basename = path.basename(filePath);
  const sourceSystem = sourceSystemFor(filePath, doc);
  const createdAt = doc.generatedAt ?? doc.meta?.generatedAt ?? null;

  if (basename === "qbank-integrity-audit.json") {
    for (const issue of [...(doc.criticalBlockers ?? []), ...(doc.warnings ?? [])].slice(0, 500)) {
      addRecord({
        qid: firstQid(issue.qid ?? issue.details?.qid),
        lang: null,
        sourceFile: relPath,
        sourceSystem: "integrity-audit",
        decisionType: issue.type?.includes("duplicate") ? "duplicate" : "master-data-fix",
        finalDecision: doc.criticalBlockers?.includes(issue) ? "needs_fix" : "manual_review",
        confidence: issue.type?.includes("duplicate") ? confidenceFromDuplicate(issue.details?.confidence) : null,
        reason: issue.reason ?? issue.type ?? "integrity audit issue",
        evidence: { issue },
        tags: ["integrity-audit", issue.type ?? "issue", ...(issue.type?.includes("raw-only") ? ["master-data"] : [])],
        createdAt,
        batch: null,
        reusableForFutureMatching: true,
      });
    }
    return;
  }

  if (basename === "backfill-quality-review.ru.json" || doc.source === "english_master_backfill_quality_review") {
    for (const item of array(doc.items)) {
      addRecord({
        qid: normalizeQid(item.qid),
        lang: doc.lang ?? "ru",
        sourceFile: relPath,
        sourceSystem: "ai-review",
        decisionType: "quality-review",
        finalDecision: normalizeFinalDecision(item.qualityStatus),
        confidence: numberOrNull(item.confidence),
        reason: item.reviewerReasoningSummary ?? firstIssue(item) ?? item.qualityStatus ?? "quality review",
        evidence: {
          issue: item.issues,
          suggestedFix: item.suggestedFix,
        },
        tags: [
          "backfill",
          ...(item.answerKeyLogicMayBeWrong ? ["answer-key-risk"] : []),
          ...(item.qualityStatus === "reject" ? ["high-risk"] : []),
        ],
        createdAt: item.reviewedAt ?? createdAt,
        batch: null,
        reusableForFutureMatching: true,
      });
    }
    return;
  }

  if (basename === "ru-ship-readiness-report.json") {
    addRecord({
      qid: null,
      lang: "ru",
      sourceFile: relPath,
      sourceSystem: "script",
      decisionType: "merge",
      finalDecision: doc.recommendation === "ship" ? "approved" : "needs_fix",
      confidence: null,
      reason: `RU ship-readiness recommendation: ${doc.recommendation}`,
      evidence: { counts: doc.counts, validation: doc.validation?.counts },
      tags: ["ship-readiness"],
      createdAt,
      batch: null,
      reusableForFutureMatching: false,
    });
    return;
  }

  if (basename === "backfill-production-merge.ru.json") {
    const items = array(doc.items ?? doc.approvedItems ?? doc.mergeItems);
    for (const item of items) {
      addRecord(recordFromGenericItem({ filePath, doc, item, sourceSystem: "production-merge", decisionType: "merge", finalDecision: doc.apply ? "merged" : "approved" }));
    }
  }

  const arrays = extractCandidateArrays(doc);
  for (const { items, path: itemPath } of arrays) {
    for (const item of items) {
      const record = recordFromGenericItem({ filePath, doc, item, sourceSystem, itemPath });
      if (record) addRecord(record);
    }
  }
}

function recordFromGenericItem({ filePath, doc, item, sourceSystem = null, itemPath = "", decisionType = null, finalDecision = null }) {
  if (!item || typeof item !== "object") return null;
  const relPath = rel(filePath);
  const qid = normalizeQid(item.qid ?? item.approvedQid ?? item.approvedExistingQid ?? item.masterQuestion?.qid ?? item.masterQuestion?.id ?? item.selectedCandidate?.qid ?? firstQid(item.id));
  const batch = item.batch ?? doc.batchId ?? doc.batch ?? batchFromPath(filePath) ?? null;
  const lang = item.lang ?? doc.lang ?? langFromPath(filePath) ?? null;
  const inferredDecisionType = decisionType ?? decisionTypeFor(filePath, item);
  const inferredFinalDecision = finalDecision ?? finalDecisionFor(item, inferredDecisionType);
  const reason = reasonFor(item, inferredDecisionType, inferredFinalDecision);
  const source = sourceSystem ?? sourceSystemFor(filePath, doc);
  const risk = String(item.riskLevel ?? item.aiReview?.riskLevel ?? "").toLowerCase();

  if (!qid && !reason && !item.id) return null;

  return {
    qid: qid || null,
    lang,
    sourceFile: relPath,
    sourceSystem: source,
    decisionType: inferredDecisionType,
    finalDecision: inferredFinalDecision,
    confidence: confidenceFor(item),
    reason,
    evidence: compactEvidence(item),
    tags: unique([
      ...(batch ? [batch] : []),
      ...(risk === "high" ? ["high-risk"] : []),
      ...(item.category ? [String(item.category)] : []),
      ...(itemPath ? [itemPath] : []),
      ...(String(reason).match(/q0518|q0934|q0264/) ? ["master-data"] : []),
    ]),
    createdAt: item.reviewedAt ?? item.generatedAt ?? doc.generatedAt ?? doc.meta?.generatedAt ?? null,
    batch,
    reusableForFutureMatching: reusableFor(inferredDecisionType, inferredFinalDecision),
  };
}

function collectProductionStateRecords() {
  const doc = readJsonSafe(RU_TRANSLATIONS_PATH);
  if (!doc?.questions) return;
  for (const [qid, entry] of Object.entries(doc.questions)) {
    if (entry?.sourceMode !== "english_master_backfill") continue;
    addRecord({
      qid: normalizeQid(qid),
      lang: "ru",
      sourceFile: rel(RU_TRANSLATIONS_PATH),
      sourceSystem: "production-merge",
      decisionType: "backfill-generation",
      finalDecision: "merged",
      confidence: confidenceFromLabel(entry.confidence),
      reason: "English-master backfill translation is present in Russian production translations.",
      evidence: {
        targetPrompt: entry.prompt,
        sourceMode: entry.sourceMode,
        reviewStatus: entry.reviewStatus,
      },
      tags: ["production", "backfill"],
      createdAt: doc.meta?.generatedAt ?? null,
      batch: null,
      reusableForFutureMatching: true,
    });
  }
}

function addRecord(record) {
  const normalized = {
    id: "",
    qid: record.qid ?? null,
    lang: record.lang ?? null,
    sourceFile: record.sourceFile,
    sourceSystem: record.sourceSystem ?? "script",
    decisionType: record.decisionType ?? "skip",
    finalDecision: record.finalDecision ?? "unknown",
    confidence: record.confidence ?? null,
    reason: truncate(record.reason ?? "No reason recorded.", 320),
    evidence: record.evidence ?? {},
    tags: unique(record.tags ?? []),
    createdAt: record.createdAt ?? null,
    batch: record.batch ?? null,
    reusableForFutureMatching: Boolean(record.reusableForFutureMatching),
  };
  normalized.id = stableId(normalized);
  if (seen.has(normalized.id)) return;
  seen.add(normalized.id);
  records.push(normalized);
}

function extractCandidateArrays(doc) {
  const out = [];
  const queue = [{ value: doc, path: "" }];
  while (queue.length) {
    const { value, path: nodePath } = queue.shift();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      if (value.some((entry) => entry && typeof entry === "object" && (entry.qid || entry.approvedQid || entry.id || entry.qualityStatus || entry.finalDecision))) {
        out.push({ items: value, path: nodePath || "items" });
      }
      continue;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (["questions", "translations"].includes(key)) continue;
      if (Array.isArray(nested)) {
        queue.push({ value: nested, path: nodePath ? `${nodePath}.${key}` : key });
      } else if (nested && typeof nested === "object" && ["items", "decisions", "records"].includes(key)) {
        queue.push({ value: nested, path: nodePath ? `${nodePath}.${key}` : key });
      }
    }
  }
  return out;
}

function decisionTypeFor(filePath, item) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("quality-review") || item.qualityStatus) return "quality-review";
  if (name.includes("answer-key") || item.localeAnswerKey || item.confirmedCorrectOptionKey) return "answer-key";
  if (name.includes("new-question") || item.createNewQuestion || item.finalDecision === "new") return "new-question";
  if (name.includes("existing-qid") || item.approvedQid || item.finalDecision === "approve") return "match";
  if (name.includes("discrepancy") && item.category === "duplicate-approval") return "duplicate";
  if (name.includes("merge") || name.includes("production")) return "merge";
  if (name.includes("backfill") || item.source === "english_master_backfill") return "backfill-generation";
  if (item.deleteQuestion) return "reject";
  if (item.keepUnresolved) return "skip";
  return "match";
}

function finalDecisionFor(item, decisionType) {
  if (item.reviewStatus === "approved" || item.qualityStatus === "approved") return "approved";
  if (item.qualityStatus === "needs_fix") return "needs_fix";
  if (item.qualityStatus === "reject" || item.deleteQuestion) return "rejected";
  if (item.applied === true || item.merged === true) return "merged";
  if (item.keepUnresolved || item.ignoreReconciliation) return "skipped";
  if (item.finalDecision) return normalizeFinalDecision(item.finalDecision);
  if (item.approvedQid || item.createNewQuestion || decisionType === "answer-key") return "approved";
  return "unknown";
}

function reasonFor(item, decisionType, finalDecision) {
  return item.reviewerNotes
    ?? item.reviewerReasoningSummary
    ?? item.aiReview?.justification
    ?? item.reason
    ?? item.skipReasons?.join("; ")
    ?? `${decisionType} ${finalDecision}`;
}

function compactEvidence(item) {
  return {
    englishPrompt: item.englishPrompt ?? item.masterQuestion?.prompt ?? item.candidate?.prompt ?? undefined,
    targetPrompt: item.generatedTranslation?.prompt ?? item.prompt ?? item.sourcePrompt ?? undefined,
    issue: item.issues ?? item.skipReasons ?? item.warning ?? undefined,
    before: item.before ?? undefined,
    after: item.after ?? item.generatedTranslation ?? undefined,
    approvedQid: item.approvedQid ?? undefined,
    candidateQids: item.candidateQids ?? item.aiReview?.bestMatches?.map((match) => match.qid) ?? undefined,
  };
}

function sourceSystemFor(filePath, doc) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("quality-review")) return "ai-review";
  if (name.includes("workbench") || name.includes("decisions")) return "manual";
  if (name.includes("notebook")) return "notebooklm";
  if (name.includes("integrity")) return "integrity-audit";
  if (name.includes("production-merge") || name.includes("merge")) return "production-merge";
  if (doc?.model || doc?.aiReviewUsed) return "ai-review";
  return "script";
}

function reusableFor(decisionType, finalDecision) {
  return !["unknown"].includes(finalDecision) && !["cleanup"].includes(decisionType);
}

function renderMarkdown(output) {
  const lines = [];
  lines.push("# Decision Memory", "");
  lines.push(`Generated: ${output.meta.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Total records: ${output.summary.totalRecords}`);
  lines.push(`- High-risk qids: ${output.summary.highRiskQids.length ? output.summary.highRiskQids.join(", ") : "none"}`);
  lines.push(`- Master-data issue qids: ${output.summary.masterDataIssueQids.length ? output.summary.masterDataIssueQids.join(", ") : "none"}`);
  lines.push(`- Rejected/needs-fix qids: ${output.summary.rejectedOrNeedsFixQids.length ? output.summary.rejectedOrNeedsFixQids.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Records By Decision Type", "");
  lines.push(...tableFromCounts(output.summary.byDecisionType));
  lines.push("");
  lines.push("## Records By Source System", "");
  lines.push(...tableFromCounts(output.summary.bySourceSystem));
  lines.push("");
  lines.push("## Reusable Matching Lessons", "");
  const reusable = output.records.filter((record) => record.reusableForFutureMatching).slice(0, 25);
  if (!reusable.length) lines.push("None.");
  else lines.push(...markdownTable(reusable.map((record) => ({ qid: record.qid, type: record.decisionType, decision: record.finalDecision, reason: record.reason })), ["qid", "type", "decision", "reason"]));
  lines.push("");
  lines.push("## Recommended Next System Improvements", "");
  lines.push("- Feed `decision-memory.json` into future matcher/reranker prompts as approved/rejected examples.");
  lines.push("- Treat master-data issue qids as preflight blockers before starting a new language.");
  lines.push("- Keep staging short-lived; promote decision JSON to history after each completed language.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(filePath));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(filePath);
  }
  return out;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function stableId(record) {
  const material = [record.sourceFile, record.qid, record.decisionType, record.finalDecision, record.reason, stableStringify(record.evidence)].join("|");
  return crypto.createHash("sha1").update(material).digest("hex");
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
}

function flattenKeys(value, out = {}) {
  if (!value || typeof value !== "object") return out;
  for (const [key, nested] of Object.entries(value)) {
    out[key] = true;
    flattenKeys(nested, out);
  }
  return out;
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item) ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function firstQid(value) {
  const match = String(value ?? "").match(/q\d{4}/i);
  return match ? normalizeQid(match[0]) : null;
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

function normalizeFinalDecision(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["approve", "approved"].includes(raw)) return "approved";
  if (["needs_fix", "needs-fix"].includes(raw)) return "needs_fix";
  if (["reject", "rejected", "delete"].includes(raw)) return "rejected";
  if (["merge", "merged"].includes(raw)) return "merged";
  if (["skip", "skipped", "keep-unresolved", "ignore"].includes(raw)) return "skipped";
  if (["fixed"].includes(raw)) return "fixed";
  if (["manual_review", "needs human review"].includes(raw)) return "manual_review";
  return raw || "unknown";
}

function confidenceFor(item) {
  return numberOrNull(item.confidence ?? item.reviewConfidence ?? item.score ?? item.aiReview?.confidence);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function confidenceFromDuplicate(value) {
  if (value === "high") return 0.95;
  if (value === "medium") return 0.7;
  if (value === "low") return 0.4;
  return null;
}

function confidenceFromLabel(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "high") return 0.9;
  if (raw === "medium") return 0.65;
  if (raw === "low") return 0.35;
  return null;
}

function firstIssue(item) {
  return Array.isArray(item.issues) ? item.issues[0]?.message : null;
}

function batchFromPath(filePath) {
  return filePath.match(/batch[-_]\d+/i)?.[0] ?? null;
}

function langFromPath(filePath) {
  const name = path.basename(filePath);
  return name.match(/(?:^|[.-])(ru|ja|ko|en)(?:[.-]|$)/)?.[1] ?? null;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function truncate(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function tableFromCounts(counts) {
  return markdownTable(Object.entries(counts).map(([key, count]) => ({ key, count })), ["key", "count"]);
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
