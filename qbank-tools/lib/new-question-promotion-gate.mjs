import fs from "node:fs";
import path from "node:path";

import { candidateTagScore } from "./tag-intelligence.mjs";

export const PROMOTION_RECOMMENDATIONS = new Set(["likely_duplicate", "needs_human_review", "safe_to_promote"]);
export const RISK_LEVELS = new Set(["high", "medium", "low"]);

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "must",
  "not",
  "of",
  "on",
  "or",
  "road",
  "should",
  "that",
  "the",
  "this",
  "to",
  "traffic",
  "vehicle",
  "vehicles",
  "what",
  "when",
  "which",
  "with",
  "you",
]);

export function loadMasterQuestions({ root = process.cwd(), dataset = "2023-test1" } = {}) {
  const questionsPath = path.join(root, "public", "qbank", dataset, "questions.json");
  const rawQuestionsPath = path.join(root, "public", "qbank", dataset, "questions.raw.json");
  const imageTagsPath = path.join(root, "public", "qbank", dataset, "image-color-tags.json");
  const questionsDoc = readJson(questionsPath);
  const rawQuestionsDoc = readJsonIfExists(rawQuestionsPath, { questions: [] });
  const imageTagsDoc = readJsonIfExists(imageTagsPath, { questions: {} });
  const rawByQid = new Map(questionArray(rawQuestionsDoc).map((question) => [normalizeQid(question.id ?? question.qid), question]));
  const questions = questionArray(questionsDoc).map((question) =>
    normalizeMasterQuestion(question, imageTagsDoc, rawByQid.get(normalizeQid(question.id ?? question.qid))),
  );
  return {
    questionsPath,
    rawQuestionsPath,
    imageTagsPath,
    questions,
    byQid: new Map(questions.map((question) => [question.qid, question])),
  };
}

export function loadDecisionMemory({ root = process.cwd() } = {}) {
  const memoryPath = path.join(root, "qbank-tools", "history", "decision-memory.json");
  if (!fs.existsSync(memoryPath)) return { memoryPath, records: [] };
  const doc = readJson(memoryPath);
  return {
    memoryPath,
    records: Array.isArray(doc.records) ? doc.records : [],
  };
}

export function loadDuplicateAudit({ root = process.cwd() } = {}) {
  const auditPath = path.join(root, "qbank-tools", "generated", "reports", "duplicate-candidate-audit.json");
  if (!fs.existsSync(auditPath)) return { auditPath, pairs: [] };
  const doc = readJson(auditPath);
  return {
    auditPath,
    pairs: Array.isArray(doc.pairs) ? doc.pairs : [],
  };
}

export function loadNewQuestionCandidates(inputPaths, { lang = null, batch = null } = {}) {
  const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths].filter(Boolean);
  const items = [];
  for (const inputPath of paths) {
    if (!inputPath || !fs.existsSync(inputPath)) continue;
    const doc = readJson(inputPath);
    const batchFromDoc = doc.batchId ?? doc.batch ?? batchFromPath(inputPath) ?? batch ?? null;
    const langFromDoc = doc.lang ?? doc.sourceLang ?? langFromPath(inputPath) ?? lang ?? null;
    const rawItems = Array.isArray(doc.items) ? doc.items : [];
    rawItems.forEach((item, index) => {
      items.push(normalizeCandidate(item, {
        index,
        inputPath,
        lang: langFromDoc,
        batch: batchFromDoc,
      }));
    });
  }
  return items;
}

export function normalizePromptText(value) {
  return normalizeText(value);
}

export function normalizeOptionText(value) {
  return normalizeText(stripOptionLabel(value));
}

