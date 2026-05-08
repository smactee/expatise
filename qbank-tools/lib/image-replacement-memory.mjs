import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SUCCESS_OUTCOMES = new Set(["approved", "applied"]);
const NEGATIVE_OUTCOMES = new Set(["rejected", "disregarded", "failed"]);

export function loadImageReplacementDecisionMemory({
  root = process.cwd(),
  dataset = "2023-test1",
  useMemory = true,
} = {}) {
  const memoryPath = path.join(root, "qbank-tools", "history", "decision-memory.json");
  if (!useMemory || !fs.existsSync(memoryPath)) {
    return emptyMemory({ enabled: Boolean(useMemory), memoryPath: relativePath(root, memoryPath), exists: false });
  }

  try {
    const doc = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
    const allRecords = Array.isArray(doc.records) ? doc.records : [];
    const records = allRecords
      .filter((record) => (record.type ?? record.decisionType) === "image-replacement")
      .filter((record) => !record.dataset || record.dataset === dataset)
      .map(normalizeMemoryRecord)
      .filter((record) => record.qid);
    const byQid = new Map();
    for (const record of records) {
      const current = byQid.get(record.qid) ?? buildEmptyQidMemory(record.qid);
      current.records.push(record);
      if (SUCCESS_OUTCOMES.has(record.outcome)) current.successfulRecords.push(record);
      if (NEGATIVE_OUTCOMES.has(record.outcome)) current.negativeRecords.push(record);
      if (hasText(record.reviewerNotes)) current.reviewerNotes.push(record.reviewerNotes);
      if (SUCCESS_OUTCOMES.has(record.outcome) && hasText(record.finalAssetPath)) current.previousAppliedAssets.push(record.finalAssetPath);
      if (SUCCESS_OUTCOMES.has(record.outcome) && hasText(record.referencedQid)) current.successfulReferencedQids.push(record.referencedQid);
      if (SUCCESS_OUTCOMES.has(record.outcome) && hasText(record.referencedImagePath)) current.successfulReferencedImagePaths.push(record.referencedImagePath);
      byQid.set(record.qid, current);
    }
    for (const memory of byQid.values()) {
      memory.reviewerNotes = unique(memory.reviewerNotes);
      memory.previousAppliedAssets = unique(memory.previousAppliedAssets);
      memory.successfulReferencedQids = unique(memory.successfulReferencedQids);
      memory.successfulReferencedImagePaths = unique(memory.successfulReferencedImagePaths);
    }
    return {
      enabled: true,
      exists: true,
      memoryPath: relativePath(root, memoryPath),
      records,
      byQid,
      counts: {
        totalMemoryRecords: allRecords.length,
        records: records.length,
        imageReplacementRecords: records.length,
        qids: byQid.size,
      },
    };
  } catch (error) {
    return {
      ...emptyMemory({ enabled: true, memoryPath: relativePath(root, memoryPath), exists: true }),
      warning: `Failed to load decision memory: ${error.message}`,
    };
  }
}

export function getQidMemory(decisionMemory, qid) {
  return decisionMemory?.byQid?.get(safeNormalizeQid(qid)) ?? buildEmptyQidMemory(safeNormalizeQid(qid));
}

export function summarizeImageReplacementMemory(memoryInfo) {
  if (!memoryInfo || memoryInfo.records.length === 0) {
    return {
      records: 0,
      successfulRecords: 0,
      negativeRecords: 0,
      previousReviewerNotes: [],
      previousAppliedAssets: [],
      successfulReferencedQids: [],
      successfulReferencedImagePaths: [],
    };
  }
  return {
    records: memoryInfo.records.length,
    successfulRecords: memoryInfo.successfulRecords.length,
    negativeRecords: memoryInfo.negativeRecords.length,
    previousReviewerNotes: memoryInfo.reviewerNotes,
    previousAppliedAssets: memoryInfo.previousAppliedAssets,
    successfulReferencedQids: memoryInfo.successfulReferencedQids,
    successfulReferencedImagePaths: memoryInfo.successfulReferencedImagePaths,
  };
}

