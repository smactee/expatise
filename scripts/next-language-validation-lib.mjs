import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  csvEscape,
  fileExists,
  stableNow,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  runNextLanguagePreflight,
  writePilotArtifacts,
} from "./next-language-preflight-lib.mjs";

export const OUTPUT_DIR = path.join(ROOT, "artifacts", "next-language-pilot");
export const INTELLIGENCE_DIR = path.join(ROOT, "artifacts", "japanese-review-intelligence");

const DECISION_PRIORITY = {
  "delete-question": 4,
  "keep-unresolved": 3,
  "create-new-question": 2,
  "approve-existing-qid": 1,
};

export function loadJapaneseReviewDatasets() {
  const reviewRows = readJsonl(path.join(INTELLIGENCE_DIR, "review_ground_truth.jsonl"));
  const evalRows = readCsv(path.join(INTELLIGENCE_DIR, "automatch_eval.csv"));

  const groupedReviewRows = new Map();
  for (const row of reviewRows) {
    const key = canonicalKey(row);
    if (!key) continue;
    if (!groupedReviewRows.has(key)) {
      groupedReviewRows.set(key, []);
    }
    groupedReviewRows.get(key).push(row);
  }

  const reviewByKey = new Map();
  for (const [key, rows] of groupedReviewRows.entries()) {
    reviewByKey.set(key, chooseCanonicalReviewRow(rows));
  }

  const evalByKey = new Map();
  for (const row of evalRows) {
    const key = canonicalKey({
      sourceBatchId: row.source_batch,
      sourceBatch: row.source_batch,
      sourceImage: row.source_image,
      sourceItemId: row.source_item_id,
    });
    if (key) {
      evalByKey.set(key, row);
    }
  }

  return {
    reviewRows,
    evalRows,
    groupedReviewRows,
    reviewByKey,
    evalByKey,
  };
}

export function loadCurrentBatchRouteIndex(lang = "ja") {
  const root = path.join(ROOT, "imports", lang);
  const sections = [
    { name: "matched", route: "auto-match ok", file: "matched.json" },
    { name: "review-needed", route: "manual review", file: "review-needed.json" },
    { name: "unresolved", route: "likely unresolved", file: "unresolved.json" },
  ];
  const index = new Map();

  for (const batchId of fs.readdirSync(root).filter((name) => name.startsWith("batch-")).sort()) {
    for (const section of sections) {
      const filePath = path.join(root, batchId, section.file);
      if (!fileExists(filePath)) continue;
      const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        const key = `${batchId}:${stripBatchPrefix(batchId, normalizeText(item.itemId ?? item.sourceImage ?? ""))}`;
        if (!key.endsWith(":")) {
          index.set(key, {
            batchId,
            section: section.name,
            route: section.route,
            suggestedQid: normalizeText(item?.match?.qid ?? item?.qid),
          });
        }
      }
    }
  }

  return index;
}

export async function runBatchProfileComparison({
  lang = "ja",
  batchId,
  dataset = "2023-test1",
  runBaseline = false,
  writeArtifacts = false,
  prefixBase = "",
  comparisonProfile = "calibrated",
} = {}) {
  const originalRun = await runNextLanguagePreflight({
    lang,
    batchId,
    dataset,
    runBaseline,
    pilotSize: null,
    calibrationProfile: "original",
  });
  const calibratedRun = await runNextLanguagePreflight({
    lang,
    batchId,
    dataset,
    runBaseline: false,
    pilotSize: null,
    calibrationProfile: comparisonProfile,
  });

  let originalArtifacts = null;
  let calibratedArtifacts = null;
  if (writeArtifacts) {
    originalArtifacts = await writePilotArtifacts(originalRun, {
      prefix: `${prefixBase}${batchId}_original_`,
    });
    calibratedArtifacts = await writePilotArtifacts(calibratedRun, {
      prefix: `${prefixBase}${batchId}_${comparisonProfile}_`,
    });
  }

  return {
    originalRun,
    calibratedRun,
    originalArtifacts,
    calibratedArtifacts,
  };
}

export function buildPreflightItemIndex(run) {
  return new Map(
    run.pilotItems.map((item) => [preflightItemKey(run.batchId, item), item]),
  );
}

export function preflightItemKey(batchId, item) {
  const sourceRef = stripBatchPrefix(batchId, item.itemId ?? item.sourceImage ?? "");
  return sourceRef ? `${batchId}:${sourceRef}` : null;
}

export function canonicalKey(row) {
  const batchId = normalizeText(row.sourceBatchId ?? row.source_batch ?? row.sourceBatch);
  const sourceRef = stripBatchPrefix(
    batchId,
    normalizeText(row.sourceImage ?? row.source_image ?? row.sourceItemId ?? row.source_item_id ?? row.sourceItemKey),
  );
  return batchId && sourceRef ? `${batchId}:${sourceRef}` : null;
}

export function stripBatchPrefix(batchId, value) {
  const text = normalizeText(value);
  if (!text) return null;
  return batchId && text.startsWith(`${batchId}:`) ? text.slice(batchId.length + 1) : text;
}

