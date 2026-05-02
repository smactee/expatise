#!/usr/bin/env node

import {
  BACKFILL_SOURCE,
  backfillPaths,
  loadBackfillContext,
  normalizeLang,
  normalizeQid,
  renderMergeMarkdown,
  reviewedTranslationToProductionEntry,
  validateDraftItems,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  booleanArg,
  fileExists,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = normalizeLang(args.lang);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const apply = booleanArg(args, "apply", false);
const allowOverwrite = booleanArg(args, "allow-overwrite", false);
const paths = backfillPaths({ lang, dataset, input: args.input });
const inputPath = args.input ? paths.reviewedPath : paths.reviewedPath;

if (!fileExists(inputPath)) {
  throw new Error(`Reviewed backfill input not found: ${relative(inputPath)}`);
}

const context = loadBackfillContext({ lang, dataset });
const inputDoc = readJson(inputPath);
const items = Array.isArray(inputDoc?.items) ? inputDoc.items : [];
const validation = validateDraftItems({
  items,
  context,
  requireGeneratedText: true,
  requireApproved: true,
});
const overlappingProductionQids = items
  .map((item) => normalizeQid(item?.qid))
  .filter((qid) => qid && context.translationQids.has(qid));

if (overlappingProductionQids.length && !allowOverwrite) {
  for (const qid of overlappingProductionQids) {
    validation.errors.push({ qid, error: "production translation already exists; pass --allow-overwrite true to replace" });
  }
  validation.valid = false;
  validation.counts.errorCount = validation.errors.length;
}

const mergeableQids = validation.valid
  ? items.map((item) => normalizeQid(item.qid)).sort()
  : [];
const report = {
  generatedAt: new Date().toISOString(),
  source: BACKFILL_SOURCE,
  lang,
  dataset,
  inputPath: relative(inputPath),
  applyRequested: apply,
  applied: false,
  allowOverwrite,
  productionModified: false,
  overlappingProductionQids,
  mergeableQids,
  validation,
};

if (apply && validation.valid) {
  const nextQuestions = {
    ...(context.translationsDoc.questions ?? {}),
  };

  for (const item of items) {
    const qid = normalizeQid(item.qid);
    const masterQuestion = context.masterByQid.get(qid);
    nextQuestions[qid] = reviewedTranslationToProductionEntry({ item, masterQuestion });
  }

  const nextDoc = {
    meta: {
      ...(context.translationsDoc.meta ?? {}),
      locale: lang,
      translatedQuestions: Object.keys(nextQuestions).length,
      generatedAt: new Date().toISOString(),
      backfillMerges: [
        ...new Set([
          ...((Array.isArray(context.translationsDoc.meta?.backfillMerges) && context.translationsDoc.meta.backfillMerges) || []),
          `missing-qid-backfill-${new Date().toISOString()}`,
        ]),
      ],
    },
    questions: Object.fromEntries(Object.entries(nextQuestions).sort(([left], [right]) => left.localeCompare(right))),
  };

  await writeJson(context.paths.translationsPath, nextDoc);
  report.applied = true;
  report.productionModified = true;
  report.productionCountBefore = context.translationQids.size;
  report.productionCountAfter = Object.keys(nextQuestions).length;
}

await writeJson(paths.mergeJsonPath, report);
await writeText(paths.mergeMdPath, renderMergeMarkdown(report));

console.log(`Wrote ${relative(paths.mergeJsonPath)}`);
console.log(`Wrote ${relative(paths.mergeMdPath)}`);
console.log(`Apply requested: ${apply ? "yes" : "no"}`);
console.log(`Applied: ${report.applied ? "yes" : "no"}`);
console.log(`Validation valid: ${validation.valid ? "yes" : "no"}`);
console.log(`Mergeable items: ${mergeableQids.length}`);
console.log(`Production translations modified: ${report.productionModified ? "yes" : "no"}`);

if (!validation.valid) {
  process.exitCode = 1;
}

function relative(filePath) {
  return filePath.replace(`${process.cwd()}/`, "");
}
