#!/usr/bin/env node

import path from "node:path";

import {
  CURRENT_FEATURE_SCHEMA_VERSION,
  DEFAULT_FEATURE_STORE_PATH,
  GENERATED_DIR,
  REPORTS_DIR,
  batchOptionsFromArgs,
  buildQidFeatureStore,
  buildMatchIndex,
  buildSyntheticMatchIndex,
  ensurePipelineDirs,
  fileExists,
  loadCorrectionRulesFile,
  loadFeatureStoreFile,
  loadQbankContext,
  parseArgs,
  processBatchAgainstIndex,
  readBatchIntake,
  reportSummary,
  writeBatchOutputs,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

function incrementCounter(map, key) {
  if (!key) {
    return;
  }

  map[key] = (map[key] ?? 0) + 1;
}

function summarizeDecisions(groups) {
  const summary = {
    byDisposition: {},
    byReasonCode: {},
    byProfile: {},
  };

  for (const [kind, items] of Object.entries(groups)) {
    const reasonCounts = {};
    const profileCounts = {};

    for (const item of items) {
      const profile =
        item?.analysis?.autoMatch?.profile ??
        item?.analysis?.matchingProfile ??
        item?.topCandidates?.[0]?.diagnostics?.matchingProfile ??
        null;
      incrementCounter(profileCounts, profile ?? "unknown");

      for (const code of item?.analysis?.decisionReasonCodes ?? []) {
        incrementCounter(reasonCounts, code);
        incrementCounter(summary.byReasonCode, code);
      }
    }

    summary.byDisposition[kind] = {
      count: items.length,
      profiles: profileCounts,
      reasonCodes: reasonCounts,
    };
    summary.byProfile[kind] = profileCounts;
  }

  return summary;
}

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const analysisMode = String(args["analysis-mode"] ?? "standard");
const topCandidates = Number(args["top-candidates"] ?? (analysisMode === "diagnostic" ? 8 : 5));
const imageOnly = String(args["image-only"] ?? "false").trim().toLowerCase() === "true";
const correctionRulesPath = args["correction-rules"]
  ? path.resolve(String(args["correction-rules"]))
  : null;
const featureStorePath = args["feature-store"]
  ? path.resolve(String(args["feature-store"]))
  : DEFAULT_FEATURE_STORE_PATH;

await ensurePipelineDirs({ lang, batchId });

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const matchIndexPath = path.join(GENERATED_DIR, "match-index.json");
const syntheticMatchIndexPath = path.join(GENERATED_DIR, "match-index.ja.synthetic.json");
const loadedFeatureStore = fileExists(featureStorePath)
  ? await loadFeatureStoreFile(featureStorePath)
  : null;
const shouldRebuildFeatureStore =
  !loadedFeatureStore ||
  Number(loadedFeatureStore.featureSchemaVersion ?? 0) < CURRENT_FEATURE_SCHEMA_VERSION;
const featureStore = shouldRebuildFeatureStore
  ? buildQidFeatureStore(context, { dataset })
  : loadedFeatureStore;
const matchIndex = buildMatchIndex(context, {
  featureStore,
  featureStorePath,
});
const syntheticJaIndex = buildSyntheticMatchIndex(matchIndex, { lang: "ja" });
const intake = readBatchIntake({ lang, batchId });
const filteredIntake = imageOnly
  ? {
    ...intake,
    items: intake.items.filter((item) => item.hasImage === true),
  }
  : intake;
const correctionRules = correctionRulesPath
  ? await loadCorrectionRulesFile(correctionRulesPath)
  : null;
const results = processBatchAgainstIndex(filteredIntake, matchIndex, {
  analysisMode,
  candidateLimit: topCandidates,
  correctionRules,
  sourceLang: lang,
});

await writeJson(featureStorePath, featureStore);
await writeJson(matchIndexPath, matchIndex);
await writeJson(syntheticMatchIndexPath, syntheticJaIndex);
await writeBatchOutputs({
  lang,
  batchId,
  dataset,
  matched: results.matched,
  reviewNeeded: results.reviewNeeded,
  unresolved: results.unresolved,
});

await writeJson(path.join(REPORTS_DIR, `process-screenshot-batch-${lang}-${batchId}.json`), {
  generatedAt: new Date().toISOString(),
  lang,
  batchId,
  dataset,
  matchIndexPath: path.relative(process.cwd(), matchIndexPath),
  syntheticMatchIndexPath: path.relative(process.cwd(), syntheticMatchIndexPath),
  featureStorePath: path.relative(process.cwd(), featureStorePath),
  featureStoreRebuilt: shouldRebuildFeatureStore,
  featureSchemaVersion: featureStore.featureSchemaVersion,
  correctionRulesPath: correctionRulesPath ? path.relative(process.cwd(), correctionRulesPath) : null,
  analysisMode,
  intakeStats: {
    originalItems: intake.items.length,
    itemsProcessed: filteredIntake.items.length,
    nonImageItemsSkipped: imageOnly ? intake.items.length - filteredIntake.items.length : 0,
    imageOnly,
  },
  outputs: [
    reportSummary("matched", results.matched),
    reportSummary("review-needed", results.reviewNeeded),
    reportSummary("unresolved", results.unresolved),
  ],
  decisionSummary: summarizeDecisions({
    matched: results.matched,
    "review-needed": results.reviewNeeded,
    unresolved: results.unresolved,
  }),
});

console.log(
  `Processed ${filteredIntake.items.length} intake item(s): ${results.matched.length} matched, ${results.reviewNeeded.length} review-needed, ${results.unresolved.length} unresolved.`,
);
