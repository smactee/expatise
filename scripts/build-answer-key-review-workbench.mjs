#!/usr/bin/env node
//
// Build a self-contained HTML workbench for reviewing answer-key meaning
// mismatches found by check-answer-key-meaning.mjs (--retro). Each card shows
// the source screenshot, the localized options + English glosses, the master
// qid's correct answer, the shipped key vs the meaning-derived expected key,
// and a prefilled verdict (change/keep/other + notes). A button exports the
// decisions JSON for the apply step.
//
// Usage: node scripts/build-answer-key-review-workbench.mjs --lang es
// Reads:  generated/reports/answer-key-meaning-<lang>-retro.json
// Writes: generated/reports/<lang>-answer-key-review-workbench.html

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = String(args.lang ?? "").trim();
if (!lang) throw new Error("Provide --lang <lang>.");
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const datasetPaths = getDatasetPaths(dataset, "ko");

const reportPath = path.join(REPORTS_DIR, `answer-key-meaning-${lang}-retro.json`);
const report = readJson(reportPath);

// --- master ---
const masterDoc = readJson(datasetPaths.questionsPath);
const masterList = Array.isArray(masterDoc?.questions) ? masterDoc.questions : Object.values(masterDoc?.questions ?? {});
const masterByQid = new Map(masterList.filter((q) => q?.id).map((q) => [q.id, q]));

// --- production (shipped es) ---
const prod = readJson(path.join(datasetPaths.datasetDir, `translations.${lang}.json`));
const prodQuestions = prod?.questions ?? {};

// --- batch items (for raw locale options + screenshot path) ---
const itemCache = new Map();
function batchItem(batch, itemId) {
  if (!itemCache.has(batch)) {
    const m = new Map();
    for (const kind of ["matched", "review-needed", "unresolved"]) {
      const f = path.join("imports", lang, batch, `${kind}.json`);
      if (!fs.existsSync(f)) continue;
      const d = readJson(f);
      let arr = Array.isArray(d) ? d : d.items ?? d.matched ?? d.reviewNeeded ?? d.unresolved ?? [];
      if (!Array.isArray(arr)) arr = [];
      for (const it of arr) if (it?.itemId) m.set(it.itemId, it);
    }
    itemCache.set(batch, m);
  }
  return itemCache.get(batch).get(itemId) ?? null;
}

