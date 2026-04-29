#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  ROOT,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);

await ensurePipelineDirs({ lang, batchId });

const suggestionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-notebooklm-suggestions.json`);
const outputPath = path.join(STAGING_DIR, `${lang}-${batchId}-combined-recommendations.json`);

if (!fileExists(suggestionsPath)) {
  throw new Error(`NotebookLM suggestions file not found: ${path.relative(ROOT, suggestionsPath)}`);
}

const suggestionsDoc = readJson(suggestionsPath);
const suggestionsByItemId = new Map(
  (Array.isArray(suggestionsDoc.items) ? suggestionsDoc.items : [])
    .filter((item) => item?.itemId)
    .map((item) => [String(item.itemId), item]),
);

const batchFiles = getBatchFiles(lang, batchId);
const sourceItems = loadSourceItems(batchFiles);
const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));

const combinedItems = [];
const summary = {
  sourceItems: sourceItems.length,
  suggestions: suggestionsByItemId.size,
  combined: 0,
  reranked: 0,
  conflicts: 0,
  externalCandidates: 0,
  answerKeyConflicts: 0,
  lowConfidenceEvidenceOnly: 0,
};

for (const entry of sourceItems) {
  const suggestion = suggestionsByItemId.get(entry.item.itemId);
  if (!suggestion) {
    continue;
  }
  const combined = buildCombinedRecommendation(entry, suggestion, questionMap);
  combinedItems.push(combined);
  summary.combined += 1;
  if (combined.combinedRecommendation?.notebookMatchedCandidateRank > 1 && combined.combinedRecommendation?.recommendedQid === suggestion.notebookSuggestedQid) {
    summary.reranked += 1;
  }
  if (combined.combinedRecommendation?.confidence === "conflict") {
    summary.conflicts += 1;
  }
  if (combined.combinedRecommendation?.notebookQidNotInMatcherCandidates) {
    summary.externalCandidates += 1;
  }
  if (combined.combinedRecommendation?.answerKeyConflict) {
    summary.answerKeyConflicts += 1;
  }
  if (combined.combinedRecommendation?.confidence === "weak") {
    summary.lowConfidenceEvidenceOnly += 1;
  }
}

await writeJson(outputPath, {
  lang,
  batch: batchId,
  batchId,
  dataset,
  generatedAt: stableNow(),
  sourceSuggestionsPath: path.relative(ROOT, suggestionsPath),
  summary,
  items: combinedItems,
});

console.log(`Wrote ${path.relative(ROOT, outputPath)}.`);
console.log(JSON.stringify(summary, null, 2));

function loadSourceItems(files) {
  const paths = [
    ["auto-matched", files.matchedPath],
    ["review-needed", files.reviewNeededPath],
    ["unresolved", files.unresolvedPath],
  ];
  const entries = [];
  for (const [section, filePath] of paths) {
    if (!fileExists(filePath)) {
      continue;
    }
    const doc = readJson(filePath);
    for (const item of Array.isArray(doc.items) ? doc.items : []) {
      entries.push({ section, item });
    }
  }
  return entries;
}

function buildCombinedRecommendation(entry, suggestion, questionMap) {
  const item = entry.item;
  const topCandidates = Array.isArray(item.topCandidates) ? item.topCandidates : [];
  const matcherTop = topCandidates[0] ?? null;
  const matcherTopQid = normalizeQid(item.match?.qid ?? matcherTop?.qid);
  const notebookQid = normalizeQid(suggestion.notebookSuggestedQid);
  const notebookConfidence = Number(suggestion.confidence ?? 0);
  const isCloseMatch = suggestion.isCloseMatch === true;
  const notebookRank = notebookQid
    ? topCandidates.findIndex((candidate) => normalizeQid(candidate.qid) === notebookQid) + 1
    : 0;
  const notebookCandidate = notebookRank > 0 ? topCandidates[notebookRank - 1] : null;
  const candidateForAnswer = notebookCandidate ?? (notebookQid ? questionMap.get(notebookQid) : null);
  const notebookAnswerKey = normalizeAnswerKey(suggestion.notebookAnswerKey);
  const candidateAnswerKey = normalizeAnswerKey(
    notebookCandidate?.correctAnswer?.correctOptionKey ??
    notebookCandidate?.correctAnswer?.correctRow ??
    candidateForAnswer?.correctAnswer?.correctOptionKey ??
    candidateForAnswer?.correctAnswer?.correctRow,
  );
  const matcherTopAnswerKey = normalizeAnswerKey(
    matcherTop?.correctAnswer?.correctOptionKey ??
    matcherTop?.correctAnswer?.correctRow ??
    item.currentStagedLocaleCorrectOptionKey,
  );
  const answerKeyConflict = Boolean(
    notebookAnswerKey &&
    ((candidateAnswerKey && notebookAnswerKey !== candidateAnswerKey) ||
      (notebookQid && matcherTopQid && notebookQid === matcherTopQid && matcherTopAnswerKey && notebookAnswerKey !== matcherTopAnswerKey)),
  );

  let recommendedQid = matcherTopQid;
  let recommendedAnswerKey = matcherTopAnswerKey ?? candidateAnswerKey ?? notebookAnswerKey ?? null;
  let confidence = "weak";
  let reason = "NotebookLM did not produce high-confidence close-match evidence; original matcher ranking is preserved.";
  let sources = ["matcher"];

  if (!isCloseMatch || notebookConfidence < 70 || !notebookQid) {
    confidence = "weak";
  } else if (notebookQid === matcherTopQid && notebookConfidence >= 85) {
    confidence = answerKeyConflict ? "conflict" : "strong";
    recommendedQid = matcherTopQid;
    recommendedAnswerKey = notebookAnswerKey ?? matcherTopAnswerKey ?? candidateAnswerKey ?? null;
    sources = ["matcher", "notebooklm"];
    reason = answerKeyConflict
      ? "NotebookLM agrees with matcher top qid but answer key evidence conflicts."
      : "NotebookLM agrees with matcher top candidate and confidence is high.";
  } else if (notebookRank > 1 && notebookConfidence >= 80) {
    confidence = answerKeyConflict ? "conflict" : "medium";
    recommendedQid = notebookQid;
    recommendedAnswerKey = notebookAnswerKey ?? candidateAnswerKey ?? null;
    sources = ["matcher", "notebooklm"];
    reason = `NotebookLM supports matcher candidate rank ${notebookRank}, so that candidate is promoted for review.`;
  } else if (notebookRank === 1) {
    confidence = answerKeyConflict ? "conflict" : "medium";
    recommendedQid = matcherTopQid;
    recommendedAnswerKey = notebookAnswerKey ?? matcherTopAnswerKey ?? candidateAnswerKey ?? null;
    sources = ["matcher", "notebooklm"];
    reason = "NotebookLM agrees with matcher top qid, but confidence is below the strong threshold.";
  } else if (notebookRank === 0 && notebookConfidence >= 85) {
    confidence = matcherTopQid ? "conflict" : "medium";
    recommendedQid = notebookQid;
    recommendedAnswerKey = notebookAnswerKey ?? candidateAnswerKey ?? null;
    sources = ["notebooklm"];
    reason = matcherTopQid
      ? "NotebookLM suggests a high-confidence qid outside the matcher candidate list."
      : "NotebookLM suggests a high-confidence qid for an item without matcher candidates.";
  }

  if (answerKeyConflict) {
    confidence = "conflict";
  }

  const rerankedCandidates = buildRerankedCandidates({
    topCandidates,
    notebookQid,
    notebookConfidence,
    notebookRank,
    questionMap,
    suggestion,
  });

  return {
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    sourceSection: entry.section,
    matcherTopQid,
    matcherTopScore: Number(item.match?.score ?? matcherTop?.score ?? 0),
    matcherTopScoreGap: Number(item.match?.scoreGap ?? item.analysis?.topGap ?? 0),
    notebookSuggestion: {
      qid: notebookQid,
      questionNumber: suggestion.notebookQuestionNumber ?? numberFromQid(notebookQid),
      answerKey: notebookAnswerKey,
      confidence: notebookConfidence,
      isCloseMatch,
      reason: suggestion.reason ?? null,
      matchedText: suggestion.matchedText ?? null,
      status: suggestion.status ?? null,
    },
    combinedRecommendation: {
      recommendedQid,
      recommendedAnswerKey,
      confidence,
      sources,
      notebookAgreesWithMatcherTop1: Boolean(notebookQid && matcherTopQid && notebookQid === matcherTopQid),
      notebookMatchedCandidateRank: notebookRank || null,
      notebookQidNotInMatcherCandidates: Boolean(notebookQid && notebookRank === 0),
      answerKeyConflict,
      matcherTopAnswerKey,
      notebookAnswerKey,
      candidateAnswerKey,
      reason,
      requiresReview: true,
    },
    rerankedCandidates,
  };
}

function buildRerankedCandidates({ topCandidates, notebookQid, notebookConfidence, notebookRank, questionMap, suggestion }) {
  const snapshots = topCandidates.map((candidate, index) => ({
    ...candidate,
    originalRank: index + 1,
    sources: normalizeSources(candidate.sources, "matcher"),
    notebookBoosted: false,
  }));

  if (!notebookQid || suggestion.isCloseMatch !== true || notebookConfidence < 70) {
    return snapshots;
  }

  if (notebookRank > 0) {
    const index = notebookRank - 1;
    snapshots[index] = {
      ...snapshots[index],
      sources: normalizeSources(snapshots[index].sources, "notebooklm"),
      notebookConfidence,
      notebookBoosted: notebookConfidence >= 80 && notebookRank > 1,
    };
    if (notebookConfidence >= 80 && notebookRank > 1) {
      const [promoted] = snapshots.splice(index, 1);
      snapshots.unshift(promoted);
    }
    return snapshots;
  }

  if (notebookConfidence >= 85) {
    const question = questionMap.get(notebookQid);
    snapshots.unshift({
      qid: notebookQid,
      number: question?.number ?? suggestion.notebookQuestionNumber ?? numberFromQid(notebookQid),
      type: question?.type ?? null,
      score: null,
      prompt: question?.prompt ?? suggestion.matchedText ?? null,
      correctAnswer: question?.correctAnswer ?? null,
      originalRank: null,
      sources: ["notebooklm"],
      notebookConfidence,
      notebookBoosted: true,
      externalCandidate: true,
    });
  }

  return snapshots;
}

function normalizeSources(value, source) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set([...list, source].filter(Boolean))];
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  if (!text || /^null$/i.test(text)) {
    return null;
  }
  const match = text.match(/^q?0*(\d{1,4})$/i);
  return match ? `q${String(Number(match[1])).padStart(4, "0")}` : null;
}

function numberFromQid(qid) {
  const match = String(qid ?? "").match(/^q0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim();
  if (!text || /^null$/i.test(text)) {
    return null;
  }
  const upper = text.toUpperCase();
  if (/^[A-D]$/.test(upper)) {
    return upper;
  }
  if (/^(RIGHT|R|TRUE|YES)$/i.test(text)) {
    return "Right";
  }
  if (/^(WRONG|W|FALSE|NO)$/i.test(text)) {
    return "Wrong";
  }
  return text;
}
