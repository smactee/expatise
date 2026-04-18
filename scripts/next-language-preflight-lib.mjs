import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  ROOT,
  csvEscape,
  fileExists,
  getBatchFiles,
  getDatasetPaths,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import { getPreflightCalibrationProfile } from "./next-language-preflight-config.mjs";

const OUTPUT_DIR = path.join(ROOT, "artifacts", "next-language-pilot");
const INTELLIGENCE_DIR = path.join(ROOT, "artifacts", "japanese-review-intelligence");
const TRUST_BANDS = ["none", "very-low", "low", "medium", "high", "very-high"];
const OBJECT_KEYWORDS = [
  "arrow",
  "crosswalk",
  "traffic-light",
  "bicycle",
  "bus",
  "train",
  "mountain",
  "railroad",
  "snow",
  "rain",
  "intersection",
];

export async function runNextLanguagePreflight({
  lang,
  batchId,
  dataset = DEFAULT_DATASET,
  pilotSize = null,
  runBaseline = false,
  analysisMode = "standard",
  topCandidates = null,
  calibrationProfile = "original",
} = {}) {
  if (!lang || !batchId) {
    throw new Error("runNextLanguagePreflight requires lang and batchId.");
  }

  if (runBaseline) {
    runBaselineMatcher({ lang, batchId, dataset, analysisMode, topCandidates });
  }

  const batchFiles = getBatchFiles(lang, batchId);
  for (const requiredPath of [batchFiles.matchedPath, batchFiles.reviewNeededPath, batchFiles.unresolvedPath]) {
    if (!fileExists(requiredPath)) {
      throw new Error(
        `Baseline batch output not found: ${path.relative(ROOT, requiredPath)}. Run scripts/process-screenshot-batch.mjs first or pass --run-baseline.`,
      );
    }
  }

  const datasetPaths = getDatasetPaths(dataset);
  const context = loadQbankContext({ dataset, referenceLang: "ko" });
  const imageTagDoc = fileExists(path.join(datasetPaths.datasetDir, "image-color-tags.json"))
    ? readJson(path.join(datasetPaths.datasetDir, "image-color-tags.json"))
    : { questions: {} };
  const imageTagMap = imageTagDoc?.questions && typeof imageTagDoc.questions === "object"
    ? imageTagDoc.questions
    : {};
  const intelligence = loadJapaneseGuidance();
  const calibration = getPreflightCalibrationProfile(calibrationProfile);

  const baselineItems = loadBaselineItems({ batchFiles });
  const pilotItems = Number.isFinite(Number(pilotSize)) && Number(pilotSize) > 0
    ? selectPilotItems(baselineItems, Number(pilotSize))
    : baselineItems;

  const evaluatedItems = pilotItems.map((item) =>
    evaluateItem({
      item,
      batchId,
      lang,
      dataset,
      context,
      imageTagMap,
      intelligence,
      calibration,
    }),
  );

  return {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    baselineItems,
    pilotItems: evaluatedItems,
    intelligence,
    calibrationProfile: calibration.name,
    calibrationDescription: calibration.description,
  };
}

export async function writePilotArtifacts(preflightRun, { prefix = "" } = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const normalizedPrefix = prefix ? `${String(prefix).replace(/[^a-z0-9_-]+/gi, "-")}` : "";
  const csvPath = path.join(OUTPUT_DIR, `${normalizedPrefix}baseline_vs_preflight.csv`);
  const riskPath = path.join(OUTPUT_DIR, `${normalizedPrefix}risk_buckets.json`);
  const summaryPath = path.join(OUTPUT_DIR, `${normalizedPrefix}preflight_summary.md`);
  const recommendationsPath = path.join(OUTPUT_DIR, `${normalizedPrefix}pilot_recommendations.md`);

  const riskBuckets = buildRiskBuckets(preflightRun);
  const csv = buildBaselineVsPreflightCsv(preflightRun);
  const summary = buildPreflightSummaryMarkdown(preflightRun, riskBuckets);
  const recommendations = buildPilotRecommendationsMarkdown(preflightRun, riskBuckets);

  await writeText(csvPath, csv);
  await writeJson(riskPath, riskBuckets);
  await writeText(summaryPath, summary);
  await writeText(recommendationsPath, recommendations);

  return {
    csvPath: path.relative(ROOT, csvPath),
    riskPath: path.relative(ROOT, riskPath),
    summaryPath: path.relative(ROOT, summaryPath),
    recommendationsPath: path.relative(ROOT, recommendationsPath),
  };
}

