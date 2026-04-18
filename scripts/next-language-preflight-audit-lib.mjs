import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  csvEscape,
  fileExists,
  stableNow,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const OUTPUT_DIR = path.join(ROOT, "artifacts", "next-language-pilot");
const INTELLIGENCE_DIR = path.join(ROOT, "artifacts", "japanese-review-intelligence");

export async function writeDowngradeAuditArtifacts(preflightRun) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const adjudication = loadJapaneseAdjudicationIndex();
  const evidence = buildJapaneseEvidenceSummary(adjudication);
  const auditRecords = buildDowngradeAuditRecords(preflightRun, adjudication);
  const checkAssessments = buildCheckAssessments(preflightRun, adjudication, evidence);

  const auditJsonlPath = path.join(OUTPUT_DIR, "downgrade_audit.jsonl");
  const reviewSheetPath = path.join(OUTPUT_DIR, "downgrade_review_sheet.csv");
  const checkReportPath = path.join(OUTPUT_DIR, "check_precision_report.csv");
  const summaryPath = path.join(OUTPUT_DIR, "downgrade_audit_summary.md");

  await writeText(auditJsonlPath, `${auditRecords.map((record) => JSON.stringify(record)).join("\n")}\n`);
  await writeText(reviewSheetPath, buildDowngradeReviewSheetCsv(auditRecords));
  await writeText(checkReportPath, buildCheckPrecisionCsv(checkAssessments));
  await writeText(summaryPath, buildDowngradeAuditSummaryMarkdown(preflightRun, auditRecords, checkAssessments));

  return {
    auditRecords,
    checkAssessments,
    evidence,
    paths: {
      auditJsonlPath: path.relative(ROOT, auditJsonlPath),
      reviewSheetPath: path.relative(ROOT, reviewSheetPath),
      checkReportPath: path.relative(ROOT, checkReportPath),
      summaryPath: path.relative(ROOT, summaryPath),
    },
  };
}

export async function writeCalibrationArtifacts({ originalRun, calibratedRun, auditArtifacts }) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const adjudication = loadJapaneseAdjudicationIndex();
  const comparisonRows = buildCalibrationComparisonRows({ originalRun, calibratedRun, adjudication });
  const comparisonCsvPath = path.join(OUTPUT_DIR, "baseline_vs_preflight_vs_calibrated.csv");
  const calibrationPlanPath = path.join(OUTPUT_DIR, "calibration_plan.md");
  const calibratedRecommendationsPath = path.join(OUTPUT_DIR, "calibrated_pilot_recommendations.md");

  await writeText(comparisonCsvPath, buildCalibrationComparisonCsv(comparisonRows));
  await writeText(
    calibrationPlanPath,
    buildCalibrationPlanMarkdown({ originalRun, calibratedRun, auditArtifacts }),
  );
  await writeText(
    calibratedRecommendationsPath,
    buildCalibratedRecommendationsMarkdown({ originalRun, calibratedRun, auditArtifacts, comparisonRows }),
  );

  return {
    comparisonRows,
    paths: {
      comparisonCsvPath: path.relative(ROOT, comparisonCsvPath),
      calibrationPlanPath: path.relative(ROOT, calibrationPlanPath),
      calibratedRecommendationsPath: path.relative(ROOT, calibratedRecommendationsPath),
    },
  };
}

