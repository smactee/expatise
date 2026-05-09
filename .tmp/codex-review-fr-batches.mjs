#!/usr/bin/env node

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import OpenAI from "openai";

const lang = "fr";
const dataset = "2023-test1";
const model = process.env.CODEX_REVIEW_MODEL || "gpt-5-mini";
const batchSize = Number(process.env.CODEX_REVIEW_BATCH_SIZE || 10);
const targetBatches = process.argv.slice(2);

if (targetBatches.length === 0) {
  throw new Error("Pass one or more batch ids, e.g. batch-004 batch-005");
}

const apiKey = process.env.OPENAI_API_KEY || await readOpenAIKeyFromDotenv();
if (!apiKey) {
  throw new Error("OPENAI_API_KEY not found");
}

const client = new OpenAI({ apiKey });
const master = loadMaster();
const priorTranslations = loadPriorTranslations();
const qbankDecisionMemory = readJsonIfExists("qbank-tools/generated/reports/qbank-decision-memory.json");
const memorySummary = summarizeDecisionMemory(qbankDecisionMemory);
const historyMemory = readJsonIfExists("qbank-tools/history/decision-memory.json");
const historyHints = summarizeHistoryMemory(historyMemory);

const runSummary = [];

for (const batchId of targetBatches) {
  console.log(`\n=== Reviewing ${batchId} ===`);
  const result = await reviewBatch(batchId);
  runSummary.push({ batchId, ...result.summary });
  console.log(`${batchId} decisions: ${JSON.stringify(result.summary)}`);
  execFileSync("/opt/homebrew/bin/npm", ["run", "generate-batch-workbench", "--", "--lang", lang, "--batch", batchId], { stdio: "inherit" });
  execFileSync("/opt/homebrew/bin/npm", ["run", "validate-localization-batch", "--", "--lang", lang, "--batch", batchId], { stdio: "inherit" });
}

console.log("\n=== Run summary ===");
console.log(JSON.stringify(runSummary, null, 2));

async function reviewBatch(batchId) {
  const items = loadBatchItems(batchId);
  const decisionsPath = `qbank-tools/generated/staging/${lang}-${batchId}-workbench-decisions.json`;
  const decisionsDoc = readJson(decisionsPath);
  const decisionsById = new Map((decisionsDoc.items || []).map((item) => [item.id, item]));
  const reviews = [];

  for (let offset = 0; offset < items.length; offset += batchSize) {
    const chunk = items.slice(offset, offset + batchSize);
    console.log(`${batchId}: AI review ${offset + 1}-${Math.min(offset + chunk.length, items.length)} / ${items.length}`);
    const parsed = await reviewChunk({ batchId, chunk });
    const byId = new Map(parsed.items.map((item) => [String(item.id || ""), item]));
    for (const item of chunk) {
      reviews.push(normalizeReview(item, byId.get(item.id)));
    }
  }

  for (const review of reviews) {
    const decision = decisionsById.get(review.id);
    if (!decision) continue;
    applyReviewToDecision(decision, review);
  }

  decisionsDoc.generatedAt = new Date().toISOString();
  await writeJson(decisionsPath, decisionsDoc);

  const snapshot = buildSnapshot({ batchId, reviews });
  const snapshotPath = `qbank-tools/generated/staging/${lang}-${batchId}-codex-recommendations.json`;
  await writeJson(snapshotPath, snapshot);
  return snapshot;
}

function loadBatchItems(batchId) {
  const specs = [
    ["auto-matched", `imports/${lang}/${batchId}/matched.json`],
    ["review-needed", `imports/${lang}/${batchId}/review-needed.json`],
    ["unresolved", `imports/${lang}/${batchId}/unresolved.json`],
  ];
  const out = [];
  for (const [section, file] of specs) {
    const doc = readJson(file);
    for (const [index, raw] of (doc.items || []).entries()) {
      out.push(normalizeSourceItem(raw, { section, index, batchId }));
    }
  }
  return out;
}

