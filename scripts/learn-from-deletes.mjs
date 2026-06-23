#!/usr/bin/env node
// learn-from-deletes.mjs — the deletion-learning loop.
//
// After a batch is reviewed/shipped, ingest the owner's CONFIRMED deletes and correlate them
// with that batch's image/text-discrepancy vision audit, so the delete pre-fill judgment
// gets smarter each batch. Accumulates per-delete records into a persistent JSONL store and
// rewrites a human-readable summary that the pre-fill doctrine reads.
//
//   node scripts/learn-from-deletes.mjs --lang zh --batch batch-001 [--export <reviewed-decisions.json>]
//
// Inputs per batch:
//   - reviewed decisions export (default: qbank-tools/generated/staging/<lang>-<batch>-workbench-decisions.json,
//     or ~/Downloads/<lang>-<batch>-workbench-decisions.json, or --export)
//   - qbank-tools/history/image-text-audit.<lang>.<batch>.json  (the vision audit: per item
//     status aligned|text-mismatch|image-text-mismatch|no-image)
// Outputs (accumulate across batches):
//   - qbank-tools/history/<lang>-delete-learning.jsonl   (one row per confirmed delete)
//   - qbank-tools/history/<lang>-delete-learning.md      (aggregate summary + flag guidance)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).join(" ").split("--").filter(Boolean).map((kv) => {
    const [k, ...v] = kv.trim().split(/\s+/);
    return [k, v.join(" ") || true];
  }),
);
const lang = String(args.lang || "").trim();
const batch = String(args.batch || "").trim();
if (!lang || !batch) {
  console.error("usage: learn-from-deletes.mjs --lang <lang> --batch <batch> [--export <path>]");
  process.exit(1);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// locate reviewed decisions
const candidates = [
  args.export && String(args.export),
  path.join(os.homedir(), "Downloads", `${lang}-${batch}-workbench-decisions.json`),
  path.join(os.homedir(), "Downloads", "Expatise", `${lang}-${batch}-workbench-decisions.json`),
  path.join(ROOT, "qbank-tools", "generated", "staging", `${lang}-${batch}-workbench-decisions.json`),
].filter(Boolean);
const exportPath = candidates.find(exists);
if (!exportPath) { console.error("no reviewed decisions found; tried:\n" + candidates.join("\n")); process.exit(1); }

const auditPath = path.join(ROOT, "qbank-tools", "history", `image-text-audit.${lang}.${batch}.json`);
const auditByItem = new Map(
  exists(auditPath) ? readJson(auditPath).items.map((i) => [i.itemId, i]) : [],
);
if (!auditByItem.size) console.warn(`  ⚠ no image/text audit at ${auditPath} — delete reasons will lack image-discrepancy correlation.`);

const decisions = readJson(exportPath).items || [];
const isImageId = (notes) => /sign|marking|\bmark\b|road surface|guide arrow|what.*(sign|mark)/i.test(notes || "");

const records = [];
for (const d of decisions) {
  if (d.deleteQuestion !== true) continue;
  const audit = auditByItem.get(d.itemId);
  const status = audit?.status || "unknown";
  records.push({
    lang, batch, itemId: d.itemId,
    imageTextStatus: status,                       // image-text-mismatch | aligned | no-image | text-mismatch | unknown
    wasImageTextMismatch: status === "image-text-mismatch",
    imageDescription: audit?.imageDescription || null,
    looksImageIdentification: isImageId(d.reviewerNotes),
    prefillProposedQid: d.approvedQid || null,
    reviewerNotes: d.reviewerNotes || null,
  });
}

// append to JSONL store (replace any prior rows for this batch to stay idempotent)
const jsonlPath = path.join(ROOT, "qbank-tools", "history", `${lang}-delete-learning.jsonl`);
const prior = exists(jsonlPath)
  ? fs.readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.batch !== batch)
  : [];
const all = [...prior, ...records];
fs.writeFileSync(jsonlPath, all.map((r) => JSON.stringify(r)).join("\n") + "\n");

// aggregate across all batches
const mism = all.filter((r) => r.wasImageTextMismatch).length;
const totalAuditable = all.filter((r) => ["image-text-mismatch", "aligned", "no-image"].includes(r.imageTextStatus));
const otherReason = all.filter((r) => !r.wasImageTextMismatch);
const byStatus = {};
for (const r of all) byStatus[r.imageTextStatus] = (byStatus[r.imageTextStatus] || 0) + 1;

// how many of the language's TOTAL image-text-mismatch items ended up deleted — needs audits across batches
let mismDeleted = 0, mismTotal = 0;
for (const [, file] of [["", auditPath]]) {} // (single-batch audit already loaded above)
// approximate language-wide rate from accumulated audits
const auditFiles = fs.readdirSync(path.join(ROOT, "qbank-tools", "history")).filter((f) => f.startsWith(`image-text-audit.${lang}.`));
const deletedIds = new Set(all.map((r) => r.itemId));
for (const f of auditFiles) {
  const doc = readJson(path.join(ROOT, "qbank-tools", "history", f));
  for (const i of doc.items) {
    if (i.status === "image-text-mismatch") { mismTotal++; if (deletedIds.has(i.itemId)) mismDeleted++; }
  }
}
const rate = mismTotal ? Math.round((mismDeleted / mismTotal) * 100) : null;

const lines = [];
lines.push(`# ${lang} — deletion learning (auto-generated by learn-from-deletes.mjs)`, "");
lines.push(`Accumulated confirmed deletes: **${all.length}** across batches [${[...new Set(all.map((r) => r.batch))].join(", ")}].`, "");
lines.push(`## Delete reasons by image/text status`);
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) lines.push(`- ${k}: ${v}`);
lines.push("");
lines.push(`## Flag guidance (feeds the delete pre-fill)`);
if (rate !== null) {
  lines.push(`- **${mismDeleted}/${mismTotal} (${rate}%) of image/text-mismatch items were deleted.**`);
  if (rate >= 70) lines.push(`  → STRONG: pre-fill should mark **every** image/text mismatch as delete (image-ID AND text-only-with-spurious-image alike). Don't narrow to image-identification questions only.`);
  else lines.push(`  → MIXED: image/text mismatch alone is not decisive; weight image-identification questions higher.`);
}
lines.push(`- ${otherReason.length} delete(s) were NOT image/text mismatches (other reasons — wrong/forced match, near-duplicate, source quality). Review their notes below to learn additional triggers.`);
lines.push("");
lines.push(`## Non-mismatch deletes (other reasons — learn from these)`);
for (const r of otherReason.slice(0, 40)) lines.push(`- [${r.imageTextStatus}] ${path.basename(r.itemId)} :: ${(r.reviewerNotes || "").slice(0, 120)}`);
const mdPath = path.join(ROOT, "qbank-tools", "history", `${lang}-delete-learning.md`);
fs.writeFileSync(mdPath, lines.join("\n") + "\n");

console.log(`Ingested ${records.length} confirmed delete(s) for ${lang} ${batch} (total accumulated: ${all.length}).`);
if (rate !== null) console.log(`Image/text-mismatch deletion rate (language-wide): ${mismDeleted}/${mismTotal} = ${rate}%.`);
console.log(`Wrote ${path.relative(ROOT, jsonlPath)} and ${path.relative(ROOT, mdPath)}.`);
