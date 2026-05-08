#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  createTagIntelligence,
  explainTagOverlap as explainQidTagOverlap,
  writeTagIntelligenceReport,
} from "../qbank-tools/lib/tag-intelligence.mjs";

const ROOT = process.cwd();
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const QUESTIONS_PATH = path.join(DATASET_DIR, "questions.json");
const RAW_QUESTIONS_PATH = path.join(DATASET_DIR, "questions.raw.json");
const IMAGE_TAGS_PATH = path.join(DATASET_DIR, "image-color-tags.json");
const MEMORY_PATH = path.join(ROOT, "qbank-tools", "history", "decision-memory.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const OUT_JSON = path.join(REPORTS_DIR, "duplicate-candidate-audit.json");
const OUT_MD = path.join(REPORTS_DIR, "duplicate-candidate-audit.md");
const OUT_HTML = path.join(REPORTS_DIR, "duplicate-candidate-audit.html");
const OUT_DECISIONS = path.join(ROOT, "qbank-tools", "generated", "staging", "duplicate-review-decisions.json");

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
  "how", "if", "in", "into", "is", "it", "its", "must", "not", "of", "on", "or", "road",
  "should", "that", "the", "their", "this", "to", "traffic", "vehicle", "vehicles", "what",
  "when", "which", "with", "meaning", "mean", "indicate", "sign", "shown", "picture",
]);

const questionsDoc = readJson(QUESTIONS_PATH);
const rawQuestionsDoc = readJson(RAW_QUESTIONS_PATH);
const imageTagsDoc = readJsonIfExists(IMAGE_TAGS_PATH, { questions: {} });
const memoryDoc = readJsonIfExists(MEMORY_PATH, { records: [] });
const previousReport = readJsonIfExists(OUT_JSON, null);
const tagIntelligence = createTagIntelligence({
  root: ROOT,
  dataset: DATASET,
  imageTagsDoc,
  decisionMemoryDoc: memoryDoc,
  questionsDoc,
});
const rawMap = new Map(questionArray(rawQuestionsDoc).map((question) => [safeNormalizeQid(question.id ?? question.qid), question]));
const imageTagsMap = buildImageTagsMap(imageTagsDoc);
const questions = questionArray(questionsDoc)
  .map((question) => normalizeQuestion(question, rawMap.get(safeNormalizeQid(question.id ?? question.qid)), imageTagsMap))
  .filter((question) => question.qid);
const questionMap = new Map(questions.map((question) => [question.qid, question]));
const memorySignals = buildDecisionMemorySignals(memoryDoc, questionMap);
const pairs = [];

for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
    const left = questions[leftIndex];
    const right = questions[rightIndex];
    const review = reviewPair(left, right, memorySignals);
    if (shouldEmitPair(review)) {
      pairs.push(review);
    }
  }
}

pairs.sort((left, right) =>
  categoryRank(left.classification) - categoryRank(right.classification) ||
  right.duplicateScore - left.duplicateScore ||
  left.qidA.localeCompare(right.qidA) ||
  left.qidB.localeCompare(right.qidB),
);

const summary = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET,
  masterQuestions: questions.length,
  previousExactDuplicateRisks: previousReport?.summary?.exactDuplicateRisks ?? null,
  duplicatePairsFound: pairs.length,
  exactDuplicateRisks: pairs.filter((pair) => pair.classification === "exact-duplicate-risk").length,
  likelyDuplicates: pairs.filter((pair) => pair.classification === "likely-duplicate").length,
  relatedButValid: pairs.filter((pair) => pair.classification === "related-but-valid").length,
  sameImageDifferentQuestionPairs: pairs.filter((pair) => pair.classification === "same-image-different-question").length,
  needsHumanReview: pairs.filter((pair) => pair.classification === "needs-human-review").length,
  tagIntelligenceScoredPairs: pairs.filter((pair) => pair.signals.tagIntelligence?.score > 0).length,
  tagOppositePairs: pairs.filter((pair) => (pair.signals.tagIntelligence?.oppositePairs ?? []).length > 0).length,
  memoryDownrankedPairs: pairs.filter((pair) => pair.signals.memoryDecision?.scoreAdjustment < 0).length,
  memoryBoostedPairs: pairs.filter((pair) => pair.signals.memoryDecision?.scoreAdjustment > 0).length,
  memoryReuseLinks: memorySignals.reuseLinks.size,
  memoryNoteLinks: memorySignals.noteLinks.size,
  duplicateReviewMemoryPairs: memorySignals.reviewLinks.size,
};