function normalizeSourceItem(raw, { section, index, batchId }) {
  const topCandidates = (raw.topCandidates || []).slice(0, 5).map((candidate, rank) => candidatePayload(candidate, rank));
  const matchCandidate = raw.match ? candidatePayload(raw.match, 0) : null;
  const qid = normalizeQid(raw.qid || raw.match?.qid || raw.initialSuggestedQid || topCandidates[0]?.qid);
  return {
    id: `${section}:${raw.itemId}`,
    section,
    batchId,
    index: index + 1,
    itemId: raw.itemId,
    sourceImage: raw.sourceImage || raw.itemId,
    promptRaw: raw.promptRawJa || raw.localizedText?.prompt || "",
    promptGloss: raw.promptGlossEn || raw.translatedText?.prompt || "",
    optionsRaw: raw.optionsRawJa || raw.localizedText?.options || [],
    optionsGloss: raw.optionsGlossEn || raw.translatedText?.options || [],
    correctKeyRaw: raw.correctKeyRaw || null,
    correctAnswerRaw: raw.correctAnswerRaw || raw.localizedText?.correctAnswer || raw.translatedText?.correctAnswer || null,
    hasImage: raw.hasImage === true,
    visual: {
      objectTags: raw.visualObjectTags || [],
      colorTags: raw.visualColorTags || [],
      numberTags: raw.visualNumberTags || [],
      layoutTags: raw.visualLayoutTags || [],
      notes: raw.visualEvidenceNotes || [],
    },
    topic: raw.provisionalTopic || null,
    subtopics: raw.provisionalSubtopics || [],
    sourceConceptSlots: raw.sourceConceptSlots || null,
    analysis: summarizeAnalysis(raw.analysis),
    initialSuggestedQid: qid,
    machineMatch: matchCandidate,
    topCandidates,
  };
}

function candidatePayload(candidate, rank) {
  const qid = normalizeQid(candidate?.qid);
  const masterQuestion = qid ? master.byQid.get(qid) : null;
  const correct = candidate?.correctAnswer || {};
  const options = (candidate?.options || masterQuestion?.options || []).map((option) => ({
    id: String(option.id || option.key || "").trim().toUpperCase() || null,
    text: option.text || option.translatedText || "",
  }));
  const type = String(candidate?.type || masterQuestion?.type || "").toUpperCase() || null;
  return {
    rank: rank + 1,
    qid,
    number: candidate?.number ?? masterQuestion?.number ?? null,
    type,
    score: finite(candidate?.score),
    scoreGap: finite(candidate?.scoreGap ?? candidate?.scoreGapFromTop),
    prompt: candidate?.prompt || masterQuestion?.prompt || "",
    options,
    correctOptionKey: normalizeChoiceKey(correct.correctOptionKey || masterQuestion?.answerRaw),
    correctOptionText: correct.correctOptionText || correct.correctOptionTranslatedText || optionTextForCorrect(masterQuestion) || "",
    correctRow: normalizeRow(correct.correctRow || masterQuestion?.correctRow || masterQuestion?.answerRaw),
    answerRaw: correct.answerRaw || masterQuestion?.answerRaw || null,
    hasImage: candidate?.image?.hasImage === true || Boolean(candidate?.image?.currentAssetSrc || masterQuestion?.image),
    image: candidate?.image?.currentAssetSrc || masterQuestion?.image || null,
    imageTags: candidate?.image?.objectTags || [],
    priorLanguageHints: priorLanguageForQid(qid),
  };
}

function summarizeAnalysis(analysis) {
  if (!analysis) return null;
  return {
    topScore: finite(analysis.topScore),
    topGap: finite(analysis.topGap),
    plausibleShortlist: analysis.plausibleShortlist === true,
    candidateImageParityMode: analysis.candidateImageParityMode || null,
    decisionReasonCodes: analysis.decisionReasonCodes || [],
    signalAgreement: analysis.autoMatch?.signalAgreement || null,
  };
}

