#!/usr/bin/env node

import { applyReleaseCleanup, parseReleaseCleanupArgs } from "./release-cleanup-lib.mjs";

const args = parseReleaseCleanupArgs();
const result = await applyReleaseCleanup({
  dataset: args.dataset,
  dryRun: args.dryRun,
  allowDelete: args.allowDelete,
  archiveRoot: args.archiveRoot,
});

console.log(JSON.stringify({
  dryRun: result.dryRun,
  archiveRoot: result.archiveRoot,
  operationCount: result.operationCount,
  jsonPath: result.jsonPath,
  summaryPath: result.summaryPath,
  sampleOperations: result.operations.slice(0, 10),
}, null, 2));