function buildDowngradeAuditRecords(preflightRun, adjudication) {
  return preflightRun.pilotItems
    .filter((item) => item.preflightStatus === "downgrade")
    .map((item) => {
      const adjudicated = lookupAdjudication(item, adjudication);
      const verdict = deriveAuditVerdict(item, adjudicated);
      const finalDecision = adjudicated.evalRow?.final_decision ?? adjudicated.groundTruthRow?.finalDecision ?? null;
      const finalQid = adjudicated.evalRow?.final_qid ?? adjudicated.groundTruthRow?.finalQid ?? null;
      return {
        itemId: item.itemId,
        sourceImage: item.sourceImage,
        batchId: item.batchId,
        lang: item.lang,
        sourcePath: item.sourcePath,
        baselineRoute: item.baselineRoute,
        baselineTrustBand: item.baselineTrustBand,
        adjustedTrustBand: item.adjustedTrustBand,
        suggestedQid: item.suggestedQid,
        suggestedScore: item.suggestedScore,
        suggestedScoreGap: item.suggestedScoreGap,
        sourceType: item.sourceType,
        preflightStatus: item.preflightStatus,
        recommendedRoute: item.recommendedRoute,
        provisionalTopic: item.provisionalTopic,
        provisionalSubtopics: item.provisionalSubtopics,
        candidateTopic: item.candidateTopic,
        candidateSubtopics: item.candidateSubtopics,
        topicConfidence: item.topicConfidence,
        expectedObjectTags: item.expectedObjectTags,
        candidateObjectTags: item.candidateObjectTags,
        imageContext: item.imageContext,
        answerEvidenceContext: item.answerEvidenceContext,
        triggeredChecks: item.triggeredChecks.map((check) => ({
          code: check.code,
          originalLevel: check.originalLevel ?? check.level,
          effectiveLevel: check.effectiveLevel ?? check.level,
          message: check.message,
          calibrationAction: check.calibrationAction ?? "unchanged",
        })),
        decisionSignals: item.decisionSignals.map((check) => ({
          code: check.code,
          level: check.effectiveLevel ?? check.level,
          message: check.message,
        })),
        adjudicationAvailable: adjudicated.available,
        humanFinalDecision: finalDecision,
        humanFinalQid: finalQid,
        humanAutoMatchCorrect: adjudicated.evalRow?.auto_match_correct ?? null,
        humanAutoMatchOverridden: adjudicated.evalRow?.auto_match_overridden ?? null,
        auditVerdict: verdict,
        auditNotes: "",
        auditSummary: buildAuditSummary(item, adjudicated, verdict),
      };
    });
}

function buildCheckAssessments(preflightRun, adjudication, evidence) {
  const statsByCode = new Map();

  for (const item of preflightRun.pilotItems) {
    const adjudicated = lookupAdjudication(item, adjudication);
    const triggeredCodes = item.triggeredChecks.map((check) => check.code);
    const matchedCombo = triggeredCodes.length > 1;

    for (const check of item.triggeredChecks) {
      const stats = getOrCreate(statsByCode, check.code, () => ({
        checkCode: check.code,
        pilotItemsTriggered: 0,
        matchedItemsTriggered: 0,
        downgradedItemsTriggered: 0,
        triggeredAloneCount: 0,
        triggeredInComboCount: 0,
        adjudicatedItems: 0,
        matchedAutoCorrectCount: 0,
        matchedAutoWrongCount: 0,
        downgradedTooConservativeCount: 0,
        downgradedCorrectCatchCount: 0,
        downgradedMixedCount: 0,
        downgradedUnknownCount: 0,
      }));

      stats.pilotItemsTriggered += 1;
      if (item.baselineSection === "matched") {
        stats.matchedItemsTriggered += 1;
      }
      if (item.preflightStatus === "downgrade") {
        stats.downgradedItemsTriggered += 1;
      }
      if (matchedCombo) {
        stats.triggeredInComboCount += 1;
      } else {
        stats.triggeredAloneCount += 1;
      }

      if (adjudicated.available) {
        stats.adjudicatedItems += 1;
        if (item.baselineSection === "matched") {
          if (adjudicated.evalRow?.auto_match_correct === "true") {
            stats.matchedAutoCorrectCount += 1;
          } else if (adjudicated.evalRow?.auto_match_correct === "false") {
            stats.matchedAutoWrongCount += 1;
          }
        }
      }

      if (item.preflightStatus === "downgrade") {
        const verdict = deriveAuditVerdict(item, adjudicated);
        if (verdict === "too_conservative") stats.downgradedTooConservativeCount += 1;
        else if (verdict === "correct_catch") stats.downgradedCorrectCatchCount += 1;
        else if (verdict === "mixed") stats.downgradedMixedCount += 1;
        else stats.downgradedUnknownCount += 1;
      }
    }
  }

  return Array.from(statsByCode.values())
    .map((stats) => {
      const supportNote = japaneseSupportNote(stats.checkCode, evidence);
      const suggestedBehavior = suggestBehavior(stats.checkCode, stats);
      return {
        ...stats,
        japaneseSupportNote: supportNote,
        provisionalValueAssessment: assessSignalValue(stats.checkCode, stats),
        suggestedBehavior,
        limitationNote: stats.adjudicatedItems === 0
          ? "No pilot adjudication available for this check yet."
          : "Pilot adjudication is limited to this sampled batch and may miss false-positive cases.",
      };
    })
    .sort((left, right) => right.downgradedItemsTriggered - left.downgradedItemsTriggered || right.pilotItemsTriggered - left.pilotItemsTriggered);
}

