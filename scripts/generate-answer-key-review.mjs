#!/usr/bin/env node

import path from "node:path";

import {
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  booleanArg,
  getBatchFiles,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const htmlOnly = booleanArg(args, "html-only", false);
const previewPath = args["preview-path"]
  ? path.resolve(String(args["preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);

const previewDoc = readJson(previewPath);
const questions = previewDoc?.questions && typeof previewDoc.questions === "object"
  ? previewDoc.questions
  : {};
const batchFiles = getBatchFiles(lang, batchId);

const items = Object.entries(questions)
  .filter(([, entry]) => entry?.answerKeyNeedsManualConfirmation === true)
  .map(([qid, entry], index) => normalizeEntry({
    qid,
    entry,
    index,
    lang,
    batchId,
    batchDir: batchFiles.batchDir,
  }));

const decisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-answer-key-decisions.template.json`);
const htmlPath = path.join(REPORTS_DIR, `${lang}-${batchId}-answer-key-review.html`);

const decisionsTemplate = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourcePreviewPath: path.relative(process.cwd(), previewPath),
  items: items.map((item) => ({
    qid: item.qid,
    sourceItemId: item.sourceItemId ?? null,
    sourceImage: item.sourceImage ?? null,
    currentStagedLocaleCorrectOptionKey: item.localeCorrectOptionKey ?? null,
    confirmedCorrectOptionKey: item.localeCorrectOptionKey ?? null,
    unknown: item.localeCorrectOptionKey ? false : true,
    reviewerNotes: "",
  })),
};

if (!htmlOnly) {
  await writeJson(decisionsPath, decisionsTemplate);
}
await writeText(htmlPath, buildHtml({
  lang,
  batchId,
  dataset,
  items,
  decisionsPath,
  previewPath,
}));

console.log(`Wrote ${path.relative(process.cwd(), htmlPath)}.`);

function normalizeEntry({ qid, entry, index, lang: sourceLang, batchId: sourceBatchId, batchDir }) {
  const localeOptionOrder = Array.isArray(entry.localeOptionOrder) && entry.localeOptionOrder.length > 0
    ? entry.localeOptionOrder.map((option, optionIndex) => ({
      key: normalizeChoiceKey(option?.sourceKey, optionIndex),
      text: option?.sourceText ?? option?.sourceTextBody ?? null,
      gloss: option?.sourceGlossEn ?? null,
    }))
    : (Array.isArray(entry.optionsRawJa) ? entry.optionsRawJa : []).map((option, optionIndex) => ({
      key: normalizeChoiceKey(parseLeadingChoice(option), optionIndex),
      text: option ?? null,
      gloss: Array.isArray(entry.optionsGlossEn) ? entry.optionsGlossEn[optionIndex] ?? null : null,
    }));

  return {
    index: index + 1,
    qid,
    sourceItemId: entry.sourceItemId ?? null,
    sourceImage: entry.sourceImage ?? null,
    screenshotPath: entry.sourceImage
      ? relativeFromReports(path.join(batchDir, entry.sourceImage))
      : null,
    promptRawJa: entry.promptRawJa ?? entry.prompt ?? null,
    promptGlossEn: entry.promptGlossEn ?? null,
    optionsRawJa: localeOptionOrder,
    localeCorrectOptionKey: entry.localeCorrectOptionKey ?? null,
    canonicalCorrectMeaning: [
      entry.canonicalCorrectOptionId ?? null,
      entry.canonicalCorrectOptionKey ? `key ${entry.canonicalCorrectOptionKey}` : null,
    ].filter(Boolean).join(" · ") || null,
    canonicalCorrectOptionText:
      entry.correctOptionAlignment?.canonicalOptionText ??
      null,
    correctKeyRaw: entry.correctKeyRaw ?? null,
    correctAnswerRaw: entry.correctAnswerRaw ?? null,
    answerKeyConfirmationReason: entry.answerKeyConfirmationReason ?? null,
    sourceLang,
    sourceBatchId,
  };
}

function buildHtml({ lang, batchId, dataset, items, decisionsPath, previewPath }) {
  const embeddedItems = items;
  const storageKey = `qbank-answer-key-review-${lang}-${batchId}`;
  const exportFileName = `${lang}-${batchId}-answer-key-decisions.json`;
  const editablePath = path.relative(REPORTS_DIR, decisionsPath).split(path.sep).join("/");
  const previewRelative = path.relative(REPORTS_DIR, previewPath).split(path.sep).join("/");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(`${lang.toUpperCase()} ${batchId} Answer-Key Confirmation`)}</title>
  <style>
    :root {
      --bg: #f6f2ea;
      --paper: #fffdf9;
      --ink: #1f1a17;
      --muted: #6d6257;
      --line: #dbd1c3;
      --accent: #1b5e54;
      --accent-soft: #e7f1ef;
      --warn: #8c4f16;
      --warn-soft: #f8ead7;
      --shadow: 0 12px 28px rgba(42, 28, 11, 0.08);
      --radius: 16px;
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      color: var(--ink);
      background: linear-gradient(180deg, #f8f3ea 0%, #f1ece3 100%);
    }
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 48px;
    }
    .hero {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
      padding: 24px;
      margin-bottom: 20px;
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: 32px;
      line-height: 1.1;
    }
    .hero p {
      margin: 0 0 10px;
      color: var(--muted);
      line-height: 1.5;
    }
    .hero .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f3ede4;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 13px;
      color: var(--muted);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      background: var(--accent);
      color: white;
    }
    button.secondary {
      background: #e8dfd2;
      color: var(--ink);
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
    }
    .list {
      display: grid;
      gap: 14px;
    }
    .item {
      display: grid;
      grid-template-columns: minmax(240px, 320px) minmax(0, 1fr) 280px;
      gap: 14px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: var(--shadow);
      padding: 16px;
      align-items: start;
    }
    .screenshot-wrap, .details, .decision {
      min-width: 0;
    }
    .item-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .item-head h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
    }
    .qid {
      font-family: var(--mono);
      font-size: 15px;
      color: var(--accent);
    }
    .image-frame {
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      background: #f2ecdf;
      min-height: 190px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .image-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .image-fallback {
      padding: 18px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .image-path {
      margin-top: 8px;
      font-family: var(--mono);
      font-size: 12px;
      word-break: break-all;
    }
    .filename {
      margin-top: 10px;
      font-size: 13px;
      color: var(--muted);
      font-family: var(--mono);
      word-break: break-all;
    }
    .section {
      margin-bottom: 12px;
    }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 5px;
      display: block;
    }
    .prompt {
      font-size: 18px;
      line-height: 1.45;
      margin: 0;
    }
    .prompt-gloss {
      margin-top: 6px;
      font-size: 14px;
      line-height: 1.5;
      color: var(--muted);
    }
    .options {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .option {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fbf7f0;
      line-height: 1.4;
    }
    .option.current {
      border-color: var(--accent);
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px rgba(27, 94, 84, 0.12);
    }
    .option-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .option strong {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      color: var(--accent);
      font-family: var(--mono);
    }
    .option-ja {
      font-size: 15px;
      line-height: 1.45;
    }
    .option-gloss {
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--muted);
    }
    .mini-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      line-height: 1;
      border: 1px solid var(--line);
      background: #f3ede4;
      color: var(--muted);
      white-space: nowrap;
    }
    .mini-badge.current {
      border-color: rgba(27, 94, 84, 0.24);
      background: rgba(27, 94, 84, 0.1);
      color: var(--accent);
    }
    .fact-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .fact {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #faf5ed;
    }
    .fact .value {
      font-size: 15px;
      line-height: 1.4;
    }
    .fact.accent {
      border-color: rgba(27, 94, 84, 0.22);
      background: var(--accent-soft);
    }
    .fact .value.small {
      font-size: 13px;
      color: var(--muted);
    }
    .decision {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fcf8f1;
      padding: 14px;
      position: sticky;
      top: 14px;
    }
    .decision h3 {
      margin: 0 0 10px;
      font-size: 18px;
    }
    .choice-list {
      display: grid;
      gap: 8px;
      margin: 0 0 14px;
      padding: 0;
      list-style: none;
    }
    .choice-list label {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 9px 10px;
      background: white;
      cursor: pointer;
    }
    .choice-list input[type="radio"] {
      margin: 0;
    }
    textarea {
      width: 100%;
      min-height: 78px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      resize: vertical;
      background: white;
    }
    .reason {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--warn-soft);
      color: var(--warn);
      font-size: 13px;
      line-height: 1.45;
    }
    .mono { font-family: var(--mono); }
    @media (max-width: 980px) {
      .item {
        grid-template-columns: 1fr;
      }
      .decision {
        position: static;
      }
      .fact-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(lang.toUpperCase())} Answer-Key Confirmation</h1>
      <p>Only items with <span class="mono">answerKeyNeedsManualConfirmation === true</span> from the staged preview are shown here. This page is self-contained for <span class="mono">file://</span> review and does not rematch qids or touch production translations.</p>
      <div class="meta">
        <span class="pill">Batch <strong>${escapeHtml(batchId)}</strong></span>
        <span class="pill">Dataset <strong>${escapeHtml(dataset)}</strong></span>
        <span class="pill">${items.length} item(s)</span>
      </div>
      <div class="controls">
        <button id="export-json">Export Decisions JSON</button>
        <button id="reset" class="secondary">Reset Local Edits</button>
        <span class="hint">Editable file: <span class="mono">${escapeHtml(editablePath)}</span>. Source preview: <span class="mono">${escapeHtml(previewRelative)}</span>.</span>
      </div>
    </section>
    <section class="list" id="list"></section>
  </div>
  <script>
    const ITEMS = ${JSON.stringify(embeddedItems)};
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const EXPORT_FILE_NAME = ${JSON.stringify(exportFileName)};
    const DEFAULT_STATE = ITEMS.map((item) => ({
      qid: item.qid,
      sourceItemId: item.sourceItemId || null,
      sourceImage: item.sourceImage || null,
      currentStagedLocaleCorrectOptionKey: item.localeCorrectOptionKey || null,
      confirmedCorrectOptionKey: item.localeCorrectOptionKey || null,
      unknown: item.localeCorrectOptionKey ? false : true,
      reviewerNotes: "",
    }));

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function cloneDefaultState() {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return cloneDefaultState();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return cloneDefaultState();
        const byQid = new Map(parsed.map((row) => [row.qid, row]));
        return DEFAULT_STATE.map((row) => ({
          ...row,
          ...(byQid.get(row.qid) || {}),
        }));
      } catch {
        return cloneDefaultState();
      }
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function download(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    function exportJson() {
      const payload = {
        exportedAt: new Date().toISOString(),
        batch: {
          lang: ${JSON.stringify(lang)},
          batchId: ${JSON.stringify(batchId)},
          dataset: ${JSON.stringify(dataset)},
          scope: "answer-key-confirmation",
        },
        items: state.map((row) => ({
          qid: row.qid,
          sourceItemId: row.sourceItemId || null,
          sourceImage: row.sourceImage || null,
          currentStagedLocaleCorrectOptionKey: row.currentStagedLocaleCorrectOptionKey || null,
          confirmedCorrectOptionKey: row.unknown ? null : (row.confirmedCorrectOptionKey || null),
          unknown: row.unknown === true,
          reviewerNotes: row.reviewerNotes || "",
        })),
      };
      download(EXPORT_FILE_NAME, JSON.stringify(payload, null, 2) + "\\n", "application/json");
    }

    function renderImage(src, alt, localPath) {
      if (!src) {
        return '<div class="image-frame"><div class="image-fallback">Screenshot not found</div></div>';
      }
      return '<div class="image-frame">' +
        '<img src="' + encodeURI(src) + '" alt="' + escapeHtml(alt) + '" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'block\\';">' +
        '<div class="image-fallback" style="display:none;">Unable to load screenshot<div class="image-path">' + escapeHtml(localPath || src) + '</div></div>' +
      '</div>';
    }

    function renderOption(option, item) {
      const isCurrent = item.localeCorrectOptionKey && option.key === item.localeCorrectOptionKey;
      return '<li class="option' + (isCurrent ? ' current' : '') + '">' +
        '<div class="option-head">' +
          '<strong>' + escapeHtml(option.key || '?') + '</strong>' +
          (isCurrent ? '<span class="mini-badge current">Current staged key</span>' : '') +
        '</div>' +
        '<div class="option-ja">' + escapeHtml(option.text || '') + '</div>' +
        (option.gloss ? '<div class="option-gloss">' + escapeHtml(option.gloss) + '</div>' : '') +
      '</li>';
    }

    function renderItem(item, decision) {
      const visibleAnswer = [item.correctKeyRaw, item.correctAnswerRaw].filter(Boolean).join(' / ');
      const choices = ['A', 'B', 'C', 'D', 'unknown'].map((choice) => {
        const checked = choice === 'unknown'
          ? decision.unknown === true
          : decision.unknown !== true && decision.confirmedCorrectOptionKey === choice;
        return '<li><label><input type="radio" name="choice-' + escapeHtml(item.qid) + '" value="' + escapeHtml(choice) + '"' + (checked ? ' checked' : '') + '>' +
          '<span>' + escapeHtml(choice.toUpperCase()) + '</span></label></li>';
      }).join('');

      return '<article class="item" data-qid="' + escapeHtml(item.qid) + '">' +
        '<div class="screenshot-wrap">' +
          '<div class="item-head"><h2>' + escapeHtml(item.qid) + '</h2><span class="qid">#' + String(item.index).padStart(2, '0') + '</span></div>' +
          renderImage(item.screenshotPath, item.qid, item.screenshotPath) +
          '<div class="filename">' + escapeHtml(item.sourceImage || '') + '</div>' +
        '</div>' +
        '<div class="details">' +
          '<div class="section"><span class="label">Japanese Prompt</span><p class="prompt">' + escapeHtml(item.promptRawJa || '') + '</p>' +
            (item.promptGlossEn ? '<div class="prompt-gloss">' + escapeHtml(item.promptGlossEn) + '</div>' : '') +
          '</div>' +
          '<div class="section"><span class="label">Japanese Options</span><ol class="options">' + item.optionsRawJa.map((option) => renderOption(option, item)).join('') + '</ol></div>' +
          '<div class="fact-grid">' +
            '<div class="fact"><span class="label">Current Staged Key</span><div class="value mono">' + escapeHtml(item.localeCorrectOptionKey || 'unknown') + '</div></div>' +
            '<div class="fact accent"><span class="label">Canonical Correct Meaning</span><div class="value mono">' + escapeHtml(item.canonicalCorrectMeaning || '') + '</div></div>' +
            '<div class="fact accent"><span class="label">Canonical English Option</span><div class="value">' + escapeHtml(item.canonicalCorrectOptionText || '') + '</div></div>' +
            '<div class="fact"><span class="label">Visible Source Answer</span><div class="value">' + escapeHtml(visibleAnswer || 'Not visible') + '</div></div>' +
          '</div>' +
          '<div class="reason">' + escapeHtml(item.answerKeyConfirmationReason || 'Manual answer-key confirmation requested.') + '</div>' +
        '</div>' +
        '<aside class="decision">' +
          '<h3>Confirm Key</h3>' +
          '<ol class="choice-list">' + choices + '</ol>' +
          '<label class="label" for="notes-' + escapeHtml(item.qid) + '">Reviewer Notes</label>' +
          '<textarea id="notes-' + escapeHtml(item.qid) + '" data-notes-for="' + escapeHtml(item.qid) + '">' + escapeHtml(decision.reviewerNotes || '') + '</textarea>' +
        '</aside>' +
      '</article>';
    }

    function render() {
      const byQid = new Map(state.map((row) => [row.qid, row]));
      document.getElementById('list').innerHTML = ITEMS.map((item) => renderItem(item, byQid.get(item.qid))).join('');

      for (const input of document.querySelectorAll('input[type="radio"]')) {
        input.addEventListener('change', (event) => {
          const article = event.target.closest('[data-qid]');
          const qid = article?.dataset?.qid;
          const row = state.find((entry) => entry.qid === qid);
          if (!row) return;
          if (event.target.value === 'unknown') {
            row.unknown = true;
            row.confirmedCorrectOptionKey = null;
          } else {
            row.unknown = false;
            row.confirmedCorrectOptionKey = event.target.value;
          }
          saveState();
        });
      }

      for (const textarea of document.querySelectorAll('textarea[data-notes-for]')) {
        textarea.addEventListener('input', (event) => {
          const qid = event.target.getAttribute('data-notes-for');
          const row = state.find((entry) => entry.qid === qid);
          if (!row) return;
          row.reviewerNotes = event.target.value;
          saveState();
        });
      }
    }

    let state = loadState();
    render();

    document.getElementById('export-json').addEventListener('click', exportJson);
    document.getElementById('reset').addEventListener('click', () => {
      state = cloneDefaultState();
      saveState();
      render();
    });
  </script>
</body>
</html>`;
}

function relativeFromReports(absolutePath) {
  return path.relative(REPORTS_DIR, absolutePath).split(path.sep).join("/");
}

function normalizeChoiceKey(value, index) {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^[A-D]$/.test(text)) {
    return text;
  }

  return String.fromCharCode(65 + index);
}

function parseLeadingChoice(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^([A-D])(?:[\s.:：、．\)\]-]|$)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
