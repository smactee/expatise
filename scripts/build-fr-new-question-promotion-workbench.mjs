#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  IMPORTS_DIR,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  discoverKnownLanguages,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  loadDecisionMemory,
  loadDuplicateAudit,
  loadMasterQuestions,
  normalizeCandidate,
  reviewNewQuestionDuplicateSafety,
} from "../qbank-tools/lib/new-question-promotion-gate.mjs";

const LANG = "fr";
const BATCH_ID = "wrapup";
const STORAGE_KEY = "expatise:fr-new-question-promotion-workbench:v1";
const CANDIDATES_PATH = path.join(STAGING_DIR, "fr-wrapup-new-question-candidates.json");
const SOURCE_DECISIONS_PATH = path.join(STAGING_DIR, "fr-wrapup-new-question-decisions.json");
const OUTPUT_HTML_PATH = path.join(REPORTS_DIR, "fr-new-question-promotion-workbench.html");
const OUTPUT_JSON_PATH = path.join(REPORTS_DIR, "fr-new-question-promotion-workbench.json");
const OUTPUT_DECISIONS_PATH = path.join(STAGING_DIR, "fr-new-question-promotion-workbench-decisions.json");
const PROMOTION_PREVIEW_PATH = path.join(STAGING_DIR, "new-question-promotion-preview.fr.wrapup.json");

const REVIEW_DECISIONS = [
  "promoteNewQuestion",
  "linkExistingQid",
  "rejectDuplicate",
  "needsHumanReview",
  "deleteCandidate",
];
const ANSWER_KEY_OPTIONS = ["", "A", "B", "C", "D", "R", "W", "UNKNOWN"];

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const generatedAt = stableNow();

if (!fileExists(CANDIDATES_PATH)) {
  throw new Error(`French wrap-up new-question candidates not found: ${rel(CANDIDATES_PATH)}`);
}

const candidatesDoc = readJson(CANDIDATES_PATH);
const sourceDecisionsDoc = fileExists(SOURCE_DECISIONS_PATH)
  ? readJson(SOURCE_DECISIONS_PATH)
  : { items: [] };
const candidates = Array.isArray(candidatesDoc.items) ? candidatesDoc.items : [];
const sourceDecisions = Array.isArray(sourceDecisionsDoc.items) ? sourceDecisionsDoc.items : [];
const sourceDecisionByCandidateId = new Map(
  sourceDecisions.map((item) => [String(item?.candidateId ?? "").trim(), item]),
);

const master = loadMasterQuestions({ root: ROOT, dataset });
const decisionMemory = loadDecisionMemory({ root: ROOT });
const duplicateAudit = loadDuplicateAudit({ root: ROOT });
const datasetPaths = getDatasetPaths(dataset, LANG);
const knownLanguages = discoverKnownLanguages({ dataset });
const highestQuestionNumber = highestMasterNumber(datasetPaths.questionsPath);
const nextNumber = highestQuestionNumber + 1;

const normalizedCandidates = candidates.map((candidate, index) =>
  normalizeCandidate(candidate, {
    index,
    inputPath: CANDIDATES_PATH,
    lang: LANG,
    batch: candidate.sourceBatch ?? BATCH_ID,
  })
);

const previewItems = candidates.map((candidate, index) => {
  const normalizedCandidate = normalizedCandidates[index];
  const duplicateSafety = reviewNewQuestionDuplicateSafety({
    candidate: normalizedCandidate,
    masterQuestions: master.questions,
    decisionMemory: decisionMemory.records,
    duplicateAudit,
  });
  const proposedMasterNumber = nextNumber + index;
  const proposedQid = `q${String(proposedMasterNumber).padStart(4, "0")}`;
  return buildPreviewItem({
    candidate,
    normalizedCandidate,
    duplicateSafety,
    proposedMasterNumber,
    proposedQid,
  });
});

