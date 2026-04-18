import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_DATASET,
  GENERATED_DIR,
  IMPORTS_DIR,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  ensureDir,
  loadQbankContext,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const LANG = "ja";
const OUTPUT_DIR = path.join(ROOT, "artifacts", "japanese-review-intelligence");
const JA_ARCHIVE_DIR = path.join(GENERATED_DIR, "archive", LANG);
const YES_NO_VALUES = new Set(["yes", "no", "right", "wrong", "true", "false"]);

const WORKFLOW_SCRIPT_PATHS = [
  "scripts/generate-batch-workbench.mjs",
  "scripts/apply-batch-workbench-decisions.mjs",
  "scripts/stage-reviewed-batch.mjs",
  "scripts/apply-unresolved-decisions.mjs",
  "scripts/generate-consolidated-backlog-workbench.mjs",
  "scripts/apply-consolidated-backlog-workbench-decisions.mjs",
  "scripts/prepare-new-question-promotion-preview.mjs",
  "scripts/apply-new-question-promotion.mjs",
  "scripts/apply-answer-key-decisions.mjs",
  "scripts/apply-production-localization-merge.mjs",
  "scripts/prepare-dry-run-merge-review.mjs",
  "scripts/build-full-batch-staging-preview.mjs",
  "scripts/generate-answer-key-review.mjs",
  "scripts/generate-single-answer-key-review.mjs",
  "scripts/stage-new-question-candidates.mjs",
  "scripts/generate-batch-review-artifact.mjs",
  "scripts/generate-unresolved-review-artifact.mjs",
  "scripts/apply-retro-auto-review-corrections.mjs",
];

export async function extractJapaneseReviewIntelligence({
  dataset = DEFAULT_DATASET,
} = {}) {
  await ensureDir(OUTPUT_DIR);

  const inventory = discoverJapaneseReviewInventory();
  const datasetMaps = loadDatasetMaps({ dataset });
  const sourceCatalog = buildSourceCatalog();
  const newQuestionCatalog = buildNewQuestionCatalog({ datasetMaps });
  const answerKeyCatalog = buildAnswerKeyCatalog();
  const records = buildGroundTruthRecords({
    dataset,
    datasetMaps,
    sourceCatalog,
    newQuestionCatalog,
    answerKeyCatalog,
  });
  const automatchRows = buildAutomatchEvalRows(records);
  const benchmarkRows = buildBenchmarkRows(records);
  const reusableRuleCandidates = buildReusableRuleCandidatesMarkdown({
    records,
    automatchRows,
  });
  const extractionSummary = buildExtractionSummaryMarkdown({
    dataset,
    inventory,
    records,
    automatchRows,
    benchmarkRows,
  });
  const nextLanguagePlan = buildNextLanguageBootstrapPlanMarkdown({
    records,
    automatchRows,
    benchmarkRows,
  });

  await writeJsonl(path.join(OUTPUT_DIR, "review_ground_truth.jsonl"), records);
  await writeText(path.join(OUTPUT_DIR, "automatch_eval.csv"), toCsv(automatchRows));
  await writeJsonl(path.join(OUTPUT_DIR, "benchmark_set.jsonl"), benchmarkRows);
  await writeText(path.join(OUTPUT_DIR, "reusable_rule_candidates.md"), reusableRuleCandidates);
  await writeText(path.join(OUTPUT_DIR, "extraction_summary.md"), extractionSummary);
  await writeText(path.join(OUTPUT_DIR, "next-language-bootstrap-plan.md"), nextLanguagePlan);

  const archiveManifest = buildArchiveManifest({ inventory });
  await writeJson(path.join(OUTPUT_DIR, "archive_manifest.json"), archiveManifest);

  return {
    outputDir: path.relative(ROOT, OUTPUT_DIR),
    inventory,
    records,
    automatchRows,
    benchmarkRows,
    archiveManifest,
  };
}

export async function planJapaneseCleanup({ dataset = DEFAULT_DATASET } = {}) {
  await ensureDir(OUTPUT_DIR);

  const inventory = discoverJapaneseReviewInventory({ dataset });
  const archiveManifest = buildArchiveManifest({ inventory });

  await writeJson(path.join(OUTPUT_DIR, "archive_manifest.json"), archiveManifest);

  return {
    outputPath: path.relative(ROOT, path.join(OUTPUT_DIR, "archive_manifest.json")),
    inventory,
    archiveManifest,
  };
}

function loadDatasetMaps({ dataset }) {
  const context = loadQbankContext({ dataset, referenceLang: "ko" });
  const questionMap = new Map(context.questions.map((question) => [question.qid, question]));
  const translationJaPath = path.join(ROOT, "public", "qbank", dataset, "translations.ja.json");
  const translationJaDoc = fileExists(translationJaPath) ? readJson(translationJaPath) : { questions: {} };
  const translationJaMap = new Map(Object.entries(translationJaDoc?.questions ?? {}));

  return {
    questionMap,
    translationJaMap,
    context,
  };
}

function discoverJapaneseReviewInventory() {
  const importsFiles = walkFiles(path.join(IMPORTS_DIR, LANG)).map((filePath) => toRelative(filePath));
  const activeStagingFiles = walkFiles(STAGING_DIR)
    .filter((filePath) => isJapaneseReviewArtifact(filePath))
    .map((filePath) => toRelative(filePath));
  const activeReportFiles = walkFiles(REPORTS_DIR)
    .filter((filePath) => isJapaneseReviewArtifact(filePath))
    .map((filePath) => toRelative(filePath));
  const archiveFiles = walkFiles(JA_ARCHIVE_DIR).map((filePath) => toRelative(filePath));
  const scriptFiles = WORKFLOW_SCRIPT_PATHS.filter((filePath) => fileExists(path.join(ROOT, filePath)));

  return {
    importsFiles: importsFiles.sort(),
    activeStagingFiles: activeStagingFiles.sort(),
    activeReportFiles: activeReportFiles.sort(),
    archiveFiles: archiveFiles.sort(),
    scriptFiles: scriptFiles.sort(),
  };
}

function buildSourceCatalog() {
  const batchIds = discoverBatchIds();
  const bySourceKey = new Map();
  const byBatchSection = new Map();

  for (const batchId of batchIds) {
    const batchDir = path.join(IMPORTS_DIR, LANG, batchId);
    const docs = [
      { section: "auto-matched", fileName: "matched.json" },
      { section: "review-needed", fileName: "review-needed.json" },
      { section: "unresolved", fileName: "unresolved.json" },
    ];

    for (const { section, fileName } of docs) {
      const docPath = path.join(batchDir, fileName);
      if (!fileExists(docPath)) {
        continue;
      }

      const doc = readJson(docPath);
      const items = Array.isArray(doc?.items) ? doc.items : [];
      const sectionMap = new Map();

      for (const item of items) {
        const normalized = normalizeSourceItem(item, {
          batchId,
          section,
          sourceDocPath: toRelative(docPath),
        });
        if (!normalized) {
          continue;
        }

        for (const key of normalized.lookupKeys) {
          bySourceKey.set(key, normalized);
          sectionMap.set(key, normalized);
        }
      }

      byBatchSection.set(`${batchId}:${section}`, sectionMap);
    }
  }

  const consolidatedBacklogPath = path.join(STAGING_DIR, "consolidated-backlog.ja.json");
  if (fileExists(consolidatedBacklogPath)) {
    const doc = readJson(consolidatedBacklogPath);
    for (const item of Array.isArray(doc?.items) ? doc.items : []) {
      const normalized = normalizeBacklogSourceItem(item, {
        sourceDocPath: toRelative(consolidatedBacklogPath),
      });
      if (!normalized) {
        continue;
      }
      for (const key of normalized.lookupKeys) {
        bySourceKey.set(key, normalized);
      }
    }
  }

  return {
    batchIds,
    bySourceKey,
    byBatchSection,
  };
}

