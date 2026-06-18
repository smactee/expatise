#!/usr/bin/env node
// prompt-nn-candidates.mjs — recall rescue for TEXT (non-image) screenshot questions.
//
// WHY: same recall bottleneck the image-NN rescue fixed, but for text. The matcher builds each
// item's candidate pool from LEXICAL retrieval, then bge re-ranks WITHIN that pool. When the
// correct qid is paraphrased differently from the screenshot's gloss, lexical retrieval drops it
// before bge ever sees it — a recall miss. Validated on de batch-007: both text-MCQ misses
// (owner qids q0182, q0183) were bge prompt-NN rank 3 and rank 1 respectively, yet outside the
// matcher's top-5 lexical candidates.
//
// WHAT: for each TEXT item, compute the top-K bge prompt nearest-neighbors (gloss-embedding of the
// item vs master prompt-embeddings) so the text-verify briefing can SEED them as candidates. Pure
// prefill-stage helper — reuses the embeddings the matcher already produced; does NOT touch the
// matcher core (pipeline.mjs). Mirror of scripts/image-nn-candidates.mjs.
//
// USAGE: node scripts/prompt-nn-candidates.mjs --lang de --batch batch-008 [--topk 14] [--dataset 2023-test1]
//   reads  imports/<lang>/<batch>/gloss-embeddings.json        (batch item gloss vectors, dim 384)
//          qbank-tools/generated/qid-prompt-embeddings.json    (master prompt vectors, dim 384)
//          public/qbank/<dataset>/translations.<lang>.json     (claimed qids, for flagging)
//   writes imports/<lang>/<batch>/_prompt-nn.json   { itemId: [{qid, promptCos, claimed}], ... }

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const lang = opt("lang");
const batch = opt("batch");
const dataset = opt("dataset", "2023-test1");
const topk = parseInt(opt("topk", "14"), 10);
if (!lang || !batch) { console.error("need --lang and --batch"); process.exit(1); }

const ROOT = process.cwd();
const batchEmbPath = path.join(ROOT, "imports", lang, batch, "gloss-embeddings.json");
const masterEmbPath = path.join(ROOT, "qbank-tools/generated/qid-prompt-embeddings.json");
const translationsPath = path.join(ROOT, "public/qbank", dataset, `translations.${lang}.json`);

if (!fs.existsSync(batchEmbPath)) { console.error(`missing ${batchEmbPath} (run process-screenshot-batch first)`); process.exit(1); }
if (!fs.existsSync(masterEmbPath)) { console.error(`missing ${masterEmbPath}`); process.exit(1); }

const batchVecs = JSON.parse(fs.readFileSync(batchEmbPath)).vectors;
const masterVecs = JSON.parse(fs.readFileSync(masterEmbPath)).vectors;
const claimed = fs.existsSync(translationsPath)
  ? new Set(Object.keys(JSON.parse(fs.readFileSync(translationsPath)).questions || {}))
  : new Set();

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const norm = (v) => Math.sqrt(dot(v, v));
const mnorm = {};
for (const q in masterVecs) mnorm[q] = norm(masterVecs[q]) || 1;

const out = {};
for (const itemId in batchVecs) {
  const v = batchVecs[itemId];
  const vn = norm(v) || 1;
  const scored = [];
  for (const q in masterVecs) scored.push([q, dot(v, masterVecs[q]) / (vn * mnorm[q])]);
  scored.sort((a, b) => b[1] - a[1]);
  out[itemId] = scored.slice(0, topk).map(([qid, cos]) => ({ qid, promptCos: Number(cos.toFixed(4)), claimed: claimed.has(qid) }));
}

const outPath = path.join(ROOT, "imports", lang, batch, "_prompt-nn.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`prompt-nn: wrote ${outPath} — ${Object.keys(out).length} item(s), top-${topk} bge neighbors each (${claimed.size} claimed qids flagged).`);