const report = {
  generatedAt: summary.generatedAt,
  dataset: DATASET,
  sources: {
    questions: rel(QUESTIONS_PATH),
    rawQuestions: rel(RAW_QUESTIONS_PATH),
    imageTags: rel(IMAGE_TAGS_PATH),
    decisionMemory: rel(MEMORY_PATH),
  },
  summary,
  pairs,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await writeJson(OUT_JSON, report);
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");
await fsp.writeFile(OUT_HTML, renderHtml(report), "utf8");
await writeTagIntelligenceReport({
  root: ROOT,
  dataset: DATASET,
  context: tagIntelligence,
  usage: {
    duplicateAuditTagScoreUsage: summary.tagIntelligenceScoredPairs,
    newQuestionGateTagScoreUsage: "enabled",
    imageReplacementTagScoreUsage: "enabled",
  },
});

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Wrote ${rel(OUT_HTML)}`);
console.log(`Duplicate pairs found: ${summary.duplicatePairsFound}`);
console.log(`Exact duplicate risks: ${summary.exactDuplicateRisks}`);
console.log(`Likely duplicates: ${summary.likelyDuplicates}`);
console.log(`Same-image different-question pairs: ${summary.sameImageDifferentQuestionPairs}`);

function reviewPair(left, right, memorySignals) {
  const pairKey = makePairKey(left.qid, right.qid);
  const promptSimilarity = textSimilarity(left.prompt, right.prompt);
  const optionsSimilarity = optionSetSimilarity(left.options, right.options);
  const correctAnswerSimilarity = correctAnswerSimilarityFor(left, right);
  const sharedImages = intersection(left.imageAssets, right.imageAssets);
  const tagExplanation = explainQidTagOverlap(left.qid, right.qid, tagIntelligence);
  const sharedTags = tagExplanation.exactOverlap;
  const tagSimilarity = tagExplanation.score;
  const memory = memorySignals.byPair.get(pairKey) ?? { reasons: [], records: [] };
  const hasMemoryReuse = memory.reasons.includes("decision-memory-reuse-existing-qid-image");
  const hasMemoryNote = memory.reasons.includes("reviewer-note-cross-qid-reference");
  const memoryDecision = memorySignals.reviewDecisions.get(pairKey) ?? null;
  const hardSignal = sharedImages.length > 0 || hasMemoryReuse || hasMemoryNote;
  const genericPromptPenalty = isGenericPrompt(left.prompt) && isGenericPrompt(right.prompt) && !hardSignal ? 0.1 : 0;
  const typeScore = left.type === right.type ? 1 : 0.25;
  const baseDuplicateScore = clamp01(
    promptSimilarity * 0.24 +
    optionsSimilarity * 0.22 +
    correctAnswerSimilarity * 0.18 +
    (sharedImages.length > 0 ? 0.2 : 0) +
    tagSimilarity * 0.08 +
    (hasMemoryReuse ? 0.16 : 0) +
    (hasMemoryNote ? 0.08 : 0) +
    typeScore * 0.04 -
    genericPromptPenalty,
  );
  const memoryAdjustment = memoryScoreAdjustment(memoryDecision);
  const duplicateScore = clamp01(baseDuplicateScore + memoryAdjustment);
  const reasonCodes = [
    promptSimilarity >= 0.96 ? "prompt_exact_or_near_exact" : null,
    promptSimilarity >= 0.65 && promptSimilarity < 0.96 ? "prompt_overlap" : null,
    optionsSimilarity >= 0.82 ? "options_near_match" : null,
    correctAnswerSimilarity >= 0.82 ? "correct_answer_match" : null,
    sharedImages.length > 0 ? "shared_image_asset" : null,
    tagExplanation.exactScore >= 0.5 ? "tag_overlap" : null,
    tagExplanation.familyScore >= 0.5 ? "tag_family_overlap" : null,
    tagExplanation.oppositePairs.length > 0 ? "opposite_tag_pair" : null,
    hasMemoryReuse ? "decision_memory_reuse_existing_qid_image" : null,
    hasMemoryNote ? "reviewer_note_mentions_pair" : null,
    memoryDecision ? `duplicate_review_memory_${memoryDecision.decision}` : null,
    left.type !== right.type ? "type_mismatch" : null,
    isOppositeMeaning(left.correctText, right.correctText) ? "opposite_answer_meaning" : null,
  ].filter(Boolean);
  const classification = classifyPair({
    promptSimilarity,
    optionsSimilarity,
    correctAnswerSimilarity,
    sharedImages,
    duplicateScore,
    hasMemoryReuse,
    hasMemoryNote,
    memoryDecision,
    tagExplanation,
    left,
    right,
  });
  return {
    qidA: left.qid,
    qidB: right.qid,
    numberA: left.number,
    numberB: right.number,
    classification,
    duplicateScore: round(duplicateScore),
    baseDuplicateScore: round(baseDuplicateScore),
    signals: {
      promptSimilarity: round(promptSimilarity),
      optionsSimilarity: round(optionsSimilarity),
      correctAnswerSimilarity: round(correctAnswerSimilarity),
      tagSimilarity: round(tagSimilarity),
      sharedImages,
      sharedTags,
      tagIntelligence: tagExplanation,
      memoryReasons: memory.reasons,
      memoryDecision: memoryDecision ? {
        decision: memoryDecision.decision,
        outcome: memoryDecision.outcome,
        reason: memoryDecision.reason,
        scoreAdjustment: memoryAdjustment,
        sourceFiles: memoryDecision.sourceFiles,
      } : null,
    },
    qidAQuestion: serializeQuestionForReport(left),
    qidBQuestion: serializeQuestionForReport(right),
    reason: buildReason(classification, reasonCodes, memory.records),
    recommendedDecision: recommendedDecision(classification),
    memoryRecords: memory.records.slice(0, 8),
  };
}

function classifyPair({ promptSimilarity, optionsSimilarity, correctAnswerSimilarity, sharedImages, duplicateScore, hasMemoryReuse, hasMemoryNote, memoryDecision, tagExplanation, left, right }) {
  if (memoryDecision?.decision === "duplicate") {
    return "exact-duplicate-risk";
  }
  if (memoryDecision?.decision === "sameImageDifferentQuestion") {
    return "same-image-different-question";
  }
  if (["notDuplicate", "relatedButValid"].includes(memoryDecision?.decision)) {
    return "related-but-valid";
  }
  if (memoryDecision?.decision === "unsure") {
    return "needs-human-review";
  }
  const sameImage = sharedImages.length > 0;
  const sameType = left.type === right.type;
  const oppositeMeaning = isOppositeMeaning(left.correctText, right.correctText) || tagExplanation.oppositePairs.length > 0;
  const promptIntentMatches = promptSimilarity >= 0.9 && !oppositeMeaning;
  const scenarioEvidence = sameImage || (tagExplanation.familyScore >= 0.72 && !isImageDependentPrompt(left.prompt, right.prompt));
  const answerAndOptionsMatch = optionsSimilarity >= 0.86 && correctAnswerSimilarity >= 0.82;
  if (oppositeMeaning) {
    return "related-but-valid";
  }
  if (sameImage && promptIntentMatches && answerAndOptionsMatch) {
    return "exact-duplicate-risk";
  }
  if (sameImage && (promptSimilarity < 0.72 || optionsSimilarity < 0.58 || correctAnswerSimilarity < 0.58)) {
    return "same-image-different-question";
  }
  if (duplicateScore >= 0.84 && sameType && answerAndOptionsMatch && promptIntentMatches && scenarioEvidence && (sameImage || hasMemoryReuse)) {
    return "likely-duplicate";
  }
  if (duplicateScore >= 0.62 && (promptSimilarity >= 0.72 || optionsSimilarity >= 0.72 || correctAnswerSimilarity >= 0.72 || hasMemoryNote || hasMemoryReuse)) {
    return "needs-human-review";
  }
  if (duplicateScore >= 0.52 || sameImage || hasMemoryReuse || hasMemoryNote) {
    return "related-but-valid";
  }
  return "needs-human-review";
}

function shouldEmitPair(pair) {
  const hardSignal = pair.signals.sharedImages.length > 0 || pair.signals.memoryReasons.length > 0;
  return hardSignal || pair.duplicateScore >= 0.52;
}

function buildDecisionMemorySignals(memoryDoc, questionMap) {
  const byPair = new Map();
  const reuseLinks = new Set();
  const noteLinks = new Set();
  const reviewLinks = new Set();
  const reviewDecisions = new Map();
  for (const raw of Array.isArray(memoryDoc.records) ? memoryDoc.records : []) {
    const type = raw.type ?? raw.decisionType;
    if (type === "duplicate-detection") {
      const qid = safeNormalizeQid(raw.qid);
      const pairedQid = safeNormalizeQid(raw.pairedQid);
      if (qid && pairedQid && questionMap.has(qid) && questionMap.has(pairedQid)) {
        const key = makePairKey(qid, pairedQid);
        reviewLinks.add(key);
        const signal = {
          decision: raw.decision ?? raw.finalDecision ?? "unsure",
          outcome: raw.outcome ?? null,
          reason: raw.reason ?? "",
          scoreAtReview: raw.scoreAtReview ?? null,
          categoryAtReview: raw.categoryAtReview ?? null,
          sourceFiles: raw.sourceFiles ?? (raw.sourceFile ? [raw.sourceFile] : []),
        };
        reviewDecisions.set(key, signal);
        addMemorySignal(byPair, key, `duplicate-review-${signal.decision}`, raw);
      }
      continue;
    }
    if (type !== "image-replacement" && type !== "duplicate") continue;
    const qid = safeNormalizeQid(raw.qid);
    const referencedQid = safeNormalizeQid(raw.referencedQid);
    if (qid && referencedQid && qid !== referencedQid && questionMap.has(qid) && questionMap.has(referencedQid)) {
      const key = makePairKey(qid, referencedQid);
      reuseLinks.add(key);
      addMemorySignal(byPair, key, "decision-memory-reuse-existing-qid-image", raw);
    }
    for (const mentionedQid of parseReviewerMentionedQids(raw.reviewerNotes ?? raw.reason ?? "")) {
      if (!qid || mentionedQid === qid || !questionMap.has(qid) || !questionMap.has(mentionedQid)) continue;
      const key = makePairKey(qid, mentionedQid);
      noteLinks.add(key);
      addMemorySignal(byPair, key, "reviewer-note-cross-qid-reference", raw);
    }
  }
  return { byPair, reuseLinks, noteLinks, reviewLinks, reviewDecisions };
}

function addMemorySignal(byPair, key, reason, record) {
  const current = byPair.get(key) ?? { reasons: [], records: [] };
  current.reasons = unique([...current.reasons, reason]);
  current.records.push({
    id: record.id ?? null,
    qid: safeNormalizeQid(record.qid),
    referencedQid: safeNormalizeQid(record.referencedQid),
    type: record.type ?? record.decisionType ?? null,
    outcome: record.outcome ?? record.finalDecision ?? null,
    operation: record.operation ?? null,
    reason,
    reviewerNotes: truncate(record.reviewerNotes ?? record.reason ?? "", 240),
    sourceFiles: record.sourceFiles ?? (record.sourceFile ? [record.sourceFile] : []),
  });
  byPair.set(key, current);
}

function parseReviewerMentionedQids(text) {
  const qids = new Set();
  const raw = String(text ?? "");
  for (const match of raw.matchAll(/\bq\s*0?(\d{1,4})\b/gi)) {
    qids.add(`q${match[1].padStart(4, "0")}`);
  }
  for (const context of raw.matchAll(/\bqids?\b[:\s-]*([^\n.]{0,100})/gi)) {
    for (const number of context[1].match(/\b\d{3,4}\b/g) ?? []) {
      qids.add(`q${number.padStart(4, "0")}`);
    }
  }
  return [...qids];
}

function normalizeQuestion(question, rawQuestion, imageTagsMap) {
  const qid = safeNormalizeQid(question.id ?? question.qid);
  const options = (Array.isArray(question.options) ? question.options : []).map((option, index) => {
    const rawOption = rawQuestion?.options?.[index] ?? {};
    return {
      key: option.originalKey ?? option.key ?? option.label ?? option.id ?? String(index + 1),
      id: option.id ?? rawOption.id ?? null,
      text: String(option.text ?? rawOption.text ?? "").trim(),
      normalized: normalizeText(option.text ?? rawOption.text ?? ""),
    };
  });
  const assets = imageAssets(question).length > 0 ? imageAssets(question) : imageAssets(rawQuestion);
  const imageTags = imageTagsMap.get(qid) ?? { colorTags: [], objectTags: [], assetSrcs: [] };
  const questionTags = flattenQuestionTags(question.tags);
  const type = String(question.type ?? rawQuestion?.type ?? "").toLowerCase() || (options.length > 0 ? "mcq" : "row");
  const correctText = correctAnswerText(question, rawQuestion, options, type);
  return {
    qid,
    number: question.number ?? rawQuestion?.number ?? Number(qid?.replace(/\D/g, "")),
    type,
    prompt: String(question.prompt ?? rawQuestion?.prompt ?? "").trim(),
    normalizedPrompt: normalizeText(question.prompt ?? rawQuestion?.prompt ?? ""),
    options,
    answerRaw: String(question.answerRaw ?? rawQuestion?.answerRaw ?? "").trim(),
    correctOptionId: question.correctOptionId ?? rawQuestion?.correctOptionId ?? null,
    correctRow: question.correctRow ?? rawQuestion?.correctRow ?? null,
    correctText,
    imageAssets: unique([...assets, ...(imageTags.assetSrcs ?? [])].map(normalizeAssetPath).filter(Boolean)),
    colorTags: unique(imageTags.colorTags ?? []),
    objectTags: unique(imageTags.objectTags ?? []),
    questionTags,
    allTags: unique([...(imageTags.colorTags ?? []), ...(imageTags.objectTags ?? []), ...questionTags].map(normalizeTag).filter(Boolean)),
  };
}

function correctAnswerText(question, rawQuestion, options, type) {
  if (type === "row") {
    return normalizeRowAnswer(question.correctRow ?? question.answerRaw ?? rawQuestion?.correctRow ?? rawQuestion?.answerRaw);
  }
  const correctId = question.correctOptionId ?? rawQuestion?.correctOptionId;
  const byId = options.find((option) => option.id === correctId);
  if (byId) return byId.text;
  const rawKey = String(question.answerRaw ?? rawQuestion?.answerRaw ?? "").trim().toUpperCase();
  const byKey = options.find((option) => String(option.key).toUpperCase() === rawKey || String(option.id).toUpperCase().endsWith(`_${rawKey}`));
  return byKey?.text ?? "";
}

function serializeQuestionForReport(question) {
  return {
    qid: question.qid,
    number: question.number,
    type: question.type,
    prompt: question.prompt,
    answerRaw: question.answerRaw,
    correctText: question.correctText,
    options: question.options.map((option) => ({ key: option.key, text: option.text })),
    images: question.imageAssets,
    tags: question.allTags,
  };
}

function promptTokens(question) {
  return tokenSet(question.prompt);
}

function textSimilarity(left, right) {
  const leftNorm = normalizeText(left);
  const rightNorm = normalizeText(right);
  if (!leftNorm || !rightNorm) return 0;
  if (leftNorm === rightNorm) return 1;
  const leftTokens = tokenSet(leftNorm);
  const rightTokens = tokenSet(rightNorm);
  return Math.max(jaccard(leftTokens, rightTokens), dice(leftTokens, rightTokens));
}

function optionSetSimilarity(leftOptions, rightOptions) {
  if (leftOptions.length === 0 && rightOptions.length === 0) return 1;
  if (leftOptions.length === 0 || rightOptions.length === 0) return 0;
  const smaller = leftOptions.length <= rightOptions.length ? leftOptions : rightOptions;
  const larger = leftOptions.length <= rightOptions.length ? rightOptions : leftOptions;
  const scores = smaller.map((option) => Math.max(...larger.map((candidate) => textSimilarity(option.text, candidate.text))));
  const countPenalty = 1 - Math.min(0.25, Math.abs(leftOptions.length - rightOptions.length) * 0.08);
  return average(scores) * countPenalty;
}

function correctAnswerSimilarityFor(left, right) {
  if (left.type === "row" || right.type === "row") {
    return normalizeRowAnswer(left.correctText) === normalizeRowAnswer(right.correctText) ? 1 : 0;
  }
  return textSimilarity(left.correctText, right.correctText);
}

function buildReason(classification, reasonCodes, memoryRecords) {
  const reasons = reasonCodes.length > 0 ? reasonCodes.join(", ") : "combined similarity threshold";
  const memory = memoryRecords.length > 0 ? `; memory records: ${memoryRecords.length}` : "";
  return `${classification}: ${reasons}${memory}`;
}

function recommendedDecision(classification) {
  switch (classification) {
    case "exact-duplicate-risk":
    case "likely-duplicate":
      return "human review before any deletion or merge";
    case "same-image-different-question":
      return "keep separate unless prompt/answer logic is also duplicate";
    case "related-but-valid":
      return "likely keep both; preserve as related signal";
    default:
      return "inspect manually";
  }
}

function memoryScoreAdjustment(memoryDecision) {
  switch (memoryDecision?.decision) {
    case "duplicate":
      return 0.35;
    case "notDuplicate":
      return -0.45;
    case "sameImageDifferentQuestion":
    case "relatedButValid":
      return -0.32;
    default:
      return 0;
  }
}

function isOppositeMeaning(left, right) {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  if (!leftText || !rightText) return false;
  const directionalOpposites = [
    ["left", "right"],
    ["right", "left"],
    ["uphill", "downhill"],
    ["downhill", "uphill"],
    ["increase", "decrease"],
    ["decrease", "increase"],
    ["allowed", "prohibited"],
    ["prohibited", "allowed"],
    ["must", "must not"],
    ["must not", "must"],
  ];
  return directionalOpposites.some(([a, b]) => hasWord(leftText, a) && hasWord(rightText, b) && !hasWord(leftText, b));
}

function hasWord(text, word) {
  return new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`).test(text);
}

