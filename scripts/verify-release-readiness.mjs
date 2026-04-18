#!/usr/bin/env node

import { parseReleaseCleanupArgs, verifyReleaseReadiness } from "./release-cleanup-lib.mjs";

const args = parseReleaseCleanupArgs();
const result = await verifyReleaseReadiness({
  dataset: args.dataset,
  checkWeb: args.checkWeb,
  checkAndroid: args.checkAndroid,
  reportFileName: args.reportFile,
});

console.log(JSON.stringify({
  status: result.status,
  reportPath: result.reportPath,
  checks: result.checks.map((check) => ({
    id: check.id,
    status: check.status,
  })),
}, null, 2));