const decisionsTemplate = buildDecisionsTemplate(previewItems);
const promotionPreview = buildPromotionPreview(previewItems);
const workbench = {
  schemaVersion: 1,
  lang: LANG,
  workbenchType: "fr-new-question-promotion",
  generatedAt,
  storageKey: STORAGE_KEY,
  sourcePaths: {
    candidates: rel(CANDIDATES_PATH),
    sourceDecisions: rel(SOURCE_DECISIONS_PATH),
    masterQuestions: rel(master.questionsPath),
    rawQuestions: rel(master.rawQuestionsPath),
    imageColorTags: rel(master.imageTagsPath),
    decisionMemory: rel(decisionMemory.memoryPath),
    duplicateAudit: rel(duplicateAudit.auditPath),
  },
  outputs: {
    html: rel(OUTPUT_HTML_PATH),
    json: rel(OUTPUT_JSON_PATH),
    decisions: rel(OUTPUT_DECISIONS_PATH),
    promotionPreview: rel(PROMOTION_PREVIEW_PATH),
  },
  counts: summarize(previewItems),
  highestExistingQuestionNumber: highestQuestionNumber,
  knownLanguages,
  items: previewItems,
  decisions: decisionsTemplate,
};

await writeJson(OUTPUT_JSON_PATH, workbench);
await writeJson(OUTPUT_DECISIONS_PATH, decisionsTemplate);
await writeJson(PROMOTION_PREVIEW_PATH, promotionPreview);
await writeText(OUTPUT_HTML_PATH, renderHtml(workbench));

console.log(`Wrote ${rel(OUTPUT_HTML_PATH)}`);
console.log(`Wrote ${rel(OUTPUT_JSON_PATH)}`);
console.log(`Wrote ${rel(OUTPUT_DECISIONS_PATH)}`);
console.log(`Wrote ${rel(PROMOTION_PREVIEW_PATH)}`);
console.log(`Candidates rendered: ${previewItems.length}`);
console.log(
  [
    `promoteNewQuestion=${decisionsTemplate.items.filter((item) => item.decision === "promoteNewQuestion").length}`,
    `linkExistingQid=${decisionsTemplate.items.filter((item) => item.decision === "linkExistingQid").length}`,
    `rejectDuplicate=${decisionsTemplate.items.filter((item) => item.decision === "rejectDuplicate").length}`,
    `needsHumanReview=${decisionsTemplate.items.filter((item) => item.decision === "needsHumanReview").length}`,
    `deleteCandidate=${decisionsTemplate.items.filter((item) => item.decision === "deleteCandidate").length}`,
  ].join(", "),
);

function buildPreviewItem({ candidate, normalizedCandidate, duplicateSafety, proposedMasterNumber, proposedQid }) {
  const sourceBatch = normalizeBatch(candidate.sourceBatch ?? normalizedCandidate.batch);
  const sourceImage = normalizeText(candidate.sourceImage ?? normalizedCandidate.sourceImage);
  const sourceDecision = sourceDecisionByCandidateId.get(String(candidate.candidateId ?? "").trim()) ?? {};
  const nearestExistingQids = Array.isArray(duplicateSafety.nearestExistingQids)
    ? duplicateSafety.nearestExistingQids
    : [];
  const topMatch = nearestExistingQids[0] ?? null;
  const defaultDecision = defaultDecisionForDuplicateSafety(duplicateSafety);
  const linkedQid = duplicateSafety.linkToExistingQid ?? topMatch?.qid ?? null;
  const localAnswerKey = normalizeAnswerKey(candidate.newQuestionLocalAnswerKey ?? candidate.correctKeyRaw);
  const sourceOptions = buildSourceOptions(candidate);
  const masterMatches = nearestExistingQids.slice(0, 6).map((match) => masterMatchCard(match));

  return {
    id: String(candidate.candidateId ?? "").trim(),
    candidateId: String(candidate.candidateId ?? "").trim(),
    sourceBatch,
    sourceImage,
    sourceItemId: candidate.sourceItemId ?? sourceImage ?? null,
    sourceScreenshotPath: sourceScreenshotPath(sourceBatch, sourceImage),
    sourceScreenshotExists: Boolean(sourceScreenshotAbs(sourceBatch, sourceImage) && fileExists(sourceScreenshotAbs(sourceBatch, sourceImage))),
    type: normalizeQuestionType(candidate.effectiveQuestionType ?? normalizedCandidate.type),
    proposedQid,
    proposedMasterNumber,
    promptRaw: normalizeText(candidate.promptRawJa ?? normalizedCandidate.sourcePrompt),
    promptGloss: normalizeText(candidate.promptGlossEn ?? normalizedCandidate.translatedEnglishPrompt),
    sourceOptions,
    localAnswerKey,
    correctAnswerRaw: normalizeText(candidate.correctAnswerRaw),
    topic: normalizeText(candidate.provisionalTopic),
    subtopics: Array.isArray(candidate.provisionalSubtopics) ? candidate.provisionalSubtopics.map(normalizeText).filter(Boolean) : [],
    topicSignals: Array.isArray(candidate.topicSignals) ? candidate.topicSignals : [],
    reviewerNotes: normalizeText(candidate.reviewerNotes ?? sourceDecision.reviewerNotes) ?? "",
    explanation: normalizeText(candidate.explanation) ?? "",
    linkedExistingAssetCandidate: candidate.linkedExistingAssetCandidate ?? null,
    duplicateSafety,
    promotionRecommendation: duplicateSafety.promotionRecommendation,
    duplicateScore: duplicateSafety.duplicateScore ?? 0,
    riskLabel: riskLabelForDuplicateSafety(duplicateSafety),
    defaultDecision,
    defaultLinkedQid: defaultDecision === "linkExistingQid" || defaultDecision === "rejectDuplicate" ? linkedQid : null,
    masterMatches,
    warnings: warningChips({ duplicateSafety, topMatch, candidate, localAnswerKey }),
  };
}