async function reviewChunk({ batchId, chunk }) {
  const payload = chunk.map((item) => ({
    id: item.id,
    section: item.section,
    sourceImage: item.sourceImage,
    sourcePromptFrench: item.promptRaw,
    sourcePromptEnglishGloss: item.promptGloss,
    sourceOptionsFrench: item.optionsRaw,
    sourceOptionsEnglishGloss: item.optionsGloss,
    extractedCorrectKey: item.correctKeyRaw,
    extractedCorrectAnswer: item.correctAnswerRaw,
    hasSourceImage: item.hasImage,
    visualEvidence: item.visual,
    topic: item.topic,
    subtopics: item.subtopics,
    matchingAnalysis: item.analysis,
    machineMatch: item.machineMatch,
    topCandidates: item.topCandidates.slice(0, 5),
  }));
  const prompt = [
    `French batch: ${batchId}`,
    `Dataset: ${dataset}`,
    `Decision memory summary: ${JSON.stringify(memorySummary)}`,
    `Broader decision-memory hints: ${JSON.stringify(historyHints)}`,
    "Review these French localization items. NotebookLM is not used.",
    "Use the French source plus English gloss as source evidence. OCR/gloss may be imperfect, so be conservative.",
    "Select approveExistingQid only when source meaning, image/sign/dashboard semantics, answer options, and answer logic clearly match an existing qid.",
    "For MCQ answer keys, return the French/source option letter whose meaning matches the approved master correct answer, not blindly the master letter.",
    "For ROW/right-wrong items, return the French/source option letter that means Right/Yes/True or Wrong/No/False as appropriate.",
    "Use createNewQuestion only when the source is valid and clearly not represented by any candidate. Prefer keepUnresolved if uncertain.",
    "If options do not contain the correct answer, use UNKNOWN or keepUnresolved with an explanation.",
    "Return JSON only with this exact shape:",
    '{ "items": [ { "id": "...", "recommendedAction": "approveExistingQid|createNewQuestion|keepUnresolved|deleteQuestion", "recommendedQid": "q0000|null", "recommendedLocaleAnswerKey": "A|B|C|D|Right|Wrong|UNKNOWN|null", "confidence": 0.0, "riskLevel": "low|medium|high", "reviewerReasoningSummary": "brief evidence-based reason", "rejectedTopMatcher": false, "rejectedTopMatcherReason": "" } ] }',
    "",
    JSON.stringify({ items: payload }, null, 2),
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: reviewSystemPrompt() }] },
          { role: "user", content: [{ type: "input_text", text: prompt }] },
        ],
      });
      const parsed = parseJsonObject(String(response.output_text || "").trim());
      if (!parsed || !Array.isArray(parsed.items)) throw new Error("missing items array");
      return parsed;
    } catch (error) {
      if (attempt >= 3) {
        console.warn(`AI review failed for ${batchId} chunk; falling back unresolved: ${error.message || error}`);
        return { items: chunk.map((item) => fallbackReview(item, `AI review failed: ${error.message || error}`)) };
      }
      await sleep(1000 * attempt);
    }
  }
}

function reviewSystemPrompt() {
  return `You are Codex doing a conservative French driving-test localization match review.

Non-negotiable rules:
- Return JSON only.
- Do not invent qids or facts.
- English master candidates are evidence, not automatically correct.
- Machine scores and OCR are supporting evidence only.
- For image/sign/dashboard items, prioritize actual visual semantics described in extracted evidence and candidate image tags.
- If confidence is not high enough, keep unresolved.
- Preserve French/source answer option order.
- A local answer key can differ from the master option letter when localized option order differs.
- Flag high risk when source text, image, options, or machine candidates conflict.`;
}

