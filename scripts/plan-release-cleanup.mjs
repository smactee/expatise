#!/usr/bin/env node

import { planReleaseCleanup, parseReleaseCleanupArgs } from "./release-cleanup-lib.mjs";

const args = parseReleaseCleanupArgs();
const result = await planReleaseCleanup({ dataset: args.dataset });

console.log(JSON.stringify({
  manifestPath: result.manifestPath,
  summaryPath: result.summaryPath,
  groupCount: result.manifest.groups.length,
  safeToArchiveNow: result.manifest.groups.filter((group) => group.classification === "SAFE_TO_ARCHIVE_NOW").length,
  excludeFromDeployUpload: result.manifest.deployExcludeGroups.length,
}, null, 2));