function masterMatchCard(match) {
  const masterQuestion = master.byQid.get(match.qid);
  const imageSrc = match.masterImage ?? masterQuestion?.imageAssets?.[0] ?? null;
  return {
    qid: match.qid,
    number: match.number ?? masterQuestion?.number ?? null,
    duplicateScore: match.duplicateScore ?? null,
    baseDuplicateScore: match.baseDuplicateScore ?? null,
    reasonCodes: Array.isArray(match.reasonCodes) ? match.reasonCodes : [],
    memoryLabels: Array.isArray(match.memoryLabels) ? match.memoryLabels : [],
    prompt: match.masterPrompt ?? masterQuestion?.prompt ?? null,
    answer: match.masterAnswer ?? masterQuestion?.answerKey ?? null,
    type: masterQuestion?.type ?? null,
    options: Array.isArray(masterQuestion?.options)
      ? masterQuestion.options.map((option) => ({ key: option.key, text: option.text }))
      : [],
    imagePath: qbankAssetPath(imageSrc),
    imageExists: Boolean(qbankAssetAbs(imageSrc) && fileExists(qbankAssetAbs(imageSrc))),
    objectTags: Array.isArray(masterQuestion?.objectTags) ? masterQuestion.objectTags : [],
  };
}

function buildDecisionsTemplate(items) {
  return {
    schemaVersion: 1,
    lang: LANG,
    workbenchType: "fr-new-question-promotion",
    generatedAt,
    sourceCandidates: rel(CANDIDATES_PATH),
    sourceWorkbench: rel(OUTPUT_JSON_PATH),
    items: items.map((item) => ({
      candidateId: item.candidateId,
      sourceBatch: item.sourceBatch,
      sourceImage: item.sourceImage,
      decision: item.defaultDecision,
      proposedQid: item.proposedQid,
      proposedMasterNumber: item.proposedMasterNumber,
      linkedExistingQid: item.defaultLinkedQid,
      localAnswerKey: item.localAnswerKey,
      topic: item.topic,
      subtopics: item.subtopics,
      reviewerNotes: defaultReviewerNote(item),
      promotionNotes: "",
      reviewed: false,
      reviewedAt: null,
    })),
  };
}

