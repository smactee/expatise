#!/usr/bin/env node

import path from "node:path";

import {
  REPORTS_DIR,
  batchOptionsFromArgs,
  getBatchDir,
  getBatchFiles,
  listBatchScreenshotFiles,
  parseArgs,
  readJson,
  stableNow,
  summarizeExtractionItems,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";
import { isTrueFalseOptionSet, normalizeQuestionType } from "../qbank-tools/lib/decision-consistency.mjs";

const args = parseArgs();
const { lang, batchId, dataset } = batchOptionsFromArgs(args);
const batchDir = getBatchDir(lang, batchId);
const batchFiles = getBatchFiles(lang, batchId);
const intake = readJson(batchFiles.intakePath);
const screenshots = listBatchScreenshotFiles(batchDir);
const items = Array.isArray(intake.items) ? intake.items : [];
const summary = summarizeExtractionItems(items);
const itemFiles = new Set(items.map((item) => String(item.file ?? item.sourceImage ?? "").trim()).filter(Boolean));
const screenshotRelative = screenshots.map((filePath) => path.relative(batchDir, filePath));
const missingFromIntake = screenshotRelative.filter((file) => !itemFiles.has(file));
const staleIntakeItems = [...itemFiles].filter((file) => !screenshotRelative.includes(file));
// True/False items wrongly declared MCQ (the es batch-007 artifact): a 2-option
// "Verdadero/Falso" item must be questionType "row" with optionsRaw [], or it
// renders as a bogus 2-option MCQ and can't align to its row master.
const trueFalseDeclaredAsMcq = items
  .filter((item) => normalizeQuestionType(item.questionType ?? item.typeHint) === "MCQ" && isTrueFalseOptionSet(item.optionsRaw))
  .map((item) => String(item.itemId ?? item.file ?? item.sourceImage ?? "").trim());
const report = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  batchDir: path.relative(process.cwd(), batchDir),
  summary,
  missingFromIntake,
  staleIntakeItems,
  trueFalseDeclaredAsMcq,
};

await writeJson(batchFiles.extractionReportPath, report);
await writeJson(path.join(REPORTS_DIR, `validate-screenshot-intake-${lang}-${batchId}.json`), report);

let failed = false;
if (missingFromIntake.length > 0) {
  console.error(`Screenshot intake validation failed. ${missingFromIntake.length} screenshot(s) are missing from intake.json.`);
  failed = true;
}
if (trueFalseDeclaredAsMcq.length > 0) {
  console.error(
    `Screenshot intake validation failed. ${trueFalseDeclaredAsMcq.length} true/false item(s) are declared MCQ; ` +
    `set questionType/typeHint "row" and optionsRaw [] for:\n  ${trueFalseDeclaredAsMcq.join("\n  ")}`,
  );
  failed = true;
}
if (failed) {
  process.exit(1);
}

console.log(
  `Validated screenshot intake: ${summary.totalScreenshots} screenshots, ${summary.successfullyExtracted} success, ${summary.partialExtraction} partial, ${summary.failedExtraction} failed.`,
);