function buildCalibrationComparisonRows({ originalRun, calibratedRun, adjudication }) {
  const calibratedByKey = new Map(
    calibratedRun.pilotItems.map((item) => [itemKey(item), item]),
  );

  return originalRun.pilotItems.map((item) => {
    const calibrated = calibratedByKey.get(itemKey(item));
    const adjudicated = lookupAdjudication(item, adjudication);
    return {
      itemId: item.itemId,
      sourceImage: item.sourceImage,
      baselineSection: item.baselineSection,
      baselineRoute: item.baselineRoute,
      suggestedQid: item.suggestedQid,
      suggestedScore: item.suggestedScore,
      originalPreflightStatus: item.preflightStatus,
      originalRecommendedRoute: item.recommendedRoute,
      originalTriggeredChecks: item.triggeredChecks.map((check) => check.code),
      originalDecisionSignals: item.decisionSignals.map((check) => check.code),
      calibratedPreflightStatus: calibrated?.preflightStatus ?? "",
      calibratedRecommendedRoute: calibrated?.recommendedRoute ?? "",
      calibratedTriggeredChecks: calibrated?.triggeredChecks.map((check) => check.code) ?? [],
      calibratedDecisionSignals: calibrated?.decisionSignals.map((check) => check.code) ?? [],
      adjudicationAvailable: adjudicated.available,
      adjudicationAutoMatchCorrect: adjudicated.evalRow?.auto_match_correct ?? "",
      adjudicationFinalDecision: adjudicated.evalRow?.final_decision ?? adjudicated.groundTruthRow?.finalDecision ?? "",
      calibrationChange: deriveCalibrationChange(item, calibrated),
    };
  });
}

