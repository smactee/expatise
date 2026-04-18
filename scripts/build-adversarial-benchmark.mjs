#!/usr/bin/env node

import path from "node:path";

import {
  OUTPUT_DIR,
  adversarialHardness,
  buildAdversarialTypes,
  buildHumanOutcomeClass,
  ensureOutputDir,
  finiteNumber,
  loadCurrentBatchRouteIndex,
  loadJapaneseReviewDatasets,
  nowIso,
  summarizeAdversarialCaseTypes,
  writeJsonl,
  writeMarkdown,
} from "./next-language-validation-lib.mjs";

const MAX_PRIMARY = 45;
const MAX_SECONDARY = 20;

ensureOutputDir();

const datasets = loadJapaneseReviewDatasets();
const currentRouteIndex = loadCurrentBatchRouteIndex("ja");
const benchmarkRows = buildAdversarialBenchmarkRows(datasets);

const benchmarkPath = path.join(OUTPUT_DIR, "adversarial_benchmark.jsonl");
const summaryPath = path.join(OUTPUT_DIR, "adversarial_benchmark_summary.md");

await writeJsonl(benchmarkPath, benchmarkRows);
await writeMarkdown(summaryPath, buildSummaryMarkdown(benchmarkRows));

console.log(JSON.stringify({
  benchmarkRows: benchmarkRows.length,
  benchmarkPath,
  summaryPath,
}, null, 2));

function buildAdversarialBenchmarkRows({ reviewByKey, evalByKey, groupedReviewRows }) {
  const rows = [];

  for (const [key, reviewRow] of reviewByKey.entries()) {
    const evalRow = evalByKey.get(key) ?? null;
    const relatedRows = groupedReviewRows.get(key) ?? [reviewRow];
    const adversarialCaseTypes = buildAdversarialTypes(reviewRow, evalRow, relatedRows);
    if (!isCandidateCase(adversarialCaseTypes)) {
      continue;
    }

    const hardnessScore = adversarialHardness(reviewRow, evalRow, adversarialCaseTypes);
    rows.push({
      benchmarkKey: key,
      sourceBatchId: reviewRow.sourceBatchId,
      sourceItemId: reviewRow.sourceItemId,
      sourceImage: reviewRow.sourceImage,
      sourceScreenshotPath: reviewRow.sourceScreenshotPath,
      reviewRecordId: reviewRow.reviewRecordId,
      relatedReviewRecordIds: relatedRows.map((row) => row.reviewRecordId),
      reviewFlow: reviewRow.reviewFlow,
      reviewSection: reviewRow.reviewSection,
      decisionCapturedAt: reviewRow.decisionCapturedAt,
      finalDecision: reviewRow.finalDecision,
      finalQid: reviewRow.finalQid,
      humanOutcomeClass: buildHumanOutcomeClass(reviewRow, evalRow),
      autoSuggestedQid: reviewRow.autoSuggestedQid ?? evalRow?.auto_suggested_qid ?? null,
      autoSuggestedScore: reviewRow.autoSuggestedScore ?? finiteNumber(evalRow?.auto_suggested_score),
      autoSuggestedScoreGap: reviewRow.autoSuggestedScoreGap ?? finiteNumber(evalRow?.auto_suggested_score_gap),
      trustBand: reviewRow.trustBand ?? evalRow?.trust_band ?? null,
      adversarialCaseTypes,
      hardnessScore,
      choiceType: reviewRow.choiceType,
      visibleOptionLetters: reviewRow.visibleOptionLetters ?? [],
      hasImage: reviewRow.hasImage === true,
      sourceProvisionalTopic: reviewRow.sourceProvisionalTopic ?? null,
      finalTopic: reviewRow.finalTopic ?? null,
      finalSubtopics: reviewRow.finalSubtopics ?? [],
      answerKeyChanged: reviewRow.answerKeyChanged ?? (evalRow?.answer_key_changed === "true"),
      topicChanged: reviewRow.topicChanged ?? (evalRow?.topic_changed === "true"),
      subtopicChanged: reviewRow.subtopicChanged ?? (evalRow?.subtopic_changed === "true"),
      reviewerNotes: reviewRow.reviewerNotes ?? null,
      reason: reviewRow.reason ?? null,
      status: reviewRow.status ?? null,
      localePromptText: reviewRow.localePromptText ?? null,
      translatedPromptText: reviewRow.translatedPromptText ?? null,
      topCandidateCount: reviewRow.topCandidateCount ?? (Array.isArray(reviewRow.topCandidateSet) ? reviewRow.topCandidateSet.length : 0),
      topCandidateSet: Array.isArray(reviewRow.topCandidateSet) ? reviewRow.topCandidateSet.slice(0, 5) : [],
      currentBaselineSection: currentRouteIndex.get(key)?.section ?? null,
      currentBaselineRoute: currentRouteIndex.get(key)?.route ?? null,
      selectedBecause: buildSelectionReason(reviewRow, adversarialCaseTypes),
    });
  }

  const currentMatchedRisk = rows.filter((row) =>
    row.currentBaselineRoute === "auto-match ok" &&
    row.adversarialCaseTypes.some((type) => ["override", "create_new", "unresolved", "delete"].includes(type)),
  );
  const alwaysKeep = rows.filter((row) =>
    row.adversarialCaseTypes.some((type) => ["create_new", "unresolved", "delete"].includes(type)),
  );
  const primary = rows
    .filter((row) =>
      !currentMatchedRisk.some((kept) => kept.benchmarkKey === row.benchmarkKey) &&
      !alwaysKeep.some((kept) => kept.benchmarkKey === row.benchmarkKey) &&
      row.adversarialCaseTypes.some((type) => ["override", "answer_key_change", "ambiguous_near_match"].includes(type)),
    )
    .sort(compareRows)
    .slice(0, MAX_PRIMARY);
  const secondary = rows
    .filter((row) =>
      !currentMatchedRisk.some((kept) => kept.benchmarkKey === row.benchmarkKey) &&
      !alwaysKeep.some((kept) => kept.benchmarkKey === row.benchmarkKey) &&
      !primary.some((kept) => kept.benchmarkKey === row.benchmarkKey) &&
      row.adversarialCaseTypes.some((type) => ["image_heavy", "topic_drift", "structural_risk"].includes(type)),
    )
    .sort(compareRows)
    .slice(0, MAX_SECONDARY);

  const selected = [...currentMatchedRisk, ...alwaysKeep, ...primary, ...secondary]
    .sort(compareRows)
    .map((row, index) => ({
      benchmarkId: `adv-${String(index + 1).padStart(3, "0")}`,
      benchmarkRank: index + 1,
      ...row,
    }));

  return selected;
}

