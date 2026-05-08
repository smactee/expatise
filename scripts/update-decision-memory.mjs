#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const HISTORY_DIR = path.join(ROOT, "qbank-tools", "history");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");

const MEMORY_PATH = path.join(HISTORY_DIR, "decision-memory.json");
const REPORT_JSON_PATH = path.join(REPORTS_DIR, "decision-memory-report.json");
const REPORT_MD_PATH = path.join(REPORTS_DIR, "decision-memory-report.md");

const SOURCE_PATHS = [
  path.join(STAGING_DIR, "image-replacement-decisions-2023-test1.json"),
  path.join(STAGING_DIR, "image-replacement-second-pass-decisions.json"),
  path.join(STAGING_DIR, "image-replacement-decisions.merged.json"),
  path.join(REPORTS_DIR, "image-replacement-apply-report.json"),
];

const RECOMMENDED_INTEGRATION_POINTS = [
  "generate-image-replacement-workbench should downrank previously rejected candidates.",
  "generate-image-replacement-second-pass-workbench should boost previously approved similar candidates.",
  "duplicate detection should use referencedQid and reuse-existing-qid-image entries as reuse signals.",
  "future localization matching should use previous final decisions as high-confidence labels.",
  "objectTags and reviewer notes should become reusable search and ranking signals.",
];

const now = new Date().toISOString();
const memory = loadMemory();
const initialRecordCount = memory.records.length;
const existingKeys = new Set();
const index = new Map();
const mergeStats = {
  created: 0,
  updated: 0,
  unchanged: 0,
};

for (const record of memory.records) {
  const key = dedupeKey(record);
  if (!key) continue;
  existingKeys.add(key);
  if (!index.has(key)) index.set(key, record);
}

const imports = [];
for (const sourcePath of SOURCE_PATHS) {
  const doc = readJsonSafe(sourcePath);
  if (!doc) {
    imports.push({ sourceFile: rel(sourcePath), exists: false, imported: 0 });
    continue;
  }
  const before = imports.length;
  const records = normalizeSourceDoc(sourcePath, doc);
  imports.push({ sourceFile: rel(sourcePath), exists: true, imported: records.length });
  for (const record of records) {
    mergeRecord(record);
  }
  if (imports.length === before) {
    imports.push({ sourceFile: rel(sourcePath), exists: true, imported: 0 });
  }
}

const imageReplacementRecords = memory.records.filter((record) => record.type === "image-replacement");
const phase6Summary = {
  updatedAt: now,
  schemaVersion: 2,
  totalRecords: memory.records.length,
  previousTotalRecords: initialRecordCount,
  imageReplacementRecords: imageReplacementRecords.length,
  imageReplacementByOutcome: countBy(imageReplacementRecords, (record) => record.outcome ?? "unknown"),
  imageReplacementByOperation: countBy(imageReplacementRecords, (record) => record.operation ?? "unknown"),
  imageReplacementWithReviewerNotes: imageReplacementRecords.filter((record) => hasText(record.reviewerNotes)).length,
  imageReplacementWithWarnings: imageReplacementRecords.filter((record) => array(record.warnings).length > 0).length,
  imageReplacementWithErrors: imageReplacementRecords.filter((record) => array(record.errors).length > 0).length,
};

memory.meta = {
  ...(memory.meta ?? {}),
  updatedAt: now,
  phase6DecisionMemorySchemaVersion: 2,
};
memory.summary = {
  ...(memory.summary ?? {}),
  totalRecords: memory.records.length,
  phase6DecisionMemory: phase6Summary,
};

const report = {
  generatedAt: now,
  memoryPath: rel(MEMORY_PATH),
  reportPaths: {
    json: rel(REPORT_JSON_PATH),
    markdown: rel(REPORT_MD_PATH),
  },
  imports,
  created: mergeStats.created,
  updated: mergeStats.updated,
  unchanged: mergeStats.unchanged,
  summary: phase6Summary,
  recommendedIntegrationPoints: RECOMMENDED_INTEGRATION_POINTS,
};

