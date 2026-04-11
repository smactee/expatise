#!/usr/bin/env node

import path from "node:path";

import {
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  getBatchFiles,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const batchFiles = getBatchFiles(lang, batchId);
const unresolvedPath = batchFiles.unresolvedPath;
const htmlPath = path.join(REPORTS_DIR, `${lang}-${batchId}-unresolved-review.html`);
const decisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-unresolved-decisions.template.json`);
const manifestPath = path.join(REPORTS_DIR, `${lang}-${batchId}-unresolved-review.manifest.json`);

const unresolvedDoc = readJson(unresolvedPath);
const rawItems = Array.isArray(unresolvedDoc.items) ? unresolvedDoc.items : [];
const items = rawItems.map((item, index) => normalizeItem(item, index, batchFiles.batchDir));

const decisionsTemplate = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceUnresolvedPath: path.relative(process.cwd(), unresolvedPath),
  items: items.map((item) => ({
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    approvedQid: null,
    createNewQuestion: item.recommendedAction === "likely-new-question-candidate",
    keepUnresolved: item.recommendedAction !== "likely-new-question-candidate",
    reviewerNotes: "",
    recommendedAction: item.recommendedAction,
  })),
};

await writeJson(decisionsPath, decisionsTemplate);
await writeText(
  htmlPath,
  buildHtml({
    lang,
    batchId,
    dataset,
    items,
    decisionsPath: relativeFromReports(decisionsPath),
  }),
);
await writeJson(manifestPath, {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceUnresolvedPath: path.relative(process.cwd(), unresolvedPath),
  outputs: {
    html: path.relative(process.cwd(), htmlPath),
    decisionsTemplateJson: path.relative(process.cwd(), decisionsPath),
  },
  counts: summarize(items),
});

console.log(`Wrote ${path.relative(process.cwd(), htmlPath)}.`);

function normalizeItem(item, index, batchDir) {
  const topCandidates = Array.isArray(item.topCandidates) ? item.topCandidates : [];
  const topScore = Number(item.analysis?.topScore ?? topCandidates[0]?.score ?? 0);

  const normalizedCandidates = topCandidates.slice(0, 3).map((candidate) => ({
    qid: candidate.qid ?? null,
    number: candidate.number ?? null,
    type: candidate.type ?? null,
    score: candidate.score ?? null,
    scoreGapFromTop:
      Number.isFinite(topScore) && Number.isFinite(Number(candidate.score))
        ? roundNumber(topScore - Number(candidate.score))
        : null,
    prompt: candidate.prompt ?? null,
    options: Array.isArray(candidate.options) ? candidate.options : [],
    correctAnswer: candidate.correctAnswer ?? null,
    diagnostics: candidate.diagnostics ?? null,
    imagePath: candidate.image?.currentAssetSrc
      ? relativeFromReports(path.join(process.cwd(), "public", candidate.image.currentAssetSrc.replace(/^\//, "")))
      : null,
  }));

  return {
    index: index + 1,
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    screenshotPath: item.sourceImage
      ? relativeFromReports(path.join(batchDir, item.sourceImage))
      : null,
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: Array.isArray(item.optionsRawJa) ? item.optionsRawJa : [],
    optionsGlossEn: Array.isArray(item.optionsGlossEn) ? item.optionsGlossEn : [],
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    reason: item.reason ?? null,
    analysis: item.analysis ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topCandidates: normalizedCandidates,
    recommendedAction: classifyUnresolvedItem(item),
  };
}

function classifyUnresolvedItem(item) {
  const analysis = item.analysis ?? {};
  const topCandidates = Array.isArray(item.topCandidates) ? item.topCandidates : [];
  const topGap = Number(analysis.topGap ?? 0);
  const topScore = Number(analysis.topScore ?? topCandidates[0]?.score ?? 0);
  const plausibleShortlist = analysis.plausibleShortlist === true;

  if (plausibleShortlist && topScore >= 40 && topGap >= 1.5) {
    return "possible-existing-qid-rescue";
  }

  if (!plausibleShortlist && topScore < 38) {
    return "likely-new-question-candidate";
  }

  return "still-unclear";
}

function summarize(items) {
  const summary = {
    total: items.length,
    possibleExistingQidRescue: 0,
    likelyNewQuestionCandidate: 0,
    stillUnclear: 0,
  };

  for (const item of items) {
    if (item.recommendedAction === "possible-existing-qid-rescue") {
      summary.possibleExistingQidRescue += 1;
    } else if (item.recommendedAction === "likely-new-question-candidate") {
      summary.likelyNewQuestionCandidate += 1;
    } else {
      summary.stillUnclear += 1;
    }
  }

  return summary;
}

function buildHtml({ lang, batchId, dataset, items, decisionsPath }) {
  const counts = summarize(items);
  const payload = items;
  const exportFileName = `${lang}-${batchId}-unresolved-decisions.json`;
  const storageKey = `qbank-unresolved-review-${lang}-${batchId}`;
  const embeddedPayload = serializeJsonForInlineScript(payload);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(`${lang.toUpperCase()} ${batchId} Unresolved Review`)}</title>
  <style>
    :root {
      --bg: #f4f0e8;
      --paper: #fffdf8;
      --ink: #1f1a17;
      --muted: #6d6257;
      --line: #d8cec1;
      --accent: #165d52;
      --accent-soft: #e4f2ef;
      --warn: #8c4f16;
      --warn-soft: #f8ead7;
      --danger: #842029;
      --danger-soft: #f8d7da;
      --note: #5541a6;
      --note-soft: #ece8ff;
      --shadow: 0 12px 28px rgba(38, 25, 10, 0.08);
      --radius: 18px;
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: linear-gradient(180deg, #f8f3ea 0%, #f1ece3 100%);
      color: var(--ink);
      font-family: var(--sans);
    }
    .page {
      max-width: 1220px;
      margin: 0 auto;
      padding: 28px 18px 48px;
    }
    .hero {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
      padding: 24px;
      margin-bottom: 18px;
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: 32px;
      line-height: 1.1;
    }
    .hero p {
      margin: 0 0 8px;
      color: var(--muted);
      line-height: 1.5;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 13px;
      border: 1px solid var(--line);
      background: #f3ede4;
      color: var(--muted);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 16px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
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
      grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) 290px;
      gap: 14px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: var(--shadow);
      padding: 16px;
      align-items: start;
    }
    .item h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
    }
    .item-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .qid {
      font-family: var(--mono);
      color: var(--accent);
      font-size: 14px;
    }
    .image-frame {
      min-height: 180px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #f1ebdf;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-frame img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .fallback {
      padding: 16px;
      font-size: 13px;
      color: var(--muted);
      text-align: center;
      line-height: 1.45;
    }
    .path {
      margin-top: 10px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      word-break: break-all;
    }
    .section {
      border-top: 1px solid var(--line);
      padding-top: 10px;
      margin-top: 10px;
    }
    .label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .ja {
      font-size: 18px;
      line-height: 1.45;
    }
    .gloss {
      margin-top: 4px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .option-list {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .option {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      background: #fcfaf5;
    }
    .option .ja {
      font-size: 15px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 12px;
      font-family: var(--mono);
      border: 1px solid transparent;
    }
    .badge-rescue { background: var(--accent-soft); color: var(--accent); border-color: #b7d8d1; }
    .badge-new { background: var(--warn-soft); color: var(--warn); border-color: #e7c49b; }
    .badge-unclear { background: var(--note-soft); color: var(--note); border-color: #cfc6ff; }
    .reason {
      border: 1px solid #ead8c3;
      background: #f9f1e6;
      border-radius: 12px;
      padding: 10px 12px;
      color: #6e4e30;
      line-height: 1.45;
    }
    .candidate-list {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }
    .candidate {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcfaf6;
      padding: 12px;
    }
    .candidate-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px 10px;
      margin-bottom: 6px;
    }
    .candidate-head strong {
      font-family: var(--mono);
      color: var(--accent);
    }
    .score {
      font-family: var(--mono);
      color: var(--muted);
      font-size: 13px;
    }
    .candidate-options {
      display: grid;
      gap: 6px;
      margin-top: 8px;
    }
    .candidate-option {
      border-left: 3px solid #ddd1c2;
      padding-left: 8px;
      color: var(--ink);
      font-size: 14px;
      line-height: 1.4;
    }
    .candidate-image {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: #f1ebdf;
      min-height: 80px;
    }
    .candidate-image img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .decision {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #faf5ee;
      padding: 14px;
      position: sticky;
      top: 16px;
    }
    .decision h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .choice-group {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .choice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 14px;
      line-height: 1.4;
    }
    .choice input[type="radio"] {
      margin-top: 2px;
    }
    .text-input {
      width: 100%;
      margin-top: 10px;
      min-height: 84px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      background: #fffdfa;
    }
    .small {
      font-size: 12px;
      color: var(--muted);
    }
    @media (max-width: 1040px) {
      .item {
        grid-template-columns: 1fr;
      }
      .decision {
        position: static;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(`${lang.toUpperCase()} ${batchId} Unresolved Review`)}</h1>
      <p>These 4 items were left unresolved after the normal matcher pass. This page is for manual rescue only: match to an existing qid if the evidence is strong, stage as a new question if it looks genuinely new, or leave it unresolved.</p>
      <p class="hint">No production files are modified from this page. Candidate evidence is shown for review only.</p>
      <div class="meta">
        <span class="pill">Dataset: <strong>${escapeHtml(dataset)}</strong></span>
        <span class="pill">Items: <strong>${items.length}</strong></span>
        <span class="pill">Possible existing-qid rescue: <strong>${counts.possibleExistingQidRescue}</strong></span>
        <span class="pill">Likely new-question candidate: <strong>${counts.likelyNewQuestionCandidate}</strong></span>
        <span class="pill">Still unclear: <strong>${counts.stillUnclear}</strong></span>
      </div>
      <div class="controls">
        <button type="button" id="export-json">Export Decisions JSON</button>
        <button type="button" class="secondary" id="reset-local">Reset Local Decisions</button>
        <span class="hint">Save the exported file as <code>${escapeHtml(path.basename(decisionsPath))}</code>.</span>
      </div>
    </section>

    <section class="list" id="list"></section>
  </div>

  <script>
    const items = ${embeddedPayload};
    const storageKey = ${JSON.stringify(storageKey)};
    const exportFileName = ${JSON.stringify(exportFileName)};
    const decisionsPath = ${JSON.stringify(decisionsPath)};
    const actionLabels = {
      "possible-existing-qid-rescue": "Possible Existing-Qid Rescue",
      "likely-new-question-candidate": "Likely New-Question Candidate",
      "still-unclear": "Still Unclear"
    };

    const actionClasses = {
      "possible-existing-qid-rescue": "badge-rescue",
      "likely-new-question-candidate": "badge-new",
      "still-unclear": "badge-unclear"
    };

    const state = loadState();
    const list = document.getElementById("list");
    for (const item of items) {
      list.appendChild(renderItem(item));
    }

    document.getElementById("export-json").addEventListener("click", () => {
      const body = {
        exportedAt: new Date().toISOString(),
        batch: {
          lang: ${JSON.stringify(lang)},
          batchId: ${JSON.stringify(batchId)},
          scope: "unresolved-only"
        },
        sourceDecisionsTemplatePath: decisionsPath,
        items: items.map((item) => {
          const draft = state[item.itemId] || {};
          return {
            itemId: item.itemId,
            sourceImage: item.sourceImage || null,
            approvedQid: normalizeString(draft.approvedQid),
            createNewQuestion: draft.decision === "createNewQuestion",
            keepUnresolved: draft.decision === "keepUnresolved" || !draft.decision,
            reviewerNotes: normalizeString(draft.reviewerNotes) || "",
            recommendedAction: item.recommendedAction
          };
        })
      };

      const blob = new Blob([JSON.stringify(body, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("reset-local").addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      location.reload();
    });

    function renderItem(item) {
      const article = document.createElement("article");
      article.className = "item";
      const draft = state[item.itemId] || {};
      const actionClass = actionClasses[item.recommendedAction] || "badge-unclear";

      article.innerHTML = \`
        <div class="left">
          <div class="item-head">
            <h2>Item \${item.index}</h2>
            <span class="qid">\${escapeHtml(item.itemId)}</span>
          </div>
          <div class="image-frame">
            \${item.screenshotPath ? \`<img src="\${escapeAttr(item.screenshotPath)}" alt="\${escapeAttr(item.itemId)}" onerror="this.remove(); this.parentElement.innerHTML = '<div class=&quot;fallback&quot;>Screenshot preview unavailable.<div class=&quot;path&quot;>\${escapeHtml(item.screenshotPath)}</div></div>';">\` : '<div class="fallback">No screenshot path available.</div>'}
          </div>
          <div class="path">\${escapeHtml(item.sourceImage || item.itemId)}</div>
          <div class="summary">
            <span class="badge \${actionClass}">\${escapeHtml(actionLabels[item.recommendedAction] || item.recommendedAction)}</span>
            \${item.ocrConfidence ? \`<span class="badge">\${escapeHtml('OCR ' + item.ocrConfidence)}</span>\` : ''}
            \${item.analysis && item.analysis.topScore != null ? \`<span class="badge">Top \${escapeHtml(String(item.analysis.topScore))}</span>\` : ''}
            \${item.analysis && item.analysis.topGap != null ? \`<span class="badge">Gap \${escapeHtml(String(item.analysis.topGap))}</span>\` : ''}
          </div>
        </div>

        <div class="middle">
          <div class="reason">
            <strong>Why it stayed unresolved:</strong><br>
            \${escapeHtml(item.reason || 'No reason recorded.')}
            \${item.analysis && item.analysis.explanation ? '<br><br>' + escapeHtml(item.analysis.explanation) : ''}
          </div>

          <div class="section">
            <span class="label">Prompt Raw JA</span>
            <div class="ja">\${escapeHtml(item.promptRawJa || 'Not available')}</div>
            \${item.promptGlossEn ? \`<div class="gloss">\${escapeHtml(item.promptGlossEn)}</div>\` : ''}
          </div>

          <div class="section">
            <span class="label">Options</span>
            <div class="option-list">
              \${renderOptions(item)}
            </div>
          </div>

          \${item.provisionalTopic ? \`
            <div class="section">
              <span class="label">Provisional Topic Review Metadata</span>
              <div class="ja">\${escapeHtml(item.provisionalTopic)}</div>
              \${item.provisionalSubtopics.length ? \`<div class="gloss">\${escapeHtml(item.provisionalSubtopics.join(', '))}</div>\` : ''}
            </div>
          \` : ''}

          <div class="section">
            <span class="label">Best Candidate Evidence</span>
            <div class="candidate-list">
              \${item.topCandidates.length ? item.topCandidates.map(renderCandidate).join('') : '<div class="reason">No candidate shortlist was recorded.</div>'}
            </div>
          </div>
        </div>

        <div class="decision">
          <h3>Decision</h3>
          <div class="small">Recommended: \${escapeHtml(actionLabels[item.recommendedAction] || item.recommendedAction)}</div>
          <div class="choice-group">
            <label class="choice">
              <input type="radio" name="decision-\${escapeAttr(item.itemId)}" value="approveExistingQid" \${draft.decision === "approveExistingQid" ? 'checked' : ''}>
              <span>Manually match to an existing qid</span>
            </label>
            <label class="choice">
              <input type="radio" name="decision-\${escapeAttr(item.itemId)}" value="createNewQuestion" \${draft.decision === "createNewQuestion" ? 'checked' : ''}>
              <span>Stage as a new-question candidate</span>
            </label>
            <label class="choice">
              <input type="radio" name="decision-\${escapeAttr(item.itemId)}" value="keepUnresolved" \${draft.decision === "keepUnresolved" || !draft.decision ? 'checked' : ''}>
              <span>Leave unresolved for now</span>
            </label>
          </div>
          <div class="section">
            <span class="label">Approved Qid</span>
            <input class="text-input" style="min-height:auto" data-field="approvedQid" data-item-id="\${escapeAttr(item.itemId)}" value="\${escapeAttr(draft.approvedQid || '')}" placeholder="q0123">
          </div>
          <div class="section">
            <span class="label">Reviewer Notes</span>
            <textarea class="text-input" data-field="reviewerNotes" data-item-id="\${escapeAttr(item.itemId)}" placeholder="Why you chose rescue vs new question">\${escapeHtml(draft.reviewerNotes || '')}</textarea>
          </div>
        </div>
      \`;

      article.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.addEventListener('change', (event) => {
          const decision = event.target.value;
          updateDraft(item.itemId, { decision });
        });
      });

      article.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', (event) => {
          updateDraft(item.itemId, { [event.target.dataset.field]: event.target.value });
        });
      });

      return article;
    }

    function renderOptions(item) {
      const rows = [];
      const count = Math.max(item.optionsRawJa.length, item.optionsGlossEn.length);
      for (let index = 0; index < count; index += 1) {
        rows.push(\`
          <div class="option">
            <div class="ja">\${escapeHtml(item.optionsRawJa[index] || 'Not available')}</div>
            \${item.optionsGlossEn[index] ? \`<div class="gloss">\${escapeHtml(item.optionsGlossEn[index])}</div>\` : ''}
          </div>
        \`);
      }
      return rows.join('');
    }

    function renderCandidate(candidate) {
      return \`
        <div class="candidate">
          <div class="candidate-head">
            <strong>\${escapeHtml(candidate.qid || 'unknown')}</strong>
            <span>#\${escapeHtml(String(candidate.number ?? '—'))}</span>
            <span>\${escapeHtml(candidate.type || '—')}</span>
            <span class="score">score \${escapeHtml(String(candidate.score ?? '—'))}</span>
            \${candidate.scoreGapFromTop != null ? \`<span class="score">gap \${escapeHtml(String(candidate.scoreGapFromTop))}</span>\` : ''}
          </div>
          <div>\${escapeHtml(candidate.prompt || 'No candidate prompt')}</div>
          \${candidate.options.length ? \`<div class="candidate-options">\${candidate.options.map((option) => \`<div class="candidate-option"><strong>\${escapeHtml(option.id || '')}</strong> \${escapeHtml(option.text || '')}</div>\`).join('')}</div>\` : ''}
          \${candidate.correctAnswer && candidate.correctAnswer.correctOptionText ? \`<div class="gloss">Correct answer: \${escapeHtml(candidate.correctAnswer.correctOptionText)}</div>\` : ''}
          \${candidate.imagePath ? \`<div class="candidate-image"><img src="\${escapeAttr(candidate.imagePath)}" alt="\${escapeAttr(candidate.qid || 'candidate image')}" onerror="this.remove(); this.parentElement.innerHTML='<div class=&quot;fallback&quot;>Candidate image unavailable.<div class=&quot;path&quot;>\${escapeHtml(candidate.imagePath)}</div></div>';"></div>\` : ''}
        </div>
      \`;
    }

    function loadState() {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || "{}");
      } catch {
        return {};
      }
    }

    function saveState() {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }

    function updateDraft(itemId, patch) {
      state[itemId] = { ...(state[itemId] || {}), ...patch };
      saveState();
    }

    function normalizeString(value) {
      const text = String(value || "").trim();
      return text || null;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
  </script>
</body>
</html>`;
}

function relativeFromReports(targetPath) {
  return path.relative(REPORTS_DIR, targetPath).split(path.sep).join("/");
}

function roundNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeJsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