function tagFamilyOverlap(left, right) {
  return jaccard(new Set(left.objectTags), new Set(right.objectTags));
}

function isImageDependentPrompt(leftPrompt, rightPrompt) {
  const combined = `${normalizeText(leftPrompt)} ${normalizeText(rightPrompt)}`;
  return /\b(this|sign|marking|arrow|picture|signal|hand)\b/.test(combined);
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  if (doc?.questions && typeof doc.questions === "object") {
    return Object.entries(doc.questions).map(([qid, value]) => ({ id: qid, ...value }));
  }
  return [];
}

function buildImageTagsMap(doc) {
  const rawQuestions = doc?.questions ?? {};
  const entries = Array.isArray(rawQuestions) ? rawQuestions.map((entry) => [entry.qid ?? entry.id, entry]) : Object.entries(rawQuestions);
  return new Map(entries.map(([qid, entry]) => [safeNormalizeQid(qid), {
    assetSrcs: Array.isArray(entry?.assetSrcs) ? entry.assetSrcs : [],
    colorTags: Array.isArray(entry?.colorTags) ? entry.colorTags : [],
    objectTags: Array.isArray(entry?.objectTags) ? entry.objectTags : [],
  }]).filter(([qid]) => qid));
}

function imageAssets(question) {
  return (Array.isArray(question?.assets) ? question.assets : [])
    .filter((asset) => asset?.kind === "image" && asset?.src)
    .map((asset) => asset.src);
}