export function applyImageReplacementMemoryToCandidate(candidate, memoryInfo, decisionMemory = null) {
  const baseScore = Number(candidate.baseScore ?? candidate.score ?? 0);
  if (!memoryInfo || memoryInfo.records.length === 0) {
    return {
      ...candidate,
      baseScore,
      finalScore: baseScore,
      score: baseScore,
      memoryMatch: false,
      memoryOutcome: null,
      memoryOperation: null,
      previousReviewerNotes: "",
      memoryReason: "",
      memoryMatchReason: "",
      memoryScoreAdjustment: 0,
    };
  }

  let boost = 0;
  let penalty = 0;
  const matchedRecords = [];
  const reasonParts = new Set();
  const candidatePaths = collectCandidatePaths(candidate);
  const candidateQids = collectCandidateQids(candidate);
  const targetRecordIds = new Set(memoryInfo.records.map((record) => record.id));

  for (const record of memoryInfo.records) {
    const pathMatch = firstPathMatch(candidatePaths.allPaths, record);
    const referencedQidMatch = record.referencedQid && candidateQids.has(record.referencedQid);

    if (SUCCESS_OUTCOMES.has(record.outcome)) {
      if (record.finalAssetPath && candidatePaths.allPaths.has(record.finalAssetPath)) {
        boost = Math.max(boost, 0.32);
        matchedRecords.push(record);
        reasonParts.add("Memory: previously applied for this qid");
        continue;
      }
      if (record.approvedSourcePath && candidatePaths.allPaths.has(record.approvedSourcePath)) {
        boost = Math.max(boost, 0.3);
        matchedRecords.push(record);
        reasonParts.add("Memory: previously approved source");
        continue;
      }
      if ((record.operation === "reuse-existing-qid-image" && referencedQidMatch) || (record.referencedImagePath && candidatePaths.allPaths.has(record.referencedImagePath))) {
        boost = Math.max(boost, 0.24);
        matchedRecords.push(record);
        reasonParts.add("Memory: reuse existing qid image");
      }
      continue;
    }

    if (record.outcome === "failed" && ["finalAssetPath", "approvedSourcePath", "referencedImagePath"].includes(pathMatch?.key)) {
      penalty = Math.max(penalty, 0.34);
      matchedRecords.push(record);
      reasonParts.add("Memory: previous failed candidate");
      continue;
    }

    if (["rejected", "disregarded"].includes(record.outcome) && (pathMatch || referencedQidMatch)) {
      penalty = Math.max(penalty, 0.24);
      matchedRecords.push(record);
      reasonParts.add("Memory: previously rejected/disregarded");
    }
  }

  for (const record of decisionMemory?.records ?? []) {
    if (targetRecordIds.has(record.id)) continue;
    const pathMatch = firstPathMatch(candidatePaths.allPaths, record);
    const qidMatch = record.qid && candidateQids.has(record.qid);
    const referencedQidMatch = record.referencedQid && candidateQids.has(record.referencedQid);
    const hasReusableImageMatch = candidate.operation === "reuse-existing-qid-image" && (
      qidMatch ||
      referencedQidMatch ||
      ["finalAssetPath", "referencedImagePath"].includes(pathMatch?.key)
    );

    if (SUCCESS_OUTCOMES.has(record.outcome) && hasReusableImageMatch) {
      boost = Math.max(boost, 0.18);
      matchedRecords.push(record);
      reasonParts.add("Memory: reuse existing qid image");
      continue;
    }

    if (record.outcome === "failed" && (qidMatch || ["finalAssetPath", "approvedSourcePath", "referencedImagePath"].includes(pathMatch?.key))) {
      penalty = Math.max(penalty, 0.3);
      matchedRecords.push(record);
      reasonParts.add("Memory: previous failed candidate");
      continue;
    }

    if (["rejected", "disregarded"].includes(record.outcome) && (qidMatch || referencedQidMatch || pathMatch)) {
      penalty = Math.max(penalty, 0.2);
      matchedRecords.push(record);
      reasonParts.add("Memory: previously rejected/disregarded");
    }
  }

  const memoryScoreAdjustment = Number((boost - penalty).toFixed(4));
  const finalScore = clamp01(baseScore + memoryScoreAdjustment);
  const primary = strongestMemoryRecord(matchedRecords);
  const scoreContainer = candidate.scoring ? "scoring" : "scoreParts";
  const memoryMatchReason = [...reasonParts].join("; ");

  return {
    ...candidate,
    baseScore,
    finalScore,
    score: finalScore,
    [scoreContainer]: {
      ...(candidate[scoreContainer] ?? {}),
      memoryBoost: boost,
      memoryPenalty: penalty,
    },
    memoryMatch: matchedRecords.length > 0,
    memoryOutcome: primary?.outcome ?? null,
    memoryOperation: primary?.operation ?? null,
    previousReviewerNotes: unique([
      ...memoryInfo.reviewerNotes,
      ...matchedRecords.map((record) => record.reviewerNotes).filter(hasText),
    ]).join("\n"),
    memoryReason: memoryMatchReason,
    memoryMatchReason,
    memoryScoreAdjustment,
  };
}