export function compareCandidateToMaster(candidate, masterQuestion, { decisionMemory = [] } = {}) {
  const reasonCodes = [];
  const promptSimilarity = scoreTextSimilarity(candidate.translatedEnglishPrompt || candidate.sourcePrompt, masterQuestion.prompt);
  let score = promptSimilarity * 0.42;

  if (promptSimilarity >= 0.98) {
    reasonCodes.push("prompt_exact_match");
    score += 0.2;
  } else if (promptSimilarity >= 0.78) {
    reasonCodes.push("prompt_near_match");
    score += 0.12;
  } else if (promptSimilarity >= 0.48) {
    reasonCodes.push("prompt_overlap");
  }

  const typeScore = scoreType(candidate.type, masterQuestion.type);
  score += typeScore.score;
  if (typeScore.code) reasonCodes.push(typeScore.code);

  const optionScore = scoreOptions(candidate, masterQuestion);
  score += optionScore.score;
  reasonCodes.push(...optionScore.reasonCodes);

  const answerScore = scoreAnswerLogic(candidate, masterQuestion);
  score += answerScore.score;
  reasonCodes.push(...answerScore.reasonCodes);

  const imageScore = scoreImages(candidate, masterQuestion);
  score += imageScore.score;
  reasonCodes.push(...imageScore.reasonCodes);

  const tagScore = scoreTags(candidate, masterQuestion);
  score += tagScore.score;
  reasonCodes.push(...tagScore.reasonCodes);

  const memoryScore = scoreDecisionMemory(candidate, masterQuestion, decisionMemory);
  score += memoryScore.score;
  reasonCodes.push(...memoryScore.reasonCodes);

  const duplicateLabelPenalty = candidate.hasDuplicateOptionLabels ? 0.04 : 0;
  if (duplicateLabelPenalty) reasonCodes.push("candidate_duplicate_option_labels");

  const finalScore = clamp(score - duplicateLabelPenalty, 0, 1);
  return {
    qid: masterQuestion.qid,
    score: Number(finalScore.toFixed(4)),
    reasonCodes: [...new Set(reasonCodes)],
    masterPrompt: masterQuestion.prompt,
    masterAnswer: masterQuestion.answerKey,
    masterImage: masterQuestion.imageAssets[0] ?? null,
    promptSimilarity: Number(promptSimilarity.toFixed(4)),
    type: masterQuestion.type,
    number: masterQuestion.number,
  };
}

export function scoreDuplicateRisk(candidate, matches) {
  const top = matches[0];
  if (!top) {
    return {
      recommendation: "safe_to_promote",
      risk: "low",
      requiredHumanAction: "can_prepare_promotion_preview",
      reasoningSummary: "No comparable master question was found.",
    };
  }

  const codes = new Set(top.reasonCodes ?? []);
  const hasHardDuplicateSignal =
    codes.has("same_image") ||
    codes.has("linked_existing_asset_candidate") ||
    codes.has("prompt_exact_match") ||
    codes.has("decision_memory_duplicate_rejection");
  const hasAnswerSupport =
    codes.has("same_answer_logic") ||
    codes.has("correct_option_meaning_match") ||
    codes.has("row_answer_equivalent");

  if (top.score >= 0.82 || (top.score >= 0.68 && hasHardDuplicateSignal && hasAnswerSupport)) {
    return {
      recommendation: "likely_duplicate",
      risk: "high",
      requiredHumanAction: "reject_duplicate",
      reasoningSummary: `Top match ${top.qid} has strong duplicate evidence: ${top.reasonCodes.join(", ")}.`,
    };
  }

  if (top.score >= 0.52 || hasHardDuplicateSignal || codes.has("prompt_near_match")) {
    return {
      recommendation: "needs_human_review",
      risk: top.score >= 0.62 || hasHardDuplicateSignal ? "medium" : "low",
      requiredHumanAction: "inspect_manually",
      reasoningSummary: `Top match ${top.qid} is plausible but not decisive: ${top.reasonCodes.join(", ") || "moderate similarity"}.`,
    };
  }

  return {
    recommendation: "safe_to_promote",
    risk: "low",
    requiredHumanAction: "can_prepare_promotion_preview",
    reasoningSummary: `No high-confidence duplicate found. Best match ${top.qid} scored ${top.score}.`,
  };
}

export function reviewNewQuestionCandidates({ candidates, masterQuestions, decisionMemory = [], limit = null } = {}) {
  const selected = limit ? candidates.slice(0, limit) : candidates;
  return selected.map((candidate) => {
    const topMatches = masterQuestions
      .map((masterQuestion) => compareCandidateToMaster(candidate, masterQuestion, { decisionMemory }))
      .filter((match) => match.score > 0.08)
      .sort((left, right) => right.score - left.score || compareQid(left.qid, right.qid))
      .slice(0, 8);
    const risk = scoreDuplicateRisk(candidate, topMatches);
    return {
      candidateId: candidate.candidateId,
      lang: candidate.lang,
      batch: candidate.batch,
      sourceFile: candidate.sourceFile,
      sourcePrompt: candidate.sourcePrompt,
      translatedEnglishPrompt: candidate.translatedEnglishPrompt,
      type: candidate.type,
      recommendation: risk.recommendation,
      risk: risk.risk,
      topMatches: topMatches.map((match) => ({
        qid: match.qid,
        number: match.number,
        score: match.score,
        reasonCodes: match.reasonCodes,
        masterPrompt: match.masterPrompt,
        masterAnswer: match.masterAnswer,
        masterImage: match.masterImage,
      })),
      reasoningSummary: risk.reasoningSummary,
      requiredHumanAction: risk.requiredHumanAction,
      candidateSignals: {
        answerKey: candidate.answerKey,
        correctOptionText: candidate.correctOptionText,
        sourceImage: candidate.sourceImage,
        imageAssets: candidate.imageAssets,
        objectTags: candidate.objectTags,
        hasDuplicateOptionLabels: candidate.hasDuplicateOptionLabels,
      },
    };
  });
}