function buildNewQuestionCatalog({ datasetMaps }) {
  const bySourceKey = new Map();
  const byCandidateId = new Map();
  const promotionByCandidateId = new Map();
  const promotedQidByCandidateId = new Map();

  for (const batchId of [...discoverBatchIds(), "consolidated-backlog"]) {
    const candidatesPath = resolveStagingArtifact(batchId, `new-question-candidates.${LANG}.${batchId}.json`);
    const decisionsPath = resolveStagingArtifact(batchId, `new-question-decisions.${LANG}.${batchId}.json`);
    const previewPath = resolveStagingArtifact(batchId, `new-question-promotion-preview.${LANG}.${batchId}.json`);
    const decisionBySourceImage = new Map();

    if (decisionsPath) {
      const doc = readJson(decisionsPath);
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        const sourceKey = compositeSourceKey(batchId, item?.itemId ?? item?.sourceImage);
        if (sourceKey) {
          bySourceKey.set(sourceKey, {
            ...(bySourceKey.get(sourceKey) ?? {}),
            decisionSnapshot: item,
            decisionPath: toRelative(decisionsPath),
          });
        }

        const sourceImage = normalizeText(item?.sourceImage);
        if (sourceImage) {
          decisionBySourceImage.set(sourceImage, item);
        }
      }
    }

    if (candidatesPath) {
      const doc = readJson(candidatesPath);
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        const sourceKeys = uniqueStrings([
          compositeSourceKey(batchId, item?.sourceImage ?? item?.itemId),
          compositeSourceKey(batchId, decisionBySourceImage.get(normalizeText(item?.sourceImage))?.itemId),
        ]);
        if (sourceKeys.length > 0) {
          for (const sourceKey of sourceKeys) {
            bySourceKey.set(sourceKey, {
              ...(bySourceKey.get(sourceKey) ?? {}),
              candidate: item,
              candidatePath: toRelative(candidatesPath),
            });
          }
        }
        const candidateId = normalizeText(item?.candidateId);
        if (candidateId) {
          byCandidateId.set(candidateId, {
            candidate: item,
            candidatePath: toRelative(candidatesPath),
          });
        }
      }
    }

    if (previewPath) {
      const doc = readJson(previewPath);
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        const candidateId = normalizeText(item?.candidateId);
        if (!candidateId) {
          continue;
        }
        promotionByCandidateId.set(candidateId, {
          preview: item,
          previewPath: toRelative(previewPath),
        });

        const proposedQid = proposedQidFromPreview(item);
        if (proposedQid && datasetMaps.questionMap.has(proposedQid)) {
          promotedQidByCandidateId.set(candidateId, proposedQid);
        }
      }
    }
  }

  return {
    bySourceKey,
    byCandidateId,
    promotionByCandidateId,
    promotedQidByCandidateId,
  };
}

function buildAnswerKeyCatalog() {
  const byBatchQid = new Map();
  const byBatchSourceKey = new Map();

  for (const batchId of discoverBatchIds()) {
    const regularPath = resolveStagingArtifact(batchId, `ja-${batchId}-answer-key-decisions.json`);
    const reviewScopePath = resolveStagingArtifact(batchId, `ja-${batchId}-answer-key-decisions.review-scope.json`);

    for (const candidatePath of [regularPath, reviewScopePath]) {
      ingestAnswerKeyFile(candidatePath, batchId, byBatchQid, byBatchSourceKey);
    }

    for (const candidatePath of resolveSpecialAnswerKeyFiles(batchId)) {
      ingestAnswerKeyFile(candidatePath, batchId, byBatchQid, byBatchSourceKey);
    }
  }

  return {
    byBatchQid,
    byBatchSourceKey,
  };
}

function buildGroundTruthRecords({
  dataset,
  datasetMaps,
  sourceCatalog,
  newQuestionCatalog,
  answerKeyCatalog,
}) {
  const records = [];

  for (const batchId of sourceCatalog.batchIds) {
    const workbenchPath = resolveStagingArtifact(batchId, `ja-${batchId}-workbench-decisions.json`);
    if (workbenchPath) {
      const doc = readJson(workbenchPath);
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        records.push(buildGroundTruthRecord({
          batchId,
          dataset,
          rawDecision: item,
          decisionPath: toRelative(workbenchPath),
          decisionGeneratedAt: doc?.generatedAt ?? doc?.exportedAt ?? null,
          sourceCatalog,
          sourceLookupSection: normalizeText(item?.section),
          reviewFlow: "batch-workbench",
          datasetMaps,
          newQuestionCatalog,
          answerKeyCatalog,
        }));
      }
    }

    const retroPath = resolveStagingArtifact(batchId, `ja-${batchId}-retro-auto-workbench-decisions.json`);
    if (retroPath) {
      const doc = readJson(retroPath);
      for (const item of Array.isArray(doc?.items) ? doc.items : []) {
        records.push(buildGroundTruthRecord({
          batchId,
          dataset,
          rawDecision: item,
          decisionPath: toRelative(retroPath),
          decisionGeneratedAt: doc?.generatedAt ?? doc?.exportedAt ?? null,
          sourceCatalog,
          sourceLookupSection: "auto-matched",
          reviewFlow: "retro-auto-workbench",
          datasetMaps,
          newQuestionCatalog,
          answerKeyCatalog,
        }));
      }
    }

    if (!workbenchPath || !workbenchHasSection(workbenchPath, "review-needed")) {
      const reviewPath = resolveStagingArtifact(batchId, `ja-${batchId}-review-decisions.json`);
      if (reviewPath) {
        const doc = readJson(reviewPath);
        for (const item of Array.isArray(doc?.items) ? doc.items : []) {
          records.push(buildGroundTruthRecord({
            batchId,
            dataset,
            rawDecision: item,
            decisionPath: toRelative(reviewPath),
            decisionGeneratedAt: doc?.generatedAt ?? doc?.exportedAt ?? null,
            sourceCatalog,
            sourceLookupSection: "review-needed",
            reviewFlow: "legacy-review-decisions",
            datasetMaps,
            newQuestionCatalog,
            answerKeyCatalog,
          }));
        }
      }
    }

    if (!workbenchPath || !workbenchHasSection(workbenchPath, "unresolved")) {
      const unresolvedPath = resolveStagingArtifact(batchId, `ja-${batchId}-unresolved-decisions.json`);
      if (unresolvedPath) {
        const doc = readJson(unresolvedPath);
        for (const item of Array.isArray(doc?.items) ? doc.items : []) {
          records.push(buildGroundTruthRecord({
            batchId,
            dataset,
            rawDecision: item,
            decisionPath: toRelative(unresolvedPath),
            decisionGeneratedAt: doc?.generatedAt ?? doc?.exportedAt ?? null,
            sourceCatalog,
            sourceLookupSection: "unresolved",
            reviewFlow: "legacy-unresolved-decisions",
            datasetMaps,
            newQuestionCatalog,
            answerKeyCatalog,
          }));
        }
      }
    }
  }

  const consolidatedWorkbenchPath = resolveStagingArtifact("consolidated-backlog", "ja-consolidated-backlog-workbench-decisions.json");
  if (consolidatedWorkbenchPath) {
    const doc = readJson(consolidatedWorkbenchPath);
    for (const item of Array.isArray(doc?.items) ? doc.items : []) {
      records.push(buildGroundTruthRecord({
        batchId: "consolidated-backlog",
        dataset,
        rawDecision: item,
        decisionPath: toRelative(consolidatedWorkbenchPath),
        decisionGeneratedAt: doc?.generatedAt ?? doc?.exportedAt ?? null,
        sourceCatalog,
        sourceLookupSection: "unresolved",
        reviewFlow: "consolidated-backlog-workbench",
        datasetMaps,
        newQuestionCatalog,
        answerKeyCatalog,
      }));
    }
  }

  return records
    .filter(Boolean)
    .sort((left, right) =>
      String(left.sourceBatchId).localeCompare(String(right.sourceBatchId)) ||
      String(left.reviewSection).localeCompare(String(right.reviewSection)) ||
      String(left.sourceImage ?? left.sourceItemId ?? left.reviewRecordId).localeCompare(
        String(right.sourceImage ?? right.sourceItemId ?? right.reviewRecordId),
      ) ||
      String(left.reviewRecordId).localeCompare(String(right.reviewRecordId)),
    );
}

