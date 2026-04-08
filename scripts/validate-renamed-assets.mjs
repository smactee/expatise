#!/usr/bin/env node

import path from "node:path";

import {
  GENERATED_DIR,
  REPORTS_DIR,
  loadQbankContext,
  parseArgs,
  readJson,
  stringArg,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const dataset = stringArg(args, "dataset", "2023-test1");
const referenceLang = stringArg(args, "reference-lang", "ko");
const context = loadQbankContext({ dataset, referenceLang });
const renamePlan = readJson(path.join(GENERATED_DIR, "asset-rename-map.json"));

const currentSrcs = new Set();
const proposed = new Set();
const errors = [];

for (const row of renamePlan.renameMap ?? []) {
  if (currentSrcs.has(row.currentSrc)) {
    errors.push(`Duplicate currentSrc: ${row.currentSrc}`);
  }
  currentSrcs.add(row.currentSrc);

  if (proposed.has(row.proposedBasename)) {
    errors.push(`Duplicate proposedBasename: ${row.proposedBasename}`);
  }
  proposed.add(row.proposedBasename);

  const question = context.questions.find((candidate) => candidate.image.currentAssetSrc === row.currentSrc);
  if (!question) {
    errors.push(`Current asset is not referenced by match index: ${row.currentSrc}`);
    continue;
  }

  const asset = question.image.assets.find((candidate) => candidate.src === row.currentSrc);
  if (!asset?.existsOnDisk) {
    errors.push(`Missing asset file: ${row.currentSrc}`);
  }

  if (!row.proposedBasename.includes(asset.shortHash)) {
    errors.push(`Proposed basename does not include short hash ${asset.shortHash}: ${row.proposedBasename}`);
  }
}

const reportPath = path.join(REPORTS_DIR, "validate-renamed-assets-report.json");

await writeJson(reportPath, {
  generatedAt: new Date().toISOString(),
  dataset,
  referenceLang,
  checkedAssets: renamePlan.renameMap?.length ?? 0,
  errors,
});

if (errors.length > 0) {
  console.error(`Asset rename validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Validated ${renamePlan.renameMap?.length ?? 0} dry-run asset rename entries.`);
