#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  approvedBatchItems,
  batchOptionsFromArgs,
  buildMergePreview,
  getBatchFiles,
  getDatasetPaths,
  parseArgs,
  readJson,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const batchFiles = getBatchFiles(lang, batchId);
const datasetPaths = getDatasetPaths(dataset, lang);

const matched = readJson(batchFiles.matchedPath).items ?? [];
const reviewNeeded = readJson(batchFiles.reviewNeededPath).items ?? [];
const existingTranslations = readJson(datasetPaths.translationPath);
const approvedItems = approvedBatchItems({ matched, reviewNeeded });
const merged = buildMergePreview({
  lang,
  batchId,
  dataset,
  existingDoc: existingTranslations,
  approvedItems,
});

const stagingPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const reportPath = path.join(REPORTS_DIR, `merge-reviewed-localizations-${lang}-${batchId}.json`);

await writeJson(stagingPath, merged);
await writeJson(reportPath, {
  generatedAt: new Date().toISOString(),
  lang,
  batchId,
  dataset,
  approvedItems: approvedItems.length,
  stagingPath: path.relative(process.cwd(), stagingPath),
});

console.log(`Staged ${approvedItems.length} approved localization(s) in ${path.relative(process.cwd(), stagingPath)}.`);