export function reviewNewQuestionDuplicateSafety({
  candidate,
  masterQuestions,
  decisionMemory = [],
  duplicateAudit = null,
  limit = 8,
} = {}) {
  const normalizedCandidate = candidate?.raw && Array.isArray(candidate?.options)
    ? candidate
    : normalizeCandidate(candidate ?? {});
  const memoryIndex = buildDuplicateDecisionMemoryIndex(decisionMemory, duplicateAudit);
  const qidHints = candidateExistingQidHints(normalizedCandidate);
  const topMatches = masterQuestions
    .map((masterQuestion) => compareCandidateToMaster(normalizedCandidate, masterQuestion, { decisionMemory: [] }))
    .filter((match) => match.score > 0.08)
    .map((match) => {
      const memoryLabels = memoryLabelsForMatch(match.qid, qidHints, memoryIndex);
      const memoryAdjustment = memoryLabels.reduce((sum, label) => sum + duplicateMemoryAdjustment(label), 0);
      const adjustedScore = clamp(match.score + memoryAdjustment, 0, 1);
      return {
        ...match,
        duplicateScore: Number(adjustedScore.toFixed(4)),
        baseDuplicateScore: match.score,
        memoryLabels,
      };
    })
    .sort((left, right) => right.duplicateScore - left.duplicateScore || compareQid(left.qid, right.qid))
    .slice(0, limit);

  const authoritativeMemoryLabels = (match) => match.memoryLabels.filter((label) => label.source === "decision-memory");
  const duplicateMemoryMatch = topMatches.find((match) =>
    authoritativeMemoryLabels(match).some((label) => label.decision === "duplicate"),
  );
  const safeMemoryLabels = topMatches.flatMap((match) =>
    authoritativeMemoryLabels(match).filter((label) =>
      ["notDuplicate", "relatedButValid", "sameImageDifferentQuestion"].includes(label.decision),
    ),
  );
  const top = topMatches[0] ?? null;
  const highSimilarityWithoutMemory =
    top && top.duplicateScore >= 0.62 && authoritativeMemoryLabels(top).length === 0;
  const linkedExistingQid = topMatches.find((match) => match.reasonCodes?.includes("linked_existing_asset_candidate"));

  let promotionRecommendation = "safeToPromote";
  if (duplicateMemoryMatch) {
    promotionRecommendation = "blockDuplicate";
  } else if (
    linkedExistingQid &&
    linkedExistingQid.duplicateScore >= 0.72 &&
    !authoritativeMemoryLabels(linkedExistingQid).some((label) =>
      ["notDuplicate", "relatedButValid", "sameImageDifferentQuestion"].includes(label.decision),
    )
  ) {
    promotionRecommendation = "linkToExistingQid";
  } else if (highSimilarityWithoutMemory) {
    promotionRecommendation = "needsDuplicateReview";
  }

  return {
    candidateId: normalizedCandidate.candidateId,
    nearestExistingQids: topMatches.map((match) => ({
      qid: match.qid,
      number: match.number,
      duplicateScore: match.duplicateScore,
      baseDuplicateScore: match.baseDuplicateScore,
      reasonCodes: match.reasonCodes,
      memoryLabels: match.memoryLabels,
      masterPrompt: match.masterPrompt,
      masterAnswer: match.masterAnswer,
      masterImage: match.masterImage,
    })),
    duplicateScore: top?.duplicateScore ?? 0,
    memoryLabelsFound: topMatches.flatMap((match) => match.memoryLabels.map((label) => ({ ...label, matchedQid: match.qid }))),
    safeMemoryLabels,
    promotionRecommendation,
    blocked: promotionRecommendation === "blockDuplicate",
    needsDuplicateReview: promotionRecommendation === "needsDuplicateReview",
    linkToExistingQid: promotionRecommendation === "blockDuplicate"
      ? duplicateMemoryMatch?.qid ?? null
      : promotionRecommendation === "linkToExistingQid"
        ? linkedExistingQid?.qid ?? null
        : null,
    explanation: duplicateSafetyExplanation({ promotionRecommendation, duplicateMemoryMatch, linkedExistingQid, top, safeMemoryLabels }),
  };
}

