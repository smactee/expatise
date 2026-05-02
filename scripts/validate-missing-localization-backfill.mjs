#!/usr/bin/env node

import {
  BACKFILL_SOURCE,
  backfillPaths,
  loadBackfillContext,
  normalizeLang,
  validateDraftItems,
  renderValidationMarkdown,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  fileExists,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = normalizeLang(args.lang);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const context = loadBackfillContext({ lang, dataset });
const paths = backfillPaths({ lang, dataset, input: args.input });
const inputPath = args.input
  ? paths.generatedDraftPath
  : fileExists(paths.generatedDraftPath)
    ? paths.generatedDraftPath
    : paths.missingItemsPath;

if (!fileExists(inputPath)) {
  throw new Error(`Backfill validation input not found: ${relative(inputPath)}`);
}

const inputDoc = readJson(inputPath);
const isGeneratedDraft = inputPath.endsWith(".generated-draft.json") || inputDoc?.meta?.outputPath?.includes("generated-draft");
const rawItems = Array.isArray(inputDoc?.items) ? inputDoc.items : [];
const items = isGeneratedDraft
  ? rawItems
  : rawItems.map((item) => ({
      ...item,
      source: BACKFILL_SOURCE,
      lang,
      generatedTranslation: {
        prompt: "",
        options: {},
        explanation: "",
      },
      generationStatus: "not_generated",
      needsHumanReview: true,
    }));

const validation = validateDraftItems({
  items,
  context,
  requireGeneratedText: false,
  requireApproved: false,
});
const notes = [];

if (!isGeneratedDraft) {
  notes.push("Validated missing-qid work items because generated draft file does not exist yet.");
}
if (validation.warnings.some((entry) => entry.warning.includes("not_generated"))) {
  notes.push("Draft contains not_generated items; this is valid for staging but not merge-ready.");
}

const report = {
  generatedAt: new Date().toISOString(),
  source: BACKFILL_SOURCE,
  lang,
  dataset,
  inputPath: relative(inputPath),
  draftExists: fileExists(paths.generatedDraftPath),
  productionModified: false,
  counts: {
    masterQids: context.masterQuestions.length,
    productionTranslations: context.translationQids.size,
    missingQids: context.missingQids.length,
  },
  mergeReady: false,
  notes,
  validation,
};

await writeJson(paths.validationJsonPath, report);
await writeText(paths.validationMdPath, renderValidationMarkdown(report));

console.log(`Wrote ${relative(paths.validationJsonPath)}`);
console.log(`Wrote ${relative(paths.validationMdPath)}`);
console.log(`Validation valid: ${validation.valid ? "yes" : "no"}`);
console.log(`Missing ${lang} qids: ${context.missingQids.length}`);
console.log("Merge ready: no");
console.log("Production translations modified: no");

if (!validation.valid) {
  process.exitCode = 1;
}

function relative(filePath) {
  return filePath.replace(`${process.cwd()}/`, "");
}