function buildPromotionPreview(items) {
  return {
    generatedAt,
    lang: LANG,
    batchId: BATCH_ID,
    dataset,
    reviewOnly: true,
    sourceCandidatesPath: rel(CANDIDATES_PATH),
    sourceDuplicateSafetyPaths: {
      masterQuestions: rel(master.questionsPath),
      rawQuestions: rel(master.rawQuestionsPath),
      imageColorTags: rel(master.imageTagsPath),
      decisionMemory: rel(decisionMemory.memoryPath),
      duplicateAudit: rel(duplicateAudit.auditPath),
    },
    duplicateSafetySummary: {
      candidatesBlocked: items.filter((item) => item.duplicateSafety.promotionRecommendation === "blockDuplicate").length,
      candidatesNeedingDuplicateReview: items.filter((item) => item.duplicateSafety.promotionRecommendation === "needsDuplicateReview").length,
      candidatesLinkedToExistingQid: items.filter((item) => item.duplicateSafety.promotionRecommendation === "linkToExistingQid").length,
      candidatesSafeToPromote: items.filter((item) => item.duplicateSafety.promotionRecommendation === "safeToPromote").length,
    },
    highestExistingQuestionNumber: highestQuestionNumber,
    knownLanguages,
    items: items.map((item) => ({
      candidateId: item.candidateId,
      proposedQid: item.proposedQid,
      proposedMasterNumber: item.proposedMasterNumber,
      sourceLang: LANG,
      sourceBatch: item.sourceBatch,
      sourceImage: item.sourceImage,
      effectiveQuestionType: item.type,
      newQuestionLocalAnswerKey: item.localAnswerKey,
      provisionalTopic: item.topic,
      provisionalSubtopics: item.subtopics,
      linkedExistingAssetCandidate: item.linkedExistingAssetCandidate,
      duplicateSafety: item.duplicateSafety,
      nearestExistingQids: item.duplicateSafety.nearestExistingQids,
      duplicateScore: item.duplicateSafety.duplicateScore,
      memoryLabelsFound: item.duplicateSafety.memoryLabelsFound,
      promotionRecommendation: item.duplicateSafety.promotionRecommendation,
      placeholderLocalizationCoverage: Object.fromEntries(
        knownLanguages.map((knownLang) => [
          knownLang,
          knownLang === LANG ? "source-extracted" : knownLang === "en" ? "missing-master-canonical" : "missing-localization",
        ]),
      ),
      status: statusForDuplicateSafety(item.duplicateSafety),
    })),
  };
}

function defaultDecisionForDuplicateSafety(duplicateSafety) {
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") return "rejectDuplicate";
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") return "linkExistingQid";
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") return "needsHumanReview";
  return "promoteNewQuestion";
}

function riskLabelForDuplicateSafety(duplicateSafety) {
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") return "blocked duplicate";
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") return "link existing";
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") return "needs review";
  return "safe to promote";
}

function statusForDuplicateSafety(duplicateSafety) {
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") return "blocked-duplicate";
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") return "link-to-existing-qid";
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") return "needs-duplicate-review";
  return "preview-only";
}

function defaultReviewerNote(item) {
  const pieces = [
    `Gate recommendation: ${item.promotionRecommendation}.`,
    item.duplicateSafety.explanation,
  ].filter(Boolean);
  if (item.defaultLinkedQid) pieces.push(`Candidate existing qid: ${item.defaultLinkedQid}.`);
  if (item.reviewerNotes) pieces.push(`Source note: ${item.reviewerNotes}`);
  return pieces.join(" ");
}

function warningChips({ duplicateSafety, topMatch, candidate, localAnswerKey }) {
  const chips = [];
  if (!localAnswerKey) chips.push("missing answer key");
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") chips.push("blocked by memory");
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") chips.push("linked existing qid");
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") chips.push("duplicate review needed");
  if (topMatch?.duplicateScore >= 0.62) chips.push(`high similarity ${topMatch.qid}`);
  if (candidate.linkedExistingAssetCandidate?.qid) chips.push(`linked asset ${candidate.linkedExistingAssetCandidate.qid}`);
  return chips;
}

function summarize(items) {
  return {
    totalCandidates: items.length,
    mcq: items.filter((item) => item.type === "MCQ").length,
    row: items.filter((item) => item.type === "ROW").length,
    promoteNewQuestion: items.filter((item) => item.defaultDecision === "promoteNewQuestion").length,
    linkExistingQid: items.filter((item) => item.defaultDecision === "linkExistingQid").length,
    rejectDuplicate: items.filter((item) => item.defaultDecision === "rejectDuplicate").length,
    needsHumanReview: items.filter((item) => item.defaultDecision === "needsHumanReview").length,
    deleteCandidate: items.filter((item) => item.defaultDecision === "deleteCandidate").length,
    missingAnswerKey: items.filter((item) => !item.localAnswerKey).length,
  };
}

function buildSourceOptions(candidate) {
  const raw = Array.isArray(candidate.optionsRawJa) ? candidate.optionsRawJa : [];
  const gloss = Array.isArray(candidate.optionsGlossEn) ? candidate.optionsGlossEn : [];
  const length = Math.max(raw.length, gloss.length);
  return Array.from({ length }, (_, index) => ({
    key: String.fromCharCode(65 + index),
    text: normalizeText(raw[index]) ?? "",
    gloss: normalizeText(gloss[index]) ?? "",
  }));
}