// Confidence tier (mirrors answer-key-consistency.mjs): a HIGH-confidence
// mismatch has the assigned option essentially unrelated to the master correct
// answer, so it is very likely a real wrong key. MEDIUM ones are where the
// similarity metric may be fooled (negation/antonym blindness, OCR truncation).
function tierOf(r) {
  return (r.assignedScore ?? 0) <= 0.1 && (r.expectedScore ?? 0) - (r.assignedScore ?? 0) >= 0.2 ? "high" : "medium";
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildCard(r, idx, { collapsed = false } = {}) {
  const master = masterByQid.get(r.qid);
  const item = batchItem(r.batch, r.itemId);
  const prodEntry = prodQuestions[r.qid] ?? {};
  const tier = r.status === "mismatch" ? tierOf(r) : "low";
  const verdict = r.status === "mismatch" && tier === "high" ? "change" : "keep";
  const note =
    r.status !== "mismatch"
      ? "ambiguous similarity — likely fine; confirm at a glance"
      : tier === "high"
        ? "shipped option is unrelated to the master correct answer — likely a real wrong key"
        : "similarity metric may be fooled (negation / OCR truncation) — verify against the screenshot";

  const screenshotSrc = encodeURI(path.join("..", "..", "..", "imports", lang, r.batch, r.itemId));
  const rawOptions = Array.isArray(item?.optionsRawJa) ? item.optionsRawJa : [];
  const glossOptions = Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn : [];
  const masterOptions = Array.isArray(master?.options) ? master.options : [];
  const masterCorrectId = master?.correctOptionId;

  const optionRows = rawOptions
    .map((raw, i) => {
      const key = "ABCD"[i] ?? String(i + 1);
      const isShipped = key === r.assignedKey;
      const isExpected = key === r.expectedKey;
      const badge = [isShipped ? '<span class="badge shipped">shipped</span>' : "", isExpected ? '<span class="badge expected">expected</span>' : ""].join(" ");
      return `<tr class="${isShipped ? "row-shipped" : ""} ${isExpected ? "row-expected" : ""}">
        <td class="key">${key}</td><td>${esc(raw)}</td><td class="gloss">${esc(glossOptions[i] ?? "")}</td><td>${badge}</td></tr>`;
    })
    .join("");

  const masterRows = masterOptions
    .map((o) => `<tr class="${o.id === masterCorrectId ? "row-master-correct" : ""}"><td class="key">${esc(o.originalKey)}</td><td>${esc(o.text)}</td><td>${o.id === masterCorrectId ? '<span class="badge master">correct ✓</span>' : ""}</td></tr>`)
    .join("");

  return `<div class="card tier-${tier}" data-idx="${idx}" data-qid="${esc(r.qid)}" data-batch="${esc(r.batch)}" data-itemid="${esc(r.itemId)}" data-shipped="${esc(r.assignedKey)}" data-expected="${esc(r.expectedKey)}">
  <div class="card-head" onclick="this.parentElement.classList.toggle('open')">
    <span class="qid">${esc(r.qid)}</span>
    <span class="meta">${esc(r.batch)} · shipped <b class="k-shipped">${esc(r.assignedKey)}</b> → expected <b class="k-expected">${esc(r.expectedKey)}</b> · sim ${r.assignedScore} vs ${r.expectedScore}</span>
    <span class="tier">${tier === "high" ? "🔴 likely wrong" : tier === "medium" ? "🟡 verify" : "⚪ ambiguous"}</span>
  </div>
  <div class="card-body">
    <div class="cols">
      <div class="col shot"><img src="${screenshotSrc}" loading="lazy" alt="${esc(r.itemId)}"></div>
      <div class="col info">
        <p class="prompt"><b>Source prompt:</b> ${esc(item?.promptRawJa ?? "")}<br><span class="gloss">${esc(item?.promptGlossEn ?? "")}</span></p>
        <table class="opts"><thead><tr><th></th><th>Localized option</th><th>English gloss</th><th></th></tr></thead><tbody>${optionRows}</tbody></table>
        <p class="master-head"><b>Master ${esc(r.qid)}:</b> ${esc(master?.prompt ?? "")}</p>
        <table class="opts master"><tbody>${masterRows}</tbody></table>
        <p class="note">${esc(note)}. Shipped production key: <b>${esc(prodEntry?.localeCorrectOptionKey ?? "?")}</b></p>
        <div class="verdict">
          <label><input type="radio" name="v${idx}" value="change" ${verdict === "change" ? "checked" : ""}> Change to <b>${esc(r.expectedKey)}</b></label>
          <label><input type="radio" name="v${idx}" value="keep" ${verdict === "keep" ? "checked" : ""}> Keep <b>${esc(r.assignedKey)}</b></label>
          <label><input type="radio" name="v${idx}" value="other"> Other: <select class="other-key">${["A", "B", "C", "D"].map((k) => `<option>${k}</option>`).join("")}</select></label>
          <input type="text" class="notes" placeholder="notes…">
        </div>
      </div>
    </div>
  </div>
</div>`;
}

const mismatches = report.results.filter((r) => r.status === "mismatch").sort((a, b) => tierOf(a).localeCompare(tierOf(b)) || b.expectedScore - a.expectedScore);
const ambiguous = report.results.filter((r) => r.status === "ambiguous").sort((a, b) => b.expectedScore - a.expectedScore);

let idx = 0;
const mismatchCards = mismatches.map((r) => buildCard(r, idx++)).join("\n");
const ambiguousCards = ambiguous.map((r) => buildCard(r, idx++, { collapsed: true })).join("\n");
const highCount = mismatches.filter((r) => tierOf(r) === "high").length;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${lang} answer-key review — ${mismatches.length} mismatches</title>
<style>
  body{font:14px/1.45 -apple-system,Segoe UI,sans-serif;margin:0;background:#f5f6f8;color:#1c2024}
  header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:10px 18px;display:flex;gap:18px;align-items:center;z-index:5}
  header h1{font-size:16px;margin:0} header .sub{color:#667}
  button.export{margin-left:auto;background:#1463ff;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:600;cursor:pointer}
  .section-title{margin:22px 18px 6px;font-size:15px;color:#445}
  .card{background:#fff;border:1px solid #e1e4e8;border-radius:10px;margin:10px 18px;overflow:hidden}
  .card-head{display:flex;gap:14px;align-items:center;padding:10px 14px;cursor:pointer;background:#fafbfc}
  .card.tier-high .card-head{background:#fff2f0}.card.tier-medium .card-head{background:#fffbe8}
  .qid{font-weight:700}.meta{color:#556}.tier{margin-left:auto;white-space:nowrap}
  .card-body{display:none;padding:14px;border-top:1px solid #eee}.card.open .card-body{display:block}
  .cols{display:flex;gap:18px;align-items:flex-start}.col.shot{flex:0 0 380px}.col.shot img{width:100%;border:1px solid #ddd;border-radius:6px}
  .col.info{flex:1;min-width:0}
  table.opts{border-collapse:collapse;width:100%;margin:6px 0 14px}
  table.opts td,table.opts th{border:1px solid #e6e8eb;padding:4px 8px;text-align:left;vertical-align:top}
  td.key{font-weight:700;width:24px}.gloss{color:#586}
  .row-shipped{background:#fff2f0}.row-expected{background:#eefaf0}.row-master-correct{background:#eefaf0}
  .badge{font-size:11px;padding:1px 7px;border-radius:8px;color:#fff}.badge.shipped{background:#d4380d}.badge.expected{background:#188038}.badge.master{background:#188038}
  .verdict{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:#f6f8fa;border-radius:8px;padding:10px}
  .verdict input.notes{flex:1;min-width:180px;padding:5px 8px;border:1px solid #ccc;border-radius:6px}
  .note{color:#664d03;background:#fff9e6;border-radius:6px;padding:6px 10px}
  .prompt{margin:2px 0 8px}.master-head{margin:8px 0 2px}
</style></head><body>
<header>
  <h1>${lang.toUpperCase()} answer-key review</h1>
  <span class="sub">${mismatches.length} mismatches (${highCount} likely-wrong 🔴) + ${ambiguous.length} ambiguous · generated ${esc(stableNow())} · click a row to expand</span>
  <button class="export" onclick="exportDecisions()">Export decisions JSON</button>
</header>
<div class="section-title">Mismatches — shipped key disagrees with master meaning (${mismatches.length})</div>
${mismatchCards}
<div class="section-title">Ambiguous — probably fine, one-glance confirm (${ambiguous.length})</div>
${ambiguousCards}
<script>
function exportDecisions(){
  const out=[];
  document.querySelectorAll('.card').forEach(card=>{
    const idx=card.dataset.idx;
    const v=(card.querySelector('input[name="v'+idx+'"]:checked')||{}).value||null;
    const other=card.querySelector('.other-key');
    const newKey=v==='change'?card.dataset.expected:v==='other'?other.value:card.dataset.shipped;
    out.push({qid:card.dataset.qid,batch:card.dataset.batch,itemId:card.dataset.itemid,
      shippedKey:card.dataset.shipped,expectedKey:card.dataset.expected,verdict:v,
      confirmedCorrectOptionKey:newKey,notes:card.querySelector('.notes').value||''});
  });
  const blob=new Blob([JSON.stringify({lang:'${lang}',generatedAt:new Date().toISOString(),items:out},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='${lang}-answer-key-review-decisions.json';a.click();
}
// open all high-tier cards by default
document.querySelectorAll('.card.tier-high').forEach(c=>c.classList.add('open'));
</script>
</body></html>`;

const outPath = path.join(REPORTS_DIR, `${lang}-answer-key-review-workbench.html`);
fs.writeFileSync(outPath, html);
console.log(`Workbench: ${path.relative(process.cwd(), outPath)}`);
console.log(`  ${mismatches.length} mismatches (${highCount} high-confidence) + ${ambiguous.length} ambiguous`);