function normalizeReview(item, raw) {
  const topQid = item.topCandidates[0]?.qid || item.machineMatch?.qid || null;
  const action = ["approveExistingQid", "createNewQuestion", "keepUnresolved", "deleteQuestion"].includes(raw?.recommendedAction)
    ? raw.recommendedAction
    : "keepUnresolved";
  let qid = normalizeQid(raw?.recommendedQid);
  let key = normalizeAnswerKey(raw?.recommendedLocaleAnswerKey);
  let note = String(raw?.reviewerReasoningSummary || "").trim();
  let confidence = Number(raw?.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.5;
  let riskLevel = ["low", "medium", "high"].includes(raw?.riskLevel) ? raw.riskLevel : (confidence < 0.84 ? "high" : "medium");

  if (action === "approveExistingQid") {
    if (!qid || !master.byQid.has(qid)) {
      return fallbackReview(item, `AI recommended invalid qid ${raw?.recommendedQid || ""}; kept unresolved.`);
    }
    if (!key) {
      key = inferLocalAnswerKey(item, qid);
      if (key) note = appendNote(note, `Local answer key inferred as ${key} by option meaning alignment.`);
    }
    if (!key) {
      return fallbackReview(item, `Approved qid ${qid} lacked a reliable local answer key; kept unresolved.`);
    }
  }

  if (action === "createNewQuestion") {
    qid = null;
    if (!key || key === "UNKNOWN") {
      return fallbackReview(item, "Potential new question but local answer key is unknown; kept unresolved for human review.");
    }
  }

  if (action === "keepUnresolved" || action === "deleteQuestion") {
    qid = null;
    key = null;
  }

  return {
    id: item.id,
    itemId: item.itemId,
    sourceImage: item.sourceImage,
    section: item.section,
    recommendedAction: action,
    recommendedQid: qid,
    recommendedLocaleAnswerKey: key,
    confidence: clamp(confidence, 0, 1),
    riskLevel,
    reviewerReasoningSummary: note || defaultReason(action, qid),
    rejectedTopMatcher: Boolean(raw?.rejectedTopMatcher || (action === "approveExistingQid" && qid && topQid && qid !== topQid) || action !== "approveExistingQid"),
    rejectedTopMatcherReason: String(raw?.rejectedTopMatcherReason || "").trim(),
    machineTopQid: topQid,
    machineTopScore: item.topCandidates[0]?.score ?? item.machineMatch?.score ?? null,
  };
}

function fallbackReview(item, reason) {
  const autoQid = item.section === "auto-matched" ? item.initialSuggestedQid : null;
  const autoKey = autoQid ? inferLocalAnswerKey(item, autoQid) : null;
  return {
    id: item.id,
    itemId: item.itemId,
    sourceImage: item.sourceImage,
    section: item.section,
    recommendedAction: autoQid && autoKey ? "approveExistingQid" : "keepUnresolved",
    recommendedQid: autoQid && autoKey ? autoQid : null,
    recommendedLocaleAnswerKey: autoQid && autoKey ? autoKey : null,
    confidence: autoQid && autoKey ? 0.78 : 0.35,
    riskLevel: "high",
    reviewerReasoningSummary: reason,
    rejectedTopMatcher: !(autoQid && autoKey),
    rejectedTopMatcherReason: reason,
    machineTopQid: item.topCandidates[0]?.qid || item.machineMatch?.qid || null,
    machineTopScore: item.topCandidates[0]?.score ?? item.machineMatch?.score ?? null,
  };
}

function applyReviewToDecision(decision, review) {
  decision.approvedQid = null;
  decision.createNewQuestion = false;
  decision.keepUnresolved = false;
  decision.deleteQuestion = false;
  decision.confirmedCorrectOptionKey = null;
  decision.newQuestionLocalAnswerKey = null;
  decision.answerKeyUnknown = false;
  decision.useCurrentStagedAnswerKey = false;

  if (review.recommendedAction === "approveExistingQid") {
    decision.approvedQid = review.recommendedQid;
    if (review.recommendedLocaleAnswerKey === "UNKNOWN") {
      decision.answerKeyUnknown = true;
    } else {
      decision.confirmedCorrectOptionKey = review.recommendedLocaleAnswerKey;
    }
  } else if (review.recommendedAction === "createNewQuestion") {
    decision.createNewQuestion = true;
    decision.newQuestionLocalAnswerKey = review.recommendedLocaleAnswerKey;
  } else if (review.recommendedAction === "deleteQuestion") {
    decision.deleteQuestion = true;
  } else {
    decision.keepUnresolved = true;
  }

  decision.reviewerNotes = [
    `Codex ${review.riskLevel}-risk ${review.recommendedAction}: ${review.reviewerReasoningSummary}`,
    review.rejectedTopMatcher && review.rejectedTopMatcherReason ? `Rejected top matcher: ${review.rejectedTopMatcherReason}` : null,
  ].filter(Boolean).join(" ");
}

function buildSnapshot({ batchId, reviews }) {
  const summary = {
    total: reviews.length,
    approvedExistingQid: reviews.filter((r) => r.recommendedAction === "approveExistingQid").length,
    createNewQuestion: reviews.filter((r) => r.recommendedAction === "createNewQuestion").length,
    keepUnresolved: reviews.filter((r) => r.recommendedAction === "keepUnresolved").length,
    deleteQuestion: reviews.filter((r) => r.recommendedAction === "deleteQuestion").length,
    unknownAnswerKey: reviews.filter((r) => r.recommendedLocaleAnswerKey === "UNKNOWN").length,
    highRisk: reviews.filter((r) => r.riskLevel === "high").length,
    changedCount: reviews.length,
  };
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      lang,
      batchId,
      dataset,
      source: "codex-ai-review",
      model,
      notebookLmUsed: false,
      productionModified: false,
      decisionMemorySummary: memorySummary,
      note: "Codex-first conservative review. Human QC still required before merge.",
    },
    summary,
    highRiskItems: reviews.filter((r) => r.riskLevel === "high").slice(0, 20),
    rejectedTopMatcherExamples: reviews.filter((r) => r.rejectedTopMatcher).slice(0, 20),
    items: reviews,
  };
}

