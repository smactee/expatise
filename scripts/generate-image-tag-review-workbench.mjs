#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const QUESTIONS_PATH = path.join(DATASET_DIR, "questions.json");
const RAW_QUESTIONS_PATH = path.join(DATASET_DIR, "questions.raw.json");
const IMAGE_TAGS_PATH = path.join(DATASET_DIR, "image-color-tags.json");
const BACKFILL_REPORT_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "missing-image-object-tags-backfill.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const OUT_HTML = path.join(REPORTS_DIR, "image-tag-review-workbench.html");
const OUT_JSON = path.join(REPORTS_DIR, "image-tag-review-workbench.json");
const EXPORT_PATH = "qbank-tools/generated/staging/image-tag-review-decisions.json";
const REVIEW_TAG = "needs-tag-review";

const questionsDoc = readJson(QUESTIONS_PATH);
const rawQuestionsDoc = readJsonIfExists(RAW_QUESTIONS_PATH, { questions: [] });
const imageTagsDoc = readJson(IMAGE_TAGS_PATH);
const backfillReport = readJson(BACKFILL_REPORT_PATH);

const questionsByQid = new Map(questionArray(questionsDoc).map((question) => [normalizeQid(question.id ?? question.qid), question]));
const rawByQid = new Map(questionArray(rawQuestionsDoc).map((question) => [normalizeQid(question.id ?? question.qid), question]));
const backfillByQid = new Map((Array.isArray(backfillReport.items) ? backfillReport.items : []).map((item) => [normalizeQid(item.qid), item]));

const items = Object.entries(imageTagsDoc.questions ?? {})
  .filter(([, entry]) => Array.isArray(entry?.objectTags) && entry.objectTags.includes(REVIEW_TAG))
  .map(([qid, tagEntry]) => buildItem(normalizeQid(qid), tagEntry))
  .filter(Boolean)
  .sort((left, right) => Number(left.number) - Number(right.number) || left.qid.localeCompare(right.qid));

const workbench = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET,
  sources: {
    questions: rel(QUESTIONS_PATH),
    rawQuestions: rel(RAW_QUESTIONS_PATH),
    imageColorTags: rel(IMAGE_TAGS_PATH),
    backfillReport: rel(BACKFILL_REPORT_PATH),
  },
  exportPath: EXPORT_PATH,
  summary: {
    qidsInReview: items.length,
  },
  items,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(OUT_JSON, `${JSON.stringify(workbench, null, 2)}\n`, "utf8");