function isCandidateCase(caseTypes) {
  return caseTypes.some((type) =>
    [
      "override",
      "answer_key_change",
      "topic_drift",
      "create_new",
      "unresolved",
      "delete",
      "image_heavy",
      "structural_risk",
      "ambiguous_near_match",
    ].includes(type),
  );
}

function compareRows(left, right) {
  return (
    right.hardnessScore - left.hardnessScore ||
    (Number(right.autoSuggestedScore ?? 0) - Number(left.autoSuggestedScore ?? 0)) ||
    String(left.benchmarkKey).localeCompare(String(right.benchmarkKey))
  );
}

function buildSelectionReason(row, caseTypes) {
  const reasons = [];
  if (caseTypes.includes("delete")) reasons.push("final terminal state was delete-question");
  if (caseTypes.includes("unresolved")) reasons.push("final terminal state was keep-unresolved");
  if (caseTypes.includes("create_new")) reasons.push("human reviewer created a new question instead of approving an existing qid");
  if (caseTypes.includes("override")) reasons.push("top-1 automatch was overridden to a different qid");
  if (caseTypes.includes("answer_key_change")) reasons.push("local answer key changed during review");
  if (caseTypes.includes("ambiguous_near_match")) reasons.push("candidate ranking or score gap indicated a near-match ambiguity");
  if (caseTypes.includes("image_heavy")) reasons.push("prompt/topic looks sign, signal, or marking heavy");
  if (caseTypes.includes("structural_risk")) reasons.push("source looked structurally unreliable or had no strong shortlist");
  if (caseTypes.includes("topic_drift")) reasons.push("topic or subtopic drift was recorded during review");
  return reasons.join("; ");
}

function buildSummaryMarkdown(rows) {
  const counts = summarizeAdversarialCaseTypes(rows);
  const batches = {};
  for (const row of rows) {
    batches[row.sourceBatchId] = (batches[row.sourceBatchId] ?? 0) + 1;
  }

  return [
    "# Adversarial Benchmark Summary",
    "",
    `Generated at ${nowIso()}.`,
    "",
    "## Composition",
    "",
    `- benchmark rows: ${rows.length}`,
    `- currently risky matched cases kept explicitly: ${rows.filter((row) => row.currentBaselineRoute === "auto-match ok").length}`,
    ...Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .map(([type, count]) => `- ${type}: ${count}`),
    "",
    "## Batch Coverage",
    "",
    ...Object.entries(batches)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([batchId, count]) => `- ${batchId}: ${count}`),
    "",
    "## Selection Policy",
    "",
    "- Always keep terminal-risk cases: create-new, unresolved, and delete.",
    "- Then keep the highest-hardness override, answer-key-change, and ambiguous-near-match cases.",
    "- Then add sign-heavy, topic-drift, and structural-risk cases until the benchmark includes the hardest remaining risky patterns.",
    "",
    "## Notes",
    "",
    "- Rows are deduplicated by underlying batch source item so consolidated backlog follow-ups collapse onto the latest terminal state.",
    "- This benchmark is intentionally adversarial, not representative. It is biased toward historically difficult Japanese review cases.",
  ].join("\n");
}
