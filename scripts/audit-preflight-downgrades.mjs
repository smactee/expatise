#!/usr/bin/env node

import {
  parsePilotArgs,
  runNextLanguagePreflight,
  writePilotArtifacts,
} from "./next-language-preflight-lib.mjs";
import { writeDowngradeAuditArtifacts } from "./next-language-preflight-audit-lib.mjs";

const args = parsePilotArgs();

if (!args.lang || !args.batchId) {
  throw new Error("Usage: node scripts/audit-preflight-downgrades.mjs --lang <lang> --batch <batch-id> [--dataset <dataset>] [--pilot-size 40] [--run-baseline]");
}

const run = await runNextLanguagePreflight({
  ...args,
  calibrationProfile: "original",
});

const preflightArtifacts = await writePilotArtifacts(run);
const auditArtifacts = await writeDowngradeAuditArtifacts(run);

console.log(JSON.stringify({
  lang: run.lang,
  batchId: run.batchId,
  dataset: run.dataset,
  calibrationProfile: run.calibrationProfile,
  downgradedItems: auditArtifacts.auditRecords.length,
  preflightArtifacts,
  auditArtifacts: auditArtifacts.paths,
}, null, 2));