function inferLocalAnswerKey(item, qid) {
  const question = master.byQid.get(normalizeQid(qid));
  if (!question) return null;
  const sourceOptions = sourceOptionRecords(item);
  if (sourceOptions.length === 0) return null;

  if (question.type === "row" || normalizeRow(question.correctRow || question.answerRaw)) {
    const row = normalizeRow(question.correctRow || question.answerRaw);
    const target = row === "Right"
      ? ["right", "true", "yes", "correct", "oui", "vrai"]
      : ["wrong", "false", "no", "incorrect", "non", "faux"];
    const scored = sourceOptions.map((option) => ({
      key: option.key,
      score: Math.max(...target.map((word) => normalizeText(option.text).includes(word) ? 1 : 0)),
    })).sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].key : null;
  }

  const correctText = optionTextForCorrect(question);
  if (!correctText) return null;
  const scored = sourceOptions.map((option) => ({ key: option.key, score: textScore(correctText, option.text) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 0.42 && scored[0].score - (scored[1]?.score || 0) >= 0.06) return scored[0].key;
  return null;
}

function sourceOptionRecords(item) {
  const raw = Array.isArray(item.optionsRaw) ? item.optionsRaw : [];
  const gloss = Array.isArray(item.optionsGloss) ? item.optionsGloss : [];
  const labels = ["A", "B", "C", "D"];
  return (raw.length ? raw : gloss).map((entry, index) => {
    const text = [raw[index] || "", gloss[index] || ""].join(" ");
    const m = String(raw[index] || gloss[index] || "").trim().match(/^([A-D])\b[\s.)-]*/i);
    return { key: (m?.[1] || labels[index] || "").toUpperCase(), text };
  }).filter((option) => option.key);
}

function optionTextForCorrect(question) {
  if (!question) return "";
  const key = normalizeChoiceKey(question.answerRaw) || normalizeChoiceKey(question.correctOptionKey);
  const opts = question.options || [];
  let option = question.correctOptionId ? opts.find((o) => o.id === question.correctOptionId) : null;
  if (!option && key) option = opts.find((o) => normalizeChoiceKey(o.id) === key || normalizeChoiceKey(o.key) === key);
  if (!option && key) option = opts[["A", "B", "C", "D"].indexOf(key)] || null;
  return option?.text || "";
}

function loadMaster() {
  const doc = readJson("public/qbank/2023-test1/questions.json");
  const questions = Array.isArray(doc) ? doc : (doc.items || doc.questions || []);
  const normalized = questions.map((q) => ({ ...q, qid: normalizeQid(q.qid || q.id), type: String(q.type || "").toLowerCase(), image: q.image || q.imagePath || q.assetPath || null }));
  return { questions: normalized, byQid: new Map(normalized.map((q) => [q.qid, q])) };
}