export function producePromotionRecommendations(context) {
  return reviewNewQuestionCandidates(context);
}

export function normalizeCandidate(item, { index = 0, inputPath = null, lang = null, batch = null } = {}) {
  const sourcePrompt = firstText(
    item.sourcePrompt,
    item.promptRawJa,
    item.promptRaw,
    item.prompt,
    item.localPrompt,
    item.source?.prompt,
  );
  const translatedEnglishPrompt = firstText(
    item.translatedEnglishPrompt,
    item.promptGlossEn,
    item.englishPrompt,
    item.promptEn,
    item.translatedPrompt,
    item.source?.englishPrompt,
  );
  const type = normalizeQuestionType(item.type ?? item.effectiveQuestionType ?? item.questionType);
  const options = normalizeCandidateOptions(item);
  const answerKey = normalizeAnswerKey(item.newQuestionLocalAnswerKey ?? item.correctKeyRaw ?? item.localeAnswerKey ?? item.answerKey, type);
  const correctOptionText = correctOptionTextFor(options, answerKey) ?? firstText(item.correctAnswerRaw, item.correctAnswerGlossEn);
  const candidateId = String(item.candidateId ?? item.id ?? `${path.basename(inputPath ?? "candidate")}:${index + 1}`);
  const imageAssets = [
    ...toArray(item.imageAssets),
    ...toArray(item.assetSrcs),
    item.image,
    item.sourceImage,
    item.linkedExistingAssetCandidate?.currentAssetSrc,
  ].filter(Boolean).map(String);
  const sourceImage = firstText(item.sourceImage, item.image, imageAssets[0]);
  const objectTags = [
    ...toArray(item.objectTags),
    ...toArray(item.imageTags?.objectTags),
    ...toArray(item.provisionalSubtopics),
    ...toArray(item.topicSignals).map((signal) => signal?.subtopic ?? signal?.topic).filter(Boolean),
  ].map(cleanTag).filter(Boolean);
  const labels = options.map((option) => option.key).filter(Boolean);

  return {
    raw: item,
    candidateId,
    lang: lang ?? item.sourceLang ?? item.lang ?? null,
    batch: batch ?? item.batch ?? null,
    sourceFile: inputPath,
    sourcePrompt,
    translatedEnglishPrompt,
    type,
    options,
    answerKey,
    correctOptionText,
    sourceImage,
    imageAssets,
    linkedExistingAssetCandidate: item.linkedExistingAssetCandidate ?? null,
    objectTags: [...new Set(objectTags)],
    hasDuplicateOptionLabels: new Set(labels).size !== labels.length,
  };
}

function normalizeMasterQuestion(question, imageTagsDoc, rawQuestion = null) {
  const qid = normalizeQid(question.id ?? question.qid);
  const type = normalizeQuestionType(question.type);
  const options = masterOptions(question);
  const answerKey = masterAnswerKey(question, options, type);
  const imageAssets = [
    ...toArray(question.assets),
    ...(toArray(question.assets).length > 0 ? [] : toArray(rawQuestion?.assets)),
  ]
    .filter((asset) => asset?.src)
    .map((asset) => String(asset.src));
  const tagEntry = imageTagsDoc?.questions?.[qid] ?? {};
  const objectTags = toArray(tagEntry.objectTags).map(cleanTag).filter(Boolean);

  return {
    raw: question,
    qid,
    number: Number(question.number ?? qid?.replace(/^q/i, "")) || null,
    type,
    prompt: String(question.prompt ?? rawQuestion?.prompt ?? "").trim(),
    normalizedPrompt: normalizePromptText(question.prompt ?? rawQuestion?.prompt),
    promptTokens: tokenSet(question.prompt ?? rawQuestion?.prompt),
    options,
    answerKey,
    correctOptionText: correctOptionTextFor(options, answerKey),
    imageAssets,
    imageBasenames: imageAssets.map((src) => path.basename(src)),
    imageHashes: imageAssets.map((src) => imageHashFromSrc(src)).filter(Boolean),
    objectTags,
  };
}

