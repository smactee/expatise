#!/usr/bin/env node

import {
  parsePilotArgs,
  runNextLanguagePreflight,
  writePilotArtifacts,
} from "./next-language-preflight-lib.mjs";
import {
  writeCalibrationArtifacts,
  writeDowngradeAuditArtifacts,
} from "./next-language-preflight-audit-lib.mjs";

const args = parsePilotArgs();

if (!args.lang || !args.batchId) {
  throw new Error("Usage: node scripts/calibrate-preflight-rules.mjs --lang <lang> --batch <batch-id> [--dataset <dataset>] [--pilot-size 40] [--run-baseline]");
}

const originalRun = await runNextLanguagePreflight({
  ...args,
  calibrationProfile: "original",
});
await writePilotArtifacts(originalRun);
const auditArtifacts = await writeDowngradeAuditArtifacts(originalRun);

const calibratedRun = await runNextLanguagePreflight({
  ...args,
  runBaseline: false,
  calibrationProfile: "calibrated",
});
const calibratedPreflightArtifacts = await writePilotArtifacts(calibratedRun, { prefix: "calibrated_" });
const calibrationArtifacts = await writeCalibrationArtifacts({
  originalRun,
  calibratedRun,
  auditArtifacts,
});

console.log(JSON.stringify({
  lang: originalRun.lang,
  batchId: originalRun.batchId,
  dataset: originalRun.dataset,
  originalProfile: originalRun.calibrationProfile,
  calibratedProfile: calibratedRun.calibrationProfile,
  calibratedPreflightArtifacts,
  calibrationArtifacts: calibrationArtifacts.paths,
}, null, 2));
