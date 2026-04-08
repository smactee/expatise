#!/usr/bin/env node

import path from "node:path";

import {
  REPORTS_DIR,
  batchOptionsFromArgs,
  getBatchFiles,
  parseArgs,
  readJson,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const files = getBatchFiles(lang, batchId);

const matched = readJson(files.matchedPath).items ?? [];
const reviewNeeded = readJson(files.reviewNeededPath).items ?? [];
const unresolved = readJson(files.unresolvedPath).items ?? [];
const seen = new Set();
const errors = [];

for (const entry of [...matched, ...reviewNeeded, ...unresolved]) {
  if (!entry.itemId) {
    errors.push("Encountered batch entry without itemId.");
    continue;
  }

  if (seen.has(entry.itemId)) {
    errors.push(`Duplicate itemId across batch outputs: ${entry.itemId}`);
  }

  seen.add(entry.itemId);
}

for (const entry of matched) {
  if (!entry.match?.qid) {
    errors.push(`Matched entry is missing qid: ${entry.itemId}`);
  }
}

for (const entry of reviewNeeded) {
  if (!Array.isArray(entry.topCandidates) || entry.topCandidates.length === 0) {
    errors.push(`Review-needed entry has no candidate list: ${entry.itemId}`);
  }
}

for (const entry of unresolved) {
  if (!entry.reason) {
    errors.push(`Unresolved entry is missing a reason: ${entry.itemId}`);
  }
}

const reportPath = path.join(REPORTS_DIR, `validate-localization-batch-${lang}-${batchId}.json`);

await writeJson(reportPath, {
  generatedAt: new Date().toISOString(),
  lang,
  batchId,
  dataset,
  counts: {
    matched: matched.length,
    reviewNeeded: reviewNeeded.length,
    unresolved: unresolved.length,
  },
  errors,
});

if (errors.length > 0) {
  console.error(`Batch validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Validated batch ${batchId} for ${lang}.`);
