#!/usr/bin/env node

import { DEFAULT_DATASET, parseArgs } from "../qbank-tools/lib/pipeline.mjs";
import { planJapaneseCleanup } from "./japanese-review-intelligence-lib.mjs";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;

const result = await planJapaneseCleanup({ dataset });

console.log(JSON.stringify({
  outputPath: result.outputPath,
  groupCount: result.archiveManifest.groups.length,
  fileCount: result.archiveManifest.totals.fileCount,
  totalMegabytes: result.archiveManifest.totals.totalMegabytes,
}, null, 2));
