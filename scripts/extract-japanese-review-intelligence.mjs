#!/usr/bin/env node

import { DEFAULT_DATASET, parseArgs } from "../qbank-tools/lib/pipeline.mjs";
import { extractJapaneseReviewIntelligence } from "./japanese-review-intelligence-lib.mjs";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;

const result = await extractJapaneseReviewIntelligence({ dataset });

console.log(JSON.stringify({
  outputDir: result.outputDir,
  reviewGroundTruth: result.records.length,
  automatchEval: result.automatchRows.length,
  benchmarkSet: result.benchmarkRows.length,
  archiveManifestGroups: result.archiveManifest.groups.length,
}, null, 2));
