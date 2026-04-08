#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  getBatchFiles,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const qid = String(args.qid ?? "q0466").trim();

await ensurePipelineDirs({ lang, batchId });

const batchFiles = getBatchFiles(lang, batchId);
const matchedPath = args["matched-path"]
  ? path.resolve(String(args["matched-path"]))
  : batchFiles.matchedPath;
const previewPath = args["preview-path"]
  ? path.resolve(String(args["preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.preview.json`);
const reportPath = args["report-path"]
  ? path.resolve(String(args["report-path"]))
  : path.join(REPORTS_DIR, `full-batch-merge-review-${lang}-${batchId}.json`);

const htmlPath = path.join(REPORTS_DIR, `${lang}-${batchId}-${qid}-answer-key-review.html`);
const decisionTemplatePath = path.join(STAGING_DIR, `${lang}-${batchId}-${qid}-answer-key-decision.template.json`);

const matchedDoc = readJson(matchedPath);
const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
const matchedItem = matchedItems.find((item) => String(item?.match?.qid ?? "").trim() === qid);
if (!matchedItem) {
  throw new Error(`Matched item for ${qid} not found in ${path.relative(process.cwd(), matchedPath)}.`);
}

const previewDoc = readJson(previewPath);
const previewEntry = previewDoc?.questions?.[qid];
if (!previewEntry || typeof previewEntry !== "object") {
  throw new Error(`Preview entry for ${qid} not found in ${path.relative(process.cwd(), previewPath)}.`);
}

const reportDoc = readJson(reportPath);
const blocker = Array.isArray(reportDoc.blockers)
  ? reportDoc.blockers.find((entry) => String(entry?.qid ?? "").trim() === qid) ?? null
  : null;

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const question = context.questions.find((entry) => entry.qid === qid);
if (!question) {
  throw new Error(`Canonical qid ${qid} not found in dataset ${dataset}.`);
}

const screenshotPath = matchedItem.sourceImage
  ? path.relative(REPORTS_DIR, path.join(batchFiles.batchDir, matchedItem.sourceImage)).split(path.sep).join("/")
  : null;

const item = {
  qid,
  number: question.number ?? null,
  sourceImage: matchedItem.sourceImage ?? null,
  screenshotPath,
  promptRawJa: previewEntry.promptRawJa ?? matchedItem.promptRawJa ?? null,
  promptGlossEn: previewEntry.promptGlossEn ?? matchedItem.promptGlossEn ?? null,
  options: buildSourceOptions(previewEntry, matchedItem),
  currentStagedLocaleCorrectOptionKey: previewEntry.localeCorrectOptionKey ?? null,
  canonicalPrompt: question.prompt ?? null,
  canonicalCorrectOptionId: question.correctAnswer?.correctOptionId ?? null,
  canonicalCorrectOptionKey: question.correctAnswer?.correctOptionKey ?? null,
  canonicalCorrectOptionText: question.correctAnswer?.correctOptionText ?? null,
  blockerReasons: blocker?.reasons ?? [],
  answerKeyConfirmationReason: previewEntry.answerKeyConfirmationReason ?? null,
  sourceMatchedPath: path.relative(process.cwd(), matchedPath),
  sourcePreviewPath: path.relative(process.cwd(), previewPath),
  sourceReportPath: path.relative(process.cwd(), reportPath),
};

const decisionTemplate = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  qid,
  sourceMatchedPath: item.sourceMatchedPath,
  sourcePreviewPath: item.sourcePreviewPath,
  sourceReportPath: item.sourceReportPath,
  item: {
    qid,
    sourceItemId: previewEntry.sourceItemId ?? matchedItem.itemId ?? null,
    sourceImage: matchedItem.sourceImage ?? null,
    currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
    confirmedCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
    unknown: item.currentStagedLocaleCorrectOptionKey ? false : true,
    reviewerNotes: "",
  },
};

await writeJson(decisionTemplatePath, decisionTemplate);
await writeText(htmlPath, buildHtml({
  dataset,
  lang,
  batchId,
  item,
  decisionTemplatePath,
}));

console.log(`Wrote ${path.relative(process.cwd(), htmlPath)} and ${path.relative(process.cwd(), decisionTemplatePath)}.`);

function buildSourceOptions(previewEntryInput, matchedItemInput) {
  const localeOptionOrder = Array.isArray(previewEntryInput.localeOptionOrder) ? previewEntryInput.localeOptionOrder : [];
  if (localeOptionOrder.length > 0) {
    return localeOptionOrder.map((entry, index) => ({
      key: normalizeChoiceKey(entry?.sourceKey, index),
      text: entry?.sourceText ?? null,
      gloss: entry?.sourceGlossEn ?? null,
      isCurrentStaged: normalizeChoiceKey(entry?.sourceKey, index) === normalizeChoiceKey(previewEntryInput.localeCorrectOptionKey),
    }));
  }

  const raw = Array.isArray(matchedItemInput.optionsRawJa) ? matchedItemInput.optionsRawJa : [];
  const gloss = Array.isArray(matchedItemInput.optionsGlossEn) ? matchedItemInput.optionsGlossEn : [];
  return raw.map((text, index) => ({
    key: normalizeChoiceKey(parseLeadingChoice(text), index),
    text,
    gloss: gloss[index] ?? null,
    isCurrentStaged: normalizeChoiceKey(parseLeadingChoice(text), index) === normalizeChoiceKey(previewEntryInput.localeCorrectOptionKey),
  }));
}

function buildHtml({ dataset: sourceDataset, lang: sourceLang, batchId: sourceBatchId, item: reviewItem, decisionTemplatePath: templatePath }) {
  const templateRelative = path.relative(REPORTS_DIR, templatePath).split(path.sep).join("/");
  const selectedKey = reviewItem.currentStagedLocaleCorrectOptionKey ?? "unknown";
  const optionsMarkup = reviewItem.options.map((option) => `
      <label class="option ${option.isCurrentStaged ? "option-current" : ""}">
        <div class="option-key">${escapeHtml(option.key)}</div>
        <div class="option-copy">
          <div class="option-ja">${escapeHtml(option.text ?? "")}</div>
          <div class="option-en">${escapeHtml(option.gloss ?? "")}</div>
        </div>
      </label>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(`${reviewItem.qid} manual answer-key review`)}</title>
  <style>
    :root {
      --bg: #f5f0e8;
      --paper: #fffdf8;
      --ink: #1f1a16;
      --muted: #6f6356;
      --line: #ddd1c0;
      --accent: #145a52;
      --accent-soft: #e6f2f0;
      --warn: #855111;
      --warn-soft: #f6ead7;
      --shadow: 0 14px 28px rgba(42, 30, 17, 0.08);
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: linear-gradient(180deg, #f8f3ea 0%, #f1ebe1 100%);
      color: var(--ink);
    }
    .page {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }
    .hero, .card {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 22px;
      margin-bottom: 18px;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      font-size: 30px;
      line-height: 1.1;
      margin-bottom: 10px;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 14px 0 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 999px;
      background: #f3ebe0;
      border: 1px solid var(--line);
      font-size: 13px;
      color: var(--muted);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      gap: 16px;
    }
    .card {
      padding: 18px;
    }
    .card h2 {
      font-size: 21px;
      margin-bottom: 12px;
    }
    .image-frame {
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      background: #f0e9de;
      min-height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .image-frame img {
      display: block;
      width: 100%;
      height: auto;
    }
    .image-fallback {
      padding: 14px;
      text-align: center;
      color: var(--muted);
      line-height: 1.45;
      font-size: 14px;
      word-break: break-word;
    }
    .kv {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .kv-row {
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcf8f1;
    }
    .kv-label {
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 5px;
    }
    .kv-value {
      line-height: 1.45;
      word-break: break-word;
    }
    .gloss {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }
    .canonical-box {
      border: 1px solid #cfe1dd;
      background: var(--accent-soft);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 14px;
    }
    .canonical-box h3 {
      margin-bottom: 8px;
      font-size: 16px;
      color: var(--accent);
    }
    .canonical-answer {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(20, 90, 82, 0.08);
      border: 1px solid rgba(20, 90, 82, 0.18);
    }
    .warn {
      border: 1px solid #e5cfac;
      background: var(--warn-soft);
      color: var(--warn);
      border-radius: 16px;
      padding: 12px 14px;
      line-height: 1.5;
      margin-bottom: 14px;
    }
    .options {
      display: grid;
      gap: 10px;
    }
    .option {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcfaf6;
    }
    .option-current {
      border-color: #a7cbc6;
      background: #eef7f5;
    }
    .option-key {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #ece3d8;
      font-family: var(--mono);
      font-size: 15px;
    }
    .option-current .option-key {
      background: var(--accent);
      color: white;
    }
    .option-ja {
      font-size: 16px;
      line-height: 1.45;
    }
    .option-en {
      margin-top: 4px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin: 14px 0 10px;
    }
    .choice {
      border: 1px solid var(--line);
      background: #f9f3ea;
      border-radius: 12px;
      padding: 10px 8px;
      text-align: center;
      font-family: var(--mono);
      font-size: 14px;
    }
    .choice.is-selected {
      border-color: #a7cbc6;
      background: #eef7f5;
      color: var(--accent);
      font-weight: 700;
    }
    .mono {
      font-family: var(--mono);
      font-size: 13px;
    }
    .footnote {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(reviewItem.qid)} answer-key confirmation</h1>
      <p>Choose the Japanese option key whose meaning matches the canonical correct meaning. Do not assume the Japanese answer letter should match the English master letter.</p>
      <div class="meta">
        <span class="pill">Dataset: ${escapeHtml(sourceDataset)}</span>
        <span class="pill">Locale: ${escapeHtml(sourceLang)}</span>
        <span class="pill">Batch: ${escapeHtml(sourceBatchId)}</span>
        <span class="pill">Question #: ${escapeHtml(String(reviewItem.number ?? ""))}</span>
        <span class="pill">Current staged key: ${escapeHtml(reviewItem.currentStagedLocaleCorrectOptionKey ?? "unknown")}</span>
      </div>
    </section>

    <div class="layout">
      <section class="card">
        <h2>Source Screenshot</h2>
        <div class="image-frame">
          ${reviewItem.screenshotPath ? `<img src="${escapeHtml(reviewItem.screenshotPath)}" alt="${escapeHtml(reviewItem.sourceImage ?? reviewItem.qid)}" onerror="this.replaceWith(buildFallback(${JSON.stringify(reviewItem.sourceImage ?? "")}))">` : `<div class="image-fallback">No screenshot path available.</div>`}
        </div>
        <div class="kv">
          <div class="kv-row">
            <div class="kv-label">Source filename</div>
            <div class="kv-value mono">${escapeHtml(reviewItem.sourceImage ?? "n/a")}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Japanese prompt</div>
            <div class="kv-value">${escapeHtml(reviewItem.promptRawJa ?? "")}</div>
            <div class="gloss">${escapeHtml(reviewItem.promptGlossEn ?? "")}</div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="canonical-box">
          <h3>Canonical/master question meaning</h3>
          <div>${escapeHtml(reviewItem.canonicalPrompt ?? "")}</div>
          <div class="canonical-answer">
            <div><strong>Canonical correct meaning:</strong> ${escapeHtml(reviewItem.canonicalCorrectOptionText ?? "")}</div>
            <div class="gloss">Master correct option: ${escapeHtml(reviewItem.canonicalCorrectOptionKey ?? "n/a")} ${reviewItem.canonicalCorrectOptionId ? `· ${escapeHtml(reviewItem.canonicalCorrectOptionId)}` : ""}</div>
          </div>
        </div>

        <div class="warn">
          <strong>Why this needs review:</strong> ${escapeHtml(reviewItem.answerKeyConfirmationReason ?? "Manual answer-key confirmation required.")}<br>
          ${reviewItem.blockerReasons.length > 0 ? `<span class="mono">Blocker flags: ${escapeHtml(reviewItem.blockerReasons.join(", "))}</span>` : ""}
        </div>

        <h2>Japanese options in official order</h2>
        <div class="options">${optionsMarkup}</div>

        <div class="kv" style="margin-top:14px;">
          <div class="kv-row">
            <div class="kv-label">What you should choose</div>
            <div class="kv-value">Pick <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, <strong>D</strong>, or <strong>unknown</strong> based on which Japanese option matches the canonical correct meaning above.</div>
            <div class="choice-grid">
              <div class="choice ${selectedKey === "A" ? "is-selected" : ""}">A</div>
              <div class="choice ${selectedKey === "B" ? "is-selected" : ""}">B</div>
              <div class="choice ${selectedKey === "C" ? "is-selected" : ""}">C</div>
              <div class="choice ${selectedKey === "D" ? "is-selected" : ""}">D</div>
              <div class="choice ${selectedKey === "unknown" ? "is-selected" : ""}">unknown</div>
            </div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Decision file to edit</div>
            <div class="kv-value mono">${escapeHtml(templateRelative)}</div>
          </div>
          <div class="kv-row">
            <div class="kv-label">Template fields</div>
            <div class="kv-value mono">item.confirmedCorrectOptionKey = "A" | "B" | "C" | "D"<br>item.unknown = true if you cannot confirm<br>item.reviewerNotes = optional note</div>
          </div>
        </div>

        <p class="footnote">This page is review-only. It does not apply any decision. Update the JSON template after you confirm the correct Japanese locale answer key.</p>
      </section>
    </div>
  </div>
  <script>
    function buildFallback(pathText) {
      const box = document.createElement('div');
      box.className = 'image-fallback';
      box.innerHTML = '<strong>Screenshot could not be loaded.</strong><br>' + escapeHtmlClient(pathText || 'No local path available.');
      return box;
    }
    function escapeHtmlClient(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;
}

function normalizeChoiceKey(value, index = 0) {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^[A-D]$/.test(text)) {
    return text;
  }

  return String.fromCharCode(65 + index);
}

function parseLeadingChoice(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^([A-D])[\s.:：、．\)\]-]+/i);
  return match ? match[1].toUpperCase() : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