function highestMasterNumber(questionsPath) {
  const doc = readJson(questionsPath);
  const questions = Array.isArray(doc.questions) ? doc.questions : Array.isArray(doc) ? doc : [];
  return questions.reduce((max, question) => Math.max(max, Number(question.number) || 0), 0);
}

function renderHtml(workbench) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>French New-Question Promotion Workbench</title>
  <style>
    :root { color-scheme: light; --ink:#211915; --muted:#72675f; --line:#d8ccbf; --soft:#fbf7f1; --paper:#fffdf8; --accent:#0f665a; --warn:#9b5b00; --danger:#9d2b2b; --blue:#4830a3; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-serif, Georgia, "Times New Roman", serif; color:var(--ink); background:#f4efe7; }
    header { position: sticky; top:0; z-index:10; background:rgba(244,239,231,.96); border-bottom:1px solid var(--line); padding:14px 22px; }
    h1 { margin:0; font-size:26px; letter-spacing:.02em; }
    .sub { color:var(--muted); font-size:14px; margin-top:4px; }
    .toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; align-items:center; }
    button, .file-label, select, input, textarea { font:inherit; }
    button, .file-label { border:1px solid #0c5f54; background:var(--accent); color:white; border-radius:999px; padding:8px 13px; cursor:pointer; display:inline-block; }
    button.secondary, .file-label.secondary { background:#fffaf3; color:var(--ink); border-color:var(--line); }
    button.active { background:#2e245f; border-color:#2e245f; }
    input[type=file] { display:none; }
    main { padding:18px 22px 42px; max-width:1680px; margin:0 auto; }
    .stats { display:grid; grid-template-columns: repeat(6, minmax(120px,1fr)); gap:10px; margin-bottom:16px; }
    .stat { border:1px solid var(--line); background:var(--paper); border-radius:8px; padding:10px; }
    .stat b { display:block; font-size:22px; }
    .card { border:1px solid var(--line); background:var(--paper); border-radius:10px; padding:14px; margin-bottom:16px; }
    .card-grid { display:grid; grid-template-columns: minmax(230px, 330px) minmax(420px,1fr) minmax(330px,420px); gap:14px; align-items:start; }
    .screen { width:100%; max-height:520px; object-fit:contain; background:#eee7dc; border:1px solid var(--line); border-radius:8px; }
    .missing-img { min-height:170px; display:flex; align-items:center; justify-content:center; border:1px dashed var(--line); color:var(--muted); border-radius:8px; background:#faf6ef; }
    .candidate-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .candidate-head h2 { margin:0; font-size:20px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
    .chip { border:1px solid var(--line); border-radius:999px; padding:3px 8px; background:#fff9f0; color:var(--muted); font-size:13px; }
    .chip.good { border-color:#a9cfc5; background:#e9f6f1; color:#0f665a; }
    .chip.warn { border-color:#e3be7a; background:#fff4d9; color:var(--warn); }
    .chip.bad { border-color:#e4aaaa; background:#fff0f0; color:var(--danger); }
    .prompt { font-size:18px; line-height:1.35; margin:8px 0; }
    .gloss { color:var(--muted); font-size:15px; line-height:1.35; margin:6px 0 10px; }
    .options { display:grid; gap:7px; margin:10px 0; }
    .option { border:1px solid var(--line); border-radius:8px; padding:8px 10px; display:grid; grid-template-columns:34px 1fr; gap:6px; align-items:start; }
    .option.correct { background:#e8f5ef; border-color:#a7cfc3; }
    .key { font-weight:700; color:var(--accent); }
    .match { border:1px solid var(--line); border-radius:8px; padding:10px; margin:8px 0; background:var(--soft); }
    .match-top { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px; }
    .qid { color:var(--blue); font-weight:700; }
    .match img { max-width:180px; max-height:140px; object-fit:contain; border:1px solid var(--line); border-radius:6px; background:white; }
    .match-body { display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:start; }
    .small { font-size:13px; color:var(--muted); }
    .decision-panel { position:sticky; top:106px; border:1px solid var(--line); border-radius:10px; padding:12px; background:#fffaf3; }
    .recommend { border-left:4px solid var(--accent); background:#eef7f3; padding:9px; border-radius:6px; margin-bottom:10px; }
    .decision-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .decision-grid .wide { grid-column: 1 / -1; }
    label .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px; }
    select, input, textarea { width:100%; border:1px solid var(--line); background:white; color:var(--ink); border-radius:7px; padding:7px 8px; }
    textarea { min-height:66px; resize:vertical; }
    details { margin-top:10px; }
    summary { cursor:pointer; color:var(--accent); }
    .hidden { display:none !important; }
    .reviewed { opacity:.82; }
    @media (max-width: 1120px) { .card-grid { grid-template-columns:1fr; } .decision-panel { position:static; } .stats { grid-template-columns: repeat(2,1fr); } }
  </style>
</head>
<body>
  <header>
    <h1>French New-Question Promotion Workbench</h1>
    <div class="sub">Review-only. This does not promote questions into production.</div>
    <div class="toolbar">
      <button data-filter="all" class="filter active">All</button>
      <button data-filter="promoteNewQuestion" class="filter">Promote</button>
      <button data-filter="linkExistingQid" class="filter">Link existing</button>
      <button data-filter="needsHumanReview" class="filter">Needs review</button>
      <button data-filter="rejectDuplicate" class="filter">Reject duplicate</button>
      <button data-filter="reviewed" class="filter">Reviewed</button>
      <button data-filter="unreviewed" class="filter">Unreviewed</button>
      <button id="export-json">Export decisions JSON</button>
      <label for="import-json" class="file-label secondary">Import decisions JSON</label>
      <input id="import-json" type="file" accept="application/json,.json">
      <button id="clear-local" class="secondary">Clear local decisions</button>
    </div>
  </header>
  <main>
    <section class="stats" id="stats"></section>
    <section id="cards"></section>
  </main>
  <script>
    const STORAGE_KEY = ${jsonScript(STORAGE_KEY)};
    const WORKBENCH = ${jsonScript(workbench)};
    const DECISION_OPTIONS = ${jsonScript(REVIEW_DECISIONS)};
    const ANSWER_KEY_OPTIONS = ${jsonScript(ANSWER_KEY_OPTIONS)};
    let state = loadState();
    let activeFilter = "all";

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.items)) return parsed;
        }
      } catch {}
      return structuredClone(WORKBENCH.decisions);
    }
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function decisionFor(candidateId) {
      let row = state.items.find((item) => item.candidateId === candidateId);
      if (!row) {
        const base = WORKBENCH.decisions.items.find((item) => item.candidateId === candidateId);
        row = structuredClone(base);
        state.items.push(row);
      }
      return row;
    }
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
    }
    function optionTags(options, selected) {
      return options.map((value) => '<option value="' + escapeHtml(value) + '"' + (String(value) === String(selected ?? "") ? " selected" : "") + '>' + escapeHtml(value || "none") + '</option>').join("");
    }
    function chips(item) {
      const cls = item.defaultDecision === "promoteNewQuestion" ? "good" : item.defaultDecision === "rejectDuplicate" ? "bad" : "warn";
      return '<div class="chips"><span class="chip ' + cls + '">' + escapeHtml(item.riskLabel) + '</span><span class="chip">score ' + escapeHtml(item.duplicateScore) + '</span><span class="chip">' + escapeHtml(item.type) + '</span>' + item.warnings.map((warning) => '<span class="chip warn">' + escapeHtml(warning) + '</span>').join("") + '</div>';
    }
    function sourceOptions(item) {
      if (!item.sourceOptions.length) return '<div class="small">No source options.</div>';
      return '<div class="options">' + item.sourceOptions.map((option) => {
        const correct = item.localAnswerKey && option.key === item.localAnswerKey ? " correct" : "";
        return '<div class="option' + correct + '"><div class="key">' + escapeHtml(option.key) + '</div><div><div>' + escapeHtml(option.text) + '</div><div class="small">' + escapeHtml(option.gloss) + '</div></div></div>';
      }).join("") + '</div>';
    }
    function matchCard(match) {
      const img = match.imagePath ? '<img src="' + escapeHtml(match.imagePath) + '" alt="candidate image">' : '';
      return '<article class="match"><div class="match-top"><span class="qid">' + escapeHtml(match.qid) + '</span><span class="chip">score ' + escapeHtml(match.duplicateScore) + '</span><span class="chip">' + escapeHtml(match.type || "") + '</span><span class="chip">answer ' + escapeHtml(match.answer || "") + '</span></div><div class="match-body">' + img + '<div><div>' + escapeHtml(match.prompt || "") + '</div>' + match.options.map((option) => '<div class="small">' + escapeHtml(option.key || "") + " " + escapeHtml(option.text || "") + '</div>').join("") + '<div class="small">' + escapeHtml((match.reasonCodes || []).join(", ")) + '</div></div></div></article>';
    }
    function decisionControls(item, decision) {
      return '<div class="decision-grid">' +
        '<label class="wide"><div class="label">Decision</div><select data-field="decision">' + optionTags(DECISION_OPTIONS, decision.decision) + '</select></label>' +
        '<label><div class="label">Proposed qid</div><input data-field="proposedQid" value="' + escapeHtml(decision.proposedQid || "") + '"></label>' +
        '<label><div class="label">Linked existing qid</div><input data-field="linkedExistingQid" value="' + escapeHtml(decision.linkedExistingQid || "") + '"></label>' +
        '<label><div class="label">Local answer key</div><select data-field="localAnswerKey">' + optionTags(ANSWER_KEY_OPTIONS, decision.localAnswerKey || "") + '</select></label>' +
        '<label><div class="label">Topic</div><input data-field="topic" value="' + escapeHtml(decision.topic || "") + '"></label>' +
        '<label class="wide"><div class="label">Subtopics</div><input data-field="subtopics" value="' + escapeHtml((decision.subtopics || []).join(", ")) + '"></label>' +
        '<label class="wide"><div class="label">Reviewer notes</div><textarea data-field="reviewerNotes">' + escapeHtml(decision.reviewerNotes || "") + '</textarea></label>' +
        '<label class="wide"><div class="label">Promotion notes</div><textarea data-field="promotionNotes">' + escapeHtml(decision.promotionNotes || "") + '</textarea></label>' +
        '<div class="wide"><button class="secondary mark-reviewed">' + (decision.reviewed ? "Update reviewed" : "Mark reviewed") + '</button> <span class="small">' + (decision.reviewedAt ? "Reviewed " + escapeHtml(decision.reviewedAt) : "Unreviewed") + '</span></div>' +
      '</div>';
    }
    function card(item) {
      const decision = decisionFor(item.candidateId);
      const screen = item.sourceScreenshotPath && item.sourceScreenshotExists ? '<img class="screen" src="' + escapeHtml(item.sourceScreenshotPath) + '" alt="source screenshot">' : '<div class="missing-img">No screenshot found</div>';
      return '<article class="card" data-candidate-id="' + escapeHtml(item.candidateId) + '" data-default-decision="' + escapeHtml(item.defaultDecision) + '">' +
        '<div class="candidate-head"><h2>' + escapeHtml(item.candidateId) + ' · ' + escapeHtml(item.sourceBatch) + '</h2><span class="chip">proposed ' + escapeHtml(item.proposedQid) + '</span></div>' +
        '<div class="card-grid"><section>' + screen + '<div class="small">' + escapeHtml(item.sourceImage || "") + '</div></section>' +
        '<section>' + chips(item) + '<div class="prompt">' + escapeHtml(item.promptRaw || "") + '</div><div class="gloss">' + escapeHtml(item.promptGloss || "") + '</div>' + sourceOptions(item) +
        '<div class="small"><b>Gate:</b> ' + escapeHtml(item.duplicateSafety.explanation || "") + '</div>' +
        '<details><summary>Nearest existing qids</summary>' + (item.masterMatches.length ? item.masterMatches.map(matchCard).join("") : '<div class="small">No nearby qids.</div>') + '</details>' +
        '</section><aside class="decision-panel"><div class="recommend"><b>Default: ' + escapeHtml(item.defaultDecision) + '</b><br><span class="small">' + escapeHtml(defaultSummary(item)) + '</span></div>' + decisionControls(item, decision) + '</aside></div></article>';
    }
    function defaultSummary(item) {
      if (item.defaultLinkedQid) return "Existing-qid candidate: " + item.defaultLinkedQid;
      return item.duplicateSafety.explanation || "";
    }
    function passesFilter(item) {
      const decision = decisionFor(item.candidateId);
      if (activeFilter === "all") return true;
      if (activeFilter === "reviewed") return decision.reviewed === true;
      if (activeFilter === "unreviewed") return decision.reviewed !== true;
      return decision.decision === activeFilter || item.defaultDecision === activeFilter;
    }
    function renderStats() {
      const reviewed = state.items.filter((item) => item.reviewed).length;
      const counts = {};
      for (const row of state.items) counts[row.decision] = (counts[row.decision] || 0) + 1;
      const stats = [
        ["Candidates", WORKBENCH.items.length],
        ["Reviewed", reviewed],
        ["Promote", counts.promoteNewQuestion || 0],
        ["Link", counts.linkExistingQid || 0],
        ["Needs review", counts.needsHumanReview || 0],
        ["Reject", counts.rejectDuplicate || 0],
      ];
      document.getElementById("stats").innerHTML = stats.map(([label, value]) => '<div class="stat"><b>' + escapeHtml(value) + '</b><span>' + escapeHtml(label) + '</span></div>').join("");
    }
    function render() {
      renderStats();
      document.getElementById("cards").innerHTML = WORKBENCH.items.filter(passesFilter).map(card).join("");
    }
    document.addEventListener("change", (event) => {
      const field = event.target?.dataset?.field;
      if (!field) return;
      const card = event.target.closest("[data-candidate-id]");
      const decision = decisionFor(card.dataset.candidateId);
      if (field === "subtopics") decision[field] = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
      else decision[field] = event.target.value || null;
      saveState();
      renderStats();
    });
    document.addEventListener("click", (event) => {
      if (event.target.classList.contains("filter")) {
        activeFilter = event.target.dataset.filter;
        document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button === event.target));
        render();
      }
      if (event.target.classList.contains("mark-reviewed")) {
        const card = event.target.closest("[data-candidate-id]");
        const decision = decisionFor(card.dataset.candidateId);
        decision.reviewed = true;
        decision.reviewedAt = new Date().toISOString();
        saveState();
        render();
      }
    });
    document.getElementById("export-json").addEventListener("click", () => {
      state.generatedAt = new Date().toISOString();
      const blob = new Blob([JSON.stringify(state, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fr-new-question-promotion-workbench-decisions.json";
      a.click();
      URL.revokeObjectURL(url);
    });
    document.getElementById("import-json").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      state = JSON.parse(await file.text());
      saveState();
      render();
    });
    document.getElementById("clear-local").addEventListener("click", () => {
      if (!confirm("Clear local review decisions?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = structuredClone(WORKBENCH.decisions);
      render();
    });
    render();
  </script>
</body>
</html>`;
}

function sourceScreenshotAbs(batch, sourceImage) {
  if (!batch || !sourceImage) return null;
  if (path.isAbsolute(sourceImage)) return sourceImage;
  return path.join(IMPORTS_DIR, LANG, batch, sourceImage);
}

function sourceScreenshotPath(batch, sourceImage) {
  const abs = sourceScreenshotAbs(batch, sourceImage);
  return abs ? toPosix(path.relative(REPORTS_DIR, abs)) : null;
}

function qbankAssetAbs(assetSrc) {
  if (!assetSrc) return null;
  if (path.isAbsolute(assetSrc) && !String(assetSrc).startsWith("/qbank/")) return assetSrc;
  const clean = String(assetSrc).replace(/^\//, "");
  if (clean.startsWith("qbank/")) return path.join(ROOT, "public", clean);
  return path.join(ROOT, clean);
}

function qbankAssetPath(assetSrc) {
  const abs = qbankAssetAbs(assetSrc);
  return abs ? toPosix(path.relative(REPORTS_DIR, abs)) : null;
}

function normalizeQuestionType(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "ROW") return "ROW";
  if (text === "MCQ") return "MCQ";
  return text || "UNKNOWN";
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return ANSWER_KEY_OPTIONS.includes(text) ? text || null : text || null;
}

function normalizeBatch(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/batch[-_]?(\d+)/i);
  return match ? `batch-${match[1].padStart(3, "0")}` : text;
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function toPosix(value) {
  return String(value ?? "").split(path.sep).join("/");
}

function rel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