export function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function truthyFlag(value) {
  return value === true || value === "true";
}

export function summarizeRunRoutes(run) {
  const counts = {
    autoMatchOk: 0,
    manualReview: 0,
    likelyCreateNew: 0,
    likelyUnresolved: 0,
    likelyDelete: 0,
    downgraded: 0,
    rerouted: 0,
  };

  for (const item of run.pilotItems) {
    if (item.recommendedRoute === "auto-match ok") counts.autoMatchOk += 1;
    if (item.recommendedRoute === "manual review") counts.manualReview += 1;
    if (item.recommendedRoute === "likely create-new-question") counts.likelyCreateNew += 1;
    if (item.recommendedRoute === "likely unresolved") counts.likelyUnresolved += 1;
    if (item.recommendedRoute === "likely delete") counts.likelyDelete += 1;
    if (item.preflightStatus === "downgrade") counts.downgraded += 1;
    if (item.preflightStatus === "reroute") counts.rerouted += 1;
  }

  return counts;
}

export function countSignals(items, selector = (item) => item.decisionSignals ?? item.triggeredChecks ?? []) {
  const counts = {};
  for (const item of items) {
    for (const signal of selector(item)) {
      const code = typeof signal === "string" ? signal : signal.code;
      if (!code) continue;
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return counts;
}

export function benchmarkRowCaseTypes(row) {
  return Array.isArray(row.adversarialCaseTypes)
    ? row.adversarialCaseTypes
    : String(row.adversarialCaseTypes ?? "")
      .split("|")
      .map((entry) => entry.trim())
      .filter(Boolean);
}

export function isHardRiskCase(caseTypes) {
  return caseTypes.some((type) =>
    ["override", "create_new", "unresolved", "delete", "structural_risk"].includes(type),
  );
}

export function isWarningRiskCase(caseTypes) {
  return caseTypes.some((type) =>
    ["answer_key_change", "topic_drift", "image_heavy", "ambiguous_near_match"].includes(type),
  );
}

export function signalOutcome(item) {
  if (!item) return "missing";
  if (item.recommendedRoute !== "auto-match ok") return "routed";
  if ((item.decisionSignals ?? []).length > 0) return "warning-only";
  return "silent-pass";
}

export function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];
    if (insideQuotes) {
      if (char === "\"" && nextChar === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        insideQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      insideQuotes = true;
    } else if (char === ",") {
      pushCell();
    } else if (char === "\n") {
      pushCell();
      pushRow();
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] ?? "";
    });
    return entry;
  });
}