function buildGroundTruthRecord({
  batchId,
  dataset,
  rawDecision,
  decisionPath,
  decisionGeneratedAt,
  sourceCatalog,
  sourceLookupSection,
  reviewFlow,
  datasetMaps,
  newQuestionCatalog,
  answerKeyCatalog,
}) {
  const decision = normalizeDecision(rawDecision, { sectionHint: sourceLookupSection });
  const source = resolveSourceItem({
    batchId,
    decision,
    sourceCatalog,
    preferredSection: sourceLookupSection,
  });
  const sourceKey = source?.sourceKey ?? compositeSourceKey(source?.sourceBatchId ?? batchId, decision.itemId ?? decision.sourceImage);
  const answerKeyInfo = resolveAnswerKeyInfo({
    batchId: source?.sourceBatchId ?? batchId,
    decision,
    answerKeyCatalog,
  });
  const newQuestionInfo = resolveNewQuestionInfo({
    sourceKey,
    batchId: source?.sourceBatchId ?? batchId,
    decision,
    newQuestionCatalog,
  });
  const decisionClass = classifyDecision(decision);
  const finalQid = decision.approvedQid ?? newQuestionInfo.promotedQid ?? null;
  const question = finalQid ? datasetMaps.questionMap.get(finalQid) ?? null : null;
  const jaEntry = finalQid ? datasetMaps.translationJaMap.get(finalQid) ?? null : null;
  const finalTopCandidate = resolveFinalTopCandidate(source, decision.approvedQid);
  const initialLocalAnswerKey =
    decision.currentStagedLocaleCorrectOptionKey ??
    answerKeyInfo.currentStagedLocaleCorrectOptionKey ??
    normalizeChoiceKey(source?.correctKeyRaw);
  const finalLocalAnswerKey = resolveFinalLocalAnswerKey({
    decision,
    answerKeyInfo,
    jaEntry,
    source,
    newQuestionInfo,
  });
  const topCandidates = summarizeTopCandidates(source?.topCandidates);
  const autoSuggestedQid = normalizeText(decision.initialSuggestedQid) ?? normalizeText(source?.match?.qid) ?? normalizeText(topCandidates[0]?.qid);
  const autoSuggestedScore = finiteNumber(source?.match?.score) ?? finiteNumber(topCandidates[0]?.score);
  const autoSuggestedScoreGap = finiteNumber(source?.match?.scoreGap) ?? finiteNumber(source?.analysis?.topGap);
  const finalCandidateRank = rankOfQid(topCandidates, decision.approvedQid);
  const finalCandidateScore = scoreForQid(topCandidates, decision.approvedQid);
  const finalTopic = normalizeText(finalTopCandidate?.topic);
  const finalSubtopics = asStringArray(finalTopCandidate?.subtopics);
  const provisionalTopic = normalizeText(source?.provisionalTopic) ?? normalizeText(decision.newQuestionProvisionalTopic);
  const provisionalSubtopics = uniqueStrings([
    ...asStringArray(source?.provisionalSubtopics),
    ...asStringArray(decision.newQuestionProvisionalSubtopics),
  ]);

  return {
    reviewRecordId: buildReviewRecordId({
      batchId: source?.sourceBatchId ?? batchId,
      reviewFlow,
      reviewSection: decision.section ?? sourceLookupSection,
      itemId: decision.itemId ?? decision.sourceImage ?? decision.qid,
    }),
    sourceItemKey: sourceKey,
    reviewFlow,
    decisionCapturedAt: decisionGeneratedAt,
    dataset,
    sourceBatchId: source?.sourceBatchId ?? batchId,
    reviewSection: decision.section ?? sourceLookupSection,
    sourceSection: source?.sourceSection ?? sourceLookupSection,
    sourceDocPath: source?.sourceDocPath ?? null,
    decisionPath,
    sourceItemId: source?.sourceItemId ?? decision.itemId ?? null,
    sourceImage: source?.sourceImage ?? decision.sourceImage ?? null,
    sourceScreenshotPath: source?.sourceScreenshotPath ?? null,
    ocrLocalizedText: source?.localizedText ?? null,
    ocrTranslatedText: source?.translatedText ?? null,
    localePromptText: source?.promptRawJa ?? null,
    translatedPromptText: source?.promptGlossEn ?? null,
    choiceType: source?.choiceType ?? null,
    visibleOptionLetters: source?.visibleOptionLetters ?? [],
    rawChoices: source?.rawChoices ?? [],
    autoSuggestedQid,
    autoSuggestedScore,
    autoSuggestedScoreGap,
    topCandidateSet: topCandidates,
    topCandidateCount: topCandidates.length,
    trustBand: trustBandForScore(autoSuggestedScore),
    analysis: source?.analysisSummary ?? null,
    finalDecision: decisionClass.finalDecision,
    finalDecisionDetail: decisionClass.finalDecisionDetail,
    resolvedTerminalState: decisionClass.resolvedTerminalState,
    finalQid,
    proposedNewQuestionQid: newQuestionInfo.proposedQid,
    promotedNewQuestionQid: newQuestionInfo.promotedQid,
    promotionCandidateId: newQuestionInfo.candidateId,
    finalQuestionType:
      normalizeText(question?.type) ??
      normalizeText(newQuestionInfo.candidate?.effectiveQuestionType) ??
      normalizeText(source?.effectiveQuestionType),
    canonicalCorrectOptionKey: question?.correctAnswer?.correctOptionKey ?? null,
    initialLocalAnswerKey,
    finalLocalAnswerKey,
    confirmedCorrectOptionKey:
      decision.confirmedCorrectOptionKey ??
      answerKeyInfo.confirmedCorrectOptionKey ??
      null,
    newQuestionLocalAnswerKey:
      decision.newQuestionLocalAnswerKey ??
      newQuestionInfo.candidate?.newQuestionLocalAnswerKey ??
      null,
    currentStagedLocaleCorrectOptionKey:
      decision.currentStagedLocaleCorrectOptionKey ??
      answerKeyInfo.currentStagedLocaleCorrectOptionKey ??
      null,
    productionLocaleCorrectOptionKey: normalizeChoiceKey(jaEntry?.localeCorrectOptionKey),
    answerKeyUnknown: decision.answerKeyUnknown === true || answerKeyInfo.unknown === true,
    useCurrentStagedAnswerKey: decision.useCurrentStagedAnswerKey === true,
    answerKeyChanged:
      initialLocalAnswerKey && finalLocalAnswerKey
        ? initialLocalAnswerKey !== finalLocalAnswerKey
        : null,
    sourceProvisionalTopic: provisionalTopic,
    sourceProvisionalSubtopics: provisionalSubtopics,
    finalTopic,
    finalSubtopics,
    topicChanged:
      provisionalTopic && finalTopic
        ? provisionalTopic !== finalTopic
        : null,
    subtopicChanged:
      provisionalSubtopics.length > 0 && finalSubtopics.length > 0
        ? !sameStringSet(provisionalSubtopics, finalSubtopics)
        : null,
    reviewerNotes:
      normalizeMultilineText(decision.reviewerNotes) ??
      normalizeMultilineText(newQuestionInfo.candidate?.reviewerNotes) ??
      "",
    sourceExplanation:
      normalizeMultilineText(decision.sourceExplanation) ??
      normalizeMultilineText(newQuestionInfo.candidate?.sourceExplanation) ??
      null,
    reason: normalizeMultilineText(source?.reason) ?? normalizeMultilineText(decision.recommendedAction) ?? null,
    status: source?.status ?? decisionClass.finalDecisionDetail,
    sourceConfidence: finiteNumber(source?.ocrConfidence),
    topicConfidence: finiteNumber(source?.topicConfidence),
    topicSignals: source?.topicSignals ?? [],
    matchSourceQid: normalizeText(source?.match?.qid),
    matchSourceScore: finiteNumber(source?.match?.score),
    matchSourceScoreGap: finiteNumber(source?.match?.scoreGap),
    hadCandidateSet: topCandidates.length > 0,
    hadScore: Number.isFinite(autoSuggestedScore),
    finalCandidateRank,
    finalCandidateScore,
    hasImage: source?.hasImage === true || question?.image?.hasImage === true,
    imageAssetCount: source?.hasImage === true ? 1 : (question?.image?.count ?? 0),
    linkedExistingAssetCandidate: summarizeLinkedAssetCandidate(newQuestionInfo.candidate?.linkedExistingAssetCandidate),
    trace: {
      sourceDocPath: source?.sourceDocPath ?? null,
      decisionPath,
      answerKeyPath: answerKeyInfo.answerKeyPath ?? null,
      newQuestionCandidatePath: newQuestionInfo.candidatePath ?? null,
      newQuestionDecisionPath: newQuestionInfo.decisionPath ?? null,
      newQuestionPreviewPath: newQuestionInfo.previewPath ?? null,
    },
  };
}