function flattenQuestionTags(tags) {
  if (!tags || typeof tags !== "object") return [];
  return [
    ...(Array.isArray(tags.auto) ? tags.auto : []),
    ...(Array.isArray(tags.user) ? tags.user : []),
    ...(Array.isArray(tags.suggested) ? tags.suggested.map((item) => item.tag ?? item) : []),
  ].map(normalizeTag).filter(Boolean);
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\bkm\s*\/\s*h(?:r)?\b/g, "kmh")
    .replace(/\bkm\s*\/\s*hr\b/g, "kmh")
    .replace(/\btelephone\b/g, "phone")
    .replace(/\bmotorized\b/g, "vehicle")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(/\s+/g).filter((token) => token && !STOPWORDS.has(token)));
}

function normalizeTag(value) {
  return String(value ?? "").toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeAssetPath(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.startsWith("/qbank/")) return `public${text}`;
  if (text.startsWith("qbank/")) return `public/${text}`;
  return text.replace(/^\/+/, "");
}

function normalizeRowAnswer(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["r", "right", "true", "correct"].includes(text)) return "right";
  if (["w", "wrong", "false", "incorrect"].includes(text)) return "wrong";
  return text;
}

function safeNormalizeQid(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function makePairKey(left, right) {
  return [left, right].sort().join("::");
}

function categoryRank(value) {
  return {
    "exact-duplicate-risk": 0,
    "likely-duplicate": 1,
    "needs-human-review": 2,
    "same-image-different-question": 3,
    "related-but-valid": 4,
  }[value] ?? 9;
}

function isGenericPrompt(value) {
  const text = normalizeText(value);
  return [
    "whats the meaning of this sign",
    "what is the meaning of this sign",
    "what does this sign mean",
    "what does this sign indicate",
    "which kind of sign is it",
    "which of the following types does this sign belong to",
  ].includes(text);
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return unique(left.filter((item) => rightSet.has(item)));
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) {
    if (right.has(item)) overlap += 1;
  }
  return overlap / (left.size + right.size - overlap);
}

