#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";

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
  getBatchDir,
  loadClaimedQidsForLang,
  loadDuplicateExclusionsForLang,
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
// Drop intake items whose screenshot is a confirmed in-app verbatim duplicate
// (registry built by `apply-duplicate-decisions`). Default ON. Disable with
// `--exclude-duplicates false`.
const excludeDuplicates = String(args["exclude-duplicates"] ?? "true").trim().toLowerCase() !== "false";
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
// Confirmed verbatim-duplicate screenshots to drop before matching.
const duplicateExclusions = excludeDuplicates
  ? loadDuplicateExclusionsForLang({ dataset, lang })
  : { files: new Set(), details: new Map() };
const isDuplicateScreenshot = (item) => {
  if (duplicateExclusions.files.size === 0) return false;
  const base = path.basename(String(item.file || item.sourceImage || ""));
  return base ? duplicateExclusions.files.has(base) : false;
};
const duplicateExcludedItems = excludeDuplicates ? intake.items.filter(isDuplicateScreenshot) : [];
const dedupedItems = excludeDuplicates
  ? intake.items.filter((item) => !isDuplicateScreenshot(item))
  : intake.items;
const filteredIntake = imageOnly
  ? {
    ...intake,
    items: dedupedItems.filter((item) => item.hasImage === true),
  }
  : { ...intake, items: dedupedItems };
const correctionRules = correctionRulesPath && fileExists(correctionRulesPath)
  ? await loadCorrectionRulesFile(correctionRulesPath)
  : null;
const claimedQids = excludeClaimed ? loadClaimedQidsForLang({ dataset, lang }) : new Set();
// Option-A semantic re-ranker (bge-small-en-v1.5) — ON by default. Uses precomputed
// vectors from scripts/qbank-embed.py when present, and is a safe no-op otherwise.
// Disable with `--embed-rerank false` or env QBANK_EMBED_RERANK=0.
const embedRerankDisabled =
  String(args["embed-rerank"] ?? "").trim().toLowerCase() === "false" ||
  process.env.QBANK_EMBED_RERANK === "0";
const embedRerankRequested =
  String(args["embed-rerank"] ?? "").trim().toLowerCase() === "true" ||
  process.env.QBANK_EMBED_RERANK === "1";
let embedRerank = null;
if (!embedRerankDisabled) {
  const loadVectorMap = (vectorPath) => {
    if (!fileExists(vectorPath)) return null;
    try {
      const doc = JSON.parse(fs.readFileSync(vectorPath, "utf8"));
      const map = new Map();
      for (const [key, vec] of Object.entries(doc.vectors ?? {})) map.set(key, Float32Array.from(vec));
      return map;
    } catch {
      return null;
    }
  };
  const masterVectors = loadVectorMap(path.join(GENERATED_DIR, "qid-prompt-embeddings.json"));
  const glossVectors = loadVectorMap(path.join(getBatchDir(lang, batchId), "gloss-embeddings.json"));
  if (masterVectors && glossVectors) {
    embedRerank = { masterVectors, glossVectors, richWeight: 0.9, genericWeight: 0, genericTokenThreshold: 4, topK: 8 };
    console.log(`Semantic re-rank ON (bge-small-en-v1.5): ${masterVectors.size} master + ${glossVectors.size} gloss vectors.`);
  } else if (embedRerankRequested) {
    console.warn(
      `embed-rerank requested but embeddings missing — run \`python scripts/qbank-embed.py build-master\` and ` +
        `\`python scripts/qbank-embed.py embed-batch --lang ${lang} --batch ${batchId}\`. Proceeding WITHOUT re-rank.`,
    );
  }
}
const results = processBatchAgainstIndex(filteredIntake, matchIndex, {
  analysisMode,
  candidateLimit: topCandidates,
  correctionRules,
  claimedQids,
  sourceLang: lang,
  embedRerank,
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
  duplicateExclusion: {
    enabled: excludeDuplicates,
    registrySize: duplicateExclusions.files.size,
    excludedItems: duplicateExcludedItems.map((item) => {
      const base = path.basename(String(item.file || item.sourceImage || ""));
      const rec = duplicateExclusions.details.get(base);
      return { itemId: item.itemId, file: base, group: rec?.group ?? null, keep: rec?.keep ?? null };
    }),
  },
  analysisMode,
  intakeStats: {
    originalItems: intake.items.length,
    itemsProcessed: filteredIntake.items.length,
    duplicateItemsSkipped: duplicateExcludedItems.length,
    nonImageItemsSkipped: imageOnly ? dedupedItems.length - filteredIntake.items.length : 0,
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
if (excludeDuplicates && duplicateExcludedItems.length > 0) {
  console.log(
    `Duplicate exclusion ON: dropped ${duplicateExcludedItems.length} confirmed verbatim-duplicate screenshot(s) before matching ` +
      `(registry: ${duplicateExclusions.files.size} for "${lang}").`,
  );
} else if (excludeDuplicates && duplicateExclusions.files.size > 0) {
  console.log(
    `Duplicate exclusion ON: ${duplicateExclusions.files.size} registered for "${lang}"; none present in this batch.`,
  );
}
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