function buildAutomatchEvalRows(records) {
  return records
    .filter((record) => record.reviewSection !== "answer-key")
    .map((record) => ({
      review_record_id: record.reviewRecordId,
      source_batch: record.sourceBatchId,
      review_flow: record.reviewFlow,
      review_section: record.reviewSection,
      source_item_id: record.sourceItemId ?? "",
      source_image: record.sourceImage ?? "",
      choice_type: record.choiceType ?? "",
      has_image: boolString(record.hasImage),
      auto_suggested_qid: record.autoSuggestedQid ?? "",
      auto_suggested_score: record.autoSuggestedScore ?? "",
      auto_suggested_score_gap: record.autoSuggestedScoreGap ?? "",
      trust_band: record.trustBand ?? "",
      final_decision: record.finalDecision,
      final_decision_detail: record.finalDecisionDetail,
      final_qid: record.finalQid ?? "",
      auto_match_correct:
        record.autoSuggestedQid
          ? boolString(record.finalDecision === "approve-existing-qid" && record.finalQid === record.autoSuggestedQid)
          : "",
      auto_match_overridden:
        record.autoSuggestedQid && record.finalDecision === "approve-existing-qid" && record.finalQid && record.finalQid !== record.autoSuggestedQid
          ? "true"
          : "false",
      top1_wrong: buildTop1WrongValue(record),
      answer_key_changed: boolString(record.answerKeyChanged),
      topic_changed: boolString(record.topicChanged),
      subtopic_changed: boolString(record.subtopicChanged),
      created_new_question: boolString(record.finalDecision === "create-new-question"),
      deleted: boolString(record.finalDecision === "delete-question"),
      unresolved: boolString(record.finalDecision === "keep-unresolved"),
      had_candidate_set: boolString(record.hadCandidateSet),
      had_score: boolString(record.hadScore),
      final_candidate_rank: record.finalCandidateRank ?? "",
      final_candidate_score: record.finalCandidateScore ?? "",
      local_answer_key: record.finalLocalAnswerKey ?? "",
      provisional_topic: record.sourceProvisionalTopic ?? "",
      final_topic: record.finalTopic ?? "",
    }));
}

function buildBenchmarkRows(records) {
  const benchmarkRows = [];

  const highConfidenceAccepted = records
    .filter((record) =>
      record.finalDecision === "approve-existing-qid" &&
      record.autoSuggestedQid &&
      record.finalQid === record.autoSuggestedQid &&
      Number.isFinite(record.autoSuggestedScore) &&
      record.autoSuggestedScore >= 70 &&
      !normalizeText(record.reviewerNotes) &&
      record.answerKeyChanged !== true,
    )
    .sort((left, right) => (right.autoSuggestedScore ?? 0) - (left.autoSuggestedScore ?? 0))
    .slice(0, 80)
    .map((record) => ({
      benchmarkClass: "approved-existing-high-confidence",
      benchmarkReason: "Top-1 candidate matched the final approved qid at a high score with no reviewer note.",
      ...record,
    }));

  const clearOverrides = records
    .filter((record) =>
      record.finalDecision === "approve-existing-qid" &&
      record.autoSuggestedQid &&
      record.finalQid &&
      record.finalQid !== record.autoSuggestedQid &&
      record.finalCandidateRank &&
      record.finalCandidateRank <= 3 &&
      !normalizeText(record.reviewerNotes),
    )
    .sort((left, right) => (left.finalCandidateRank ?? 99) - (right.finalCandidateRank ?? 99))
    .slice(0, 20)
    .map((record) => ({
      benchmarkClass: "approved-existing-clear-override",
      benchmarkReason: "Reviewer selected a different existing qid and the final qid still appeared in the candidate set.",
      ...record,
    }));

  const clearCreateNew = records
    .filter((record) =>
      record.finalDecision === "create-new-question" &&
      !normalizeText(record.reviewerNotes) &&
      (!Number.isFinite(record.autoSuggestedScore) || record.autoSuggestedScore < 55),
    )
    .slice(0, 20)
    .map((record) => ({
      benchmarkClass: "create-new-clear",
      benchmarkReason: "Reviewer created a new question after a weak or missing existing-qid candidate set.",
      ...record,
    }));

  const clearDeletes = records
    .filter((record) => record.finalDecision === "delete-question")
    .map((record) => ({
      benchmarkClass: "delete-clear",
      benchmarkReason: "Reviewer intentionally discarded the item as a resolved deletion.",
      ...record,
    }));

  for (const row of [...highConfidenceAccepted, ...clearOverrides, ...clearCreateNew, ...clearDeletes]) {
    if (!benchmarkRows.some((existing) => existing.reviewRecordId === row.reviewRecordId)) {
      benchmarkRows.push(row);
    }
  }

  return benchmarkRows;
}

function buildArchiveManifest({ inventory }) {
  const groups = [
    buildManifestGroup({
      id: "imports-ja-source-batches",
      classification: "ARCHIVE",
      reason: "Original Japanese screenshot intake, OCR outputs, and review source JSONs are the heaviest source materials and should move out of the active workspace first.",
      paths: inventory.importsFiles,
    }),
    buildManifestGroup({
      id: "active-ja-decision-json",
      classification: "ARCHIVE",
      reason: "Compact but high-value reviewer decision JSONs remain the main source-of-truth for manual outcomes and should be archived before any workspace cleanup.",
      paths: inventory.activeStagingFiles.filter((filePath) =>
        /(?:workbench-decisions|review-decisions|unresolved-decisions|existing-qid-decisions|answer-key-decisions|new-question-decisions|new-question-candidates|consolidated-backlog)/.test(filePath),
      ),
    }),
    buildManifestGroup({
      id: "active-ja-preview-and-follow-up",
      classification: "SAFE_TO_DELETE_AFTER_ARCHIVE",
      reason: "Generated preview, follow-up, dry-run, and promotion JSONs are reproducible once archived and extracted, so they are the safest active staging files to remove next.",
      paths: inventory.activeStagingFiles.filter((filePath) =>
        /(?:translations\.ja\..*preview|merge-dry-run|follow-up-review\.ja|new-question-promotion-preview|new-question-promotion-config)/.test(filePath),
      ),
    }),
    buildManifestGroup({
      id: "active-ja-generated-reports",
      classification: "SAFE_TO_DELETE_AFTER_ARCHIVE",
      reason: "Workbench HTML, merge review reports, and apply reports are bulky and reproducible; archive them, then remove the active copies.",
      paths: inventory.activeReportFiles,
    }),
    buildManifestGroup({
      id: "archived-ja-review-tree",
      classification: "KEEP_ACTIVE",
      reason: "The existing archive tree is already the safest historical landing zone and should remain until the compact intelligence package is accepted as sufficient.",
      paths: inventory.archiveFiles,
    }),
    buildManifestGroup({
      id: "review-workflow-scripts",
      classification: "KEEP_ACTIVE",
      reason: "The generator, apply, merge, and promotion scripts remain part of the live review workflow and should stay in the active repo.",
      paths: inventory.scriptFiles,
    }),
    buildManifestGroup({
      id: "japanese-review-intelligence-package",
      classification: "KEEP_ACTIVE",
      reason: "The compact intelligence package is the reusable learning layer that should stay active after the bulky Japanese artifacts are archived.",
      paths: walkFiles(OUTPUT_DIR).map((filePath) => toRelative(filePath)),
    }),
  ].filter((group) => group.fileCount > 0);

  return {
    generatedAt: stableNow(),
    lang: LANG,
    dryRunOnly: true,
    totals: {
      fileCount: groups.reduce((total, group) => total + group.fileCount, 0),
      totalBytes: groups.reduce((total, group) => total + group.totalBytes, 0),
      totalMegabytes: roundNumber(groups.reduce((total, group) => total + group.totalBytes, 0) / (1024 * 1024)),
      groupCount: groups.length,
    },
    groups,
  };
}