await writeJson(MEMORY_PATH, memory);
await writeJson(REPORT_JSON_PATH, report);
await writeText(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Decision memory: ${rel(MEMORY_PATH)}`);
console.log(`Report: ${rel(REPORT_JSON_PATH)}`);
console.log(`Created: ${mergeStats.created}`);
console.log(`Updated: ${mergeStats.updated}`);
console.log(`Image replacement records: ${imageReplacementRecords.length}`);

function loadMemory() {
  const existing = readJsonSafe(MEMORY_PATH);
  if (existing && Array.isArray(existing.records)) return existing;
  return {
    meta: {
      createdAt: now,
      schemaVersion: 2,
    },
    summary: {},
    records: [],
  };
}

function normalizeSourceDoc(sourcePath, doc) {
  const relPath = rel(sourcePath);
  const basename = path.basename(sourcePath);
  const generatedAt = doc.generatedAt ?? doc.mergedAt ?? now;
  const dataset = doc.dataset ?? "2023-test1";

  if (basename === "image-replacement-apply-report.json") {
    return array(doc.entries).map((entry) => normalizeApplyEntry({ entry, doc, sourcePath: relPath, generatedAt, dataset }));
  }

  return Object.entries(doc.decisions ?? {}).map(([qid, decision]) =>
    normalizeDecisionEntry({ qid, decision, doc, sourcePath: relPath, generatedAt, dataset }),
  );
}

function normalizeDecisionEntry({ qid, decision, doc, sourcePath, generatedAt, dataset }) {
  const normalizedQid = normalizeQid(qid);
  const reviewerNotes = firstText(decision.reviewerNotes, decision.notes, decision.previousNotes);
  const operation = inferOperation(decision);
  const language = inferLanguage(decision.approvedSourcePath ?? decision.sourcePath ?? decision.approvedPreviewPath);
  const outcome = mapDecisionOutcome(decision.decision);
  const record = compactObject({
    id: null,
    type: "image-replacement",
    dataset,
    qid: normalizedQid,
    language,
    source: "human-review",
    decision: normalizeDecision(decision.decision),
    operation,
    approvedSourcePath: normalizePath(decision.approvedSourcePath ?? decision.sourcePath),
    approvedPreviewPath: normalizePath(decision.approvedPreviewPath),
    finalAssetPath: null,
    previousAssetPath: normalizePath(decision.previousImagePath ?? decision.currentImagePath),
    referencedQid: normalizeQid(decision.referencedQid),
    referencedImagePath: normalizePath(decision.referencedImagePath),
    candidateScore: numberOrNull(decision.score ?? decision.candidateScore ?? decision.scoreParts?.score ?? decision.secondPass?.visualScore),
    reviewerNotes,
    tags: stringArray(decision.tags),
    objectTags: stringArray(decision.objectTags),
    outcome,
    validationStatus: null,
    warnings: stringArray(decision.warnings),
    errors: stringArray(decision.errors),
    createdAt: generatedAt,
    updatedAt: now,
    sourceFiles: unique([sourcePath, normalizePath(doc.sourceWorkbenchJsonPath)].filter(Boolean)),
    context: compactObject({
      questionText: decision.questionText,
      candidateIndex: decision.candidateIndex,
      cropMode: decision.cropMode,
      target: decision.target,
      sourceType: decision.sourceType,
      previousDecision: decision.previousDecision,
      previousNotes: decision.previousNotes,
      scoreParts: decision.scoreParts,
      secondPass: decision.secondPass,
    }),
  });
  record.id = buildId(record);
  return record;
}

function normalizeApplyEntry({ entry, doc, sourcePath, generatedAt, dataset }) {
  const operation = inferOperation(entry);
  const language = inferLanguage(entry.approvedSourcePath ?? entry.approvedPreviewPath ?? entry.finalAssetPath);
  const outcome = mapApplyOutcome(entry, doc);
  const reviewerNotes = firstText(entry.reviewerNotes, entry.notes);
  const record = compactObject({
    id: null,
    type: "image-replacement",
    dataset,
    qid: normalizeQid(entry.qid),
    language,
    source: "script-apply",
    decision: normalizeDecision(entry.decision),
    operation,
    approvedSourcePath: normalizePath(entry.approvedSourcePath),
    approvedPreviewPath: normalizePath(entry.approvedPreviewPath),
    finalAssetPath: normalizePath(entry.finalAssetPath ?? entry.finalImagePath),
    previousAssetPath: normalizePath(entry.previousImagePath ?? entry.currentImagePath),
    referencedQid: normalizeQid(entry.referencedQid),
    referencedImagePath: normalizePath(entry.referencedImagePath),
    candidateScore: numberOrNull(entry.score ?? entry.candidateScore),
    reviewerNotes,
    tags: stringArray(entry.tags),
    objectTags: stringArray(entry.objectTags),
    outcome,
    validationStatus: entry.validationStatus ?? null,
    warnings: stringArray([...(doc.runWarnings ?? []), ...(entry.warnings ?? [])]),
    errors: stringArray(entry.errors),
    createdAt: generatedAt,
    updatedAt: now,
    sourceFiles: unique([sourcePath, normalizePath(doc.decisionsPath), normalizePath(doc.requestedDecisionsPath)].filter(Boolean)),
    context: compactObject({
      imageColorTagsStatus: entry.imageColorTagsStatus,
      enhancementInstructionUsed: entry.enhancementInstructionUsed,
      crossQidReferenceDetected: entry.crossQidReferenceDetected,
      notesIncluded: entry.notesIncluded,
      notesApplied: entry.notesApplied,
      imageDimensions: entry.imageDimensions,
      changedFiles: entry.changedFiles,
      oldHash: entry.oldHash,
      newHash: entry.newHash,
      dryRun: doc.dryRun,
      apply: doc.apply,
    }),
  });
  record.id = buildId(record);
  return record;
}

function mergeRecord(incoming) {
  const key = dedupeKey(incoming);
  if (!key) return;
  const existing = index.get(key);
  if (!existing) {
    incoming.id = incoming.id || buildId(incoming);
    incoming.createdAt = incoming.createdAt ?? now;
    incoming.updatedAt = incoming.updatedAt ?? now;
    memory.records.push(incoming);
    index.set(key, incoming);
    mergeStats.created += 1;
    return;
  }

  const merged = mergeObjects(existing, incoming);
  if (stableJson(merged) === stableJson(existing)) {
    mergeStats.unchanged += 1;
    return;
  }
  const existingId = existing.id;
  Object.keys(existing).forEach((keyName) => delete existing[keyName]);
  Object.assign(existing, merged, { id: existingId ?? incoming.id ?? buildId(merged), updatedAt: now });
  mergeStats.updated += 1;
}

function mergeObjects(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "id") continue;
    if (key === "createdAt") {
      merged.createdAt = existing.createdAt ?? value;
      continue;
    }
    if (key === "updatedAt") {
      continue;
    }
    if (key === "sourceFiles" || key === "warnings" || key === "errors" || key === "tags" || key === "objectTags") {
      merged[key] = unique([...(array(existing[key])), ...(array(value))]);
      continue;
    }
    if (key === "outcome") {
      merged.outcome = strongerOutcome(existing.outcome, value);
      continue;
    }
    if (key === "source") {
      merged.source = existing.source === "script-apply" || value == null ? existing.source : value;
      continue;
    }
    if (key === "context") {
      merged.context = compactObject({ ...(existing.context ?? {}), ...(value ?? {}) });
      continue;
    }
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  }
  merged.id = existing.id ?? incoming.id ?? buildId(merged);
  return merged;
}

function dedupeKey(record) {
  if (!record || record.type !== "image-replacement") return null;
  const stableAsset =
    record.operation === "reuse-existing-qid-image"
      ? record.referencedQid || record.referencedImagePath || record.approvedSourcePath || record.finalAssetPath
      : record.approvedSourcePath || record.referencedQid || record.referencedImagePath || record.finalAssetPath || record.previousAssetPath || record.decision;
  return [
    record.type,
    record.dataset ?? "2023-test1",
    normalizeQid(record.qid) ?? "no-qid",
    record.operation ?? "unknown-operation",
    stableAsset ?? "no-asset",
  ].join("|");
}

function buildId(record) {
  const hash = crypto.createHash("sha1").update(dedupeKey(record) ?? stableJson(record)).digest("hex").slice(0, 12);
  return `image-replacement:${record.dataset ?? "2023-test1"}:${record.qid ?? "no-qid"}:${hash}`;
}

function inferOperation(entry) {
  if (hasText(entry.operation)) return entry.operation;
  const decision = normalizeDecision(entry.decision);
  if (decision === "disregard") return "skip";
  if (decision === "needsManualSearch") return "manual-search";
  if (entry.referencedQid || entry.referencedImagePath || entry.sourceType === "existing-production-qid") return "reuse-existing-qid-image";
  if (entry.approvedSourcePath || entry.approvedPreviewPath || entry.sourcePath) return "extract-enhance-from-approved-source";
  return "review";
}

function mapDecisionOutcome(decision) {
  switch (normalizeDecision(decision)) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "needsManualSearch":
      return "needsManualSearch";
    case "disregard":
      return "disregarded";
    default:
      return "proposed";
  }
}

function mapApplyOutcome(entry, doc) {
  const base = mapDecisionOutcome(entry.decision);
  if (array(entry.errors).length > 0 || entry.validationStatus === "failed") return "failed";
  if (base === "approved" && doc.apply === true && doc.dryRun !== true && ["passed", "warning"].includes(entry.validationStatus)) return "applied";
  return base;
}

function strongerOutcome(a, b) {
  const rank = {
    proposed: 0,
    needsManualSearch: 1,
    disregarded: 2,
    rejected: 3,
    approved: 4,
    failed: 5,
    applied: 6,
  };
  return (rank[b] ?? -1) >= (rank[a] ?? -1) ? b : a;
}

function normalizeDecision(value) {
  const text = String(value ?? "").trim();
  if (["needs-manual-search", "needs_manual_search", "manualSearch"].includes(text)) return "needsManualSearch";
  if (["disregarded", "ignore", "ignored"].includes(text)) return "disregard";
  if (["approved"].includes(text)) return "approve";
  if (["rejected"].includes(text)) return "reject";
  return text || "unknown";
}

function normalizeQid(value) {
  if (value == null) return null;
  const match = String(value).match(/q?(\d{1,4})/i);
  if (!match) return null;
  return `q${match[1].padStart(4, "0")}`;
}

function normalizePath(value) {
  if (!hasText(value)) return null;
  return String(value).replaceAll("\\", "/");
}

function inferLanguage(value) {
  const text = String(value ?? "");
  const match = text.match(/(?:^|\/)imports\/([a-z]{2})(?:\/|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function stringArray(value) {
  return array(value).map((item) => String(item)).filter(hasText);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(items) {
  return [...new Set(items.filter((item) => item !== undefined && item !== null && item !== ""))];
}

function firstText(...values) {
  return values.find(hasText) ?? "";
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactObject(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null || entry === "") continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    if (typeof entry === "object" && !Array.isArray(entry) && Object.keys(entry).length === 0) continue;
    out[key] = entry;
  }
  return out;
}

function stableJson(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sortObject(entry)]));
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, value, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function renderMarkdown(report) {
  const lines = [
    "# Decision Memory Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Memory records created: ${report.created}`,
    `- Memory records updated: ${report.updated}`,
    `- Memory records unchanged: ${report.unchanged}`,
    `- Total memory records: ${report.summary.totalRecords}`,
    `- Image replacement records: ${report.summary.imageReplacementRecords}`,
    "",
    "## Image Replacement Outcomes",
    "",
    ...table(["Outcome", "Count"], Object.entries(report.summary.imageReplacementByOutcome)),
    "",
    "## Image Replacement Operations",
    "",
    ...table(["Operation", "Count"], Object.entries(report.summary.imageReplacementByOperation)),
    "",
    "## Sources",
    "",
    ...report.imports.map((item) => `- ${item.sourceFile}: ${item.exists ? `${item.imported} imported` : "missing"}`),
    "",
    "## Recommended Integration Points",
    "",
    ...report.recommendedIntegrationPoints.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? "")).join(" | ")} |`),
  ];
}
