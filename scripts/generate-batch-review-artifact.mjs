#!/usr/bin/env node

import path from "node:path";

import {
  REPORTS_DIR,
  batchOptionsFromArgs,
  booleanArg,
  getBatchFiles,
  getNewQuestionFiles,
  getReviewArtifactPaths,
  parseArgs,
  readJson,
  stableNow,
  writeCsv,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const scope = String(args.scope ?? "review-needed").trim().toLowerCase();
const includeUnresolved = scope === "remaining" || String(args["include-unresolved"] ?? "").trim().toLowerCase() === "true";
const htmlOnly = booleanArg(args, "html-only", false);

const batchFiles = getBatchFiles(lang, batchId);
const reviewDoc = readJson(batchFiles.reviewNeededPath);
const unresolvedDoc = readJson(batchFiles.unresolvedPath);

const reviewItems = Array.isArray(reviewDoc.items) ? reviewDoc.items : [];
const unresolvedItems = includeUnresolved && Array.isArray(unresolvedDoc.items) ? unresolvedDoc.items : [];
const combinedItems = [
  ...reviewItems.map((item) => normalizeReviewItem(item, "review-needed")),
  ...unresolvedItems.map((item) => normalizeReviewItem(item, "unresolved")),
];

const baseName = scope === "remaining"
  ? `${lang}-${batchId}-remaining-review`
  : `${lang}-${batchId}-review`;
const reviewPaths = getReviewArtifactPaths(lang, batchId, { scope });
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const htmlPath = reviewPaths.htmlPath;
const jsonPath = reviewPaths.decisionsTemplateJsonPath;
const csvPath = reviewPaths.decisionsTemplateCsvPath;
const manifestPath = reviewPaths.manifestPath;

const decisionsTemplate = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope,
  sources: {
    reviewNeeded: path.relative(process.cwd(), batchFiles.reviewNeededPath),
    unresolved: includeUnresolved ? path.relative(process.cwd(), batchFiles.unresolvedPath) : null,
  },
  items: combinedItems.map((item) => ({
    itemId: item.itemId,
    approvedQid: null,
    noneOfThese: false,
    createNewQuestion: false,
    unsure: true,
    reviewerNotes: "",
  })),
};

const csvRows = decisionsTemplate.items.map((item) => ({
  itemId: item.itemId,
  approvedQid: "",
  noneOfThese: "false",
  createNewQuestion: "false",
  unsure: "true",
  reviewerNotes: "",
}));

if (!htmlOnly) {
  await writeJson(jsonPath, decisionsTemplate);
  await writeCsv(csvPath, [
    "itemId",
    "approvedQid",
    "noneOfThese",
    "createNewQuestion",
    "unsure",
    "reviewerNotes",
  ], csvRows);
}

const newQuestionDecisions = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope,
  sourceReviewDecisionsPath: path.relative(process.cwd(), jsonPath),
  items: combinedItems.map((item) => ({
    itemId: item.itemId,
    sourceImage: item.sourceImage,
    currentTopQid: item.currentTopQid,
    currentTopScore: item.currentTopScore,
    createNewQuestion: false,
    reviewerNotes: "",
    status: "pending-review",
  })),
};

const emptyNewQuestionCandidates = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), newQuestionFiles.decisionsPath),
  items: [],
};

if (!htmlOnly) {
  await writeJson(newQuestionFiles.decisionsPath, newQuestionDecisions);
  await writeJson(newQuestionFiles.candidatesPath, emptyNewQuestionCandidates);
}
await writeText(htmlPath, buildHtml({
  lang,
  batchId,
  dataset,
  scope,
  reviewCount: reviewItems.length,
  unresolvedCount: unresolvedItems.length,
  items: combinedItems,
  decisionsTemplatePath: path.relative(REPORTS_DIR, jsonPath).split(path.sep).join("/"),
  decisionsTemplateCsvPath: path.relative(REPORTS_DIR, csvPath).split(path.sep).join("/"),
  newQuestionDecisionsPath: path.relative(REPORTS_DIR, newQuestionFiles.decisionsPath).split(path.sep).join("/"),
  newQuestionCandidatesPath: path.relative(REPORTS_DIR, newQuestionFiles.candidatesPath).split(path.sep).join("/"),
}));
if (!htmlOnly) {
  await writeJson(manifestPath, {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    scope,
    outputs: {
      html: path.relative(process.cwd(), htmlPath),
      decisionsTemplateJson: path.relative(process.cwd(), jsonPath),
      decisionsTemplateCsv: path.relative(process.cwd(), csvPath),
      newQuestionDecisions: path.relative(process.cwd(), newQuestionFiles.decisionsPath),
      newQuestionCandidates: path.relative(process.cwd(), newQuestionFiles.candidatesPath),
    },
    counts: {
      reviewNeeded: reviewItems.length,
      unresolved: unresolvedItems.length,
      total: combinedItems.length,
    },
  });
}