function normalizeCandidateOptions(item) {
  const english = toArray(item.optionsGlossEn ?? item.englishOptions ?? item.optionsEn ?? item.options);
  const raw = toArray(item.optionsRawJa ?? item.optionsRaw ?? item.localOptions);
  const source = english.length ? english : raw;
  return source.map((value, index) => {
    if (value && typeof value === "object") {
      const key = normalizeMcqKey(value.key ?? value.sourceKey ?? value.originalKey) ?? keyFromIndex(index);
      return {
        key,
        text: String(value.text ?? value.sourceText ?? value.label ?? "").trim(),
        normalizedText: normalizeOptionText(value.text ?? value.sourceText ?? value.label),
      };
    }
    const parsed = parseOptionString(value, index);
    return {
      key: parsed.key,
      text: parsed.text,
      normalizedText: normalizeOptionText(parsed.text),
    };
  });
}

function masterOptions(question) {
  return toArray(question.options).map((option, index) => {
    const key = normalizeMcqKey(option?.originalKey ?? option?.key) ?? keyFromIndex(index);
    const text = String(option?.text ?? "").trim();
    return {
      id: String(option?.id ?? "").trim(),
      key,
      text,
      normalizedText: normalizeOptionText(text),
    };
  });
}

function masterAnswerKey(question, options, type) {
  if (type === "row") return normalizeAnswerKey(question.answerRaw ?? question.correctRow, type);
  const correctOptionId = String(question.correctOptionId ?? "").trim();
  const byId = options.find((option) => option.id === correctOptionId);
  return byId?.key ?? normalizeMcqKey(question.answerRaw);
}

function scoreTextSimilarity(left, right) {
  const leftNorm = normalizeText(left);
  const rightNorm = normalizeText(right);
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 1;
  const containment = leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)
    ? Math.min(leftNorm.length, rightNorm.length) / Math.max(leftNorm.length, rightNorm.length)
    : 0;
  const jaccard = jaccardSimilarity(tokenSet(leftNorm), tokenSet(rightNorm));
  const keyJaccard = jaccardSimilarity(tokenSet(leftNorm, { removeStopwords: true }), tokenSet(rightNorm, { removeStopwords: true }));
  return clamp(Math.max(containment * 0.9, jaccard, keyJaccard * 0.95), 0, 1);
}

function scoreType(candidateType, masterType) {
  if (candidateType === "unknown" || masterType === "unknown") return { score: 0, code: "unknown_type" };
  if (candidateType === masterType) return { score: 0.08, code: "same_question_type" };
  return { score: -0.04, code: "different_question_type" };
}

function scoreOptions(candidate, masterQuestion) {
  const reasonCodes = [];
  if (!candidate.options.length && !masterQuestion.options.length) return { score: 0.03, reasonCodes: ["no_options_both"] };
  if (!candidate.options.length || !masterQuestion.options.length) return { score: 0, reasonCodes };

  if (candidate.options.length === masterQuestion.options.length) reasonCodes.push("same_option_count");
  const optionScores = candidate.options.map((candidateOption) => {
    const best = Math.max(0, ...masterQuestion.options.map((masterOption) => scoreTextSimilarity(candidateOption.text, masterOption.text)));
    return best;
  });
  const average = optionScores.reduce((sum, score) => sum + score, 0) / optionScores.length;
  let score = average * 0.17;
  if (average >= 0.78) reasonCodes.push("option_meaning_match");
  else if (average >= 0.5) reasonCodes.push("option_overlap");

  if (candidate.correctOptionText && masterQuestion.correctOptionText) {
    const correctScore = scoreTextSimilarity(candidate.correctOptionText, masterQuestion.correctOptionText);
    score += correctScore * 0.12;
    if (correctScore >= 0.75) reasonCodes.push("correct_option_meaning_match");
  }

  return { score, reasonCodes };
}