await fsp.writeFile(OUT_HTML, renderHtml(workbench), "utf8");

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_HTML)}`);
console.log(`Qids in review: ${items.length}`);

function buildItem(qid, tagEntry) {
  const question = questionsByQid.get(qid);
  const rawQuestion = rawByQid.get(qid);
  if (!question && !rawQuestion) return null;
  const backfill = backfillByQid.get(qid) ?? {};
  const assets = imageAssets(question).length ? imageAssets(question) : imageAssets(rawQuestion);
  const options = optionRows(question, rawQuestion);
  const answer = answerSummary(question, rawQuestion, options);
  return {
    qid,
    number: question?.number ?? rawQuestion?.number ?? Number(qid.replace(/\D/g, "")),
    type: question?.type ?? rawQuestion?.type ?? (options.length ? "mcq" : "row"),
    prompt: String(question?.prompt ?? rawQuestion?.prompt ?? "").trim(),
    rawPrompt: String(rawQuestion?.prompt ?? "").trim(),
    answer,
    options,
    images: assets.map((src) => ({
      src,
      browserSrc: browserPath(src),
    })),
    colorTags: Array.isArray(tagEntry?.colorTags) ? tagEntry.colorTags : [],
    currentObjectTags: Array.isArray(tagEntry?.objectTags) ? tagEntry.objectTags : [],
    inferredTags: Array.isArray(backfill.objectTagsToAdd) ? backfill.objectTagsToAdd : [],
    suggestedEditableTags: unique([
      ...(Array.isArray(tagEntry?.objectTags) ? tagEntry.objectTags : []),
      ...(Array.isArray(backfill.objectTagsToAdd) ? backfill.objectTagsToAdd : []),
    ].filter((tag) => tag !== REVIEW_TAG)),
    confidence: backfill.confidence ?? "unknown",
    evidence: Array.isArray(backfill.evidence) ? backfill.evidence : [],
    backfillNeedsTagReview: backfill.needsTagReview === true,
  };
}

function optionRows(question, rawQuestion) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const rawOptions = Array.isArray(rawQuestion?.options) ? rawQuestion.options : [];
  const source = options.length ? options : rawOptions;
  return source.map((option, index) => ({
    key: String(option?.originalKey ?? option?.key ?? option?.label ?? keyFromIndex(index) ?? "").trim(),
    id: option?.id ?? rawOptions[index]?.id ?? null,
    text: String(option?.text ?? rawOptions[index]?.text ?? "").trim(),
  }));
}

function answerSummary(question, rawQuestion, options) {
  const type = String(question?.type ?? rawQuestion?.type ?? "").toLowerCase();
  if (type === "row") {
    return {
      raw: question?.answerRaw ?? rawQuestion?.answerRaw ?? question?.correctRow ?? rawQuestion?.correctRow ?? null,
      text: question?.correctRow ?? rawQuestion?.correctRow ?? question?.answerRaw ?? rawQuestion?.answerRaw ?? null,
    };
  }
  const correctOptionId = question?.correctOptionId ?? rawQuestion?.correctOptionId ?? null;
  const byId = options.find((option) => option.id === correctOptionId);
  const rawKey = String(question?.answerRaw ?? rawQuestion?.answerRaw ?? "").trim().toUpperCase();
  const byKey = options.find((option) => String(option.key).toUpperCase() === rawKey);
  const correct = byId ?? byKey ?? null;
  return {
    raw: rawKey || correctOptionId,
    text: correct ? `${correct.key}. ${correct.text}` : null,
  };
}

function renderHtml(workbench) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Tag Review Workbench</title>
  <style>
    :root { color-scheme: light; --bg:#f7f3eb; --card:#fffdf8; --line:#dfd5c7; --text:#221f1a; --muted:#6f665a; --accent:#1d4ed8; --warn:#b45309; --ok:#166534; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { position:sticky; top:0; z-index:2; background:#fffaf0; border-bottom:1px solid var(--line); padding:18px 22px; }
    h1 { margin:0 0 8px; font-size:24px; }
    .meta, .small { color:var(--muted); font-size:12px; }
    .stats { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
    .stat { background:white; border:1px solid var(--line); border-radius:8px; padding:8px 10px; }
    main { display:grid; gap:14px; padding:18px; }
    article { background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
    .head { display:flex; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); }
    .grid { display:grid; grid-template-columns:280px 1fr 330px; gap:14px; padding:14px; }
    .panel { background:white; border:1px solid var(--line); border-radius:8px; padding:12px; }
    img { width:100%; max-height:260px; object-fit:contain; border:1px solid var(--line); border-radius:7px; background:white; }
    .prompt { font-weight:750; margin:0 0 10px; }
    ul { margin:8px 0 0; padding-left:20px; }
    li { margin:4px 0; font-size:13px; }
    .tags { display:flex; flex-wrap:wrap; gap:5px; margin:8px 0; }
    .tag { border:1px solid var(--line); border-radius:999px; padding:3px 7px; font-size:12px; background:#fffaf0; }
    .review-tag { color:var(--warn); border-color:#f59e0b; background:#fffbeb; font-weight:800; }
    textarea, input { width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius:7px; padding:8px; font:inherit; font-size:13px; }
    textarea { min-height:72px; resize:vertical; }
    .buttons { display:flex; gap:6px; flex-wrap:wrap; margin:10px 0; }
    button { border:1px solid var(--line); border-radius:7px; background:white; padding:7px 9px; cursor:pointer; }
    button.active { background:#eff6ff; color:#1d4ed8; border-color:#2563eb; font-weight:800; }
    .primary { background:#2563eb; color:white; border-color:#1d4ed8; font-weight:800; }
    .export { display:grid; gap:8px; margin-top:10px; }
    #export-json { min-height:120px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    @media (max-width: 1100px) { .grid { grid-template-columns:1fr; } header { position:static; } }
  </style>
</head>
<body>
  <header>
    <h1>Image Tag Review Workbench</h1>
    <div class="meta">Generated ${escapeHtml(workbench.generatedAt)} · export target <code>${escapeHtml(workbench.exportPath)}</code></div>
    <div class="stats">
      <div class="stat"><strong>${workbench.summary.qidsInReview}</strong><div class="small">qids in review</div></div>
    </div>
    <div class="buttons">
      <button class="primary" type="button" id="export-decisions">Export decisions JSON</button>
      <button type="button" id="copy-decisions">Copy JSON</button>
    </div>
    <div class="export">
      <textarea id="export-json" spellcheck="false" placeholder="Exported decisions JSON appears here."></textarea>
    </div>
  </header>
  <main>
    ${workbench.items.map(renderItem).join("\n")}
  </main>
  <script>
    const DATASET = ${JSON.stringify(workbench.dataset)};
    const ITEMS = ${safeInlineJson(workbench.items.map((item) => ({ qid: item.qid, suggestedEditableTags: item.suggestedEditableTags })))};
    const states = new Map(ITEMS.map((item) => [item.qid, { decision: "approve", objectTags: item.suggestedEditableTags, removeTags: ["needs-tag-review"], notes: "" }]));
    function parseTags(value) {
      return [...new Set(String(value || "").split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean))];
    }
    function setDecision(card, decision) {
      const qid = card.dataset.qid;
      const state = states.get(qid) || {};
      const tags = parseTags(card.querySelector("[data-tags-input]").value);
      const removeNeeds = card.querySelector("[data-remove-review]").checked;
      states.set(qid, {
        ...state,
        decision,
        objectTags: tags,
        removeTags: removeNeeds ? ["needs-tag-review"] : [],
        notes: card.querySelector("[data-notes]").value || "",
      });
      card.querySelectorAll("[data-decision]").forEach((button) => button.classList.toggle("active", button.dataset.decision === decision));
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-decision]");
      if (!button) return;
      setDecision(button.closest("[data-qid]"), button.dataset.decision);
    });
    document.addEventListener("input", (event) => {
      const card = event.target.closest("[data-qid]");
      if (!card) return;
      const state = states.get(card.dataset.qid) || {};
      states.set(card.dataset.qid, {
        ...state,
        objectTags: parseTags(card.querySelector("[data-tags-input]").value),
        removeTags: card.querySelector("[data-remove-review]").checked ? ["needs-tag-review"] : [],
        notes: card.querySelector("[data-notes]").value || "",
      });
    });
    document.addEventListener("change", (event) => {
      const card = event.target.closest("[data-qid]");
      if (!card) return;
      const state = states.get(card.dataset.qid) || {};
      states.set(card.dataset.qid, {
        ...state,
        removeTags: card.querySelector("[data-remove-review]").checked ? ["needs-tag-review"] : [],
      });
    });
    function exportJson() {
      const decisions = {};
      for (const item of ITEMS) {
        const state = states.get(item.qid);
        decisions[item.qid] = {
          decision: state?.decision || "approve",
          objectTags: state?.objectTags || [],
          removeTags: state?.removeTags || [],
          notes: state?.notes || "",
        };
      }
      const doc = { dataset: DATASET, generatedAt: new Date().toISOString(), decisions };
      document.getElementById("export-json").value = JSON.stringify(doc, null, 2);
      return doc;
    }
    document.getElementById("export-decisions").addEventListener("click", exportJson);
    document.getElementById("copy-decisions").addEventListener("click", async () => {
      exportJson();
      await navigator.clipboard.writeText(document.getElementById("export-json").value);
    });
  </script>
</body>
</html>
`;
}