function runBaselineMatcher({ lang, batchId, dataset, analysisMode, topCandidates }) {
  const args = [
    path.join(ROOT, "scripts", "process-screenshot-batch.mjs"),
    "--lang",
    lang,
    "--batch",
    batchId,
    "--dataset",
    dataset,
    "--analysis-mode",
    analysisMode,
  ];
  if (Number.isFinite(Number(topCandidates)) && Number(topCandidates) > 0) {
    args.push("--top-candidates", String(Number(topCandidates)));
  }

  execFileSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function loadBaselineItems({ batchFiles }) {
  const sections = [
    { kind: "matched", baselineRoute: "auto-match ok", path: batchFiles.matchedPath },
    { kind: "review-needed", baselineRoute: "manual review", path: batchFiles.reviewNeededPath },
    { kind: "unresolved", baselineRoute: "likely unresolved", path: batchFiles.unresolvedPath },
  ];

  const items = [];
  for (const section of sections) {
    const doc = readJson(section.path);
    for (const rawItem of Array.isArray(doc?.items) ? doc.items : []) {
      items.push({
        baselineSection: section.kind,
        baselineRoute: section.baselineRoute,
        sourcePath: path.relative(ROOT, section.path),
        rawItem,
      });
    }
  }

  return items;
}

function loadJapaneseGuidance() {
  const groundTruthPath = path.join(INTELLIGENCE_DIR, "review_ground_truth.jsonl");
  if (!fileExists(groundTruthPath)) {
    throw new Error(`Japanese review intelligence not found: ${path.relative(ROOT, groundTruthPath)}`);
  }

  const records = readJsonl(groundTruthPath);
  const trustBandCounts = {};
  const createNewScores = [];
  const unresolvedScores = [];
  const deleteScores = [];
  let imageSignOverrideCount = 0;
  let overrideCount = 0;

  for (const record of records) {
    if (record.autoSuggestedQid) {
      const band = record.trustBand ?? "none";
      const bucket = trustBandCounts[band] ?? { total: 0, accepted: 0 };
      bucket.total += 1;
      if (record.finalDecision === "approve-existing-qid" && record.finalQid === record.autoSuggestedQid) {
        bucket.accepted += 1;
      }
      trustBandCounts[band] = bucket;
    }

    if (record.finalDecision === "create-new-question" && Number.isFinite(record.autoSuggestedScore)) {
      createNewScores.push(record.autoSuggestedScore);
    }
    if (record.finalDecision === "keep-unresolved" && Number.isFinite(record.autoSuggestedScore)) {
      unresolvedScores.push(record.autoSuggestedScore);
    }
    if (record.finalDecision === "delete-question" && Number.isFinite(record.autoSuggestedScore)) {
      deleteScores.push(record.autoSuggestedScore);
    }

    if (
      record.finalDecision === "approve-existing-qid" &&
      record.autoSuggestedQid &&
      record.finalQid &&
      record.autoSuggestedQid !== record.finalQid
    ) {
      overrideCount += 1;
      if (record.hasImage === true && isSignLike(record)) {
        imageSignOverrideCount += 1;
      }
    }
  }

  const trustBandRates = Object.fromEntries(
    Object.entries(trustBandCounts).map(([band, bucket]) => [
      band,
      {
        ...bucket,
        acceptanceRate: bucket.total > 0 ? bucket.accepted / bucket.total : 0,
      },
    ]),
  );

  return {
    generatedAt: stableNow(),
    trustBandRates,
    createNewScoreCeiling: Math.min(55, quantile(createNewScores, 0.7) ?? 55),
    unresolvedScoreCeiling: quantile(unresolvedScores, 0.8) ?? 42,
    deleteScoreCeiling: quantile(deleteScores, 0.8) ?? 35,
    imageSignOverrideRate: overrideCount > 0 ? imageSignOverrideCount / overrideCount : 0,
    highBandAcceptanceRate: trustBandRates.high?.acceptanceRate ?? 0,
    veryHighBandAcceptanceRate: trustBandRates["very-high"]?.acceptanceRate ?? 0,
  };
}

function evaluateItem({ item, batchId, lang, dataset, context, imageTagMap, intelligence, calibration }) {
  const source = item.rawItem;
  const topCandidate = pickTopCandidate(source);
  const score = Number(topCandidate?.score ?? source?.match?.score ?? source?.analysis?.topScore ?? 0) || 0;
  const gap = finiteNumber(source?.match?.scoreGap ?? source?.analysis?.topGap ?? topCandidate?.scoreGapFromTop);
  const baselineTrustBand = trustBandForScore(score);
  const sourceType = normalizeChoiceShape(source);
  const candidateType = normalizeCandidateType(topCandidate?.type);
  const candidateImageTags = topCandidate?.qid ? imageTagMap[topCandidate.qid] ?? {} : {};
  const sourceTexts = collectSourceTexts(source);
  const expectedObjectTags = inferExpectedObjectTags(sourceTexts);
  const sourceIsSignHeavy = isSignHeavySource(source, sourceTexts, expectedObjectTags);
  const candidateHasImage = topCandidate?.image?.hasImage ?? topCandidate?.imageSignal ?? null;
  const candidateTopic = normalizeText(topCandidate?.topic);
  const candidateSubtopics = asStringArray(topCandidate?.subtopics);
  const provisionalTopic = normalizeText(source?.provisionalTopic);
  const provisionalSubtopics = asStringArray(source?.provisionalSubtopics);
  const topicConfidence = finiteNumber(source?.topicConfidence) ?? 0;
  const choices = extractVisibleChoices(source);
  const hasSourceAnswerEvidence =
    Boolean(normalizeText(source?.correctKeyRaw)) ||
    Boolean(normalizeText(source?.correctAnswerRaw)) ||
    Boolean(normalizeText(source?.translatedText?.correctAnswer)) ||
    Boolean(normalizeText(source?.localizedText?.correctAnswer));
  const triggeredChecks = [];

  if (sourceType && candidateType && sourceType !== candidateType) {
    triggeredChecks.push({
      code: "choice-shape-mismatch",
      level: "severe",
      message: `Source ${sourceType} shape conflicts with candidate ${candidateType}.`,
    });
  }

  const answerKeyRisk = detectAnswerKeyRisk(source, topCandidate, score);
  if (answerKeyRisk) {
    triggeredChecks.push(answerKeyRisk);
  }

  const topicRisk = detectTopicRisk(source, topCandidate, provisionalTopic, provisionalSubtopics, topicConfidence);
  if (topicRisk) {
    triggeredChecks.push(topicRisk);
  }

  const imageRisk = detectImageRisk({
    source,
    topCandidate,
    candidateImageTags,
    sourceIsSignHeavy,
    expectedObjectTags,
    intelligence,
  });
  if (imageRisk) {
    triggeredChecks.push(imageRisk);
  }

  const structuralRisk = detectStructuralRisk(source, score, intelligence);
  if (structuralRisk) {
    triggeredChecks.push(structuralRisk);
  }

  const createNewRisk = detectCreateNewRisk({
    source,
    topCandidate,
    score,
    gap,
    intelligence,
    sourceType,
    sourceIsSignHeavy,
  });
  if (createNewRisk) {
    triggeredChecks.push(createNewRisk);
  }

  const trustBandRisk = detectTrustBandRisk({
    baselineSection: item.baselineSection,
    baselineTrustBand,
    score,
    gap,
    sourceIsSignHeavy,
    triggeredChecks,
    intelligence,
  });
  if (trustBandRisk) {
    triggeredChecks.push(trustBandRisk);
  }

  const calibratedChecks = applyCalibrationProfile(triggeredChecks, calibration);
  const combinationSignals = buildCombinationSignals({
    triggeredChecks: calibratedChecks,
    calibration,
    context: {
      sourceType,
      hasImage: source?.hasImage === true || Boolean(source?.sourceImage),
      provisionalTopic,
      topicConfidence,
      hasSourceAnswerEvidence,
      candidateTopic,
      candidateHasImage,
      baselineTrustBand,
      suggestedScore: score,
      suggestedScoreGap: gap,
      sourceIsSignHeavy,
      scoreBreakdown: topCandidate?.scoreBreakdown ?? source?.match?.scoreBreakdown ?? null,
    },
  });
  const decisionSignals = [...calibratedChecks, ...combinationSignals];
  const recommendedRoute = decideRecommendedRoute({
    baselineSection: item.baselineSection,
    baselineRoute: item.baselineRoute,
    baselineTrustBand,
    decisionSignals,
  });
  const adjustedTrustBand = downgradeTrustBand(
    baselineTrustBand,
    totalBandPenalty(decisionSignals),
  );
  const preflightStatus = derivePreflightStatus({
    baselineRoute: item.baselineRoute,
    recommendedRoute,
    decisionSignals,
  });

  return {
    itemId: normalizeText(source?.itemId) ?? null,
    sourceImage: normalizeText(source?.sourceImage) ?? null,
    batchId,
    lang,
    dataset,
    baselineSection: item.baselineSection,
    baselineRoute: item.baselineRoute,
    sourceType,
    suggestedQid: normalizeText(topCandidate?.qid ?? source?.match?.qid) ?? null,
    suggestedScore: score,
    suggestedScoreGap: gap,
    baselineTrustBand,
    adjustedTrustBand,
    calibrationProfile: calibration.name,
    provisionalTopic,
    provisionalSubtopics,
    candidateTopic,
    candidateSubtopics,
    topicConfidence,
    expectedObjectTags,
    candidateObjectTags: asStringArray(candidateImageTags.objectTags),
    hasImage: source?.hasImage === true || Boolean(source?.sourceImage),
    sourceIsSignHeavy,
    candidateHasImage,
    preflightStatus,
    recommendedRoute,
    triggeredChecks: calibratedChecks,
    decisionSignals,
    combinationSignals,
    analysisMode: normalizeText(source?.analysis?.mode),
    plausibleShortlist: source?.analysis?.plausibleShortlist === true,
    sourcePath: item.sourcePath,
    scoreBreakdown: topCandidate?.scoreBreakdown ?? source?.match?.scoreBreakdown ?? null,
    visibleChoiceCount: choices.length,
    visibleChoices: choices,
    hasSourceAnswerEvidence,
    answerEvidenceContext: {
      correctKeyRaw: normalizeText(source?.correctKeyRaw),
      correctAnswerRaw: normalizeText(source?.correctAnswerRaw),
      translatedCorrectAnswer: normalizeText(source?.translatedText?.correctAnswer),
      localizedCorrectAnswer: normalizeText(source?.localizedText?.correctAnswer),
      answerPolarity: normalizeText(source?.answerPolarity),
      breakdown: topCandidate?.scoreBreakdown ?? source?.match?.scoreBreakdown ?? null,
    },
    imageContext: {
      hasSourceImage: source?.hasImage === true || Boolean(source?.sourceImage),
      sourceIsSignHeavy,
      candidateHasImage,
      expectedObjectTags,
      candidateObjectTags: asStringArray(candidateImageTags.objectTags),
    },
  };
}

function pickTopCandidate(source) {
  const topCandidates = Array.isArray(source?.topCandidates) ? source.topCandidates : [];
  if (topCandidates.length === 0) {
    return source?.match
      ? {
        qid: source.match.qid,
        score: source.match.score,
        type: source.analysis?.effectiveQuestionType ?? null,
        scoreBreakdown: source.match.scoreBreakdown ?? null,
        topic: source.match.candidateTopicTruth?.topic ?? null,
        subtopics: source.match.candidateTopicTruth?.subtopics ?? [],
        image: source.match.candidateImageRef ?? null,
      }
      : null;
  }
  return topCandidates[0];
}

function normalizeChoiceShape(source) {
  const declared = normalizeCandidateType(source?.analysis?.effectiveQuestionType);
  if (declared) {
    return declared;
  }
  const options = extractVisibleChoices(source);
  if (options.length === 2) {
    return "ROW";
  }
  if (options.length >= 3) {
    return "MCQ";
  }
  return null;
}

function normalizeCandidateType(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "ROW") return "ROW";
  if (text === "MCQ") return "MCQ";
  return null;
}