function buildReusableRuleCandidatesMarkdown({ records, automatchRows }) {
  const approvedExisting = records.filter((record) => record.finalDecision === "approve-existing-qid");
  const createdNew = records.filter((record) => record.finalDecision === "create-new-question");
  const deleted = records.filter((record) => record.finalDecision === "delete-question");
  const unresolved = records.filter((record) => record.finalDecision === "keep-unresolved");
  const acceptedByBand = summarizeTrustBands(automatchRows);
  const overrideRows = approvedExisting.filter(
    (record) => record.autoSuggestedQid && record.finalQid && record.autoSuggestedQid !== record.finalQid,
  );
  const answerKeyChanged = records.filter((record) => record.answerKeyChanged === true);
  const imageHeavyOverrides = overrideRows.filter((record) => record.hasImage === true).length;
  const signLikeOverrides = overrideRows.filter((record) => isSignLikePrompt(record.localePromptText, record.translatedPromptText)).length;
  const topicDriftPairs = topTopicTransitions(records);

  return [
    "# Reusable Rule Candidates",
    "",
    `Generated at ${stableNow()}.`,
    "",
    "## Outcome Snapshot",
    "",
    `- Reviewed records: ${records.length}`,
    `- Approved existing qid: ${approvedExisting.length}`,
    `- Create new question: ${createdNew.length}`,
    `- Keep unresolved: ${unresolved.length}`,
    `- Delete question: ${deleted.length}`,
    "",
    "## Auto-match Trust Bands",
    "",
    ...acceptedByBand.map((band) =>
      `- ${band.band}: ${band.accepted}/${band.total} accepted as the same qid (${band.acceptanceRate}%).`,
    ),
    "",
    "## Rule Candidates",
    "",
    `- Mid-band image-heavy overrides: ${imageHeavyOverrides}/${overrideRows.length} existing-qid overrides still involved image-backed questions. Raise manual review priority for image-backed candidates with scores below 70.`,
    `- Sign/marking prompt overrides: ${signLikeOverrides}/${overrideRows.length} overrides used sign-like or marking-like prompts. Generic sign prompts should keep a lower auto-trust ceiling unless the candidate gap is strong.`,
    `- Answer-key alignment changes: ${answerKeyChanged.length} reviewed items changed the local answer key. Preserve explicit reviewer-selected locale keys as a first-class signal for future languages.`,
    `- Create-new profile: ${createdNew.filter((record) => !Number.isFinite(record.autoSuggestedScore) || record.autoSuggestedScore < 55).length}/${createdNew.length} create-new outcomes came from weak or missing top-1 scores. Low-score existing matches should bias toward new-question review instead of forced approval.`,
    `- Delete profile: ${deleted.length} delete outcomes only appeared in the consolidated backlog. Delete is a useful terminal state for incomplete image-only leftovers that should not stay unresolved forever.`,
    `- Unresolved profile: ${unresolved.filter((record) => record.hasImage === true).length}/${unresolved.length} unresolved outcomes still had images, so missing or insufficient image evidence should remain an explicit fallback class.`,
    "",
    "## Topic / Subtopic Drift",
    "",
    ...(topicDriftPairs.length > 0
      ? topicDriftPairs.map((pair) => `- ${pair.from} -> ${pair.to}: ${pair.count} item(s).`)
      : ["- No confident topic drift pairs were derivable from the candidate sets."]),
    "",
    "## Practical Next Rules",
    "",
    "- Keep the score threshold conservative: let very-high and high trust bands pass faster, but force review for mid-band image-backed sign questions.",
    "- Treat locale answer-key confirmations as reusable supervision. They capture the most expensive human correction signal with minimal schema cost.",
    "- When the reviewer creates a new question and a visible local answer key exists, preserve that key as canonical promotion input rather than recomputing it later.",
    "- Keep delete separate from unresolved. Delete is a resolved discard state, while unresolved should remain a limited follow-up bucket.",
  ].join("\n");
}

function buildExtractionSummaryMarkdown({
  dataset,
  inventory,
  records,
  automatchRows,
  benchmarkRows,
}) {
  const decisionCounts = countBy(records, (record) => record.finalDecision);
  const flowCounts = countBy(records, (record) => record.reviewFlow);
  const bandSummary = summarizeTrustBands(automatchRows);
  const missingFinalTopics = records.filter(
    (record) => record.finalDecision === "approve-existing-qid" && !record.finalTopic,
  ).length;

  return [
    "# Japanese Review Intelligence Extraction Summary",
    "",
    `Generated at ${stableNow()} for dataset \`${dataset}\`.`,
    "",
    "## Discovery",
    "",
    `- imports/ja files: ${inventory.importsFiles.length}`,
    `- active staging files: ${inventory.activeStagingFiles.length}`,
    `- active report files: ${inventory.activeReportFiles.length}`,
    `- archived JA files: ${inventory.archiveFiles.length}`,
    `- workflow scripts indexed: ${inventory.scriptFiles.length}`,
    "",
    "## Extracted Outputs",
    "",
    `- review_ground_truth rows: ${records.length}`,
    `- automatch_eval rows: ${automatchRows.length}`,
    `- benchmark_set rows: ${benchmarkRows.length}`,
    "",
    "## Final Human Decisions",
    "",
    ...Object.entries(decisionCounts).map(([decision, count]) => `- ${decision}: ${count}`),
    "",
    "## Review Flows",
    "",
    ...Object.entries(flowCounts).map(([flow, count]) => `- ${flow}: ${count}`),
    "",
    "## Trust-Band Snapshot",
    "",
    ...bandSummary.map((band) => `- ${band.band}: ${band.accepted}/${band.total} accepted as top-1.`),
    "",
    "## Limitations",
    "",
    "- Early batches do not always preserve unified workbench decisions for every section, so the extractor falls back to legacy review and unresolved decision exports where needed.",
    "- Final topic and subtopic labels are only available when the approved qid appears inside the stored candidate set. Otherwise those fields are left blank instead of guessed.",
    "- Reviewer rationale is only explicit when reviewer notes or sourceExplanation text exists. No extra rationale is invented.",
    `- ${missingFinalTopics} approved-existing records could not recover a confident final topic from the stored candidate metadata.`,
  ].join("\n");
}

function buildNextLanguageBootstrapPlanMarkdown({
  records,
  automatchRows,
  benchmarkRows,
}) {
  const bandSummary = summarizeTrustBands(automatchRows);
  const answerKeyChanges = records.filter((record) => record.answerKeyChanged === true).length;
  const createdNew = records.filter((record) => record.finalDecision === "create-new-question");
  const deleted = records.filter((record) => record.finalDecision === "delete-question").length;
  const unresolved = records.filter((record) => record.finalDecision === "keep-unresolved").length;
  const imageBackedCreateNew = createdNew.filter((record) => record.hasImage === true).length;

  return [
    "# Next Language Bootstrap Plan",
    "",
    "## Goal",
    "",
    "Use the completed Japanese review history as a supervision layer before launching the next language workflow.",
    "",
    "## 1. Auto-match Trust Thresholds",
    "",
    ...bandSummary.map((band) => `- ${band.band}: ${band.accepted}/${band.total} accepted the top-1 qid.`),
    "- Practical rule: allow faster acceptance only in the high-confidence bands, but keep image-backed sign and marking questions on manual review unless the score and candidate gap are both strong.",
    "- Reuse the benchmark set to compare future matcher revisions before changing review thresholds.",
    "",
    "## 2. Answer-key Validation Rules",
    "",
    `- Preserve manual locale answer-key corrections as explicit supervision. Japanese produced ${answerKeyChanges} answer-key changes that should feed future language QA.`,
    "- If a reviewer changes the approved qid or confirms a locale key manually, store that as a stronger signal than the staged key.",
    "- Require a visible local answer key for create-new questions whenever options are present, and keep the confirmed key through promotion.",
    "",
    "## 3. Topic / Subtopic Suggestions",
    "",
    "- Keep provisional topic suggestions, but treat them as soft hints until an approved qid or promoted question confirms the final class.",
    "- Use repeated topic drift pairs from the Japanese archive to down-rank misleading topic priors in the next language.",
    "",
    "## 4. New-question / Delete / Unresolved Heuristics",
    "",
    `- Create-new outcomes: ${createdNew.length} total, ${imageBackedCreateNew} image-backed. Weak or missing top-1 candidates should bias toward create-new review instead of forced approval.`,
    `- Delete outcomes: ${deleted}. Keep delete as a terminal discard option for incomplete image leftovers.`,
    `- Unresolved outcomes: ${unresolved}. Keep unresolved narrow and evidence-driven; it should be smaller than the delete bucket once delete is available.`,
    "",
    "## 5. Visual Signal Reuse",
    "",
    "- Join hidden image tags into future matching features. Image-backed sign questions are overrepresented in manual overrides, so symbol and object tags can help route them correctly.",
    "- Reuse clear visual tags such as sign, road-marking, traffic-light, arrow, crosswalk, bus, train, mountain, railroad, rain, and intersection as candidate-ranking features instead of only search metadata.",
    "",
    "## 6. Workflow Changes To Reuse Immediately",
    "",
    "- Preload the next language review UI with the Japanese-derived trust bands and benchmark set so matcher changes are measurable before rollout.",
    "- Surface answer-key risk early when the top candidate qid changes but the source-side option meaning is still ambiguous.",
    "- Preserve source screenshots, OCR prompt text, top candidates, and the final manual state in the same normalized package for every future language from day one.",
    "",
    `## 7. Immediate Reuse Assets`,
    "",
    `- review_ground_truth.jsonl: ${records.length} normalized reviewer outcomes.`,
    `- automatch_eval.csv: ${automatchRows.length} auto-vs-human comparison rows.`,
    `- benchmark_set.jsonl: ${benchmarkRows.length} clean benchmark rows for regression checks.`,
  ].join("\n");
}

