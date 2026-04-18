#!/usr/bin/env node

import {
  parsePilotArgs,
  runNextLanguagePreflight,
  writePilotArtifacts,
} from "./next-language-preflight-lib.mjs";

const args = parsePilotArgs();

if (!args.lang || !args.batchId) {
  throw new Error("Usage: node scripts/run-next-language-pilot.mjs --lang <lang> --batch <batch-id> [--dataset <dataset>] [--pilot-size 40] [--run-baseline] [--calibration-profile original|calibrated]");
}

const run = await runNextLanguagePreflight(args);
const artifacts = await writePilotArtifacts(run);

console.log(JSON.stringify({
  lang: run.lang,
  batchId: run.batchId,
  dataset: run.dataset,
  calibrationProfile: run.calibrationProfile,
  pilotSize: args.pilotSize,
  matchedBaseline: run.pilotItems.filter((item) => item.baselineSection === "matched").length,
  downgraded: run.pilotItems.filter((item) => item.preflightStatus === "downgrade").length,
  rerouted: run.pilotItems.filter((item) => item.preflightStatus === "reroute").length,
  artifacts,
}, null, 2));