function extractVisibleChoices(source) {
  const raw = []
    .concat(source?.localizedText?.options ?? [])
    .concat(source?.translatedText?.options ?? [])
    .concat(source?.optionsRawJa ?? [])
    .concat(source?.optionsGlossEn ?? []);
  const seen = [];
  for (const entry of raw) {
    const choice = normalizeChoice(entry);
    if (choice && !seen.some((existing) => existing.key === choice.key && existing.text === choice.text)) {
      seen.push(choice);
    }
  }
  return seen;
}

function normalizeChoice(value, index = 0) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  const match = text.match(/^([A-Z])(?:[\s.:：、．\)\]-]+)(.*)$/i);
  if (match) {
    return {
      key: String(match[1]).toUpperCase(),
      text: normalizeText(match[2]) ?? "",
    };
  }
  return {
    key: String.fromCharCode(65 + index),
    text,
  };
}

function collectSourceTexts(source) {
  return [
    normalizeText(source?.translatedText?.prompt),
    ...asStringArray(source?.translatedText?.options),
    normalizeText(source?.translatedText?.correctAnswer),
    normalizeText(source?.promptGlossEn),
    ...asStringArray(source?.optionsGlossEn),
    normalizeText(source?.correctAnswerRaw),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferExpectedObjectTags(text) {
  if (!text) {
    return [];
  }
  const tags = [];
  if (/\btraffic light\b|\btraffic signal\b/.test(text)) tags.push("traffic-light");
  if (/\bcrosswalk\b|\bpedestrian crossing\b/.test(text)) tags.push("crosswalk");
  if (/\bbicycle\b|\bbike\b|\bcycle\b/.test(text)) tags.push("bicycle");
  if (/\bbus\b/.test(text)) tags.push("bus");
  if (/\btrain\b/.test(text)) tags.push("train");
  if (/\brailroad\b|\brailway\b|\brail crossing\b/.test(text)) tags.push("railroad");
  if (/\bmountain\b|\bmountain road\b|\bcliff\b/.test(text)) tags.push("mountain");
  if (/\bsnow\b|\bsnowy\b/.test(text)) tags.push("snow");
  if (/\brain\b|\brainy\b|\bwet road\b/.test(text)) tags.push("rain");
  if (/\bintersection\b|\bcrossroad\b|\bt-junction\b|\bjunction\b/.test(text)) tags.push("intersection");
  if (/\barrow\b/.test(text)) tags.push("arrow");
  return Array.from(new Set(tags));
}

function isSignHeavySource(source, text, expectedObjectTags) {
  return (
    source?.hasImage === true &&
    (
      normalizeText(source?.provisionalTopic) === "traffic-signals" ||
      /sign|symbol|marking|traffic light|traffic signal|lane/.test(text) ||
      expectedObjectTags.length > 0
    )
  );
}

function detectAnswerKeyRisk(source, topCandidate, score) {
  if (!topCandidate?.scoreBreakdown) {
    return null;
  }

  const breakdown = topCandidate.scoreBreakdown;
  const sourceType = normalizeChoiceShape(source);

  if (sourceType === "ROW") {
    if (!normalizeText(source?.answerPolarity)) {
      return null;
    }
    const polarity = finiteNumber(breakdown.answerPolarity);
    const contradiction = finiteNumber(breakdown.contradictionPenalty);
    if ((polarity !== null && polarity < 1) || (contradiction !== null && contradiction >= 0.12)) {
      return {
        code: "answer-key-consistency-risk",
        level: score >= 70 ? "severe" : "moderate",
        message: "Binary polarity or contradiction signals suggest a yes/no answer-key mismatch risk.",
      };
    }
    return null;
  }

  const hasSourceAnswerEvidence =
    Boolean(normalizeText(source?.correctKeyRaw)) ||
    Boolean(normalizeText(source?.correctAnswerRaw)) ||
    Boolean(normalizeText(source?.translatedText?.correctAnswer)) ||
    Boolean(normalizeText(source?.localizedText?.correctAnswer));

  if (!hasSourceAnswerEvidence) {
    return null;
  }

  const correctMeaning = finiteNumber(breakdown.correctAnswerMeaning);
  const optionSimilarity = finiteNumber(breakdown.optionSimilarity);
  if (
    (correctMeaning !== null && correctMeaning < 0.32) ||
    (
      correctMeaning !== null &&
      optionSimilarity !== null &&
      optionSimilarity >= 0.78 &&
      correctMeaning < 0.45
    )
  ) {
    return {
      code: "answer-key-consistency-risk",
      level: score >= 72 ? "severe" : "moderate",
      message: "Candidate option match is stronger than the correct-answer meaning alignment, so answer-key drift is plausible.",
    };
  }

  return null;
}

function detectTopicRisk(source, topCandidate, provisionalTopic, provisionalSubtopics, topicConfidence) {
  const candidateTopic = normalizeText(topCandidate?.topic);
  if (!provisionalTopic || !candidateTopic || provisionalTopic === candidateTopic || ["mcq", "row"].includes(candidateTopic)) {
    return null;
  }

  if (topicConfidence < 0.7) {
    return null;
  }

  const candidateSubtopics = asStringArray(topCandidate?.subtopics);
  const subtopicOverlap = provisionalSubtopics.some((subtopic) => candidateSubtopics.includes(subtopic));
  return {
    code: "topic-subtopic-drift-risk",
    level: subtopicOverlap ? "moderate" : "severe",
    message: `Source topic ${provisionalTopic} conflicts with candidate topic ${candidateTopic}.`,
    details: {
      provisionalTopic,
      candidateTopic,
      provisionalSubtopics,
      candidateSubtopics,
      topicConfidence,
    },
  };
}

function detectImageRisk({ source, topCandidate, candidateImageTags, sourceIsSignHeavy, expectedObjectTags, intelligence }) {
  if (!source?.hasImage && !sourceIsSignHeavy) {
    return null;
  }

  const candidateHasImage = topCandidate?.image?.hasImage ?? topCandidate?.imageSignal ?? null;
  if (candidateHasImage === false) {
    return {
      code: "image-sign-symbol-mismatch-risk",
      level: "severe",
      message: "Source appears image-backed but the candidate lacks an aligned image asset.",
    };
  }

  const candidateObjectTags = asStringArray(candidateImageTags.objectTags);
  if (expectedObjectTags.length > 0 && !expectedObjectTags.some((tag) => candidateObjectTags.includes(tag))) {
    return {
      code: "image-sign-symbol-mismatch-risk",
      level: "moderate",
      message: `Expected visual cue ${expectedObjectTags.join(", ")} is not reflected in the candidate image tags.`,
    };
  }

  if (
    sourceIsSignHeavy &&
    intelligence.imageSignOverrideRate >= 0.25 &&
    normalizeText(topCandidate?.topic) !== "traffic-signals"
  ) {
    return {
      code: "image-sign-symbol-mismatch-risk",
      level: "moderate",
      message: "Image-heavy sign/symbol item is leaning on a non-sign topic candidate, which was a common Japanese override pattern.",
    };
  }

  return null;
}

function detectStructuralRisk(source, score, intelligence) {
  const choices = extractVisibleChoices(source);
  const hasPrompt = Boolean(normalizeText(source?.translatedText?.prompt) ?? normalizeText(source?.promptGlossEn));
  const hasComparableText = hasPrompt || choices.length > 0;

  if (!hasComparableText) {
    return {
      code: "structural-reliability-risk",
      level: "reroute-delete",
      message: "Prompt and options are both missing or unusable after intake translation.",
    };
  }

  if (choices.length < 2 && score <= intelligence.deleteScoreCeiling) {
    return {
      code: "structural-reliability-risk",
      level: "reroute-unresolved",
      message: "Visible choices are incomplete, so the item should stay out of confident auto-match routing.",
    };
  }

  return null;
}

function detectCreateNewRisk({ source, topCandidate, score, gap, intelligence, sourceType, sourceIsSignHeavy }) {
  const choices = extractVisibleChoices(source);
  const topScore = Number(score || 0);
  const plausibleShortlist = source?.analysis?.plausibleShortlist === true;
  const hasPrompt = Boolean(normalizeText(source?.translatedText?.prompt) ?? normalizeText(source?.promptGlossEn));

  if (!hasPrompt || choices.length < 2) {
    return null;
  }

  const lowScore = topScore <= intelligence.createNewScoreCeiling;
  const weakGap = gap === null || gap < 1.5;
  const noTopCandidate = !topCandidate?.qid;

  if (
    noTopCandidate ||
    (
      lowScore &&
      !plausibleShortlist &&
      weakGap &&
      !sourceIsSignHeavy &&
      sourceType &&
      topScore <= intelligence.createNewScoreCeiling
    )
  ) {
    return {
      code: "likely-create-new-question",
      level: "reroute-create-new",
      message: "Weak shortlist and complete prompt/options fit the Japanese create-new pattern better than a forced existing-qid match.",
    };
  }

  return null;
}

function detectTrustBandRisk({ baselineSection, baselineTrustBand, score, gap, sourceIsSignHeavy, triggeredChecks, intelligence }) {
  if (baselineSection !== "matched") {
    return null;
  }

  const severeCount = triggeredChecks.filter((check) => check.level === "severe").length;
  if (severeCount > 0) {
    return null;
  }

  if (baselineTrustBand === "very-high") {
    return null;
  }

  if (
    baselineTrustBand === "high" &&
    !sourceIsSignHeavy &&
    score >= 74 &&
    (gap ?? 0) >= 10 &&
    intelligence.highBandAcceptanceRate >= 0.75
  ) {
    return null;
  }

  return {
    code: "trust-band-caution",
    level: "moderate",
    message: `Japanese guidance only trusted ${baselineTrustBand} matches conservatively, so this auto-match should stay review-first.`,
  };
}

function decideRecommendedRoute({ baselineSection, baselineRoute, baselineTrustBand, decisionSignals }) {
  const severeCount = decisionSignals.filter((check) => signalLevel(check) === "severe").length;
  const moderateCount = decisionSignals.filter((check) => signalLevel(check) === "moderate").length;

  if (decisionSignals.some((check) => signalLevel(check) === "reroute-delete")) {
    return "likely delete";
  }
  if (decisionSignals.some((check) => signalLevel(check) === "reroute-unresolved")) {
    return "likely unresolved";
  }
  if (decisionSignals.some((check) => signalLevel(check) === "reroute-create-new")) {
    return "likely create-new-question";
  }
  if (
    baselineSection === "matched" &&
    (
      severeCount > 0 ||
      moderateCount >= 2 ||
      (moderateCount >= 1 && baselineTrustBand !== "very-high")
    )
  ) {
    return "manual review";
  }
  return baselineRoute;
}

function derivePreflightStatus({ baselineRoute, recommendedRoute, decisionSignals }) {
  if (recommendedRoute !== baselineRoute) {
    if (recommendedRoute === "manual review") {
      return "downgrade";
    }
    return "reroute";
  }

  if (decisionSignals.length > 0) {
    return "warn";
  }

  return "pass";
}

function totalBandPenalty(triggeredChecks) {
  return triggeredChecks.reduce((total, check) => {
    switch (signalLevel(check)) {
      case "reroute-delete":
      case "reroute-unresolved":
      case "reroute-create-new":
        return Math.max(total, 3);
      case "severe":
        return Math.max(total, 2);
      case "moderate":
        return Math.max(total, 1);
      default:
        return total;
    }
  }, 0);
}

function downgradeTrustBand(band, penalty) {
  const index = Math.max(0, TRUST_BANDS.indexOf(band));
  const nextIndex = Math.max(0, index - penalty);
  return TRUST_BANDS[nextIndex] ?? "none";
}

function buildRiskBuckets(preflightRun) {
  const items = preflightRun.pilotItems;
  const bucket = {
    generatedAt: stableNow(),
    lang: preflightRun.lang,
    batchId: preflightRun.batchId,
    dataset: preflightRun.dataset,
    calibrationProfile: preflightRun.calibrationProfile,
    pilotItemCount: items.length,
    countsByBaselineSection: countBy(items, (item) => item.baselineSection),
    countsByPreflightStatus: countBy(items, (item) => item.preflightStatus),
    countsByRecommendedRoute: countBy(items, (item) => item.recommendedRoute),
    countsByAdjustedTrustBand: countBy(items, (item) => item.adjustedTrustBand),
    triggeredChecks: countNested(items, (item) => item.triggeredChecks.map((check) => check.code)),
    decisionSignals: countNested(items, (item) => item.decisionSignals.map((check) => check.code)),
    reroutes: items
      .filter((item) => item.recommendedRoute !== item.baselineRoute)
      .map((item) => ({
        itemId: item.itemId,
        sourceImage: item.sourceImage,
        baselineRoute: item.baselineRoute,
        recommendedRoute: item.recommendedRoute,
        suggestedQid: item.suggestedQid,
        suggestedScore: item.suggestedScore,
        checks: item.triggeredChecks.map((check) => check.code),
      })),
  };

  return bucket;
}

function buildBaselineVsPreflightCsv(preflightRun) {
  const headers = [
    "item_id",
    "source_image",
    "baseline_section",
    "baseline_route",
    "suggested_qid",
    "suggested_score",
    "suggested_score_gap",
    "baseline_trust_band",
    "adjusted_trust_band",
    "preflight_status",
    "recommended_route",
    "calibration_profile",
    "source_type",
    "provisional_topic",
    "candidate_topic",
    "expected_object_tags",
    "candidate_object_tags",
    "triggered_checks",
    "decision_signals",
  ];

  const lines = [headers.join(",")];
  for (const item of preflightRun.pilotItems) {
    const row = {
      item_id: item.itemId ?? "",
      source_image: item.sourceImage ?? "",
      baseline_section: item.baselineSection,
      baseline_route: item.baselineRoute,
      suggested_qid: item.suggestedQid ?? "",
      suggested_score: item.suggestedScore ?? "",
      suggested_score_gap: item.suggestedScoreGap ?? "",
      baseline_trust_band: item.baselineTrustBand,
      adjusted_trust_band: item.adjustedTrustBand,
      preflight_status: item.preflightStatus,
      recommended_route: item.recommendedRoute,
      calibration_profile: item.calibrationProfile,
      source_type: item.sourceType ?? "",
      provisional_topic: item.provisionalTopic ?? "",
      candidate_topic: item.candidateTopic ?? "",
      expected_object_tags: item.expectedObjectTags.join("|"),
      candidate_object_tags: item.candidateObjectTags.join("|"),
      triggered_checks: item.triggeredChecks.map((check) => check.code).join("|"),
      decision_signals: item.decisionSignals.map((check) => check.code).join("|"),
    };
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function buildPreflightSummaryMarkdown(preflightRun, riskBuckets) {
  const downgraded = riskBuckets.countsByPreflightStatus.downgrade ?? 0;
  const rerouted = riskBuckets.countsByPreflightStatus.reroute ?? 0;
  const autoMatchOk = riskBuckets.countsByRecommendedRoute["auto-match ok"] ?? 0;
  const manualReview = riskBuckets.countsByRecommendedRoute["manual review"] ?? 0;
  const createNew = riskBuckets.countsByRecommendedRoute["likely create-new-question"] ?? 0;
  const unresolved = riskBuckets.countsByRecommendedRoute["likely unresolved"] ?? 0;
  const deleted = riskBuckets.countsByRecommendedRoute["likely delete"] ?? 0;

  return [
    "# Next-Language Preflight Summary",
    "",
    `Generated at ${stableNow()} for \`${preflightRun.lang}/${preflightRun.batchId}\` on dataset \`${preflightRun.dataset}\` using profile \`${preflightRun.calibrationProfile}\`.`,
    "",
    "## Japanese Guidance Used",
    "",
    `- very-high band acceptance: ${percent(preflightRun.intelligence.veryHighBandAcceptanceRate)}`,
    `- high band acceptance: ${percent(preflightRun.intelligence.highBandAcceptanceRate)}`,
    `- create-new score ceiling: ${roundNumber(preflightRun.intelligence.createNewScoreCeiling)}`,
    `- unresolved score ceiling: ${roundNumber(preflightRun.intelligence.unresolvedScoreCeiling)}`,
    `- delete score ceiling: ${roundNumber(preflightRun.intelligence.deleteScoreCeiling)}`,
    `- image/sign override rate: ${percent(preflightRun.intelligence.imageSignOverrideRate)}`,
    "",
    "## Pilot Counts",
    "",
    `- pilot items: ${preflightRun.pilotItems.length}`,
    `- baseline matched: ${riskBuckets.countsByBaselineSection.matched ?? 0}`,
    `- baseline review-needed: ${riskBuckets.countsByBaselineSection["review-needed"] ?? 0}`,
    `- baseline unresolved: ${riskBuckets.countsByBaselineSection.unresolved ?? 0}`,
    "",
    "## Before vs After",
    "",
    `- auto-match ok after preflight: ${autoMatchOk}`,
    `- manual review after preflight: ${manualReview}`,
    `- likely create-new-question: ${createNew}`,
    `- likely unresolved: ${unresolved}`,
    `- likely delete: ${deleted}`,
    `- downgraded baseline auto-matches: ${downgraded}`,
    `- rerouted items: ${rerouted}`,
    "",
    "## Live Checks",
    "",
    "- choice-shape mismatch",
    "- answer-key consistency risk",
    "- topic/subtopic drift risk",
    "- image/sign/symbol mismatch risk",
    "- likely create-new-question routing",
    "- structural unresolved/delete routing",
    "- Japanese trust-band caution",
    "",
    "## Top Triggered Checks",
    "",
    ...Object.entries(riskBuckets.triggeredChecks)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([code, count]) => `- ${code}: ${count}`),
  ].join("\n");
}

function buildPilotRecommendationsMarkdown(preflightRun, riskBuckets) {
  const downgraded = riskBuckets.countsByPreflightStatus.downgrade ?? 0;
  const matchedBaseline = riskBuckets.countsByBaselineSection.matched ?? 0;
  const downgradeRate = matchedBaseline > 0 ? downgraded / matchedBaseline : 0;
  const severeRouteCount = preflightRun.pilotItems.filter((item) =>
    item.recommendedRoute !== item.baselineRoute &&
    ["likely create-new-question", "likely unresolved", "likely delete"].includes(item.recommendedRoute)
  ).length;
  const readiness =
    severeRouteCount === 0 && downgradeRate < 0.1
      ? "full run"
      : severeRouteCount <= Math.max(2, Math.round(preflightRun.pilotItems.length * 0.08)) && downgradeRate < 0.25
        ? "limited batch run"
        : "needs one more iteration";

  return [
    "# Pilot Recommendations",
    "",
    "## Biggest Gains From Preflight",
    "",
    `- ${downgraded} baseline auto-matches were downgraded before review because Japanese trust-band and risk rules judged them unsafe to trust directly.`,
    `- ${severeRouteCount} items were rerouted out of generic manual review into create-new or unresolved/delete-style handling.`,
    `- Image/sign-heavy items now carry explicit visual mismatch warnings instead of relying on raw score alone.`,
    "",
    "## Main Failure Modes Still Not Covered",
    "",
    "- Source-side image semantics are still inferred from text and existing hidden candidate tags; there is no direct object-tag extraction on the new source screenshots yet.",
    "- Topic drift is lightweight and only uses provisional topic hints plus candidate topic labels. It does not run a deeper semantic classifier.",
    "- Delete routing is intentionally conservative. Without direct asset integrity or OCR quality metrics, only structurally broken items are pushed there.",
    "",
    "## Should We Trust This For Full Next-Language Rollout?",
    "",
    `- Recommendation: ${readiness}.`,
    `- Downgrade rate on baseline auto-matches: ${percent(downgradeRate)}.`,
    `- Rerouted create-new/unresolved/delete items: ${severeRouteCount}.`,
    `- Biggest remaining risk: sign/image-heavy near-matches can still look semantically close without enough source-side visual evidence.`,
    "",
    "## Operational Use",
    "",
    "- Run the standard batch matcher first, then run the pilot preflight to inspect the before-vs-after CSV and risk bucket summary.",
    "- If the pilot still shows too many high-band downgrades, tune thresholds on the preflight wrapper before scaling to the full language.",
    "- Keep the preflight wrapper non-destructive until one real next-language pilot batch has been reviewed manually.",
  ].join("\n");
}

function selectPilotItems(items, size) {
  if (items.length <= size) {
    return items;
  }

  const groups = {
    matched: items.filter((item) => item.baselineSection === "matched"),
    "review-needed": items.filter((item) => item.baselineSection === "review-needed"),
    unresolved: items.filter((item) => item.baselineSection === "unresolved"),
  };

  const targetFractions = {
    matched: 0.5,
    "review-needed": 0.35,
    unresolved: 0.15,
  };

  const selected = [];
  const quotas = {};
  for (const [section, group] of Object.entries(groups)) {
    if (group.length === 0) {
      quotas[section] = 0;
      continue;
    }
    quotas[section] = Math.min(group.length, Math.max(1, Math.round(size * targetFractions[section])));
  }

  let totalQuota = Object.values(quotas).reduce((sum, value) => sum + value, 0);
  while (totalQuota > size) {
    const reducible = Object.entries(quotas).find(([section, quota]) => quota > 1 && groups[section].length >= quota);
    if (!reducible) break;
    quotas[reducible[0]] -= 1;
    totalQuota -= 1;
  }
  while (totalQuota < size) {
    const expandable = Object.entries(groups)
      .filter(([section, group]) => quotas[section] < group.length)
      .sort((left, right) => left[1].length - right[1].length)[0];
    if (!expandable) break;
    quotas[expandable[0]] += 1;
    totalQuota += 1;
  }

  for (const [section, group] of Object.entries(groups)) {
    selected.push(...evenlySample(sortGroup(group), quotas[section]));
  }

  return selected.slice(0, size);
}

function sortGroup(items) {
  return [...items].sort((left, right) => {
    const leftScore = Number(pickTopCandidate(left.rawItem)?.score ?? left.rawItem?.match?.score ?? 0);
    const rightScore = Number(pickTopCandidate(right.rawItem)?.score ?? right.rawItem?.match?.score ?? 0);
    return rightScore - leftScore || String(left.rawItem?.itemId ?? "").localeCompare(String(right.rawItem?.itemId ?? ""));
  });
}

function evenlySample(items, count) {
  if (count <= 0 || items.length === 0) {
    return [];
  }
  if (items.length <= count) {
    return items;
  }
  const selected = [];
  for (let index = 0; index < count; index += 1) {
    const position = Math.floor((index * items.length) / count);
    selected.push(items[position]);
  }
  return selected;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function countNested(items, nestedFn) {
  const counts = {};
  for (const item of items) {
    for (const key of nestedFn(item)) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function quantile(values, q) {
  const numbers = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (numbers.length === 0) {
    return null;
  }
  const index = Math.min(numbers.length - 1, Math.max(0, Math.floor((numbers.length - 1) * q)));
  return numbers[index];
}

function trustBandForScore(score) {
  if (!Number.isFinite(score) || score <= 0) return "none";
  if (score >= 80) return "very-high";
  if (score >= 70) return "high";
  if (score >= 60) return "medium";
  if (score >= 50) return "low";
  return "very-low";
}

function isSignLike(record) {
  const text = [
    record.localePromptText,
    record.translatedPromptText,
    record.sourceProvisionalTopic,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /sign|symbol|marking|traffic-signals|標識|記号|路面標示/.test(text);
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(value) {
  return `${Math.round((value ?? 0) * 1000) / 10}%`;
}

function roundNumber(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function parsePilotArgs() {
  const args = parseArgs();
  return {
    lang: String(args.lang ?? "").trim(),
    batchId: String(args.batch ?? args.batchId ?? "").trim(),
    dataset: String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET,
    pilotSize: Number(args["pilot-size"] ?? args.pilotSize ?? 40),
    runBaseline: args["run-baseline"] === true,
    analysisMode: String(args["analysis-mode"] ?? "standard"),
    topCandidates: args["top-candidates"] == null ? null : Number(args["top-candidates"]),
    calibrationProfile: String(args["calibration-profile"] ?? args.calibrationProfile ?? "original").trim() || "original",
    comparisonProfile: String(args["comparison-profile"] ?? args.comparisonProfile ?? "calibrated").trim() || "calibrated",
    outputPrefix: String(args["output-prefix"] ?? args.outputPrefix ?? "").trim(),
  };
}

function applyCalibrationProfile(triggeredChecks, calibration) {
  return triggeredChecks.map((check) => {
    const effectiveLevel =
      calibration.checkLevelOverrides?.[check.code]?.[check.level] ??
      check.level;
    const calibrationAction = effectiveLevel === check.level ? "unchanged" : `${check.level}->${effectiveLevel}`;
    return {
      ...check,
      originalLevel: check.level,
      effectiveLevel,
      calibrationAction,
    };
  });
}

function buildCombinationSignals({ triggeredChecks, calibration, context }) {
  const presentCodes = new Set(triggeredChecks.map((check) => check.code));
  return (calibration.combinationRules ?? [])
    .filter((rule) => matchesCombinationRule(rule, presentCodes, context))
    .map((rule) => ({
      code: rule.code,
      level: rule.level,
      originalLevel: rule.level,
      effectiveLevel: rule.level,
      calibrationAction: "synthetic-combination",
      message: rule.message,
      checks: rule.whenAllCodes,
    }));
}

function signalLevel(check) {
  return check?.effectiveLevel ?? check?.level;
}

function matchesCombinationRule(rule, presentCodes, context) {
  if (rule.whenNoCodes === true && presentCodes.size > 0) {
    return false;
  }
  if (Array.isArray(rule.whenAllCodes) && !rule.whenAllCodes.every((code) => presentCodes.has(code))) {
    return false;
  }
  if (Array.isArray(rule.whenAnyCodes) && !rule.whenAnyCodes.some((code) => presentCodes.has(code))) {
    return false;
  }
  return matchesRuleConditions(rule.conditions ?? {}, context);
}

function matchesRuleConditions(conditions, context) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }

  const normalizedCandidateTopic = String(context.candidateTopic ?? "").trim().toLowerCase();
  const candidateTopicPresent = normalizedCandidateTopic.length > 0;
  const candidateTopicInformative = candidateTopicPresent && !["mcq", "row"].includes(normalizedCandidateTopic);
  const normalizedSourceTopic = String(context.provisionalTopic ?? "").trim().toLowerCase();
  const sourceTopicPresent = normalizedSourceTopic.length > 0;

  if (Array.isArray(conditions.anyOf) && !conditions.anyOf.some((entry) => matchesRuleConditions(entry, context))) {
    return false;
  }
  if (Array.isArray(conditions.allOf) && !conditions.allOf.every((entry) => matchesRuleConditions(entry, context))) {
    return false;
  }

  if (conditions.sourceType && context.sourceType !== conditions.sourceType) {
    return false;
  }
  if (conditions.hasImage != null && Boolean(context.hasImage) !== Boolean(conditions.hasImage)) {
    return false;
  }
  if (conditions.hasSourceAnswerEvidence != null && Boolean(context.hasSourceAnswerEvidence) !== Boolean(conditions.hasSourceAnswerEvidence)) {
    return false;
  }
  if (conditions.sourceTopicPresent != null && sourceTopicPresent !== Boolean(conditions.sourceTopicPresent)) {
    return false;
  }
  if (conditions.candidateTopicPresent != null) {
    if (candidateTopicPresent !== Boolean(conditions.candidateTopicPresent)) {
      return false;
    }
  }
  if (conditions.candidateTopicMissing != null) {
    const missing = !candidateTopicPresent;
    if (missing !== Boolean(conditions.candidateTopicMissing)) {
      return false;
    }
  }
  if (conditions.candidateTopicInformativePresent != null) {
    if (candidateTopicInformative !== Boolean(conditions.candidateTopicInformativePresent)) {
      return false;
    }
  }
  if (conditions.candidateTopicInformativeMissing != null) {
    const missing = !candidateTopicInformative;
    if (missing !== Boolean(conditions.candidateTopicInformativeMissing)) {
      return false;
    }
  }
  if (conditions.candidateTopicDiffersFromSource != null) {
    const differs = sourceTopicPresent && candidateTopicInformative && normalizedCandidateTopic !== normalizedSourceTopic;
    if (differs !== Boolean(conditions.candidateTopicDiffersFromSource)) {
      return false;
    }
  }

  const breakdown = context.scoreBreakdown ?? {};
  if (!passesMinimum(breakdown.promptSimilarity, conditions.minPromptSimilarity)) return false;
  if (!passesMaximum(breakdown.promptSimilarity, conditions.maxPromptSimilarity)) return false;
  if (!passesMinimum(breakdown.optionSimilarity, conditions.minOptionSimilarity)) return false;
  if (!passesMaximum(breakdown.optionSimilarity, conditions.maxOptionSimilarity)) return false;
  if (!passesMinimum(breakdown.optionExactSet, conditions.minOptionExactSet)) return false;
  if (!passesMaximum(breakdown.optionExactSet, conditions.maxOptionExactSet)) return false;
  if (!passesMinimum(breakdown.correctAnswerMeaning, conditions.minCorrectAnswerMeaning)) return false;
  if (!passesMaximum(breakdown.correctAnswerMeaning, conditions.maxCorrectAnswerMeaning)) return false;
  if (!passesMinimum(context.topicConfidence, conditions.minTopicConfidence)) return false;
  if (!passesMaximum(context.topicConfidence, conditions.maxTopicConfidence)) return false;
  if (!passesMinimum(context.suggestedScore, conditions.minSuggestedScore)) return false;
  if (!passesMaximum(context.suggestedScore, conditions.maxSuggestedScore)) return false;
  if (!passesMinimum(context.suggestedScoreGap, conditions.minSuggestedScoreGap)) return false;
  if (!passesMaximum(context.suggestedScoreGap, conditions.maxSuggestedScoreGap)) return false;

  return true;
}

function passesMinimum(value, minimum) {
  if (minimum == null) return true;
  return finiteNumber(value) !== null && Number(value) >= Number(minimum);
}

function passesMaximum(value, maximum) {
  if (maximum == null) return true;
  return finiteNumber(value) !== null && Number(value) <= Number(maximum);
}