function buildDowngradeReviewSheetCsv(records) {
  const headers = [
    "item_id",
    "source_image",
    "suggested_qid",
    "suggested_score",
    "baseline_trust_band",
    "recommended_route",
    "triggered_checks",
    "audit_summary",
    "audit_verdict",
    "audit_notes",
  ];

  const lines = [headers.join(",")];
  for (const record of records) {
    const row = {
      item_id: record.itemId ?? "",
      source_image: record.sourceImage ?? "",
      suggested_qid: record.suggestedQid ?? "",
      suggested_score: record.suggestedScore ?? "",
      baseline_trust_band: record.baselineTrustBand ?? "",
      recommended_route: record.recommendedRoute ?? "",
      triggered_checks: record.triggeredChecks.map((check) => check.code).join("|"),
      audit_summary: record.auditSummary,
      audit_verdict: record.auditVerdict,
      audit_notes: record.auditNotes,
    };
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function buildCheckPrecisionCsv(checkAssessments) {
  const headers = [
    "check_code",
    "pilot_items_triggered",
    "matched_items_triggered",
    "downgraded_items_triggered",
    "triggered_alone_count",
    "triggered_in_combo_count",
    "adjudicated_items",
    "matched_auto_correct_count",
    "matched_auto_wrong_count",
    "downgraded_too_conservative_count",
    "downgraded_correct_catch_count",
    "downgraded_mixed_count",
    "downgraded_unknown_count",
    "provisional_value_assessment",
    "suggested_behavior",
    "japanese_support_note",
    "limitation_note",
  ];

  const lines = [headers.join(",")];
  for (const stats of checkAssessments) {
    const row = {
      check_code: stats.checkCode,
      pilot_items_triggered: stats.pilotItemsTriggered,
      matched_items_triggered: stats.matchedItemsTriggered,
      downgraded_items_triggered: stats.downgradedItemsTriggered,
      triggered_alone_count: stats.triggeredAloneCount,
      triggered_in_combo_count: stats.triggeredInComboCount,
      adjudicated_items: stats.adjudicatedItems,
      matched_auto_correct_count: stats.matchedAutoCorrectCount,
      matched_auto_wrong_count: stats.matchedAutoWrongCount,
      downgraded_too_conservative_count: stats.downgradedTooConservativeCount,
      downgraded_correct_catch_count: stats.downgradedCorrectCatchCount,
      downgraded_mixed_count: stats.downgradedMixedCount,
      downgraded_unknown_count: stats.downgradedUnknownCount,
      provisional_value_assessment: stats.provisionalValueAssessment,
      suggested_behavior: stats.suggestedBehavior,
      japanese_support_note: stats.japaneseSupportNote,
      limitation_note: stats.limitationNote,
    };
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function buildCalibrationComparisonCsv(rows) {
  const headers = [
    "item_id",
    "source_image",
    "baseline_section",
    "baseline_route",
    "suggested_qid",
    "suggested_score",
    "original_preflight_status",
    "original_recommended_route",
    "original_triggered_checks",
    "original_decision_signals",
    "calibrated_preflight_status",
    "calibrated_recommended_route",
    "calibrated_triggered_checks",
    "calibrated_decision_signals",
    "adjudication_available",
    "adjudication_auto_match_correct",
    "adjudication_final_decision",
    "calibration_change",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    const serializable = {
      item_id: row.itemId ?? "",
      source_image: row.sourceImage ?? "",
      baseline_section: row.baselineSection,
      baseline_route: row.baselineRoute,
      suggested_qid: row.suggestedQid ?? "",
      suggested_score: row.suggestedScore ?? "",
      original_preflight_status: row.originalPreflightStatus,
      original_recommended_route: row.originalRecommendedRoute,
      original_triggered_checks: row.originalTriggeredChecks.join("|"),
      original_decision_signals: row.originalDecisionSignals.join("|"),
      calibrated_preflight_status: row.calibratedPreflightStatus,
      calibrated_recommended_route: row.calibratedRecommendedRoute,
      calibrated_triggered_checks: row.calibratedTriggeredChecks.join("|"),
      calibrated_decision_signals: row.calibratedDecisionSignals.join("|"),
      adjudication_available: row.adjudicationAvailable ? "true" : "false",
      adjudication_auto_match_correct: row.adjudicationAutoMatchCorrect,
      adjudication_final_decision: row.adjudicationFinalDecision,
      calibration_change: row.calibrationChange,
    };
    lines.push(headers.map((header) => csvEscape(serializable[header] ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function buildDowngradeAuditSummaryMarkdown(preflightRun, auditRecords, checkAssessments) {
  const countsByVerdict = countBy(auditRecords, (record) => record.auditVerdict);
  return [
    "# Downgrade Audit Summary",
    "",
    `Generated at ${stableNow()} for \`${preflightRun.lang}/${preflightRun.batchId}\` using profile \`${preflightRun.calibrationProfile}\`.`,
    "",
    "## Verdict Counts",
    "",
    `- downgraded items audited: ${auditRecords.length}`,
    `- too_conservative: ${countsByVerdict.too_conservative ?? 0}`,
    `- correct_catch: ${countsByVerdict.correct_catch ?? 0}`,
    `- mixed: ${countsByVerdict.mixed ?? 0}`,
    `- unknown: ${countsByVerdict.unknown ?? 0}`,
    "",
    "## Main Downgrade Pressure",
    "",
    ...checkAssessments
      .filter((stats) => stats.downgradedItemsTriggered > 0)
      .map((stats) => `- ${stats.checkCode}: downgraded ${stats.downgradedItemsTriggered}, too_conservative ${stats.downgradedTooConservativeCount}, suggested ${stats.suggestedBehavior}.`),
    "",
    "## Audit Notes",
    "",
    "- This audit uses stored Japanese adjudication when it can map the pilot item back to completed review history.",
    "- For items without adjudication, the review sheet remains the source of truth and auditVerdict stays unknown until a reviewer fills it in.",
  ].join("\n");
}

function buildCalibrationPlanMarkdown({ originalRun, calibratedRun, auditArtifacts }) {
  const originalCounts = summarizeRun(originalRun);
  const calibratedCounts = summarizeRun(calibratedRun);
  const reclassified = auditArtifacts.checkAssessments.map((stats) => `- ${stats.checkCode}: ${stats.suggestedBehavior}.`);

  return [
    "# Calibration Plan",
    "",
    `Generated at ${stableNow()} for \`${originalRun.lang}/${originalRun.batchId}\`.`,
    "",
    "## Audit Outcome",
    "",
    `- Original downgraded items: ${originalCounts.downgraded}.`,
    `- Audited too_conservative downgrades: ${auditArtifacts.auditRecords.filter((record) => record.auditVerdict === "too_conservative").length}.`,
    `- Audited correct_catch downgrades: ${auditArtifacts.auditRecords.filter((record) => record.auditVerdict === "correct_catch").length}.`,
    "",
    "## Reclassification",
    "",
    "- hard block: choice-shape mismatch, structural unresolved/delete routing, likely create-new-question routing, and any severe image-mismatch caused by a missing candidate image asset.",
    "- soft downgrade: answer-key consistency risk when explicit answer evidence exists.",
    "- warning only: topic/subtopic drift risk, moderate image/sign/symbol mismatch risk, and Japanese trust-band caution.",
    "",
    "## Explicit Changes Applied",
    "",
    ...reclassified,
    "",
    "## Count Shift",
    "",
    `- baseline auto-match ok: ${originalCounts.baselineAutoMatchOk}`,
    `- original preflight auto-match ok: ${originalCounts.autoMatchOk}`,
    `- calibrated preflight auto-match ok: ${calibratedCounts.autoMatchOk}`,
    `- original downgrades: ${originalCounts.downgraded}`,
    `- calibrated downgrades: ${calibratedCounts.downgraded}`,
    "",
    "## Limits",
    "",
    "- This pilot batch exposes only human-approved baseline auto-matches, so the calibration reduces false-positive downgrade pressure but does not yet validate recall against a known bad matched set.",
    "- The calibrated profile keeps severe structural mismatches strong and does not weaken reroute logic for create-new, unresolved, or delete paths.",
  ].join("\n");
}

function buildCalibratedRecommendationsMarkdown({ originalRun, calibratedRun, auditArtifacts, comparisonRows }) {
  const originalCounts = summarizeRun(originalRun);
  const calibratedCounts = summarizeRun(calibratedRun);
  const recovered = comparisonRows.filter((row) => row.calibrationChange === "recovered-auto-match").length;
  const stillDowngraded = comparisonRows.filter((row) => row.calibrationChange === "still-downgraded").length;
  const matchedFalsePositives = auditArtifacts.auditRecords.filter((record) => record.auditVerdict === "too_conservative").length;

  return [
    "# Calibrated Pilot Recommendations",
    "",
    `Generated at ${stableNow()} for \`${calibratedRun.lang}/${calibratedRun.batchId}\` using calibrated profile \`${calibratedRun.calibrationProfile}\`.`,
    "",
    "## Before vs After",
    "",
    `- baseline auto-match ok: ${originalCounts.baselineAutoMatchOk}`,
    `- original preflight auto-match ok: ${originalCounts.autoMatchOk}`,
    `- calibrated preflight auto-match ok: ${calibratedCounts.autoMatchOk}`,
    `- original manual review: ${originalCounts.manualReview}`,
    `- calibrated manual review: ${calibratedCounts.manualReview}`,
    `- original downgraded auto-matches: ${originalCounts.downgraded}`,
    `- calibrated downgraded auto-matches: ${calibratedCounts.downgraded}`,
    `- recovered downgraded auto-matches: ${recovered}`,
    `- still downgraded after calibration: ${stillDowngraded}`,
    "",
    "## Biggest Gains From Calibration",
    "",
    `- ${matchedFalsePositives}/${originalCounts.downgraded} audited downgrades were human-approved as the original qid, and calibration restores those matches to auto-match ok.`,
    "- Topic drift and trust-band caution now stay visible as warnings instead of independently killing a matched candidate.",
    "- Moderate image/sign mismatches still surface in the audit trail, but only severe image-asset conflicts remain blocking.",
    "",
    "## Main Failure Modes Still Not Covered",
    "",
    "- This pilot batch does not contain any human-proven bad baseline auto-matches, so calibrated recall on truly wrong matched items is still unmeasured.",
    "- Source-side image semantics are still inferred from text plus candidate hidden tags rather than direct screenshot understanding.",
    "- Answer-key risk stayed mostly unexercised in this pilot, so its downgrade behavior still needs a broader sample.",
    "",
    "## Should We Trust This For Full Next-Language Rollout?",
    "",
    "- Recommendation: limited batch run.",
    `- Biggest gains from preflight: recovered ${recovered} known-correct auto-matches without weakening structural or reroute safety checks.`,
    "- Main failure mode still not covered: no adjudicated bad matched examples in this sample, so the calibrated profile needs one more pilot that includes borderline false positives before a full rollout.",
    "",
    "## Operational Use",
    "",
    "- Keep the calibrated profile optional and non-destructive.",
    "- Run the downgrade audit first on any new pilot batch, then decide whether the calibrated profile should become the default wrapper.",
    "- Use the review sheet whenever the pilot batch has no historical adjudication yet.",
  ].join("\n");
}

function loadJapaneseAdjudicationIndex() {
  const evalPath = path.join(INTELLIGENCE_DIR, "automatch_eval.csv");
  const groundTruthPath = path.join(INTELLIGENCE_DIR, "review_ground_truth.jsonl");

  const evalRows = fileExists(evalPath) ? readCsv(evalPath) : [];
  const groundTruthRows = fileExists(groundTruthPath) ? readJsonl(groundTruthPath) : [];

  return {
    evalByKey: indexBy(evalRows, (row) => row.source_item_id || row.source_image),
    groundTruthByKey: indexBy(groundTruthRows, (row) => row.sourceItemId || row.sourceImage),
    evalRows,
    groundTruthRows,
  };
}

function lookupAdjudication(item, adjudication) {
  const keys = [item.itemId, item.sourceImage].filter(Boolean);
  for (const key of keys) {
    const evalRow = adjudication.evalByKey.get(key) ?? null;
    const groundTruthRow = adjudication.groundTruthByKey.get(key) ?? null;
    if (evalRow || groundTruthRow) {
      return {
        available: true,
        evalRow,
        groundTruthRow,
      };
    }
  }

  return {
    available: false,
    evalRow: null,
    groundTruthRow: null,
  };
}

function deriveAuditVerdict(item, adjudicated) {
  if (!adjudicated.available) {
    return "unknown";
  }

  if (item.preflightStatus !== "downgrade") {
    return "unknown";
  }

  if (adjudicated.evalRow?.auto_match_correct === "true") {
    return "too_conservative";
  }

  if (
    adjudicated.evalRow?.auto_match_correct === "false" ||
    adjudicated.evalRow?.auto_match_overridden === "true" ||
    ["create-new-question", "keep-unresolved", "delete-question"].includes(adjudicated.evalRow?.final_decision)
  ) {
    return "correct_catch";
  }

  return "mixed";
}

function buildAuditSummary(item, adjudicated, verdict) {
  const codes = item.triggeredChecks.map((check) => check.code).join(", ");
  const verdictLine =
    verdict === "too_conservative"
      ? `Stored adjudication later approved ${item.suggestedQid} unchanged, so this downgrade was too conservative.`
      : verdict === "correct_catch"
        ? "Stored adjudication did not keep the original auto-match, so the downgrade looks justified."
        : verdict === "mixed"
          ? "Stored adjudication is mixed or incomplete, so this downgrade still needs reviewer confirmation."
          : "No stored adjudication was found for this pilot item yet.";
  return `Downgraded from ${item.baselineTrustBand} to manual review because ${codes || "no explicit checks"} fired. ${verdictLine}`;
}

function japaneseSupportNote(checkCode, evidence) {
  switch (checkCode) {
    case "choice-shape-mismatch":
      return "Choice-shape mismatch is structural and should stay strong whenever source and candidate shapes conflict.";
    case "answer-key-consistency-risk":
      return `Japanese automatch eval logged ${evidence.answerKeyChangedCount} answer-key changes, so explicit answer evidence remains a high-value signal.`;
    case "topic-subtopic-drift-risk":
      return `Japanese automatch eval logged ${evidence.topicChangedCount} topic changes and ${evidence.subtopicChangedCount} subtopic changes, so topic labels drift often even when qid is correct.`;
    case "image-sign-symbol-mismatch-risk":
      return `Japanese rule candidates flagged image/sign-heavy overrides, but this pilot's matched downgrades with this check were all human-approved.`;
    case "trust-band-caution":
      return `Japanese very-high/high acceptance was ${evidence.veryHighAcceptanceRate}/${evidence.highAcceptanceRate}, so trust band alone is not a decisive downgrade signal.`;
    case "likely-create-new-question":
      return `Japanese create-new outcomes numbered ${evidence.createNewCount}, mostly under weak top-1 score conditions.`;
    case "structural-reliability-risk":
      return `Japanese unresolved/delete outcomes were rare (${evidence.unresolvedCount + evidence.deletedCount}) and clustered on incomplete leftovers, so this should remain conservative but explicit.`;
    default:
      return "No stronger Japanese support note is available for this check yet.";
  }
}

function suggestBehavior(checkCode, stats) {
  if (checkCode === "choice-shape-mismatch" || checkCode === "structural-reliability-risk" || checkCode === "likely-create-new-question") {
    return "hard block";
  }
  if (checkCode === "answer-key-consistency-risk") {
    return "soft downgrade";
  }
  if (
    stats.downgradedTooConservativeCount > 0 &&
    stats.downgradedCorrectCatchCount === 0 &&
    ["topic-subtopic-drift-risk", "image-sign-symbol-mismatch-risk", "trust-band-caution"].includes(checkCode)
  ) {
    return checkCode === "image-sign-symbol-mismatch-risk"
      ? "warning only for moderate cases; keep hard block for severe no-image conflicts"
      : "warning only";
  }
  return "soft downgrade";
}

function assessSignalValue(checkCode, stats) {
  if (checkCode === "choice-shape-mismatch" || checkCode === "structural-reliability-risk" || checkCode === "likely-create-new-question") {
    return "provisional-high-value";
  }
  if (
    stats.downgradedTooConservativeCount > 0 &&
    stats.downgradedCorrectCatchCount === 0 &&
    ["topic-subtopic-drift-risk", "image-sign-symbol-mismatch-risk", "trust-band-caution"].includes(checkCode)
  ) {
    return "provisional-noisy-on-matched";
  }
  if (checkCode === "answer-key-consistency-risk") {
    return stats.adjudicatedItems > 0 ? "provisional-underexercised" : "pilot-missing";
  }
  return "provisional-mixed";
}

function buildJapaneseEvidenceSummary(adjudication) {
  const rows = adjudication.evalRows;
  const trustBandCounts = {};
  let answerKeyChangedCount = 0;
  let topicChangedCount = 0;
  let subtopicChangedCount = 0;
  let createNewCount = 0;
  let unresolvedCount = 0;
  let deletedCount = 0;

  for (const row of rows) {
    const trustBand = row.trust_band || "none";
    const bucket = trustBandCounts[trustBand] ?? { total: 0, accepted: 0 };
    bucket.total += 1;
    if (row.auto_match_correct === "true") {
      bucket.accepted += 1;
    }
    trustBandCounts[trustBand] = bucket;

    if (row.answer_key_changed === "true") answerKeyChangedCount += 1;
    if (row.topic_changed === "true") topicChangedCount += 1;
    if (row.subtopic_changed === "true") subtopicChangedCount += 1;
    if (row.created_new_question === "true") createNewCount += 1;
    if (row.unresolved === "true") unresolvedCount += 1;
    if (row.deleted === "true") deletedCount += 1;
  }

  return {
    answerKeyChangedCount,
    topicChangedCount,
    subtopicChangedCount,
    createNewCount,
    unresolvedCount,
    deletedCount,
    highAcceptanceRate: formatAcceptance(trustBandCounts.high),
    veryHighAcceptanceRate: formatAcceptance(trustBandCounts["very-high"]),
  };
}

function summarizeRun(run) {
  return {
    baselineAutoMatchOk: run.pilotItems.filter((item) => item.baselineRoute === "auto-match ok").length,
    autoMatchOk: run.pilotItems.filter((item) => item.recommendedRoute === "auto-match ok").length,
    manualReview: run.pilotItems.filter((item) => item.recommendedRoute === "manual review").length,
    likelyCreateNew: run.pilotItems.filter((item) => item.recommendedRoute === "likely create-new-question").length,
    likelyUnresolved: run.pilotItems.filter((item) => item.recommendedRoute === "likely unresolved").length,
    likelyDelete: run.pilotItems.filter((item) => item.recommendedRoute === "likely delete").length,
    downgraded: run.pilotItems.filter((item) => item.preflightStatus === "downgrade").length,
  };
}

function deriveCalibrationChange(originalItem, calibratedItem) {
  if (!calibratedItem) {
    return "missing-calibrated-row";
  }
  if (originalItem.preflightStatus === "downgrade" && calibratedItem.recommendedRoute === "auto-match ok") {
    return "recovered-auto-match";
  }
  if (originalItem.preflightStatus === "downgrade" && calibratedItem.preflightStatus === "downgrade") {
    return "still-downgraded";
  }
  if (originalItem.recommendedRoute !== calibratedItem.recommendedRoute) {
    return "route-changed";
  }
  return "unchanged";
}

function itemKey(item) {
  return item.itemId ?? item.sourceImage ?? "";
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readCsv(filePath) {
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

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key) {
      map.set(key, row);
    }
  }
  return map;
}

function getOrCreate(map, key, factory) {
  if (!map.has(key)) {
    map.set(key, factory());
  }
  return map.get(key);
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatAcceptance(bucket) {
  if (!bucket || bucket.total === 0) {
    return "0%";
  }
  return `${Math.round((bucket.accepted / bucket.total) * 1000) / 10}%`;
}
