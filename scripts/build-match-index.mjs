#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_FEATURE_STORE_PATH,
  buildSyntheticMatchIndex,
  GENERATED_DIR,
  REPORTS_DIR,
  buildQidFeatureStore,
  buildMatchIndex,
  loadQbankContext,
  parseArgs,
  stringArg,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const dataset = stringArg(args, "dataset", "2023-test1");
const referenceLang = stringArg(args, "reference-lang", "ko");
const featureStorePath = args["feature-store-out"]
  ? path.resolve(String(args["feature-store-out"]))
  : DEFAULT_FEATURE_STORE_PATH;

const context = loadQbankContext({ dataset, referenceLang });
const featureStore = buildQidFeatureStore(context, { dataset });
const index = buildMatchIndex(context, {
  featureStore,
  featureStorePath,
});
const syntheticJaIndex = buildSyntheticMatchIndex(index, { lang: "ja" });
const matchIndexPath = path.join(GENERATED_DIR, "match-index.json");
const syntheticMatchIndexPath = path.join(GENERATED_DIR, "match-index.ja.synthetic.json");
const reportPath = path.join(REPORTS_DIR, "build-match-index-report.json");

await writeJson(featureStorePath, featureStore);
await writeJson(matchIndexPath, index);
await writeJson(syntheticMatchIndexPath, syntheticJaIndex);
await writeJson(reportPath, {
  generatedAt: index.generatedAt,
  dataset,
  referenceLang,
  featureSchemaVersion: featureStore.featureSchemaVersion,
  featureStore: path.relative(process.cwd(), featureStorePath),
  output: path.relative(process.cwd(), matchIndexPath),
  syntheticOutput: path.relative(process.cwd(), syntheticMatchIndexPath),
  stats: {
    ...context.stats,
    featureStoreQuestions: featureStore.stats.questionCount,
    translationCoverage: featureStore.stats.translationCoverage,
    glossCoverageByLang: featureStore.stats.glossCoverageByLang ?? {},
    glossModesByLang: featureStore.stats.glossModesByLang ?? {},
  },
});

console.log(
  `Wrote ${path.relative(process.cwd(), featureStorePath)}, ${path.relative(process.cwd(), matchIndexPath)}, and ${path.relative(process.cwd(), syntheticMatchIndexPath)} (${context.stats.questions} questions).`,
);
