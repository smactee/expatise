#!/usr/bin/env node

import path from "node:path";

import {
  GENERATED_DIR,
  REPORTS_DIR,
  batchOptionsFromArgs,
  buildMatchIndex,
  buildSyntheticMatchIndex,
  ensurePipelineDirs,
  loadQbankContext,
  parseArgs,
  processBatchAgainstIndex,
  readBatchIntake,
  reportSummary,
  writeBatchOutputs,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const analysisMode = String(args["analysis-mode"] ?? "standard");
const topCandidates = Number(args["top-candidates"] ?? (analysisMode === "diagnostic" ? 8 : 5));

await ensurePipelineDirs({ lang, batchId });

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const matchIndexPath = path.join(GENERATED_DIR, "match-index.json");
const syntheticMatchIndexPath = path.join(GENERATED_DIR, "match-index.ja.synthetic.json");
const matchIndex = buildMatchIndex(context);
const syntheticJaIndex = buildSyntheticMatchIndex(matchIndex, { lang: "ja" });
const intake = readBatchIntake({ lang, batchId });
const results = processBatchAgainstIndex(intake, matchIndex, {
  analysisMode,
  candidateLimit: topCandidates,
});

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
  analysisMode,
  intakeStats: {
    items: intake.items.length,
  },
  outputs: [
    reportSummary("matched", results.matched),
    reportSummary("review-needed", results.reviewNeeded),
    reportSummary("unresolved", results.unresolved),
  ],
});

console.log(
  `Processed ${intake.items.length} intake item(s): ${results.matched.length} matched, ${results.reviewNeeded.length} review-needed, ${results.unresolved.length} unresolved.`,
);