export function countMemoryAdjustedCandidates(results) {
  const candidates = results.flatMap((result) => result.candidates ?? []);
  return {
    boosted: candidates.filter((candidate) => Number(candidate.memoryScoreAdjustment ?? 0) > 0).length,
    downranked: candidates.filter((candidate) => Number(candidate.memoryScoreAdjustment ?? 0) < 0).length,
  };
}

export function buildImageReplacementMemoryDebugReport({
  decisionMemory,
  results,
  dataset = "2023-test1",
  source = "image-replacement-workbench",
  generatedAt = new Date().toISOString(),
} = {}) {
  const records = decisionMemory?.records ?? [];
  const qidMemoryCount = (qid) => getQidMemory(decisionMemory, qid).records.length;
  const candidateDebugRows = [];
  const perQid = (results ?? []).map((result) => {
    const qid = safeNormalizeQid(result.qid);
    const qidMemory = getQidMemory(decisionMemory, qid);
    const candidates = result.candidates ?? [];
    const sourcePaths = new Set();
    const previewPaths = new Set();
    const imagePaths = new Set();
    const finalAssetMatches = new Map();
    const approvedSourceMatches = new Map();
    const referencedQidMatches = new Map();

    for (const candidate of candidates) {
      const candidatePaths = collectCandidatePaths(candidate);
      for (const value of candidatePaths.sourcePaths) sourcePaths.add(value);
      for (const value of candidatePaths.previewPaths) previewPaths.add(value);
      for (const value of candidatePaths.imagePaths) imagePaths.add(value);
      const debug = debugCandidateMemory(candidate, qidMemory, records, qid);
      candidateDebugRows.push(debug);
      for (const record of debug.exactPathMatches) {
        if (record.matchKind === "finalAssetPath") finalAssetMatches.set(record.id, record);
        if (record.matchKind === "approvedSourcePath") approvedSourceMatches.set(record.id, record);
      }
      for (const record of debug.referencedQidMatches) {
        referencedQidMatches.set(record.id, record);
      }
    }

    return {
      qid,
      memoryEntriesFoundForQid: qidMemory.records.map(summarizeMemoryRecord),
      memoryEntriesFoundByReferencedQid: records.filter((record) => record.referencedQid === qid).map(summarizeMemoryRecord),
      memoryEntriesFoundByFinalAssetPath: [...finalAssetMatches.values()],
      memoryEntriesFoundByApprovedSourcePath: [...approvedSourceMatches.values()],
      candidateSourcePathsChecked: [...sourcePaths].sort(),
      candidatePreviewPathsChecked: [...previewPaths].sort(),
      candidateImagePathsChecked: [...imagePaths].sort(),
      whyMemoryDidOrDidNotMatch: candidateDebugRows
        .filter((row) => row.qid === qid)
        .map((row) => ({
          candidateRank: row.rank,
          sourceType: row.sourceType,
          sourcePath: row.sourcePath,
          referencedQid: row.referencedQid,
          memoryMatch: row.memoryMatch,
          baseScore: row.baseScore,
          memoryScoreAdjustment: row.memoryScoreAdjustment,
          finalScore: row.finalScore,
          memoryMatchReason: row.memoryMatchReason,
          reasons: row.reasons,
        })),
      boostedCandidates: candidates.filter((candidate) => Number(candidate.memoryScoreAdjustment ?? 0) > 0).map(summarizeCandidate),
      downrankedCandidates: candidates.filter((candidate) => Number(candidate.memoryScoreAdjustment ?? 0) < 0).map(summarizeCandidate),
      notes: qidMemory.records.length > 0 && qidMemory.successfulRecords.length === 0 && qidMemory.negativeRecords.length === 0
        ? "Memory exists for this qid, but all relevant outcomes are neutral for ranking."
        : null,
    };
  });

  const summary = {
    totalMemoryEntriesLoaded: decisionMemory?.counts?.totalMemoryRecords ?? records.length,
    imageReplacementMemoryEntries: decisionMemory?.counts?.imageReplacementRecords ?? records.length,
    qidsWithMemory: decisionMemory?.counts?.qids ?? 0,
    qidsProcessed: (results ?? []).length,
    qidsProcessedThatHaveMemory: (results ?? []).filter((result) => qidMemoryCount(result.qid) > 0).length,
    candidatesChecked: candidateDebugRows.length,
    candidatesWithExactPathMatch: candidateDebugRows.filter((row) => row.exactPathMatches.length > 0).length,
    candidatesWithQidMatch: candidateDebugRows.filter((row) => row.qidMatches.length > 0).length,
    candidatesWithReferencedQidMatch: candidateDebugRows.filter((row) => row.referencedQidMatches.length > 0).length,
    boostedCount: candidateDebugRows.filter((row) => Number(row.memoryScoreAdjustment ?? 0) > 0).length,
    downrankedCount: candidateDebugRows.filter((row) => Number(row.memoryScoreAdjustment ?? 0) < 0).length,
    scoreAdjustedCount: candidateDebugRows.filter((row) => Number(row.memoryScoreAdjustment ?? 0) !== 0).length,
  };

  return {
    generatedAt,
    dataset,
    source,
    memoryPath: decisionMemory?.memoryPath ?? null,
    memoryEnabled: Boolean(decisionMemory?.enabled),
    memoryWarning: decisionMemory?.warning ?? null,
    summary,
    qids: perQid,
  };
}