function scoreAnswerLogic(candidate, masterQuestion) {
  const reasonCodes = [];
  if (candidate.type === "row" && masterQuestion.type === "row" && candidate.answerKey && masterQuestion.answerKey) {
    if (candidate.answerKey === masterQuestion.answerKey) {
      return { score: 0.12, reasonCodes: ["same_answer_logic", "row_answer_equivalent"] };
    }
    return { score: -0.05, reasonCodes: ["different_row_answer_logic"] };
  }
  if (candidate.correctOptionText && masterQuestion.correctOptionText) {
    const similarity = scoreTextSimilarity(candidate.correctOptionText, masterQuestion.correctOptionText);
    if (similarity >= 0.75) {
      reasonCodes.push("same_answer_logic");
      return { score: 0.1, reasonCodes };
    }
  }
  if (candidate.answerKey && masterQuestion.answerKey && candidate.answerKey === masterQuestion.answerKey && candidate.type === masterQuestion.type) {
    return { score: 0.03, reasonCodes: ["same_answer_letter"] };
  }
  return { score: 0, reasonCodes };
}

function scoreImages(candidate, masterQuestion) {
  const reasonCodes = [];
  let score = 0;
  const candidateBasenames = new Set(candidate.imageAssets.map((src) => path.basename(src)));
  const candidateHashes = new Set(candidate.imageAssets.map(imageHashFromSrc).filter(Boolean));
  const masterBasenames = new Set(masterQuestion.imageBasenames);
  const masterHashes = new Set(masterQuestion.imageHashes);

  if (candidate.linkedExistingAssetCandidate?.qid === masterQuestion.qid) {
    score += 0.24;
    reasonCodes.push("linked_existing_asset_candidate");
  }
  if (intersects(candidateBasenames, masterBasenames) || intersects(candidateHashes, masterHashes)) {
    score += 0.22;
    reasonCodes.push("same_image");
  } else if (!candidate.imageAssets.length && !masterQuestion.imageAssets.length) {
    score += 0.01;
    reasonCodes.push("no_image_both");
  }

  return { score, reasonCodes };
}

function scoreTags(candidate, masterQuestion) {
  const reasonCodes = [];
  if (!candidate.objectTags.length || !masterQuestion.objectTags.length) return { score: 0, reasonCodes };
  const tagReview = candidateTagScore(masterQuestion.qid, candidate.objectTags);
  if (tagReview.exactScore >= 0.5) reasonCodes.push("object_tag_overlap");
  if (tagReview.familyScore >= 0.5) reasonCodes.push("object_tag_family_overlap");
  if (tagReview.oppositePairs.length) reasonCodes.push("opposite_object_tags");
  return { score: tagReview.score * 0.08, reasonCodes };
}

function scoreDecisionMemory(candidate, masterQuestion, decisionMemory) {
  const reasonCodes = [];
  let score = 0;
  const candidateNeedles = [
    candidate.candidateId,
    candidate.sourceImage,
    candidate.translatedEnglishPrompt,
    candidate.sourcePrompt,
  ].filter(Boolean).map((value) => normalizeText(value));

  for (const record of decisionMemory) {
    if (record.qid !== masterQuestion.qid) continue;
    const haystack = normalizeText(JSON.stringify(record));
    if (!candidateNeedles.some((needle) => needle && haystack.includes(needle.slice(0, Math.min(needle.length, 80))))) continue;
    if (record.decisionType === "duplicate" || /duplicate/i.test(record.reason ?? "")) {
      score += record.finalDecision === "rejected" || record.finalDecision === "skipped" ? 0.14 : 0.08;
      reasonCodes.push("decision_memory_duplicate_rejection");
    }
    if (record.decisionType === "new-question" && record.finalDecision === "approved") {
      score -= 0.06;
      reasonCodes.push("decision_memory_previously_approved_new");
    }
  }

  return { score, reasonCodes };
}