export function writeJsonl(filePath, rows) {
  return writeText(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

export function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  return writeText(filePath, `${lines.join("\n")}\n`);
}

export function writeMarkdown(filePath, text) {
  return writeText(filePath, text);
}

export function isSignLikeRow(row) {
  const text = [
    row.localePromptText,
    row.translatedPromptText,
    row.sourceProvisionalTopic,
    row.finalTopic,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /sign|signal|marking|traffic light|traffic signal|arrow|crosswalk|road marking|police signal/.test(text);
}

export function isAmbiguousNearMatch(row) {
  const gap = finiteNumber(row.autoSuggestedScoreGap);
  const candidateCount = finiteNumber(row.topCandidateCount) ?? (Array.isArray(row.topCandidateSet) ? row.topCandidateSet.length : 0);
  const finalCandidateRank = finiteNumber(row.finalCandidateRank);
  return (
    (gap !== null && gap <= 3.5) ||
    (finalCandidateRank !== null && finalCandidateRank > 1 && finalCandidateRank <= 3) ||
    (
      candidateCount >= 2 &&
      Array.isArray(row.topCandidateSet) &&
      row.topCandidateSet.length >= 2 &&
      finiteNumber(row.topCandidateSet[0]?.score) !== null &&
      finiteNumber(row.topCandidateSet[1]?.score) !== null &&
      Math.abs(Number(row.topCandidateSet[0]?.score) - Number(row.topCandidateSet[1]?.score)) <= 1.5
    )
  );
}

export function isStructuralRiskRow(row) {
  const visibleChoices = Array.isArray(row.visibleOptionLetters) ? row.visibleOptionLetters.length : 0;
  const text = normalizeText(row.translatedPromptText ?? row.localePromptText);
  return (
    !truthyFlag(row.hadCandidateSet) ||
    (Array.isArray(row.topCandidateSet) && row.topCandidateSet.length === 0) ||
    finiteNumber(row.topicConfidence) === 0 ||
    visibleChoices < 2 ||
    (text && text.length < 24) ||
    /minimum similarity threshold|pending-superset-review|kept-unresolved/i.test(String(row.reason ?? row.status ?? ""))
  );
}

export function buildAdversarialTypes(row, evalRow, relatedRows = []) {
  const types = new Set();
  if (truthyFlag(evalRow?.auto_match_overridden) || (row.autoSuggestedQid && row.finalQid && row.autoSuggestedQid !== row.finalQid)) {
    types.add("override");
  }
  if (truthyFlag(evalRow?.answer_key_changed) || row.answerKeyChanged === true) {
    types.add("answer_key_change");
  }
  if (truthyFlag(evalRow?.topic_changed) || truthyFlag(evalRow?.subtopic_changed) || row.topicChanged === true || row.subtopicChanged === true) {
    types.add("topic_drift");
  }
  if (row.finalDecision === "create-new-question" || truthyFlag(evalRow?.created_new_question)) {
    types.add("create_new");
  }
  if (row.finalDecision === "keep-unresolved" || truthyFlag(evalRow?.unresolved) || relatedRows.some((entry) => entry.finalDecision === "keep-unresolved")) {
    types.add("unresolved");
  }
  if (row.finalDecision === "delete-question" || truthyFlag(evalRow?.deleted) || relatedRows.some((entry) => entry.finalDecision === "delete-question")) {
    types.add("delete");
  }
  if (isSignLikeRow(row)) {
    types.add("image_heavy");
  }
  if (isStructuralRiskRow(row)) {
    types.add("structural_risk");
  }
  if (isAmbiguousNearMatch(row)) {
    types.add("ambiguous_near_match");
  }
  return Array.from(types);
}

export function adversarialHardness(row, evalRow, caseTypes) {
  let score = 0;
  if (caseTypes.includes("delete")) score += 10;
  if (caseTypes.includes("unresolved")) score += 8;
  if (caseTypes.includes("create_new")) score += 8;
  if (caseTypes.includes("override")) score += 7;
  if (caseTypes.includes("answer_key_change")) score += 6;
  if (caseTypes.includes("ambiguous_near_match")) score += 4;
  if (caseTypes.includes("structural_risk")) score += 4;
  if (caseTypes.includes("image_heavy")) score += 3;
  if (caseTypes.includes("topic_drift")) score += 2;
  if ((row.reviewSection ?? row.sourceSection) === "auto-matched") score += 2;
  if ((row.reviewSection ?? row.sourceSection) === "matched") score += 2;

  const trustBand = String(row.trustBand ?? evalRow?.trust_band ?? "");
  if (["none", "very-low"].includes(trustBand)) score += 2;
  else if (trustBand === "low") score += 1;

  const gap = finiteNumber(row.autoSuggestedScoreGap);
  if (gap !== null && gap <= 3.5) score += 2;
  else if (gap !== null && gap <= 7) score += 1;

  const topScore = finiteNumber(row.autoSuggestedScore);
  if (topScore !== null && topScore <= 45) score += 2;
  else if (topScore !== null && topScore <= 60) score += 1;

  return score;
}

export function chooseCanonicalReviewRow(rows) {
  return [...rows].sort((left, right) => {
    const leftTime = Date.parse(left.decisionCapturedAt ?? "") || 0;
    const rightTime = Date.parse(right.decisionCapturedAt ?? "") || 0;
    const timeDiff = rightTime - leftTime;
    if (timeDiff !== 0) return timeDiff;
    return (DECISION_PRIORITY[right.finalDecision] ?? 0) - (DECISION_PRIORITY[left.finalDecision] ?? 0);
  })[0];
}

export function summarizeAdversarialCaseTypes(rows) {
  const counts = {};
  for (const row of rows) {
    for (const type of row.adversarialCaseTypes) {
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildHumanOutcomeClass(reviewRow, evalRow) {
  if (!reviewRow) return "unknown";
  if (reviewRow.finalDecision === "delete-question") return "delete";
  if (reviewRow.finalDecision === "keep-unresolved") return "unresolved";
  if (reviewRow.finalDecision === "create-new-question") return "create_new";
  if (truthyFlag(evalRow?.auto_match_overridden) || (reviewRow.autoSuggestedQid && reviewRow.finalQid && reviewRow.autoSuggestedQid !== reviewRow.finalQid)) {
    return "override";
  }
  if (truthyFlag(evalRow?.answer_key_changed) || reviewRow.answerKeyChanged === true) {
    return "answer_key_change";
  }
  if (truthyFlag(evalRow?.auto_match_correct) || (reviewRow.autoSuggestedQid && reviewRow.finalQid && reviewRow.autoSuggestedQid === reviewRow.finalQid)) {
    return "same_qid";
  }
  return "other";
}

export function routeCountsToMarkdown(label, counts) {
  return [
    `- ${label} auto-match ok: ${counts.autoMatchOk}`,
    `- ${label} manual review: ${counts.manualReview}`,
    `- ${label} likely create-new-question: ${counts.likelyCreateNew}`,
    `- ${label} likely unresolved: ${counts.likelyUnresolved}`,
    `- ${label} likely delete: ${counts.likelyDelete}`,
    `- ${label} downgraded: ${counts.downgraded}`,
    `- ${label} rerouted: ${counts.rerouted}`,
  ];
}

export function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export function fileExistsOrThrow(filePath, message) {
  if (!fileExists(filePath)) {
    throw new Error(message ?? `Required file not found: ${path.relative(ROOT, filePath)}`);
  }
}

export function nowIso() {
  return stableNow();
}