function normalizeSourceItem(item, { batchId, section, sourceDocPath }) {
  const sourceItemId = normalizeText(item?.itemId);
  const sourceImage = normalizeText(item?.sourceImage) ?? sourceItemId;
  const sourceKey = compositeSourceKey(batchId, sourceItemId ?? sourceImage);
  if (!sourceKey) {
    return null;
  }

  const rawChoices = buildRawChoices(item);
  return {
    sourceKey,
    lookupKeys: uniqueStrings([
      compositeSourceKey(batchId, sourceItemId),
      compositeSourceKey(batchId, sourceImage),
    ]),
    sourceBatchId: batchId,
    sourceSection: section,
    sourceDocPath,
    sourceItemId,
    sourceImage,
    sourceScreenshotPath: sourceImage ? toRelative(path.join(IMPORTS_DIR, LANG, batchId, sourceImage)) : null,
    promptRawJa: normalizeMultilineText(item?.promptRawJa),
    promptGlossEn: normalizeMultilineText(item?.promptGlossEn),
    localizedText: item?.localizedText ?? null,
    translatedText: item?.translatedText ?? null,
    optionsRawJa: asStringArray(item?.optionsRawJa),
    optionsGlossEn: asStringArray(item?.optionsGlossEn),
    rawChoices,
    visibleOptionLetters: rawChoices.map((choice) => choice.key).filter(Boolean),
    choiceType: inferChoiceType(rawChoices),
    correctKeyRaw: normalizeChoiceKey(item?.correctKeyRaw),
    correctAnswerRaw: normalizeMultilineText(item?.correctAnswerRaw),
    ocrConfidence: finiteNumber(item?.ocrConfidence),
    provisionalTopic: normalizeText(item?.provisionalTopic),
    provisionalSubtopics: asStringArray(item?.provisionalSubtopics),
    topicConfidence: finiteNumber(item?.topicConfidence),
    topicSignals: Array.isArray(item?.topicSignals) ? item.topicSignals : [],
    sourceConceptSlots: item?.sourceConceptSlots ?? null,
    match: summarizeMatch(item?.match),
    topCandidates: Array.isArray(item?.topCandidates) ? item.topCandidates : [],
    analysisSummary: summarizeAnalysis(item?.analysis),
    effectiveQuestionType: normalizeText(item?.analysis?.effectiveQuestionType ?? item?.effectiveQuestionType),
    reason: normalizeMultilineText(item?.reason),
    status: normalizeText(item?.status),
    hasImage: Boolean(sourceImage),
  };
}

function normalizeBacklogSourceItem(item, { sourceDocPath }) {
  const itemId = normalizeText(item?.itemId);
  const sourceBatchId = normalizeText(item?.sourceBatchId) ?? normalizeText(String(itemId ?? "").split(":")[0]);
  const sourceImage = normalizeText(item?.sourceImage);
  const sourceKey = itemId ?? compositeSourceKey(sourceBatchId, sourceImage);
  if (!sourceKey) {
    return null;
  }

  const rawChoices = buildRawChoices(item);
  return {
    sourceKey,
    lookupKeys: uniqueStrings([
      sourceKey,
      compositeSourceKey(sourceBatchId, sourceImage),
    ]),
    sourceBatchId,
    sourceSection: "unresolved",
    sourceDocPath,
    sourceItemId: itemId,
    sourceImage,
    sourceScreenshotPath: normalizeText(item?.screenshotPath),
    promptRawJa: normalizeMultilineText(item?.promptRawJa),
    promptGlossEn: normalizeMultilineText(item?.promptGlossEn),
    localizedText: null,
    translatedText: null,
    optionsRawJa: asStringArray(item?.optionsRawJa),
    optionsGlossEn: asStringArray(item?.optionsGlossEn),
    rawChoices,
    visibleOptionLetters: rawChoices.map((choice) => choice.key).filter(Boolean),
    choiceType: inferChoiceType(rawChoices),
    correctKeyRaw: normalizeChoiceKey(item?.correctKeyRaw),
    correctAnswerRaw: normalizeMultilineText(item?.correctAnswerRaw),
    ocrConfidence: null,
    provisionalTopic: normalizeText(item?.provisionalTopic),
    provisionalSubtopics: asStringArray(item?.provisionalSubtopics),
    topicConfidence: finiteNumber(item?.topicConfidence),
    topicSignals: Array.isArray(item?.topicSignals) ? item.topicSignals : [],
    sourceConceptSlots: item?.sourceConceptSlots ?? null,
    match: null,
    topCandidates: Array.isArray(item?.topCandidates) ? item.topCandidates : [],
    analysisSummary: summarizeAnalysis(item?.analysis),
    effectiveQuestionType: normalizeText(item?.effectiveQuestionType),
    reason: normalizeMultilineText(item?.reason),
    status: normalizeText(item?.backlogStatus),
    hasImage: item?.hasImage === true || Boolean(sourceImage),
  };
}

function normalizeDecision(item, { sectionHint = null } = {}) {
  const approvedQid = normalizeText(item?.approvedQid);
  const deleteQuestion = item?.deleteQuestion === true;
  const createNewQuestion = deleteQuestion ? false : item?.createNewQuestion === true;
  const keepUnresolved = deleteQuestion ? false : item?.keepUnresolved === true;
  const noneOfThese = item?.noneOfThese === true;
  const unsure =
    approvedQid || createNewQuestion || deleteQuestion || noneOfThese
      ? false
      : item?.unsure === true;

  return {
    id: normalizeText(item?.id),
    section: normalizeText(item?.section) ?? sectionHint,
    itemId: normalizeText(item?.itemId),
    sourceImage: normalizeText(item?.sourceImage),
    qid: normalizeText(item?.qid),
    approvedQid: deleteQuestion ? null : approvedQid,
    initialSuggestedQid: normalizeText(item?.initialSuggestedQid),
    createNewQuestion,
    keepUnresolved,
    deleteQuestion,
    noneOfThese,
    unsure,
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey),
    answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
    useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
    reviewerNotes: normalizeMultilineText(item?.reviewerNotes) ?? "",
    sourceExplanation: normalizeMultilineText(item?.sourceExplanation),
    newQuestionProvisionalTopic: normalizeText(item?.newQuestionProvisionalTopic),
    newQuestionProvisionalSubtopics: asStringArray(item?.newQuestionProvisionalSubtopics),
    recommendedAction: normalizeText(item?.recommendedAction),
  };
}

