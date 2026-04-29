#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_FEATURE_STORE_PATH,
  buildQidFeatureStore,
  loadQbankContext,
  parseArgs,
  stringArg,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const dataset = stringArg(args, "dataset", "2023-test1");
const referenceLang = stringArg(args, "reference-lang", "ko");
const outPath = args.out
  ? path.resolve(String(args.out))
  : DEFAULT_FEATURE_STORE_PATH;

const context = loadQbankContext({ dataset, referenceLang });
const featureStore = buildQidFeatureStore(context, { dataset });

await writeJson(outPath, featureStore);

console.log(
  `Wrote ${path.relative(process.cwd(), outPath)} (${featureStore.stats.questionCount} QIDs, ${featureStore.languages.length - 1} translation language(s)).`,
);