console.log(`Wrote ${path.relative(process.cwd(), htmlPath)}.`);

function normalizeReviewItem(item, sourceKind) {
  const topCandidate = item.match ?? item.topCandidates?.[0] ?? null;
  const topScore = topCandidate?.score ?? item.analysis?.topScore ?? null;
  const topGap = item.match?.scoreGap ?? item.analysis?.topGap ?? null;

  return {
    sourceKind,
    itemId: item.itemId,
    sourceImage: item.sourceImage,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: item.optionsRawJa ?? item.localizedText?.options ?? [],
    optionsGlossEn: item.optionsGlossEn ?? item.translatedText?.options ?? [],
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? item.localizedText?.correctAnswer ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: item.provisionalSubtopics ?? [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: item.topicSignals ?? [],
    sourceConceptSlots: item.sourceConceptSlots ?? null,
    reason: item.reason ?? null,
    localizedText: item.localizedText ?? {
      prompt: null,
      options: [],
      correctAnswer: null,
      explanation: null,
    },
    translatedText: item.translatedText ?? {
      prompt: null,
      options: [],
      correctAnswer: null,
    },
    analysis: item.analysis ?? null,
    currentTopQid: topCandidate?.qid ?? null,
    currentTopScore: topScore,
    currentTopGap: topGap,
    topCandidates: (item.topCandidates ?? []).map((candidate) => ({
      ...candidate,
      scoreGapFromTop:
        topScore == null || candidate?.score == null
          ? null
          : roundNumber(Number(topScore) - Number(candidate.score)),
      candidateImagePath: candidate.image?.currentAssetSrc
        ? relativeFromReports(path.join(process.cwd(), "public", candidate.image.currentAssetSrc.replace(/^\//, "")))
        : null,
    })),
    screenshotPath: item.sourceImage
      ? relativeFromReports(path.join(batchFiles.batchDir, item.sourceImage))
      : null,
  };
}

function roundNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function buildHtml({
  lang,
  batchId,
  dataset,
  scope,
  reviewCount,
  unresolvedCount,
  items,
  decisionsTemplatePath,
  decisionsTemplateCsvPath,
  newQuestionDecisionsPath,
  newQuestionCandidatesPath,
}) {
  const payload = items.map((item, index) => ({
    index: index + 1,
    ...item,
  }));
  const storageKey = `qbank-remaining-review-${lang}-${batchId}-${scope}`;
  const pageTitle = scope === "remaining" ? "Remaining Japanese Batch Review" : "Japanese Batch Review";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)} ${escapeHtml(batchId)}</title>
  <style>
    :root {
      --bg: #f4f0e8;
      --paper: #fffdf8;
      --ink: #1f1a17;
      --muted: #6f6257;
      --line: #d8cec1;
      --accent: #165d52;
      --accent-soft: #e3f0ed;
      --warn: #8f4f12;
      --warn-soft: #f9ead8;
      --danger: #842029;
      --danger-soft: #f8d7da;
      --shadow: 0 14px 28px rgba(38, 25, 10, 0.08);
      --radius: 18px;
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(22, 93, 82, 0.12), transparent 34%),
        radial-gradient(circle at top right, rgba(143, 79, 18, 0.12), transparent 28%),
        var(--bg);
      color: var(--ink);
      font-family: var(--sans);
    }
    a { color: var(--accent); }
    .page {
      width: min(1480px, calc(100vw - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248, 244, 237, 0.96));
      border: 1px solid rgba(216, 206, 193, 0.9);
      border-radius: 28px;
      padding: 28px 32px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .stat {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
    }
    .stat strong {
      display: block;
      font-size: 26px;
      margin-top: 6px;
      word-break: break-word;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-top: 22px;
    }
    .toolbar button {
      appearance: none;
      border: none;
      border-radius: 999px;
      background: var(--accent);
      color: white;
      padding: 11px 16px;
      font: inherit;
      cursor: pointer;
    }
    .toolbar button.secondary {
      background: #efe8dd;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    .toolbar .hint {
      color: var(--muted);
      font-size: 14px;
    }
    .item {
      background: rgba(255,255,255,0.92);
      border: 1px solid rgba(216, 206, 193, 0.95);
      border-radius: 24px;
      padding: 22px;
      margin-top: 22px;
      box-shadow: var(--shadow);
    }
    .item-head {
      display: flex;
      gap: 16px;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .item-head h2 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.03em;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f7f2ea;
      color: var(--muted);
      padding: 6px 10px;
      font-size: 13px;
      white-space: nowrap;
    }
    .pill.warn {
      background: var(--warn-soft);
      color: var(--warn);
    }
    .pill.danger {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }
    .panel {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
    }
    .panel h3 {
      margin: 0 0 12px;
      font-size: 18px;
    }
    .screenshot {
      width: 100%;
      height: auto;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: #f0ece6;
    }
    .prompt {
      font-size: 18px;
      line-height: 1.45;
      margin: 0 0 12px;
    }
    .subtle {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.4;
    }
    .options {
      display: grid;
      gap: 8px;
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
    }
    .options li {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fcfaf6;
    }
    .controls {
      display: grid;
      gap: 10px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px dashed var(--line);
    }
    .choice-list {
      display: grid;
      gap: 8px;
    }
    .choice {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 12px;
      background: #fff;
    }
    .choice input {
      margin-top: 4px;
    }
    .choice strong {
      display: block;
      margin-bottom: 4px;
    }
    textarea {
      width: 100%;
      min-height: 78px;
      resize: vertical;
      border-radius: 14px;
      border: 1px solid var(--line);
      padding: 12px;
      font: inherit;
      background: #fff;
    }
    .candidate-list {
      display: grid;
      gap: 10px;
    }
    .candidate {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      background: #fffdfa;
    }
    .candidate-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .candidate-head h4 {
      margin: 0;
      font-size: 17px;
    }
    .score {
      font-family: var(--mono);
      font-size: 14px;
      background: var(--accent-soft);
      color: var(--accent);
      border-radius: 999px;
      padding: 7px 10px;
      border: 1px solid rgba(22, 93, 82, 0.2);
    }
    .candidate-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 12px;
      align-items: start;
    }
    .candidate .meta-row {
      padding: 8px 10px;
    }
    .candidate .prompt {
      font-size: 16px;
      margin: 0 0 6px;
    }
    .candidate .options {
      gap: 6px;
      margin-top: 6px;
    }
    .candidate .options li {
      padding: 8px 10px;
    }
    .meta {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }
    .meta-row {
      padding: 10px 12px;
      border-radius: 12px;
      background: #f7f2ea;
      border: 1px solid var(--line);
    }
    .breakdown {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .breakdown div {
      border-radius: 12px;
      padding: 10px;
      border: 1px solid var(--line);
      background: #fcfaf6;
      font-size: 13px;
    }
    .breakdown strong {
      display: block;
      font-family: var(--mono);
      font-size: 15px;
      margin-bottom: 2px;
    }
    .badge-warn {
      display: inline-block;
      border-radius: 999px;
      padding: 6px 10px;
      background: var(--warn-soft);
      color: var(--warn);
      border: 1px solid rgba(143, 79, 18, 0.2);
      font-size: 13px;
      margin: 0 8px 8px 0;
    }
    .notes {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f7f2ea;
      border: 1px solid var(--line);
      font-size: 14px;
      color: var(--muted);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .fact {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      background: #fcfaf6;
      font-size: 13px;
    }
    .fact strong,
    .signal strong {
      font-family: var(--mono);
      font-size: 12px;
    }
    .signal-list {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .signal {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fcfaf6;
      font-size: 13px;
      line-height: 1.5;
    }
    .concept-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }
    .concept-grid > div {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #fcfaf6;
      padding: 10px 12px;
    }
    .concept-grid strong {
      display: block;
      font-size: 12px;
      font-family: var(--mono);
      margin-bottom: 6px;
      color: var(--muted);
    }
    .concept-grid ul {
      margin: 0;
      padding-left: 18px;
    }
    .concept-grid li {
      margin: 0 0 4px;
    }
    .mono {
      font-family: var(--mono);
      word-break: break-word;
    }
    .candidate-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 0;
    }
    .advanced {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f8f4ec;
      overflow: hidden;
    }
    .advanced summary {
      cursor: pointer;
      list-style: none;
      padding: 10px 12px;
      font-size: 13px;
      color: var(--muted);
      font-family: var(--mono);
    }
    .advanced summary::-webkit-details-marker {
      display: none;
    }
    .advanced summary::before {
      content: "+ ";
    }
    .advanced[open] summary::before {
      content: "- ";
    }
    .advanced-body {
      padding: 0 12px 12px;
      display: grid;
      gap: 10px;
      border-top: 1px solid var(--line);
      background: #fffdfa;
    }
    .image-frame {
      margin-top: 10px;
    }
    .image-fallback {
      display: none;
      margin-top: 10px;
      padding: 12px;
      border-radius: 12px;
      border: 1px dashed var(--line);
      background: #fcfaf6;
      color: var(--muted);
      line-height: 1.45;
    }
    .image-path {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .image-frame.is-broken .screenshot {
      display: none;
    }
    .image-frame.is-broken .image-fallback {
      display: block;
    }
    .empty {
      margin-top: 20px;
      padding: 24px;
      border-radius: 18px;
      border: 1px dashed var(--line);
      color: var(--muted);
      background: rgba(255,255,255,0.75);
      text-align: center;
    }
    @media (max-width: 1080px) {
      .layout,
      .candidate-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(pageTitle)}</h1>
      <p>Batch <strong>${escapeHtml(batchId)}</strong> in <strong>${escapeHtml(lang)}</strong>. Review the remaining difficult items, choose the approved qid, mark none/unsure, or mark <strong>create new question</strong>. All review data, CSS, and JavaScript are embedded in this file for direct <span class="mono">file://</span> use. This page does not modify production qbank data.</p>
      <div class="hero-grid">
        <div class="stat">
          <span class="subtle">Total items</span>
          <strong>${items.length}</strong>
        </div>
        <div class="stat">
          <span class="subtle">Review-needed</span>
          <strong>${reviewCount}</strong>
        </div>
        <div class="stat">
          <span class="subtle">Unresolved</span>
          <strong>${unresolvedCount}</strong>
        </div>
        <div class="stat">
          <span class="subtle">Decisions template JSON</span>
          <strong>${escapeHtml(decisionsTemplatePath)}</strong>
        </div>
      </div>
      <div class="hero-grid">
        <div class="stat">
          <span class="subtle">Decisions template CSV</span>
          <strong>${escapeHtml(decisionsTemplateCsvPath)}</strong>
        </div>
        <div class="stat">
          <span class="subtle">New-question decisions</span>
          <strong>${escapeHtml(newQuestionDecisionsPath)}</strong>
        </div>
        <div class="stat">
          <span class="subtle">New-question candidates</span>
          <strong>${escapeHtml(newQuestionCandidatesPath)}</strong>
        </div>
        <div class="stat">
          <span class="subtle">Dataset</span>
          <strong>${escapeHtml(dataset)}</strong>
        </div>
        <div class="stat">
          <span class="subtle">Scope</span>
          <strong>${escapeHtml(scope)}</strong>
        </div>
      </div>
      <div class="toolbar">
        <button id="export-json">Export Decisions JSON</button>
        <button id="export-csv" class="secondary">Export Decisions CSV</button>
        <button id="clear-storage" class="secondary">Clear Saved Decisions</button>
        <span class="hint">Selections are stored in this browser until you export them. Edit the staged JSON file after review if you prefer a file-based workflow.</span>
      </div>
    </section>
    <main id="app"></main>
  </div>
  <script>
    const REVIEW_DATA = ${JSON.stringify(payload)};
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const CONTEXT = ${JSON.stringify({ lang, batchId, dataset, scope })};
    const JSON_FILENAME = ${JSON.stringify(`${baseName}-decisions.json`)};
    const CSV_FILENAME = ${JSON.stringify(`${baseName}-decisions.csv`)};

    function getSaved() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    }

    function save(saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }

    function text(value) {
      return value == null || value === "" ? "None" : String(value);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function renderOptions(options) {
      if (!options || !options.length) {
        return '<div class="subtle">No options</div>';
      }
      return '<ul class="options">' + options.map((option) => '<li>' + escapeHtml(option) + '</li>').join("") + '</ul>';
    }

    function renderCandidateOptions(options) {
      if (!options || !options.length) {
        return '<div class="subtle">No options</div>';
      }
      return '<ul class="options">' + options.map((option) => {
        const translated = option.translatedText ? '<div class="subtle">' + escapeHtml(option.translatedText) + '</div>' : "";
        return '<li><strong>' + escapeHtml(option.id) + '.</strong> ' + escapeHtml(option.text) + translated + '</li>';
      }).join("") + '</ul>';
    }

    function renderFacts(entries) {
      const items = entries.filter((entry) => entry && entry.value != null && entry.value !== "" && (!(Array.isArray(entry.value)) || entry.value.length > 0));
      if (!items.length) {
        return '<div class="subtle">No metadata</div>';
      }
      return '<div class="facts">' + items.map((entry) => {
        const value = Array.isArray(entry.value) ? entry.value.join(", ") : entry.value;
        return '<div class="fact"><strong>' + escapeHtml(entry.label) + '</strong><span>' + escapeHtml(String(value)) + '</span></div>';
      }).join("") + '</div>';
    }

    function renderTopicSignals(signals) {
      if (!signals || !signals.length) {
        return '<div class="subtle">No topic signals</div>';
      }
      return '<div class="signal-list">' + signals.map((signal) => {
        const parts = [
          signal.topic || "unknown",
          signal.subtopic || "no-subtopic",
          signal.signal || "signal",
          signal.weight == null ? null : 'weight ' + signal.weight,
        ].filter(Boolean);
        return '<div class="signal"><strong>' + escapeHtml(signal.signal || "signal") + '</strong><div>' + escapeHtml(parts.join(" · ")) + '</div></div>';
      }).join("") + '</div>';
    }

    function renderConceptSlots(slots) {
      if (!slots) {
        return '<div class="subtle">No concept slots</div>';
      }
      return '<div class="concept-grid">' +
        renderConceptColumn('Condition', slots.condition) +
        renderConceptColumn('Context', slots.context) +
        renderConceptColumn('Action', slots.action) +
        renderConceptColumn('Polarity', slots.polarity ? [slots.polarity] : []) +
      '</div>';
    }

    function renderConceptColumn(label, values) {
      if (!values || !values.length) {
        return '<div><strong>' + escapeHtml(label) + '</strong><div class="subtle">None</div></div>';
      }
      return '<div><strong>' + escapeHtml(label) + '</strong><ul>' + values.map((value) => '<li>' + escapeHtml(value) + '</li>').join("") + '</ul></div>';
    }

    function renderMetaRow(label, body) {
      return '<div class="meta-row"><strong>' + escapeHtml(label) + '</strong>' + body + '</div>';
    }

    function renderBreakdown(breakdown) {
      const entries = Object.entries(breakdown || {});
      if (!entries.length) {
        return '<div class="subtle">No score breakdown</div>';
      }

      return '<div class="breakdown">' + entries.map(([key, value]) => {
        return '<div><strong>' + escapeHtml(value) + '</strong>' + escapeHtml(key) + '</div>';
      }).join("") + '</div>';
    }

    function renderAdvancedDiagnostics(candidate) {
      const notes = (candidate.diagnostics?.explanation || []).map((note) => '<span class="badge-warn">' + escapeHtml(note) + '</span>').join(" ");

      return '<details class="advanced"><summary>Show advanced diagnostics</summary><div class="advanced-body">' +
        renderMetaRow('Synthetic JA prompt', '<div class="prompt">' + escapeHtml(text(candidate.syntheticJaPrompt)) + '</div>') +
        renderMetaRow('Candidate topic metadata', renderFacts([
          { label: 'topic', value: candidate.topic || 'None' },
          { label: 'subtopics', value: candidate.subtopics || [] },
        ])) +
        renderMetaRow('Candidate concept slots', renderConceptSlots(candidate.conceptSlots)) +
        renderMetaRow('Score breakdown', renderBreakdown(candidate.scoreBreakdown)) +
        '<div class="notes">' + (notes || '<span class="subtle">No extra diagnostics</span>') + '</div>' +
      '</div></details>';
    }

    function renderImageBlock(src, alt, localPath, emptyLabel) {
      if (!src) {
        return '<div class="empty">' + escapeHtml(emptyLabel || "Image not available") + '</div>' +
          (localPath
            ? '<div class="image-path mono">' + escapeHtml(localPath) + '</div>'
            : '');
      }

      const safeSrc = escapeHtml(src);
      const safeAlt = escapeHtml(alt || "image");
      const safePath = escapeHtml(localPath || src);
      return '<div class="image-frame">' +
        '<img class="screenshot" loading="lazy" src="' + safeSrc + '" alt="' + safeAlt + '" onerror="this.closest(&quot;.image-frame&quot;).classList.add(&quot;is-broken&quot;);">' +
        '<div class="image-fallback">Image could not be loaded directly from this local file view.<br><span class="mono">' + safePath + '</span></div>' +
        '<div class="image-path mono">' + safePath + '</div>' +
      '</div>';
    }

    function normalizeDecision(raw) {
      return {
        approvedQid: raw?.approvedQid || "",
        noneOfThese: raw?.noneOfThese === true,
        createNewQuestion: raw?.createNewQuestion === true,
        unsure: raw?.approvedQid ? false : raw?.noneOfThese ? false : raw?.createNewQuestion ? false : raw?.unsure !== false,
        reviewerNotes: raw?.reviewerNotes || "",
      };
    }

    function decisionRows(saved) {
      return REVIEW_DATA.map((item) => {
        const current = normalizeDecision(saved[item.itemId]);
        return {
          itemId: item.itemId,
          approvedQid: current.approvedQid || "",
          noneOfThese: String(current.noneOfThese),
          createNewQuestion: String(current.createNewQuestion),
          unsure: String(current.unsure),
          reviewerNotes: current.reviewerNotes || "",
        };
      });
    }

    function exportJson() {
      const payload = {
        exportedAt: new Date().toISOString(),
        batch: CONTEXT,
        items: decisionRows(getSaved()).map((row) => ({
          itemId: row.itemId,
          approvedQid: row.approvedQid || null,
          noneOfThese: row.noneOfThese === "true",
          createNewQuestion: row.createNewQuestion === "true",
          unsure: row.unsure === "true",
          reviewerNotes: row.reviewerNotes,
        })),
      };
      downloadFile(JSON_FILENAME, JSON.stringify(payload, null, 2), "application/json");
    }

    function exportCsv() {
      const rows = decisionRows(getSaved());
      const headers = ["itemId", "approvedQid", "noneOfThese", "createNewQuestion", "unsure", "reviewerNotes"];
      const lines = [headers.join(",")].concat(rows.map((row) => headers.map((key) => csvEscape(row[key] || "")).join(",")));
      downloadFile(CSV_FILENAME, lines.join("\\n"), "text/csv");
    }

    function csvEscape(value) {
      const text = String(value ?? "");
      return /[",\\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }

    function downloadFile(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    function render() {
      const saved = getSaved();
      const app = document.getElementById("app");

      if (!REVIEW_DATA.length) {
        app.innerHTML = '<div class="empty">No remaining items were found for this batch.</div>';
        return;
      }

      app.innerHTML = REVIEW_DATA.map((item) => {
        const current = normalizeDecision(saved[item.itemId]);
        const candidateChoices = (item.topCandidates || []).map((candidate) => {
          const checked = current.approvedQid === candidate.qid ? "checked" : "";
          return '<label class="choice"><input type="radio" name="decision-' + escapeHtml(item.itemId) + '" value="approved:' + escapeHtml(candidate.qid) + '" ' + checked + '><div><strong>Approve ' + escapeHtml(candidate.qid) + '</strong><div class="subtle">Question #' + escapeHtml(candidate.number) + ' · score ' + escapeHtml(candidate.score) + '</div></div></label>';
        }).join("");

        const noneChecked = current.noneOfThese ? "checked" : "";
        const createNewChecked = current.createNewQuestion ? "checked" : "";
        const unsureChecked = current.unsure ? "checked" : "";

        return '<section class="item" data-item-id="' + escapeHtml(item.itemId) + '">' +
          '<div class="item-head">' +
            '<div>' +
              '<h2>' + escapeHtml(item.itemId) + '</h2>' +
              '<div class="subtle">' + escapeHtml(item.sourceImage || "") + '</div>' +
              '<div class="pill-row">' +
                '<span class="pill ' + (item.sourceKind === "unresolved" ? "danger" : "warn") + '">' + escapeHtml(item.sourceKind) + '</span>' +
                '<span class="pill">Top qid ' + escapeHtml(item.currentTopQid || "none") + '</span>' +
                '<span class="pill">Top score ' + escapeHtml(item.currentTopScore ?? "none") + '</span>' +
                '<span class="pill">Top gap ' + escapeHtml(item.currentTopGap ?? "none") + '</span>' +
                '<span class="pill">Effective type ' + escapeHtml(item.analysis?.effectiveQuestionType || "unknown") + '</span>' +
                '<span class="pill">OCR ' + escapeHtml(item.ocrConfidence || "unknown") + '</span>' +
                '<span class="pill">Provisional topic ' + escapeHtml(item.provisionalTopic || "none") + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="subtle">' + escapeHtml(item.analysis?.explanation || item.reason || "") + '</div>' +
          '</div>' +
          '<div class="layout">' +
            '<div class="panel">' +
              '<h3>Screenshot</h3>' +
              renderImageBlock(item.screenshotPath, item.itemId, item.screenshotPath, 'Screenshot not found') +
              '<div class="meta">' +
                (item.reason ? '<div class="meta-row"><strong>Unresolved reason</strong><div class="prompt">' + escapeHtml(item.reason) + '</div></div>' : '') +
                renderMetaRow('Source filename', '<div class="prompt mono">' + escapeHtml(text(item.sourceImage)) + '</div>') +
                renderMetaRow('Prompt Raw JA', '<div class="prompt">' + escapeHtml(text(item.promptRawJa)) + '</div>') +
                renderMetaRow('Prompt Gloss EN', '<div class="prompt">' + escapeHtml(text(item.promptGlossEn)) + '</div>') +
                renderMetaRow('Options Raw JA', renderOptions(item.optionsRawJa)) +
                renderMetaRow('Options Gloss EN', renderOptions(item.optionsGlossEn)) +
                renderMetaRow('Visible answer data', renderFacts([
                  { label: 'correctKeyRaw', value: item.correctKeyRaw || 'None' },
                  { label: 'correctAnswerRaw', value: item.correctAnswerRaw || 'None' },
                  { label: 'ocrConfidence', value: item.ocrConfidence || 'unknown' },
                ])) +
                renderMetaRow('Provisional topic review metadata', renderFacts([
                  { label: 'topic', value: item.provisionalTopic || 'None' },
                  { label: 'subtopics', value: item.provisionalSubtopics || [] },
                  { label: 'topicConfidence', value: item.topicConfidence == null ? 'None' : item.topicConfidence },
                ]) + renderTopicSignals(item.topicSignals)) +
                renderMetaRow('Source concept slots', renderConceptSlots(item.sourceConceptSlots)) +
              '</div>' +
              '<div class="controls">' +
                '<h3>Review Decision</h3>' +
                '<div class="choice-list">' +
                  candidateChoices +
                  '<label class="choice"><input type="radio" name="decision-' + escapeHtml(item.itemId) + '" value="none" ' + noneChecked + '><div><strong>None of these</strong><div class="subtle">No candidate looks correct</div></div></label>' +
                  '<label class="choice"><input type="radio" name="decision-' + escapeHtml(item.itemId) + '" value="create-new" ' + createNewChecked + '><div><strong>Create new question</strong><div class="subtle">Stage this item as a superset-bank candidate instead of forcing an existing qid</div></div></label>' +
                  '<label class="choice"><input type="radio" name="decision-' + escapeHtml(item.itemId) + '" value="unsure" ' + unsureChecked + '><div><strong>Unsure</strong><div class="subtle">Keep for later review</div></div></label>' +
                '</div>' +
                '<label class="subtle" for="notes-' + escapeHtml(item.itemId) + '">Reviewer notes</label>' +
                '<textarea id="notes-' + escapeHtml(item.itemId) + '" data-role="notes">' + escapeHtml(current.reviewerNotes || "") + '</textarea>' +
              '</div>' +
            '</div>' +
            '<div class="candidate-list">' +
              (item.topCandidates || []).map((candidate) => {
                const correct = candidate.correctAnswer?.kind === "MCQ"
                  ? (candidate.correctAnswer.correctOptionKey || "?") + ". " + (candidate.correctAnswer.correctOptionText || "")
                  : candidate.correctAnswer?.correctRow || candidate.correctAnswer?.correctOptionText || "Unknown";
                const gapText = candidate.scoreGapFromTop == null
                  ? "No delta"
                  : candidate.scoreGapFromTop === 0 && item.currentTopGap != null
                    ? "top gap " + item.currentTopGap
                    : "-" + candidate.scoreGapFromTop + " from top";
                return '<article class="candidate">' +
                  '<div class="candidate-head">' +
                    '<div><h4>' + escapeHtml(candidate.qid) + ' · #' + escapeHtml(candidate.number) + '</h4><div class="subtle">' + escapeHtml(candidate.type) + '</div></div>' +
                    '<div class="score">score ' + escapeHtml(candidate.score) + ' · ' + escapeHtml(gapText) + '</div>' +
                  '</div>' +
                  '<div class="candidate-grid">' +
                    '<div>' +
                      renderMetaRow('English prompt', '<div class="prompt">' + escapeHtml(text(candidate.prompt)) + '</div>') +
                      renderMetaRow('English options', renderCandidateOptions(candidate.options)) +
                      renderMetaRow('Correct answer', '<div class="prompt">' + escapeHtml(text(correct)) + '</div>') +
                      renderAdvancedDiagnostics(candidate) +
                    '</div>' +
                    '<div>' +
                      '<div class="meta-row"><strong>Production image</strong>' +
                        renderImageBlock(candidate.candidateImagePath, candidate.qid, candidate.candidateImagePath, 'No production image') +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</article>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</section>';
      }).join("");

      bind();
    }

    function bind() {
      const saved = getSaved();
      document.querySelectorAll(".item").forEach((section) => {
        const itemId = section.getAttribute("data-item-id");
        section.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.addEventListener("change", () => {
            const raw = input.value;
            const next = normalizeDecision(saved[itemId]);
            if (raw.startsWith("approved:")) {
              next.approvedQid = raw.split(":")[1];
              next.noneOfThese = false;
              next.createNewQuestion = false;
              next.unsure = false;
            } else if (raw === "none") {
              next.approvedQid = "";
              next.noneOfThese = true;
              next.createNewQuestion = false;
              next.unsure = false;
            } else if (raw === "create-new") {
              next.approvedQid = "";
              next.noneOfThese = false;
              next.createNewQuestion = true;
              next.unsure = false;
            } else {
              next.approvedQid = "";
              next.noneOfThese = false;
              next.createNewQuestion = false;
              next.unsure = true;
            }
            saved[itemId] = next;
            save(saved);
          });
        });

        const notes = section.querySelector('textarea[data-role="notes"]');
        notes.addEventListener("input", () => {
          const next = normalizeDecision(saved[itemId]);
          next.reviewerNotes = notes.value;
          saved[itemId] = next;
          save(saved);
        });
      });
    }

    document.getElementById("export-json").addEventListener("click", exportJson);
    document.getElementById("export-csv").addEventListener("click", exportCsv);
    document.getElementById("clear-storage").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      render();
    });

    render();
  </script>
</body>
</html>`;
}

function relativeFromReports(absolutePath) {
  if (!absolutePath) {
    return null;
  }

  return path.relative(REPORTS_DIR, absolutePath).split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
