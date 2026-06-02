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
  loadClaimedQidsForLang,
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
// Exclude master qids already localized for this language by a prior batch
// (read from production translations.<lang>.json). Default ON. Disable with
// `--exclude-claimed false` when intentionally re-matching an already-merged batch.
const excludeClaimed = String(args["exclude-claimed"] ?? "true").trim().toLowerCase() !== "false";
const correctionRulesPath = args["correction-rules"]
  ? path.resolve(String(args["correction-rules"]))
  : path.join(path.dirname(DEFAULT_FEATURE_STORE_PATH), "correction-rules.json");
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
const correctionRules = correctionRulesPath && fileExists(correctionRulesPath)
  ? await loadCorrectionRulesFile(correctionRulesPath)
  : null;
const claimedQids = excludeClaimed ? loadClaimedQidsForLang({ dataset, lang }) : new Set();
const results = processBatchAgainstIndex(filteredIntake, matchIndex, {
  analysisMode,
  candidateLimit: topCandidates,
  correctionRules,
  claimedQids,
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
  claimedQidExclusion: {
    enabled: excludeClaimed,
    claimedQidCount: claimedQids.size,
    duplicateSuspectItems: [...results.matched, ...results.reviewNeeded, ...results.unresolved]
      .filter((item) => item?.analysis?.claimedQidExclusion?.duplicateSuspect === true)
      .map((item) => ({
        itemId: item.itemId,
        topExcludedClaimed: item.analysis.claimedQidExclusion.topExcludedClaimed?.[0] ?? null,
      })),
  },
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

const duplicateSuspectCount = [...results.matched, ...results.reviewNeeded, ...results.unresolved]
  .filter((item) => item?.analysis?.claimedQidExclusion?.duplicateSuspect === true).length;

console.log(
  `Processed ${filteredIntake.items.length} intake item(s): ${results.matched.length} matched, ${results.reviewNeeded.length} review-needed, ${results.unresolved.length} unresolved.`,
);
if (excludeClaimed) {
  console.log(
    `Claimed-qid exclusion ON: ${claimedQids.size} qid(s) already localized for "${lang}" were excluded from the candidate pool` +
      (duplicateSuspectCount > 0
        ? `; ${duplicateSuspectCount} item(s) flagged as likely target-language duplicate(s) (claimed-qid-duplicate-suspect).`
        : "."),
  );
} else {
  console.log(`Claimed-qid exclusion OFF (--exclude-claimed false).`);
}
