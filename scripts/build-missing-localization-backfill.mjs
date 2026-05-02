#!/usr/bin/env node

import {
  BACKFILL_SOURCE,
  backfillPaths,
  buildMissingBackfillItems,
  loadBackfillContext,
  normalizeLang,
  parseLimit,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  booleanArg,
  parseArgs,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = normalizeLang(args.lang);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const limit = parseLimit(args.limit);
const apply = booleanArg(args, "apply", false);

const context = loadBackfillContext({ lang, dataset });
const paths = backfillPaths({ lang, dataset });
const items = buildMissingBackfillItems(context, { limit });

const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: BACKFILL_SOURCE,
    lang,
    dataset,
    applyRequested: apply,
    productionModified: false,
    limit,
    sourcePaths: {
      masterQuestions: relative(paths.masterPath),
      productionTranslations: relative(paths.translationsPath),
      imageColorTags: relative(paths.imageColorTagsPath),
    },
    outputPath: relative(paths.missingItemsPath),
  },
  counts: {
    masterQids: context.masterQuestions.length,
    productionTranslations: context.translationQids.size,
    missingQids: context.missingQids.length,
    emittedItems: items.length,
  },
  missingQids: context.missingQids,
  items,
};

await writeJson(paths.missingItemsPath, output);

console.log(`Wrote ${relative(paths.missingItemsPath)}`);
console.log(`Missing ${lang} qids: ${context.missingQids.length}`);
console.log(`Emitted backfill items: ${items.length}`);
console.log("Production translations modified: no");

function relative(filePath) {
  return filePath.replace(`${process.cwd()}/`, "");
}
