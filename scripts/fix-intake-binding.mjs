#!/usr/bin/env node
/**
 * fix-intake-binding.mjs
 *
 * Repairs a file<->content desync in intake.json by swapping every CONTENT
 * field between two records while keeping their identity fields
 * ({itemId, file, sourceImage, lang}) pinned to the on-disk file.
 *
 * Use after verify-intake-binding.mjs flags a swapped pair. Writes a timestamped
 * backup of intake.json before mutating.
 *
 * Usage:
 *   node scripts/fix-intake-binding.mjs --lang zh --batch batch-004 \
 *     --swap "screenshots/Screenshot 2026-05-25 at 14.32.17.png::screenshots/Screenshot 2026-05-25 at 14.32.18.png"
 *   (repeat --swap for multiple pairs)
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  batchOptionsFromArgs,
  getBatchFiles,
  normalizeWhitespace,
  parseArgs,
  readJson,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const IDENTITY_KEYS = new Set(["itemId", "file", "sourceImage", "lang"]);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const { lang, batchId } = batchOptionsFromArgs(args);
  const swaps = collectSwaps(args);
  if (!swaps.length) throw new Error('Provide at least one --swap "fileA::fileB"');

  const batchFiles = getBatchFiles(lang, batchId);
  const intake = await readJson(batchFiles.intakePath);
  const items = intake.items ?? [];

  const findItem = (file) => {
    const norm = normalizeWhitespace(file);
    const it = items.find(
      (x) => normalizeWhitespace(x.file ?? x.sourceImage ?? "") === norm,
    );
    if (!it) throw new Error(`Record not found for file: ${file}`);
    return it;
  };

  // Backup
  const backupPath = batchFiles.intakePath.replace(
    /\.json$/,
    `.pre-bindingfix.bak.json`,
  );
  await fs.writeFile(backupPath, JSON.stringify(intake, null, 2));

  for (const [fileA, fileB] of swaps) {
    const a = findItem(fileA);
    const b = findItem(fileB);
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let swapped = 0;
    for (const k of keys) {
      if (IDENTITY_KEYS.has(k)) continue;
      const tmp = a[k];
      a[k] = b[k];
      b[k] = tmp;
      swapped += 1;
    }
    console.log(
      `Swapped ${swapped} content field(s) between:\n  ${fileA}\n  ${fileB}`,
    );
  }

  await writeJson(batchFiles.intakePath, intake);
  console.log(`\nWrote ${path.relative(process.cwd(), batchFiles.intakePath)}`);
  console.log(`Backup: ${path.relative(process.cwd(), backupPath)}`);
}

function collectSwaps(args) {
  const raw = args.swap ?? args.swaps ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter(Boolean)
    .map((s) => {
      const [a, b] = String(s).split("::");
      if (!a || !b) throw new Error(`Bad --swap value (need fileA::fileB): ${s}`);
      return [a.trim(), b.trim()];
    });
}
