#!/usr/bin/env node

import path from "node:path";

import {
  buildSyntheticMatchIndex,
  GENERATED_DIR,
  REPORTS_DIR,
  buildMatchIndex,
  ensurePipelineDirs,
  loadQbankContext,
  parseArgs,
  stringArg,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const dataset = stringArg(args, "dataset", "2023-test1");
const referenceLang = stringArg(args, "reference-lang", "ko");

await ensurePipelineDirs({ lang: referenceLang, batchId: "batch-001" });

const context = loadQbankContext({ dataset, referenceLang });
const index = buildMatchIndex(context);
const syntheticJaIndex = buildSyntheticMatchIndex(index, { lang: "ja" });
const matchIndexPath = path.join(GENERATED_DIR, "match-index.json");
const syntheticMatchIndexPath = path.join(GENERATED_DIR, "match-index.ja.synthetic.json");
const reportPath = path.join(REPORTS_DIR, "build-match-index-report.json");

await writeJson(matchIndexPath, index);
await writeJson(syntheticMatchIndexPath, syntheticJaIndex);
await writeJson(reportPath, {
  generatedAt: index.generatedAt,
  dataset,
  referenceLang,
  output: path.relative(process.cwd(), matchIndexPath),
  syntheticOutput: path.relative(process.cwd(), syntheticMatchIndexPath),
  stats: context.stats,
});

console.log(
  `Wrote ${path.relative(process.cwd(), matchIndexPath)} and ${path.relative(process.cwd(), syntheticMatchIndexPath)} (${context.stats.questions} questions).`,
);