function resolveSourceItem({ batchId, decision, sourceCatalog, preferredSection }) {
  const candidateKeys = uniqueStrings([
    compositeSourceKey(batchId, decision.itemId),
    compositeSourceKey(batchId, decision.sourceImage),
    compositeSourceKey(batchId, decision.itemId ?? decision.sourceImage),
  ]);

  if (preferredSection) {
    const sectionMap = sourceCatalog.byBatchSection.get(`${batchId}:${preferredSection}`);
    if (sectionMap) {
      for (const key of candidateKeys) {
        if (sectionMap.has(key)) {
          return sectionMap.get(key);
        }
      }
    }
  }

  for (const key of candidateKeys) {
    if (sourceCatalog.bySourceKey.has(key)) {
      return sourceCatalog.bySourceKey.get(key);
    }
  }

  return null;
}

function resolveAnswerKeyInfo({ batchId, decision, answerKeyCatalog }) {
  const qidKey = `${batchId}:${normalizeText(decision.approvedQid ?? decision.qid)}`;
  const sourceKey = compositeSourceKey(batchId, decision.itemId ?? decision.sourceImage);
  return (
    (sourceKey ? answerKeyCatalog.byBatchSourceKey.get(sourceKey) : null) ??
    (qidKey ? answerKeyCatalog.byBatchQid.get(qidKey) : null) ??
    {}
  );
}

function resolveNewQuestionInfo({ sourceKey, batchId, decision, newQuestionCatalog }) {
  const info = sourceKey ? newQuestionCatalog.bySourceKey.get(sourceKey) ?? {} : {};
  const candidateId = normalizeText(info?.candidate?.candidateId);
  const previewInfo = candidateId ? newQuestionCatalog.promotionByCandidateId.get(candidateId) ?? {} : {};
  const promotedQid = candidateId ? newQuestionCatalog.promotedQidByCandidateId.get(candidateId) ?? null : null;

  return {
    ...info,
    candidateId,
    proposedQid: previewInfo?.preview ? proposedQidFromPreview(previewInfo.preview) : null,
    previewPath: previewInfo?.previewPath ?? null,
    promotedQid,
  };
}

function resolveFinalLocalAnswerKey({ decision, answerKeyInfo, jaEntry, source, newQuestionInfo }) {
  if (decision.createNewQuestion) {
    return (
      decision.newQuestionLocalAnswerKey ??
      normalizeChoiceKey(newQuestionInfo?.candidate?.newQuestionLocalAnswerKey) ??
      normalizeChoiceKey(jaEntry?.localeCorrectOptionKey) ??
      normalizeChoiceKey(source?.correctKeyRaw)
    );
  }

  return (
    decision.confirmedCorrectOptionKey ??
    answerKeyInfo.confirmedCorrectOptionKey ??
    (decision.useCurrentStagedAnswerKey ? decision.currentStagedLocaleCorrectOptionKey : null) ??
    normalizeChoiceKey(jaEntry?.localeCorrectOptionKey) ??
    decision.currentStagedLocaleCorrectOptionKey ??
    answerKeyInfo.currentStagedLocaleCorrectOptionKey ??
    normalizeChoiceKey(source?.correctKeyRaw) ??
    null
  );
}

function resolveFinalTopCandidate(source, approvedQid) {
  if (!source || !approvedQid) {
    return null;
  }
  return (Array.isArray(source.topCandidates) ? source.topCandidates : []).find(
    (candidate) => normalizeText(candidate?.qid) === approvedQid,
  ) ?? null;
}

function classifyDecision(decision) {
  if (decision.deleteQuestion) {
    return {
      finalDecision: "delete-question",
      finalDecisionDetail: "delete-question",
      resolvedTerminalState: true,
    };
  }

  if (decision.approvedQid) {
    return {
      finalDecision: "approve-existing-qid",
      finalDecisionDetail: "approved-existing-qid",
      resolvedTerminalState: true,
    };
  }

  if (decision.createNewQuestion) {
    return {
      finalDecision: "create-new-question",
      finalDecisionDetail: "create-new-question",
      resolvedTerminalState: true,
    };
  }

  if (decision.keepUnresolved) {
    return {
      finalDecision: "keep-unresolved",
      finalDecisionDetail: "keep-unresolved",
      resolvedTerminalState: false,
    };
  }

  if (decision.noneOfThese) {
    return {
      finalDecision: "keep-unresolved",
      finalDecisionDetail: "none-of-these",
      resolvedTerminalState: false,
    };
  }

  if (decision.unsure) {
    return {
      finalDecision: "keep-unresolved",
      finalDecisionDetail: "unsure",
      resolvedTerminalState: false,
    };
  }

  return {
    finalDecision: "keep-unresolved",
    finalDecisionDetail: "no-terminal-choice-captured",
    resolvedTerminalState: false,
  };
}

function buildManifestGroup({ id, classification, reason, paths }) {
  const existingPaths = paths.filter(Boolean);
  const stats = summarizePaths(existingPaths);
  return {
    id,
    classification,
    reason,
    fileCount: stats.fileCount,
    totalBytes: stats.totalBytes,
    totalMegabytes: roundNumber(stats.totalBytes / (1024 * 1024)),
    samplePaths: existingPaths.slice(0, 8),
  };
}

function summarizePaths(paths) {
  let totalBytes = 0;
  for (const filePath of paths) {
    const absolutePath = path.join(ROOT, filePath);
    if (!fileExists(absolutePath)) {
      continue;
    }
    totalBytes += fs.statSync(absolutePath).size;
  }
  return {
    fileCount: paths.length,
    totalBytes,
  };
}

function summarizeTrustBands(automatchRows) {
  const bandOrder = ["very-high", "high", "medium", "low", "very-low", "none"];
  const buckets = new Map(bandOrder.map((band) => [band, { band, total: 0, accepted: 0 }]));

  for (const row of automatchRows) {
    const band = row.trust_band || "none";
    const bucket = buckets.get(band) ?? { band, total: 0, accepted: 0 };
    bucket.total += 1;
    if (row.auto_match_correct === "true") {
      bucket.accepted += 1;
    }
    buckets.set(band, bucket);
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.total > 0)
    .map((bucket) => ({
      ...bucket,
      acceptanceRate: roundPercent(bucket.accepted / bucket.total),
    }));
}