function buildDuplicateDecisionMemoryIndex(decisionMemory = [], duplicateAudit = null) {
  const byPair = new Map();

  for (const record of Array.isArray(decisionMemory) ? decisionMemory : []) {
    if ((record.type ?? record.decisionType) !== "duplicate-detection") continue;
    const qid = normalizeQidSafe(record.qid);
    const pairedQid = normalizeQidSafe(record.pairedQid ?? record.referencedQid);
    if (!qid || !pairedQid || qid === pairedQid) continue;
    addDuplicateLabel(byPair, qid, pairedQid, {
      source: "decision-memory",
      decision: normalizeDuplicateDecision(record.decision ?? record.finalDecision ?? record.outcome),
      outcome: record.outcome ?? record.finalDecision ?? null,
      reason: String(record.reason ?? record.reviewerNotes ?? "").trim(),
      scoreAtReview: finiteNumber(record.scoreAtReview),
      categoryAtReview: record.categoryAtReview ?? null,
      sourceFiles: Array.isArray(record.sourceFiles) ? record.sourceFiles : [record.sourceFile].filter(Boolean),
    });
  }

  for (const pair of Array.isArray(duplicateAudit?.pairs) ? duplicateAudit.pairs : []) {
    const qidA = normalizeQidSafe(pair.qidA);
    const qidB = normalizeQidSafe(pair.qidB);
    if (!qidA || !qidB || qidA === qidB) continue;
    addDuplicateLabel(byPair, qidA, qidB, {
      source: "duplicate-candidate-audit",
      decision: duplicateAuditDecision(pair),
      outcome: null,
      reason: String(pair.reason ?? pair.recommendedDecision ?? "").trim(),
      scoreAtReview: finiteNumber(pair.duplicateScore),
      categoryAtReview: pair.classification ?? null,
      sourceFiles: ["qbank-tools/generated/reports/duplicate-candidate-audit.json"],
    });
  }

  return { byPair };
}

function addDuplicateLabel(byPair, qidA, qidB, label) {
  const key = duplicatePairKey(qidA, qidB);
  const labels = byPair.get(key) ?? [];
  const normalized = {
    source: label.source,
    decision: normalizeDuplicateDecision(label.decision),
    outcome: label.outcome ?? null,
    reason: label.reason ?? "",
    scoreAtReview: label.scoreAtReview ?? null,
    categoryAtReview: label.categoryAtReview ?? null,
    sourceFiles: Array.isArray(label.sourceFiles) ? label.sourceFiles : [],
    pairQids: key.split("::"),
  };
  if (
    !labels.some(
      (existing) =>
        existing.source === normalized.source &&
        existing.decision === normalized.decision &&
        existing.reason === normalized.reason &&
        existing.categoryAtReview === normalized.categoryAtReview,
    )
  ) {
    labels.push(normalized);
  }
  byPair.set(key, labels);
}

function candidateExistingQidHints(candidate) {
  const raw = candidate.raw ?? {};
  const values = [
    candidate.linkedExistingAssetCandidate?.qid,
    raw.linkedExistingAssetCandidate?.qid,
    raw.currentTopQid,
    raw.approvedQid,
    raw.match?.qid,
    raw.matchQid,
    raw.topCandidateQid,
    ...toArray(raw.candidateQids),
    ...toArray(raw.candidateQidHints),
    ...toArray(raw.topCandidates).map((entry) => entry?.qid),
    ...toArray(raw.candidates).map((entry) => entry?.qid),
  ];
  return [...new Set(values.map(normalizeQidSafe).filter(Boolean))];
}

function memoryLabelsForMatch(matchQid, qidHints, memoryIndex) {
  const normalizedMatchQid = normalizeQidSafe(matchQid);
  if (!normalizedMatchQid || !qidHints.length) return [];
  const labels = [];
  for (const qidHint of qidHints) {
    const pairLabels = memoryIndex.byPair.get(duplicatePairKey(normalizedMatchQid, qidHint)) ?? [];
    labels.push(...pairLabels.map((label) => ({ ...label, matchedViaQid: qidHint })));
  }
  return labels;
}

function duplicateMemoryAdjustment(label) {
  if (label.source !== "decision-memory") return 0;
  if (label.decision === "duplicate") return 0.35;
  if (label.decision === "notDuplicate") return -0.4;
  if (label.decision === "relatedButValid" || label.decision === "sameImageDifferentQuestion") return -0.28;
  return 0;
}

function duplicateSafetyExplanation({ promotionRecommendation, duplicateMemoryMatch, linkedExistingQid, top, safeMemoryLabels }) {
  if (promotionRecommendation === "blockDuplicate") {
    const label = duplicateMemoryMatch?.memoryLabels?.find((entry) => entry.source === "decision-memory" && entry.decision === "duplicate");
    return `Blocked by duplicate decision memory for ${duplicateMemoryMatch?.qid ?? "an existing qid"}${label?.reason ? `: ${label.reason}` : "."}`;
  }
  if (promotionRecommendation === "linkToExistingQid") {
    return `High duplicate risk because the candidate is already linked to existing qid ${linkedExistingQid?.qid}; review as an existing-qid link instead of promotion.`;
  }
  if (promotionRecommendation === "needsDuplicateReview") {
    return `High similarity to ${top?.qid ?? "an existing qid"} without prior duplicate-review memory; run/record duplicate review before promotion.`;
  }
  if (safeMemoryLabels.length) {
    const label = safeMemoryLabels[0];
    return `Prior duplicate-review memory says ${label.decision}; similarity alone is not blocking promotion${label.reason ? `: ${label.reason}` : "."}`;
  }
  if (top) return `No blocking duplicate memory found. Nearest qid ${top.qid} scored ${top.duplicateScore}.`;
  return "No blocking duplicate memory or similar master qid found.";
}