function renderItem(item) {
  return `<article data-qid="${escapeAttr(item.qid)}">
    <div class="head">
      <div><strong>${escapeHtml(item.qid)}</strong> <span class="small">#${escapeHtml(item.number)} · ${escapeHtml(item.type)}</span></div>
      <div class="small">confidence: ${escapeHtml(item.confidence)}</div>
    </div>
    <div class="grid">
      <section class="panel">
        ${item.images.map((image) => `<img loading="lazy" src="${escapeAttr(image.browserSrc)}" alt="${escapeAttr(item.qid)} image">`).join("") || "<div class='small'>No image found</div>"}
        <div class="small">${item.images.map((image) => escapeHtml(image.src)).join("<br>")}</div>
      </section>
      <section class="panel">
        <p class="prompt">${escapeHtml(item.prompt)}</p>
        ${item.rawPrompt && item.rawPrompt !== item.prompt ? `<p class="small">${escapeHtml(item.rawPrompt)}</p>` : ""}
        <div><strong>Answer:</strong> ${escapeHtml(item.answer.raw ?? "")}${item.answer.text ? ` · ${escapeHtml(item.answer.text)}` : ""}</div>
        ${item.options.length ? `<ul>${item.options.map((option) => `<li><strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.text)}</li>`).join("")}</ul>` : ""}
        <h3>Current objectTags</h3>
        <div class="tags">${item.currentObjectTags.map((tag) => tag === REVIEW_TAG ? `<span class="tag review-tag">${escapeHtml(tag)}</span>` : `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <h3>Inferred/backfilled tags</h3>
        <div class="tags">${item.inferredTags.map((tag) => tag === REVIEW_TAG ? `<span class="tag review-tag">${escapeHtml(tag)}</span>` : `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="small">${item.evidence.map(escapeHtml).join("; ") || "No evidence recorded."}</div>
      </section>
      <section class="panel">
        <label><strong>Editable objectTags</strong></label>
        <textarea data-tags-input spellcheck="false">${escapeHtml(item.suggestedEditableTags.join(", "))}</textarea>
        <label class="small"><input type="checkbox" data-remove-review checked> remove needs-tag-review</label>
        <div class="buttons">
          <button type="button" data-decision="approve" class="active">Approve tags</button>
          <button type="button" data-decision="unsure">Mark unsure</button>
        </div>
        <label><strong>Notes</strong></label>
        <textarea data-notes spellcheck="false" placeholder="Optional reviewer notes"></textarea>
      </section>
    </div>
  </article>`;
}

function imageAssets(question) {
  return (Array.isArray(question?.assets) ? question.assets : [])
    .filter((asset) => asset?.kind === "image" && asset?.src)
    .map((asset) => String(asset.src));
}

function browserPath(src) {
  const clean = String(src ?? "").replace(/^\/+/, "");
  const absolute = clean.startsWith("qbank/")
    ? path.join(ROOT, "public", clean)
    : clean.startsWith("public/")
      ? path.join(ROOT, clean)
      : path.join(DATASET_DIR, "images", clean);
  return path.relative(REPORTS_DIR, absolute).split(path.sep).join("/");
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  if (doc?.questions && typeof doc.questions === "object") {
    return Object.entries(doc.questions).map(([qid, value]) => ({ id: qid, ...value }));
  }
  return [];
}

function normalizeQid(value) {
  const match = String(value ?? "").match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function keyFromIndex(index) {
  return ["A", "B", "C", "D"][index] ?? String(index + 1);
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
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

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
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
