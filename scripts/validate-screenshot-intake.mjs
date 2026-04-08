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
const report = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  batchDir: path.relative(process.cwd(), batchDir),
  summary,
  missingFromIntake,
  staleIntakeItems,
};

await writeJson(batchFiles.extractionReportPath, report);
await writeJson(path.join(REPORTS_DIR, `validate-screenshot-intake-${lang}-${batchId}.json`), report);

if (missingFromIntake.length > 0) {
  console.error(`Screenshot intake validation failed. ${missingFromIntake.length} screenshot(s) are missing from intake.json.`);
  process.exit(1);
}

console.log(
  `Validated screenshot intake: ${summary.totalScreenshots} screenshots, ${summary.successfullyExtracted} success, ${summary.partialExtraction} partial, ${summary.failedExtraction} failed.`,
);