function topTopicTransitions(records) {
  const counts = new Map();

  for (const record of records) {
    if (!record.sourceProvisionalTopic || !record.finalTopic || record.sourceProvisionalTopic === record.finalTopic) {
      continue;
    }
    const key = `${record.sourceProvisionalTopic}=>${record.finalTopic}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split("=>");
      return { from, to, count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function summarizeTopCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates.slice(0, 5).map((candidate) => ({
    qid: normalizeText(candidate?.qid),
    number: finiteNumber(candidate?.number),
    type: normalizeText(candidate?.type),
    score: finiteNumber(candidate?.score),
    topic: normalizeText(candidate?.topic),
    subtopics: asStringArray(candidate?.subtopics),
  }));
}

function summarizeLinkedAssetCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return {
    qid: normalizeText(candidate.qid),
    number: finiteNumber(candidate.number),
    score: finiteNumber(candidate.score),
    currentAssetSrc: normalizeText(candidate.currentAssetSrc),
    assetHashes: asStringArray(candidate.assetHashes),
    status: normalizeText(candidate.status),
  };
}

function summarizeMatch(match) {
  if (!match || typeof match !== "object") {
    return null;
  }

  return {
    qid: normalizeText(match.qid),
    number: finiteNumber(match.number),
    score: finiteNumber(match.score),
    scoreGap: finiteNumber(match.scoreGap),
  };
}

function summarizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  return {
    mode: normalizeText(analysis.mode),
    effectiveQuestionType: normalizeText(analysis.effectiveQuestionType),
    declaredQuestionType: normalizeText(analysis.declaredQuestionType),
    booleanChoiceDetected: analysis.booleanChoiceDetected === true,
    topScore: finiteNumber(analysis.topScore),
    topGap: finiteNumber(analysis.topGap),
    plausibleShortlist: analysis.plausibleShortlist === true,
    imageParityApplied: analysis.imageParityApplied === true,
    candidateImageParityMode: normalizeText(analysis.candidateImageParityMode),
    explanation: normalizeMultilineText(analysis.explanation),
  };
}

function buildRawChoices(item) {
  const rawOptions = asStringArray(item?.optionsRawJa);
  const glossOptions = asStringArray(item?.optionsGlossEn);
  const optionCount = Math.max(rawOptions.length, glossOptions.length);
  const choices = [];

  for (let index = 0; index < optionCount; index += 1) {
    const rawChoice = parseChoice(rawOptions[index], index);
    const glossChoice = parseChoice(glossOptions[index], index);
    const key = rawChoice.key ?? glossChoice.key;
    if (!key) {
      continue;
    }
    choices.push({
      key,
      rawText: rawChoice.fullText,
      rawBody: rawChoice.body,
      glossText: glossChoice.fullText,
      glossBody: glossChoice.body,
    });
  }

  return choices;
}

function parseChoice(value, index) {
  const raw = normalizeMultilineText(value);
  if (!raw) {
    return {
      key: String.fromCharCode(65 + index),
      fullText: null,
      body: null,
    };
  }

  const match = raw.match(/^([A-Z])(?:[\s.:：、．\)\]-]+)(.*)$/i);
  if (match) {
    return {
      key: normalizeChoiceKey(match[1]) ?? String.fromCharCode(65 + index),
      fullText: raw,
      body: normalizeMultilineText(match[2]),
    };
  }

  return {
    key: String.fromCharCode(65 + index),
    fullText: raw,
    body: raw,
  };
}

function inferChoiceType(rawChoices) {
  const choices = Array.isArray(rawChoices) ? rawChoices : [];
  if (choices.length === 0) {
    return "no-options";
  }

  const normalizedBodies = choices.map((choice) => normalizeChoiceBody(choice.rawBody ?? choice.glossBody));
  if (choices.length === 2 && normalizedBodies.every((value) => YES_NO_VALUES.has(value))) {
    return "yes-no";
  }

  return `${choices.length}-choice`;
}

function buildReviewRecordId({ batchId, reviewFlow, reviewSection, itemId }) {
  return `${reviewFlow}:${batchId}:${reviewSection ?? "unknown"}:${normalizeText(itemId) ?? "unknown-item"}`;
}

function buildTop1WrongValue(record) {
  if (!record.autoSuggestedQid) {
    return "";
  }
  if (record.finalDecision === "approve-existing-qid") {
    return boolString(record.finalQid !== record.autoSuggestedQid);
  }
  if (record.finalDecision === "create-new-question" || record.finalDecision === "delete-question") {
    return "true";
  }
  return "";
}

function resolveStagingArtifact(batchId, fileName) {
  const activePath = path.join(STAGING_DIR, fileName);
  if (fileExists(activePath)) {
    return activePath;
  }

  if (batchId === "consolidated-backlog") {
    return null;
  }

  const archivedPath = path.join(JA_ARCHIVE_DIR, batchId, "staging", fileName);
  return fileExists(archivedPath) ? archivedPath : null;
}

function resolveSpecialAnswerKeyFiles(batchId) {
  const roots = [STAGING_DIR, path.join(JA_ARCHIVE_DIR, batchId, "staging")];
  const files = [];
  for (const root of roots) {
    if (!fileExists(root)) {
      continue;
    }
    for (const entry of fs.readdirSync(root)) {
      if (new RegExp(`^ja-${batchId}-q\\d+-answer-key-decision(?:\\.template)?\\.json$`).test(entry)) {
        files.push(path.join(root, entry));
      }
    }
  }
  return uniqueStrings(files);
}

function ingestAnswerKeyFile(filePath, batchId, byBatchQid, byBatchSourceKey) {
  if (!filePath || !fileExists(filePath)) {
    return;
  }

  const doc = readJson(filePath);
  const items = Array.isArray(doc?.items)
    ? doc.items
    : doc?.item && typeof doc.item === "object"
      ? [doc.item]
      : [];

  for (const item of items) {
    const normalized = {
      qid: normalizeText(item?.qid ?? doc?.qid),
      sourceItemId: normalizeText(item?.sourceItemId),
      sourceImage: normalizeText(item?.sourceImage),
      currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
      confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
      unknown: item?.unknown === true,
      reviewerNotes: normalizeMultilineText(item?.reviewerNotes) ?? "",
      answerKeyPath: toRelative(filePath),
    };

    const qidKey = normalized.qid ? `${batchId}:${normalized.qid}` : null;
    const sourceKey = compositeSourceKey(batchId, normalized.sourceItemId ?? normalized.sourceImage);

    if (qidKey) {
      byBatchQid.set(qidKey, normalized);
    }
    if (sourceKey) {
      byBatchSourceKey.set(sourceKey, normalized);
    }
  }
}

function workbenchHasSection(workbenchPath, section) {
  if (!workbenchPath || !fileExists(workbenchPath)) {
    return false;
  }
  const doc = readJson(workbenchPath);
  return Array.isArray(doc?.items) && doc.items.some((item) => normalizeText(item?.section) === section);
}

function proposedQidFromPreview(item) {
  const number = Number(item?.proposedMasterNumber);
  if (Number.isFinite(number)) {
    return `q${String(number).padStart(4, "0")}`;
  }
  const direct = normalizeText(item?.proposedQid);
  return direct && /^q\d+$/i.test(direct) ? direct.toLowerCase() : null;
}

function discoverBatchIds() {
  const langDir = path.join(IMPORTS_DIR, LANG);
  if (!fileExists(langDir)) {
    return [];
  }
  return fs.readdirSync(langDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^batch-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function compositeSourceKey(batchId, itemIdOrImage) {
  const batch = normalizeText(batchId);
  const value = normalizeText(itemIdOrImage);
  if (value && /^batch-\d+:.+/.test(value)) {
    return value;
  }
  if (!batch || !value) {
    return null;
  }
  return `${batch}:${value}`;
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ].join("\n");
}

async function writeJsonl(filePath, rows) {
  await ensureDir(path.dirname(filePath));
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  await fsp.writeFile(filePath, content ? `${content}\n` : "", "utf8");
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, content, "utf8");
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function walkFiles(rootDir) {
  if (!fileExists(rootDir)) {
    return [];
  }

  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function isJapaneseReviewArtifact(filePath) {
  const rel = toRelative(filePath);
  return (
    rel.includes("/ja-") ||
    rel.includes(".ja.") ||
    rel.includes("ja-consolidated-backlog") ||
    rel.includes("consolidated-backlog.ja") ||
    rel.includes("/ja/") ||
    rel.includes("production-merge-ja-") ||
    rel.includes("apply-unresolved-decisions-ja-") ||
    rel.includes("apply-workbench-decisions-ja-") ||
    rel.includes("apply-consolidated-backlog-workbench-decisions-ja") ||
    rel.includes("dry-run-merge-review-ja-") ||
    rel.includes("full-batch-merge-review-ja-")
  );
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath) || ".";
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeMultilineText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]$/.test(text) ? text : null;
}

function normalizeChoiceBody(value) {
  return String(value ?? "").trim().toLowerCase();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeMultilineText(entry))
        .filter(Boolean)
    : [];
}

function sameStringSet(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }
  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }
  return true;
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function rankOfQid(candidates, qid) {
  const normalizedQid = normalizeText(qid);
  if (!normalizedQid || !Array.isArray(candidates)) {
    return null;
  }
  const index = candidates.findIndex((candidate) => normalizeText(candidate?.qid) === normalizedQid);
  return index >= 0 ? index + 1 : null;
}

function scoreForQid(candidates, qid) {
  const normalizedQid = normalizeText(qid);
  if (!normalizedQid || !Array.isArray(candidates)) {
    return null;
  }
  const candidate = candidates.find((entry) => normalizeText(entry?.qid) === normalizedQid);
  return finiteNumber(candidate?.score);
}

function trustBandForScore(score) {
  if (!Number.isFinite(score)) {
    return "none";
  }
  if (score >= 80) return "very-high";
  if (score >= 70) return "high";
  if (score >= 60) return "medium";
  if (score >= 50) return "low";
  return "very-low";
}

function boolString(value) {
  if (value == null) {
    return "";
  }
  return value ? "true" : "false";
}

function roundPercent(value) {
  return Math.round(value * 1000) / 10;
}

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}

function isSignLikePrompt(localePromptText, translatedPromptText) {
  const value = `${localePromptText ?? ""} ${translatedPromptText ?? ""}`.toLowerCase();
  return /(sign|symbol|marking|標識|記号|路面標示|路面表示)/.test(value);
}