export function renderImageReplacementMemoryDebugMarkdown(report) {
  const lines = [
    "# Image Replacement Memory Debug",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source}`,
    `Dataset: ${report.dataset}`,
    `Memory: ${report.memoryEnabled ? "enabled" : "disabled"} (${report.memoryPath ?? "none"})`,
    "",
    "## Summary",
    "",
    `- total memory entries loaded: ${report.summary.totalMemoryEntriesLoaded}`,
    `- image-replacement memory entries: ${report.summary.imageReplacementMemoryEntries}`,
    `- qids with memory: ${report.summary.qidsWithMemory}`,
    `- qids processed: ${report.summary.qidsProcessed}`,
    `- qids processed that have memory: ${report.summary.qidsProcessedThatHaveMemory}`,
    `- candidates checked: ${report.summary.candidatesChecked}`,
    `- candidates with exact path match: ${report.summary.candidatesWithExactPathMatch}`,
    `- candidates with qid match: ${report.summary.candidatesWithQidMatch}`,
    `- candidates with referencedQid match: ${report.summary.candidatesWithReferencedQidMatch}`,
    `- boosted count: ${report.summary.boostedCount}`,
    `- downranked count: ${report.summary.downrankedCount}`,
    `- total score-adjusted candidates: ${report.summary.scoreAdjustedCount}`,
    "",
    "## Processed QIDs",
    "",
  ];
  for (const item of report.qids) {
    lines.push(
      `### ${item.qid}`,
      "",
      `- memory entries for qid: ${item.memoryEntriesFoundForQid.length}`,
      `- memory entries by referencedQid: ${item.memoryEntriesFoundByReferencedQid.length}`,
      `- memory entries by finalAssetPath: ${item.memoryEntriesFoundByFinalAssetPath.length}`,
      `- memory entries by approvedSourcePath: ${item.memoryEntriesFoundByApprovedSourcePath.length}`,
      `- candidate source paths checked: ${item.candidateSourcePathsChecked.length}`,
      `- candidate preview paths checked: ${item.candidatePreviewPathsChecked.length}`,
      `- candidate image paths checked: ${item.candidateImagePathsChecked.length}`,
      `- boosted candidates: ${item.boostedCandidates.length}`,
      `- downranked candidates: ${item.downrankedCandidates.length}`,
      ...(item.notes ? [`- note: ${item.notes}`] : []),
      "",
      "| rank | source type | memory match | adjustment | reasons |",
      "| --- | --- | --- | --- | --- |",
      ...item.whyMemoryDidOrDidNotMatch.map((row) =>
        `| ${row.candidateRank ?? ""} | ${row.sourceType ?? ""} | ${row.memoryMatch ? "yes" : "no"} | ${row.memoryScoreAdjustment ?? 0} | ${escapeMarkdown(row.reasons.join("; "))} |`,
      ),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function emptyMemory({ enabled = false, exists = false, memoryPath = null } = {}) {
  return {
    enabled,
    exists,
    memoryPath,
    records: [],
    byQid: new Map(),
    counts: { totalMemoryRecords: 0, records: 0, imageReplacementRecords: 0, qids: 0 },
  };
}

function buildEmptyQidMemory(qid) {
  return {
    qid,
    records: [],
    successfulRecords: [],
    negativeRecords: [],
    reviewerNotes: [],
    previousAppliedAssets: [],
    successfulReferencedQids: [],
    successfulReferencedImagePaths: [],
  };
}

function normalizeMemoryRecord(record) {
  return {
    ...record,
    qid: safeNormalizeQid(record.qid),
    referencedQid: safeNormalizeQid(record.referencedQid),
    outcome: record.outcome ?? record.finalDecision ?? null,
    operation: record.operation ?? record.decisionType ?? null,
    approvedSourcePath: normalizePath(record.approvedSourcePath),
    approvedPreviewPath: normalizePath(record.approvedPreviewPath),
    finalAssetPath: normalizePath(record.finalAssetPath),
    previousAssetPath: normalizePath(record.previousAssetPath),
    referencedImagePath: normalizePath(record.referencedImagePath),
    reviewerNotes: String(record.reviewerNotes ?? record.reason ?? "").trim(),
  };
}

function matchCandidateToRecord(candidate, record) {
  const candidatePaths = new Set([
    candidate.screenshotPath,
    candidate.sourcePath,
    candidate.approvedSourcePath,
    candidate.previewPath,
    candidate.thumbnailPath,
    candidate.referencedImagePath,
  ].map(normalizePath).filter(Boolean));
  const candidateQids = new Set([
    candidate.referencedQid,
    ...(candidate.referencedQids ?? []),
    candidate.likelyExistingQidMatch?.qid,
    ...(candidate.possibleExistingQidMatches ?? []).map((match) => match.qid),
  ].map(safeNormalizeQid).filter(Boolean));

  if (record.referencedQid && candidateQids.has(record.referencedQid)) {
    return { matched: true, kind: "referenced-qid" };
  }
  if (record.finalAssetPath && candidatePaths.has(record.finalAssetPath)) {
    return { matched: true, kind: "final-asset" };
  }
  if (record.referencedImagePath && candidatePaths.has(record.referencedImagePath)) {
    return { matched: true, kind: "referenced-image" };
  }
  if (record.approvedSourcePath && candidatePaths.has(record.approvedSourcePath)) {
    return { matched: true, kind: "approved-source" };
  }
  if (record.approvedPreviewPath && candidatePaths.has(record.approvedPreviewPath)) {
    return { matched: true, kind: "approved-preview" };
  }
  return { matched: false, kind: null };
}

function debugCandidateMemory(candidate, qidMemory, allRecords, qid) {
  const candidatePaths = collectCandidatePaths(candidate);
  const candidateQids = collectCandidateQids(candidate);
  const qidMatches = [];
  const referencedQidMatches = [];
  const exactPathMatches = [];

  for (const record of allRecords) {
    if (record.qid && candidateQids.has(record.qid)) {
      qidMatches.push({ ...summarizeMemoryRecord(record), matchKind: "qid" });
    }
    if (record.referencedQid && candidateQids.has(record.referencedQid)) {
      referencedQidMatches.push({ ...summarizeMemoryRecord(record), matchKind: "referencedQid" });
    }
    for (const key of ["finalAssetPath", "approvedSourcePath", "approvedPreviewPath", "referencedImagePath", "previousAssetPath"]) {
      if (record[key] && candidatePaths.allPaths.has(record[key])) {
        exactPathMatches.push({ ...summarizeMemoryRecord(record), matchKind: key });
      }
    }
  }

  const rankingRelevantMatches = [
    ...qidMemory.successfulRecords,
    ...qidMemory.negativeRecords,
  ].map((record) => ({ record, match: matchCandidateToRecord(candidate, record) }))
    .filter((entry) => entry.match.matched);
  const reasons = [];
  if (qidMemory.records.length === 0) {
    reasons.push("No memory records found for processed qid.");
  } else if (qidMemory.successfulRecords.length === 0 && qidMemory.negativeRecords.length === 0) {
    reasons.push("Processed qid has memory, but outcomes are neutral for ranking.");
  } else if (rankingRelevantMatches.length === 0) {
    reasons.push("Processed qid has ranking-relevant memory, but no candidate path/qid matched it.");
  }
  if (exactPathMatches.length > 0) reasons.push(`${exactPathMatches.length} exact memory path match(es) found.`);
  if (qidMatches.length > 0) reasons.push(`${qidMatches.length} memory qid match(es) found.`);
  if (referencedQidMatches.length > 0) reasons.push(`${referencedQidMatches.length} memory referencedQid match(es) found.`);
  if (Number(candidate.memoryScoreAdjustment ?? 0) > 0) reasons.push("Candidate was boosted by ranking memory.");
  if (Number(candidate.memoryScoreAdjustment ?? 0) < 0) reasons.push("Candidate was downranked by ranking memory.");
  if (reasons.length === 0) reasons.push("No qid, referencedQid, or exact path memory match found.");

  return {
    qid,
    rank: candidate.rank,
    sourceType: candidate.sourceType,
    sourcePath: candidate.sourcePath ?? candidate.screenshotPath ?? null,
    previewPath: candidate.previewPath ?? candidate.thumbnailPath ?? null,
    referencedQid: candidate.referencedQid ?? null,
    referencedImagePath: candidate.referencedImagePath ?? null,
    memoryMatch: Boolean(candidate.memoryMatch),
    baseScore: candidate.baseScore ?? null,
    memoryScoreAdjustment: candidate.memoryScoreAdjustment ?? 0,
    finalScore: candidate.finalScore ?? candidate.score ?? null,
    memoryMatchReason: candidate.memoryMatchReason ?? "",
    qidMatches,
    referencedQidMatches,
    exactPathMatches,
    sourcePathsChecked: [...candidatePaths.sourcePaths],
    previewPathsChecked: [...candidatePaths.previewPaths],
    imagePathsChecked: [...candidatePaths.imagePaths],
    candidateQidsChecked: [...candidateQids],
    reasons,
  };
}

function collectCandidatePaths(candidate) {
  const sourcePaths = new Set([
    candidate.screenshotPath,
    candidate.sourcePath,
    candidate.approvedSourcePath,
  ].map(normalizePath).filter(Boolean));
  const previewPaths = new Set([
    candidate.previewPath,
    candidate.thumbnailPath,
    candidate.existingPreviewPath,
    candidate.approvedPreviewPath,
  ].map(normalizePath).filter(Boolean));
  const imagePaths = new Set([
    candidate.referencedImagePath,
    candidate.finalAssetPath,
    candidate.currentImagePath,
    candidate.likelyExistingQidMatch?.currentImagePath,
    ...(candidate.possibleExistingQidMatches ?? []).map((match) => match.currentImagePath),
  ].map(normalizePath).filter(Boolean));
  return {
    sourcePaths,
    previewPaths,
    imagePaths,
    allPaths: new Set([...sourcePaths, ...previewPaths, ...imagePaths]),
  };
}

function collectCandidateQids(candidate) {
  return new Set([
    candidate.referencedQid,
    ...(candidate.referencedQids ?? []),
    ...(candidate.contextQids ?? []),
    candidate.likelyExistingQidMatch?.qid,
    ...(candidate.possibleExistingQidMatches ?? []).map((match) => match.qid),
  ].map(safeNormalizeQid).filter(Boolean));
}

function firstPathMatch(candidatePaths, record) {
  for (const key of ["finalAssetPath", "approvedSourcePath", "approvedPreviewPath", "referencedImagePath", "previousAssetPath"]) {
    if (record[key] && candidatePaths.has(record[key])) {
      return { key, path: record[key] };
    }
  }
  return null;
}

function summarizeMemoryRecord(record) {
  return {
    id: record.id ?? null,
    qid: record.qid ?? null,
    outcome: record.outcome ?? null,
    operation: record.operation ?? null,
    decision: record.decision ?? null,
    approvedSourcePath: record.approvedSourcePath ?? null,
    approvedPreviewPath: record.approvedPreviewPath ?? null,
    finalAssetPath: record.finalAssetPath ?? null,
    previousAssetPath: record.previousAssetPath ?? null,
    referencedQid: record.referencedQid ?? null,
    referencedImagePath: record.referencedImagePath ?? null,
    reviewerNotes: record.reviewerNotes ?? "",
  };
}

function summarizeCandidate(candidate) {
  return {
    rank: candidate.rank,
    sourceType: candidate.sourceType,
    sourcePath: candidate.sourcePath ?? candidate.screenshotPath ?? null,
    previewPath: candidate.previewPath ?? candidate.thumbnailPath ?? null,
    referencedQid: candidate.referencedQid ?? null,
    referencedImagePath: candidate.referencedImagePath ?? null,
    score: candidate.score ?? null,
    baseScore: candidate.baseScore ?? null,
    finalScore: candidate.finalScore ?? candidate.score ?? null,
    memoryMatch: Boolean(candidate.memoryMatch),
    memoryOutcome: candidate.memoryOutcome ?? null,
    memoryOperation: candidate.memoryOperation ?? null,
    memoryScoreAdjustment: candidate.memoryScoreAdjustment ?? 0,
    memoryReason: candidate.memoryReason ?? "",
    memoryMatchReason: candidate.memoryMatchReason ?? "",
  };
}

function strongestMemoryRecord(records) {
  const rank = { applied: 5, approved: 4, failed: 3, rejected: 2, disregarded: 1 };
  return [...records].sort((left, right) => (rank[right.outcome] ?? 0) - (rank[left.outcome] ?? 0))[0] ?? null;
}

function safeNormalizeQid(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function normalizePath(value) {
  if (!hasText(value)) return null;
  return String(value).replaceAll("\\", "/");
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function unique(values) {
  return [...new Set(values.filter(hasText))];
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