function duplicateAuditDecision(pair) {
  if (pair?.signals?.memoryDecision) return normalizeDuplicateDecision(pair.signals.memoryDecision);
  if (Array.isArray(pair?.memoryRecords) && pair.memoryRecords.length) {
    const decision = pair.memoryRecords.find((record) => record?.decision)?.decision;
    if (decision) return normalizeDuplicateDecision(decision);
  }
  if (pair?.classification === "same-image-different-question") return "sameImageDifferentQuestion";
  if (pair?.classification === "related-but-valid") return "relatedButValid";
  return "unsure";
}

function normalizeDuplicateDecision(value) {
  const raw = String(value ?? "").trim();
  const compact = raw.toLowerCase().replace(/[-_\s]+/g, "");
  if (compact === "duplicate" || compact === "approvedduplicate") return "duplicate";
  if (compact === "notduplicate" || compact === "falseduplicate") return "notDuplicate";
  if (compact === "relatedbutvalid") return "relatedButValid";
  if (compact === "sameimagedifferentquestion") return "sameImageDifferentQuestion";
  return raw || "unsure";
}

function duplicatePairKey(qidA, qidB) {
  return [qidA, qidB].sort(compareQid).join("::");
}

function normalizeQidSafe(value) {
  const qid = normalizeQid(value);
  return /^q\d{4}$/i.test(qid) ? qid : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function correctOptionTextFor(options, answerKey) {
  if (!answerKey) return null;
  return options.find((option) => option.key === answerKey)?.text ?? null;
}

function parseOptionString(value, index) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^\s*([A-D])[\).:\-\s]+(.+)$/i);
  return {
    key: normalizeMcqKey(match?.[1]) ?? keyFromIndex(index),
    text: (match?.[2] ?? raw).trim(),
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value, { removeStopwords = false } = {}) {
  const tokens = normalizeText(value).split(/\s+/).filter(Boolean);
  return new Set(removeStopwords ? tokens.filter((token) => !STOPWORDS.has(token)) : tokens);
}

function jaccardSimilarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / new Set([...left, ...right]).size;
}

function normalizeQuestionType(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["row", "rightwrong", "right-wrong", "truefalse", "true-false"].includes(raw)) return "row";
  if (["mcq", "multiple-choice", "multiple_choice"].includes(raw)) return "mcq";
  return raw ? raw : "unknown";
}

function normalizeAnswerKey(value, type) {
  if (type === "row") return normalizeRowKey(value);
  return normalizeMcqKey(value) ?? normalizeRowKey(value);
}

function normalizeMcqKey(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(raw) ? raw : null;
}

function normalizeRowKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["r", "right", "true", "correct", "yes", "правильно"].includes(raw)) return "Right";
  if (["w", "wrong", "false", "incorrect", "no", "неправильно", "не правильно"].includes(raw)) return "Wrong";
  return null;
}

function keyFromIndex(index) {
  return ["A", "B", "C", "D"][index] ?? null;
}

function imageHashFromSrc(src) {
  return String(src ?? "").match(/img_([a-f0-9]{16,})/i)?.[1] ?? null;
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

function compareQid(left, right) {
  const leftNumber = Number(String(left).replace(/^q/i, ""));
  const rightNumber = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right));
}

function cleanTag(value) {
  return String(value ?? "").trim().replace(/^#/, "").toLowerCase();
}

function stripOptionLabel(value) {
  return String(value ?? "").replace(/^\s*[A-D][\).:\-\s]+/i, "").trim();
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function intersects(left, right) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function batchFromPath(filePath) {
  return path.basename(filePath).match(/batch-\d+/i)?.[0] ?? null;
}

function langFromPath(filePath) {
  return path.basename(filePath).match(/(?:^|[.-])([a-z]{2,3})(?:[.-]|$)/)?.[1] ?? null;
}