function dice(left, right) {
  if (!left.size && !right.size) return 1;
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) {
    if (right.has(item)) overlap += 1;
  }
  return (2 * overlap) / (left.size + right.size);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value) {
  return Number(value.toFixed(4));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function truncate(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  try {
    return readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function renderMarkdown(report) {
  const lines = [
    "# Duplicate Candidate Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Duplicate pairs found: ${report.summary.duplicatePairsFound}`,
    `- Previous exact duplicate risks: ${report.summary.previousExactDuplicateRisks ?? "n/a"}`,
    `- Exact duplicate risks: ${report.summary.exactDuplicateRisks}`,
    `- Likely duplicates: ${report.summary.likelyDuplicates}`,
    `- Same-image different-question pairs: ${report.summary.sameImageDifferentQuestionPairs}`,
    `- Needs human review: ${report.summary.needsHumanReview}`,
    `- Related but valid: ${report.summary.relatedButValid}`,
    `- Memory-downranked pairs: ${report.summary.memoryDownrankedPairs}`,
    "",
    "## Top Pairs",
    "",
    "| classification | score | qid A | qid B | reason |",
    "| --- | ---: | --- | --- | --- |",
    ...report.pairs.slice(0, 120).map((pair) => `| ${pair.classification} | ${pair.duplicateScore} | ${pair.qidA} | ${pair.qidB} | ${escapeMarkdown(pair.reason)} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function renderHtml(report) {
  const rows = report.pairs.map((pair) => renderPairCard(pair)).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Duplicate Candidate Audit</title>
  <style>
    :root { color-scheme: light; --bg:#f7f3eb; --card:#fffdf8; --line:#dfd5c7; --text:#221f1a; --muted:#6f665a; --bad:#b42318; --warn:#b45309; --ok:#166534; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
    header { padding:24px; border-bottom:1px solid var(--line); background:#fffaf0; position:sticky; top:0; z-index:2; }
    h1 { margin:0 0 8px; font-size:24px; }
    .meta, .small { color:var(--muted); font-size:12px; }
    .stats { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .stat { padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:white; }
    main { padding:18px; display:grid; gap:16px; }
    article { border:1px solid var(--line); border-radius:10px; background:var(--card); overflow:hidden; }
    .head { padding:12px 14px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .badge { display:inline-flex; padding:4px 8px; border-radius:999px; font-weight:800; font-size:12px; border:1px solid var(--line); }
    .exact-duplicate-risk, .likely-duplicate { color:var(--bad); background:#fff1f2; }
    .needs-human-review { color:var(--warn); background:#fffbeb; }
    .same-image-different-question, .related-but-valid { color:var(--ok); background:#f0fdf4; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px; }
    .q { border:1px solid var(--line); border-radius:8px; padding:12px; background:white; }
    .q h2 { margin:0 0 8px; font-size:18px; }
    .prompt { font-weight:700; margin:8px 0; }
    .answer { color:#334155; font-size:13px; }
    ul { margin:8px 0; padding-left:22px; }
    li { margin:3px 0; font-size:13px; }
    img { max-width:100%; height:180px; object-fit:contain; border:1px solid var(--line); border-radius:6px; background:white; }
    .tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
    .tag { font-size:11px; padding:2px 6px; border:1px solid var(--line); border-radius:999px; color:var(--muted); }
    .details { padding:0 14px 14px; display:grid; gap:8px; }
    .review { padding:12px 14px; border-top:1px solid var(--line); background:#fffbf2; display:grid; gap:8px; }
    .review-buttons { display:flex; flex-wrap:wrap; gap:6px; }
    .review button { border:1px solid var(--line); background:white; border-radius:7px; padding:6px 9px; cursor:pointer; }
    .review button.active { border-color:#2563eb; background:#eff6ff; color:#1d4ed8; font-weight:800; }
    textarea { width:100%; min-height:48px; border:1px solid var(--line); border-radius:7px; padding:8px; font:inherit; font-size:13px; box-sizing:border-box; }
    .export-panel { margin-top:12px; display:grid; gap:8px; }
    .export-panel button { width:max-content; border:1px solid #1d4ed8; background:#2563eb; color:white; border-radius:7px; padding:8px 11px; cursor:pointer; font-weight:800; }
    #export-json { min-height:120px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    code { font-size:11px; overflow-wrap:anywhere; }
    @media (max-width: 900px) { .grid { grid-template-columns:1fr; } header { position:static; } }
  </style>
</head>
<body>
  <header>
    <h1>Duplicate Candidate Audit</h1>
    <div class="meta">Generated ${escapeHtml(report.generatedAt)} · dataset ${escapeHtml(report.dataset)}</div>
    <div class="stats">
      ${stat("pairs", report.summary.duplicatePairsFound)}
      ${stat("previous exact risk", report.summary.previousExactDuplicateRisks ?? "n/a")}
      ${stat("exact risk", report.summary.exactDuplicateRisks)}
      ${stat("likely", report.summary.likelyDuplicates)}
      ${stat("same image different question", report.summary.sameImageDifferentQuestionPairs)}
      ${stat("needs review", report.summary.needsHumanReview)}
      ${stat("memory downranked", report.summary.memoryDownrankedPairs)}
    </div>
    <div class="export-panel">
      <button type="button" id="export-decisions">Export duplicate review decisions JSON</button>
      <textarea id="export-json" spellcheck="false" placeholder="Exported decisions JSON will appear here. Save it to ${escapeHtml(rel(OUT_DECISIONS))}."></textarea>
    </div>
  </header>
  <main>${rows || "<p>No duplicate candidates found.</p>"}</main>
  <script>
    const PAIRS = ${safeInlineJson(report.pairs.map((pair) => ({
      qidA: pair.qidA,
      qidB: pair.qidB,
      scoreAtReview: pair.duplicateScore,
      categoryAtReview: pair.classification,
    })))};
    const decisions = new Map();
    function pairKey(qidA, qidB) { return [qidA, qidB].sort().join("::"); }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-decision]");
      if (!button) return;
      const card = button.closest("[data-pair-key]");
      const key = card.dataset.pairKey;
      const existing = decisions.get(key) || {};
      decisions.set(key, { ...existing, decision: button.dataset.reviewDecision });
      card.querySelectorAll("[data-review-decision]").forEach((item) => item.classList.toggle("active", item === button));
    });
    document.addEventListener("input", (event) => {
      if (!event.target.matches("[data-review-reason]")) return;
      const card = event.target.closest("[data-pair-key]");
      const key = card.dataset.pairKey;
      const existing = decisions.get(key) || {};
      decisions.set(key, { ...existing, reason: event.target.value });
    });
    document.getElementById("export-decisions").addEventListener("click", () => {
      const exported = [];
      for (const pair of PAIRS) {
        const state = decisions.get(pairKey(pair.qidA, pair.qidB));
        if (!state?.decision) continue;
        exported.push({
          qidA: pair.qidA,
          qidB: pair.qidB,
          decision: state.decision,
          reason: state.reason || "",
          scoreAtReview: pair.scoreAtReview,
          categoryAtReview: pair.categoryAtReview,
        });
      }
      document.getElementById("export-json").value = JSON.stringify({
        dataset: ${JSON.stringify(DATASET)},
        generatedAt: new Date().toISOString(),
        type: "duplicate-detection",
        decisions: exported,
      }, null, 2);
    });
  </script>
</body>
</html>
`;
}

function renderPairCard(pair) {
  return `<article data-pair-key="${escapeAttr(makePairKey(pair.qidA, pair.qidB))}">
    <div class="head">
      <div>
        <span class="badge ${escapeAttr(pair.classification)}">${escapeHtml(pair.classification)}</span>
        <strong>${escapeHtml(pair.qidA)} / ${escapeHtml(pair.qidB)}</strong>
      </div>
      <div class="small">score ${pair.duplicateScore}</div>
    </div>
    <div class="grid">
      ${renderQuestion(pair.qidAQuestion)}
      ${renderQuestion(pair.qidBQuestion)}
    </div>
    <div class="details">
      <div><strong>shared tags:</strong> ${pair.signals.sharedTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ") || "<span class='small'>none</span>"}</div>
      <div><strong>shared images:</strong> ${pair.signals.sharedImages.map((image) => `<code>${escapeHtml(image)}</code>`).join("<br>") || "<span class='small'>none</span>"}</div>
      <div><strong>reason:</strong> ${escapeHtml(pair.reason)}</div>
      <div><strong>recommended decision:</strong> ${escapeHtml(pair.recommendedDecision)}</div>
      ${pair.signals.memoryDecision ? `<div><strong>memory:</strong> ${escapeHtml(pair.signals.memoryDecision.decision)} · ${escapeHtml(pair.signals.memoryDecision.reason ?? "")}</div>` : ""}
    </div>
    <div class="review">
      <strong>Review decision</strong>
      <div class="review-buttons">
        ${reviewButton("notDuplicate", "Not duplicate")}
        ${reviewButton("duplicate", "Duplicate")}
        ${reviewButton("sameImageDifferentQuestion", "Same image, different question")}
        ${reviewButton("relatedButValid", "Related but valid")}
        ${reviewButton("unsure", "Unsure")}
      </div>
      <textarea data-review-reason placeholder="Reason, e.g. opposite answer logic / different meaning"></textarea>
    </div>
  </article>`;
}

function reviewButton(decision, label) {
  return `<button type="button" data-review-decision="${escapeAttr(decision)}">${escapeHtml(label)}</button>`;
}

function renderQuestion(question) {
  const img = question.images[0] ? `<img loading="lazy" src="${escapeAttr(browserPath(question.images[0]))}" alt="${escapeAttr(question.qid)} image">` : "";
  return `<section class="q">
    <h2>${escapeHtml(question.qid)} <span class="small">#${escapeHtml(question.number)} · ${escapeHtml(question.type)}</span></h2>
    ${img}
    <p class="prompt">${escapeHtml(question.prompt)}</p>
    <div class="answer"><strong>answer:</strong> ${escapeHtml(question.answerRaw)} · ${escapeHtml(question.correctText)}</div>
    ${question.options.length ? `<ul>${question.options.map((option) => `<li><strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.text)}</li>`).join("")}</ul>` : ""}
    <div class="tags">${question.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
  </section>`;
}

function browserPath(imagePath) {
  return path.relative(REPORTS_DIR, path.join(ROOT, imagePath)).split(path.sep).join("/");
}

function stat(label, value) {
  return `<div class="stat"><strong>${escapeHtml(value)}</strong><div class="small">${escapeHtml(label)}</div></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function safeInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
