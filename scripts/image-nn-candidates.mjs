#!/usr/bin/env node
// image-nn-candidates.mjs — recall rescue for image-bearing screenshot questions.
//
// WHY: the matcher builds each item's candidate pool from TEXT retrieval, then the CLIP
// image re-ranker only RE-RANKS within that pool. For generic-prompt sign questions
// ("What does this sign mean?") the correct qid is image-only-distinguishable, so it is
// frequently filtered out before the image signal ever applies — a RECALL miss the
// image-verify agents cannot recover from (the right qid is not in their candidate list).
// Validated on de batch-005: for 6 of 7 such recall misses the owner's correct qid was the
// #1 or #2 image nearest-neighbor.
//
// WHAT: for each image item in a batch, compute the top-K image nearest-neighbors (CLIP
// cosine) over the master image vectors, and emit them so the image-verify briefing can
// SEED them into the candidate list. Pure prefill-stage helper — does NOT touch the matcher
// core (pipeline.mjs). Reuses the embeddings the matcher already produced.
//
// USAGE: node scripts/image-nn-candidates.mjs --lang de --batch batch-006 [--topk 8] [--dataset 2023-test1]
//   reads  imports/<lang>/<batch>/image-embeddings.json        (batch item vectors)
//          qbank-tools/generated/qid-image-embeddings.json     (master qid vectors)
//          public/qbank/<dataset>/translations.<lang>.json     (claimed qids, for flagging)
//   writes imports/<lang>/<batch>/_image-nn.json   { itemId: [{qid, imgCos, claimed}], ... }

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const lang = opt("lang");
const batch = opt("batch");
const dataset = opt("dataset", "2023-test1");
// topK raised 8 -> 14 after de batch-006: owner's correct qid was at NN rank 5 (12.12.27/q0777)
// and beyond rank 8 (12.12.31/q0782), so a shallow list under-served the merge step.
const topk = parseInt(opt("topk", "14"), 10);
if (!lang || !batch) { console.error("need --lang and --batch"); process.exit(1); }

const ROOT = process.cwd();
const batchEmbPath = path.join(ROOT, "imports", lang, batch, "image-embeddings.json");
const masterEmbPath = path.join(ROOT, "qbank-tools/generated/qid-image-embeddings.json");
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
  out[itemId] = scored.slice(0, topk).map(([qid, cos]) => ({ qid, imgCos: Number(cos.toFixed(4)), claimed: claimed.has(qid) }));
}

const outPath = path.join(ROOT, "imports", lang, batch, "_image-nn.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
const nItems = Object.keys(out).length;
console.log(`image-nn: wrote ${outPath} — ${nItems} image item(s), top-${topk} CLIP neighbors each (${claimed.size} claimed qids flagged).`);
