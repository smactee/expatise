#!/usr/bin/env node
// Ingest a reviewed duplicate-workbench export (es-duplicates-decisions.json)
// into the per-language duplicate-exclusion registry that the matcher honors.
//
// Usage:
//   npm run apply-duplicate-decisions -- --lang es --path ~/Downloads/es-duplicates-decisions.json
//   (omit --path to auto-locate the newest *-duplicates-decisions.json in ~/Downloads
//    then the repo's imports/<lang>/_dupscan/)
//
// Only groups whose verdict is "dup" contribute deletions. Each group's `delete`
// files are added to the registry; the `keep` file is recorded as provenance.
// Idempotent: re-running merges/updates without creating duplicate entries.
// Pass --dry-run to preview without writing.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_DATASET,
  duplicateExclusionsPath,
  normalizeLang,
  parseArgs,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const lang = normalizeLang(args.lang || "es");
const dataset = args.dataset || DEFAULT_DATASET;
const dryRun = String(args["dry-run"] ?? "false").toLowerCase() === "true" || args["dry-run"] === true;

function findDecisionsFile() {
  if (args.path) {
    return path.resolve(String(args.path).replace(/^~/, os.homedir()));
  }
  const candidates = [];
  const dirs = [
    path.join(os.homedir(), "Downloads"),
    path.join(os.homedir(), "Downloads", "Expatise"),
    path.resolve(`imports/${lang}/_dupscan`),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/duplicates?-decisions.*\.json$/i.test(f)) {
        const full = path.join(dir, f);
        candidates.push({ full, mtime: fs.statSync(full).mtimeMs });
      }
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full ?? null;
}

const decisionsFile = findDecisionsFile();
if (!decisionsFile || !fs.existsSync(decisionsFile)) {
  console.error(
    "No duplicate-decisions JSON found. Export one from the workbench, then pass --path <file> " +
      "(searched ~/Downloads, ~/Downloads/Expatise, imports/" + lang + "/_dupscan).",
  );
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(decisionsFile, "utf8"));
if (!Array.isArray(doc.decisions)) {
  console.error(`Malformed decisions file (no .decisions array): ${decisionsFile}`);
  process.exit(1);
}
if (doc.lang && normalizeLang(doc.lang) !== lang) {
  console.error(`Decisions file lang "${doc.lang}" != --lang "${lang}". Aborting.`);
  process.exit(1);
}

const registryPath = duplicateExclusionsPath({ dataset, lang });
const existing =
  fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : { lang, dataset, exclusions: [] };
const byFile = new Map((existing.exclusions || []).map((e) => [path.basename(String(e.file)), e]));

const now = new Date().toISOString();
const sourceName = path.basename(decisionsFile);
let added = 0;
let updated = 0;
const skippedGroups = { not: 0, unsure: 0, noDelete: 0 };

for (const d of doc.decisions) {
  if (d.verdict !== "dup") {
    if (d.verdict === "not") skippedGroups.not++;
    else if (d.verdict === "unsure") skippedGroups.unsure++;
    continue;
  }
  const dels = Array.isArray(d.delete) ? d.delete : [];
  const keep = Array.isArray(d.keep) ? d.keep[0] : d.keep;
  if (dels.length === 0) {
    skippedGroups.noDelete++;
    continue;
  }
  for (const file of dels) {
    const base = path.basename(String(file));
    const record = {
      file: base,
      group: d.id,
      verdict: d.verdict,
      keep: keep ? path.basename(String(keep)) : null,
      prompt: d.prompt || "",
      note: d.notes || "",
      source: sourceName,
      addedAt: byFile.get(base)?.addedAt || now,
      updatedAt: now,
    };
    if (byFile.has(base)) updated++;
    else added++;
    byFile.set(base, record);
  }
}

const merged = {
  lang,
  dataset,
  updatedAt: now,
  source: sourceName,
  count: byFile.size,
  exclusions: [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file)),
};

console.log(`Source: ${decisionsFile}`);
console.log(
  `Duplicate groups marked "dup": added ${added} new exclusion(s), updated ${updated}; ` +
    `registry now holds ${merged.count} screenshot(s).`,
);
console.log(
  `Skipped non-deletions: ${skippedGroups.not} "not-dup" group(s), ${skippedGroups.unsure} "unsure", ` +
    `${skippedGroups.noDelete} dup-group(s) with nothing marked delete.`,
);

if (dryRun) {
  console.log(`\n[dry-run] would write ${registryPath} (no changes made).`);
} else {
  fs.writeFileSync(registryPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), registryPath)}`);
}
