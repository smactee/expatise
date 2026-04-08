#!/usr/bin/env node

import path from "node:path";

import {
  GENERATED_DIR,
  REPORTS_DIR,
  buildAssetRenamePlan,
  ensurePipelineDirs,
  loadQbankContext,
  parseArgs,
  stringArg,
  writeCsv,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const dataset = stringArg(args, "dataset", "2023-test1");
const referenceLang = stringArg(args, "reference-lang", "ko");

await ensurePipelineDirs({ lang: referenceLang, batchId: "batch-001" });

const context = loadQbankContext({ dataset, referenceLang });
const plan = buildAssetRenamePlan(context);
const jsonPath = path.join(GENERATED_DIR, "asset-rename-map.json");
const csvPath = path.join(GENERATED_DIR, "asset-rename-preview.csv");
const reportPath = path.join(REPORTS_DIR, "dry-run-asset-rename-report.json");

await writeJson(jsonPath, plan);
await writeCsv(csvPath, [
  "currentSrc",
  "currentBasename",
  "currentHash",
  "proposedBasename",
  "proposedSrc",
  "qids",
  "numbers",
  "topic",
  "subtopics",
  "dryRun",
  "semanticSource",
], plan.renameMap);

await writeJson(reportPath, {
  generatedAt: plan.generatedAt,
  dataset,
  namingStrategy: plan.namingStrategy,
  stats: plan.stats,
  outputs: {
    renameMap: path.relative(process.cwd(), jsonPath),
    previewCsv: path.relative(process.cwd(), csvPath),
  },
});

console.log(`Wrote ${path.relative(process.cwd(), jsonPath)} and ${path.relative(process.cwd(), csvPath)}.`);