function loadPriorTranslations() {
  const out = {};
  for (const code of ["ko", "ja", "ru"]) {
    const p = `public/qbank/2023-test1/translations.${code}.json`;
    if (!fsSync.existsSync(p)) continue;
    const doc = readJson(p);
    out[code] = doc.questions || {};
  }
  return out;
}

function priorLanguageForQid(qid) {
  if (!qid) return {};
  const out = {};
  for (const [code, questions] of Object.entries(priorTranslations)) {
    const entry = questions[qid];
    if (!entry) continue;
    out[code] = {
      prompt: entry.prompt || entry.statement || "",
      options: entry.options || null,
      localeCorrectOptionKey: entry.localeCorrectOptionKey || null,
    };
  }
  return out;
}

function summarizeDecisionMemory(memory) {
  return {
    sourceReports: memory?.summary?.sourceReportCount ?? 0,
    totalCompared: memory?.summary?.totalCompared ?? 0,
    repeatedQidConfusionPairs: memory?.repeatedQidConfusionPairs ?? [],
    imageBasedConfusionPatterns: memory?.imageBasedConfusionPatterns ?? [],
    answerKeyReorderWarnings: memory?.answerKeyReorderWarnings ?? [],
    note: memory?.meta?.note || "No qbank-decision-memory found.",
  };
}

function summarizeHistoryMemory(memory) {
  const records = Array.isArray(memory) ? memory : (memory?.records || memory?.items || []);
  const useful = records.filter((r) => ["duplicate", "reject", "master-data-fix", "answer-key"].includes(r.decisionType || r.type)).slice(0, 100);
  return {
    recordCount: records.length,
    sampledCautionRecords: useful.map((r) => ({
      qid: r.qid || null,
      type: r.decisionType || r.type,
      decision: r.finalDecision || r.decision || r.outcome,
      reason: String(r.reason || r.evidence?.issue || "").slice(0, 160),
    })).slice(0, 25),
  };
}

function parseJsonObject(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("Unable to parse JSON response");
}

function defaultReason(action, qid) {
  if (action === "approveExistingQid") return `Selected ${qid} based on source/candidate semantic and answer compatibility.`;
  if (action === "createNewQuestion") return "Source appears valid but no candidate safely matched.";
  if (action === "deleteQuestion") return "Source appears unusable.";
  return "Conservative unresolved decision because evidence was insufficient.";
}

function normalizeQid(value) {
  const m = String(value || "").trim().match(/q?(\d{1,4})/i);
  return m ? `q${m[1].padStart(4, "0")}` : null;
}
function normalizeChoiceKey(value) {
  const v = String(value || "").trim().toUpperCase();
  return ["A", "B", "C", "D"].includes(v) ? v : null;
}
function normalizeAnswerKey(value) {
  const v = String(value || "").trim();
  if (!v || v === "null") return null;
  if (/^unknown$/i.test(v)) return "UNKNOWN";
  if (/^right$/i.test(v)) return "Right";
  if (/^wrong$/i.test(v)) return "Wrong";
  return normalizeChoiceKey(v);
}
function normalizeRow(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["r", "right", "true", "yes", "correct"].includes(v)) return "Right";
  if (["w", "wrong", "false", "no", "incorrect"].includes(v)) return "Wrong";
  return null;
}
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function textScore(a, b) {
  const A = new Set(normalizeText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const jaccard = inter / (A.size + B.size - inter);
  const containment = inter / Math.min(A.size, B.size);
  return Math.max(jaccard, containment * 0.82);
}
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function appendNote(a, b) {
  return a ? `${a} ${b}` : b;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function readJson(file) {
  return JSON.parse(fsSync.readFileSync(file, "utf8"));
}
function readJsonIfExists(file) {
  return fsSync.existsSync(file) ? readJson(file) : null;
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
async function readOpenAIKeyFromDotenv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
    } catch {}
  }
  return null;
}
