#!/usr/bin/env node
// Register screenshots that are UNANSWERABLE because the question needs an image
// but the image never rendered in the capture (blank). These are dropped from
// matching exactly like duplicate exclusions — same per-language registry
// (qbank-tools/history/duplicate-exclusions.<lang>.json), with reason "no-image".
//
// Usage:
//   npm run apply-noimage-deletions -- --lang zh --path <list-or-export.json> [--dry-run]
// The JSON may be either:
//   - a bare array of screenshot filenames, or
//   - { delete: [filenames], reason?, notes? }  (e.g. a deletion-workbench export)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_DATASET, duplicateExclusionsPath, normalizeLang, parseArgs } from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const lang = normalizeLang(args.lang);
const dataset = args.dataset || DEFAULT_DATASET;
const dryRun = String(args["dry-run"] ?? "false").toLowerCase() === "true" || args["dry-run"] === true;
if (!lang) { console.error("--lang required"); process.exit(1); }
if (!args.path) { console.error("--path <json> required"); process.exit(1); }

const src = path.resolve(String(args.path).replace(/^~/, os.homedir()));
const doc = JSON.parse(fs.readFileSync(src, "utf8"));
const files = (Array.isArray(doc) ? doc : doc.delete || []).map((f) => path.basename(String(f)));
if (files.length === 0) { console.error("No files to register (empty list/delete[])."); process.exit(1); }
const reason = doc.reason || args.reason || "no-image-unanswerable";

const registryPath = duplicateExclusionsPath({ dataset, lang });
const existing = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
  : { lang, dataset, exclusions: [] };
const byFile = new Map((existing.exclusions || []).map((e) => [path.basename(String(e.file)), e]));

const now = new Date().toISOString();
let added = 0, updated = 0;
for (const base of files) {
  const rec = {
    file: base, group: "no-image", verdict: "delete", reason,
    keep: null, note: doc.notes || "image required but did not render in capture — unanswerable",
    source: path.basename(src), addedAt: byFile.get(base)?.addedAt || now, updatedAt: now,
  };
  if (byFile.has(base)) updated++; else added++;
  byFile.set(base, rec);
}
const merged = {
  lang, dataset, updatedAt: now, source: path.basename(src), count: byFile.size,
  exclusions: [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file)),
};
const noImg = merged.exclusions.filter((e) => e.reason && e.reason.startsWith("no-image")).length;
const dup = merged.count - noImg;
console.log(`Registered no-image deletions: +${added} new, ${updated} updated.`);
console.log(`Registry ${path.basename(registryPath)} now: ${merged.count} total (${noImg} no-image, ${dup} duplicate).`);
if (dryRun) { console.log(`[dry-run] not written.`); }
else { fs.writeFileSync(registryPath, JSON.stringify(merged, null, 2) + "\n"); console.log(`Wrote ${path.relative(process.cwd(), registryPath)}`); }
