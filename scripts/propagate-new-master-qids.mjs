#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  compareQid,
  normalizeLang,
  normalizeQid,
  questionArray,
  questionQid,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  getDatasetPaths,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const PLACEHOLDER_STATUS = "missing";
const PLACEHOLDER_SOURCE = "auto-propagation";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const generatedAt = new Date().toISOString();
const datasetPaths = getDatasetPaths(dataset);
const reportJsonPath = path.join(REPORTS_DIR, "propagation-report.json");
const reportMdPath = path.join(REPORTS_DIR, "propagation-report.md");

if (!fs.existsSync(datasetPaths.questionsPath)) {
  throw new Error(`English master questions not found: ${relative(datasetPaths.questionsPath)}`);
}

const masterDoc = readJson(datasetPaths.questionsPath);
const masterQids = uniqueInOrder(questionArray(masterDoc).map(questionQid).filter(Boolean));
const masterQidSet = new Set(masterQids);
const translationFiles = listTranslationFiles(datasetPaths.datasetDir);

if (translationFiles.length === 0) {
  throw new Error(`No translations.*.json files found in ${relative(datasetPaths.datasetDir)}`);
}

const languageReports = [];
const newQidsDetected = new Set();

for (const translationFile of translationFiles) {
  const doc = readJson(translationFile.path);
  const questions = doc?.questions;

  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    throw new Error(`${relative(translationFile.path)} must contain a questions object`);
  }

  const existingKeys = Object.keys(questions);
  const existingQids = new Set(existingKeys.map(normalizeQid).filter(Boolean));
  const missingQids = masterQids.filter((qid) => !existingQids.has(qid));
  const extraQids = existingKeys
    .map(normalizeQid)
    .filter((qid) => qid && !masterQidSet.has(qid))
    .sort(compareQid);

  for (const qid of missingQids) {
    newQidsDetected.add(qid);
  }

  let updated = false;
  const nextQuestions = { ...questions };

  for (const qid of missingQids) {
    if (Object.hasOwn(nextQuestions, qid)) {
      continue;
    }
    nextQuestions[qid] = {
      qid,
      translationStatus: PLACEHOLDER_STATUS,
      source: PLACEHOLDER_SOURCE,
      createdAt: generatedAt,
    };
    updated = true;
  }

  if (updated) {
    await writeJson(translationFile.path, {
      ...doc,
      questions: nextQuestions,
    });
  }

  languageReports.push({
    lang: translationFile.lang,
    path: relative(translationFile.path),
    beforeCount: existingKeys.length,
    afterCount: Object.keys(nextQuestions).length,
    addedCount: missingQids.length,
    addedQids: [...missingQids].sort(compareQid),
    skippedExistingEntries: masterQids.length - missingQids.length,
    extraTranslationQids: extraQids,
    modified: updated,
  });
}

languageReports.sort((left, right) => left.lang.localeCompare(right.lang));

const report = {
  generatedAt,
  dataset,
  source: PLACEHOLDER_SOURCE,
  masterPath: relative(datasetPaths.questionsPath),
  reportPaths: {
    json: relative(reportJsonPath),
    markdown: relative(reportMdPath),
  },
  summary: {
    masterQids: masterQids.length,
    languagesProcessed: languageReports.length,
    totalEntriesAdded: languageReports.reduce((sum, entry) => sum + entry.addedCount, 0),
    newQidsDetectedCount: newQidsDetected.size,
  },
  languagesProcessed: languageReports.map((entry) => entry.lang),
  newQidsDetected: [...newQidsDetected].sort(compareQid),
  entriesAddedPerLanguage: Object.fromEntries(languageReports.map((entry) => [entry.lang, entry.addedCount])),
  skippedExistingEntries: Object.fromEntries(languageReports.map((entry) => [entry.lang, entry.skippedExistingEntries])),
  languages: languageReports,
};

await writeJson(reportJsonPath, report);
await writeText(reportMdPath, renderMarkdown(report));

console.log(`Wrote ${relative(reportJsonPath)}`);
console.log(`Wrote ${relative(reportMdPath)}`);
console.log(`Languages processed: ${report.languagesProcessed.join(", ")}`);
console.log(`New qids detected: ${report.newQidsDetected.join(", ") || "none"}`);
console.log(`Entries added: ${report.summary.totalEntriesAdded}`);

function listTranslationFiles(datasetDir) {
  return fs.readdirSync(datasetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(/^translations\.([^.]+)\.json$/);
      if (!match) return null;
      return {
        lang: normalizeLang(match[1]),
        path: path.join(datasetDir, entry.name),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.lang.localeCompare(right.lang));
}

function uniqueInOrder(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function renderMarkdown(reportData) {
  const lines = [];
  lines.push("# Master QID Propagation Report", "");
  lines.push(`Generated: ${reportData.generatedAt}`);
  lines.push(`Dataset: ${reportData.dataset}`);
  lines.push(`Master: ${reportData.masterPath}`);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(`- Languages processed: ${reportData.languagesProcessed.join(", ")}`);
  lines.push(`- Master qids: ${reportData.summary.masterQids}`);
  lines.push(`- New qids detected: ${reportData.newQidsDetected.join(", ") || "none"}`);
  lines.push(`- Total placeholder entries added: ${reportData.summary.totalEntriesAdded}`);
  lines.push("");
  lines.push("## Language Results", "");
  lines.push("| Language | Before | Added | After | Skipped existing | Extra translation qids |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- |");
  for (const entry of reportData.languages) {
    lines.push(`| ${entry.lang} | ${entry.beforeCount} | ${entry.addedCount} | ${entry.afterCount} | ${entry.skippedExistingEntries} | ${entry.extraTranslationQids.join(", ") || "none"} |`);
  }
  lines.push("");
  lines.push("## Added QIDs", "");
  for (const entry of reportData.languages) {
    lines.push(`- ${entry.lang}: ${entry.addedQids.join(", ") || "none"}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function relative(filePath) {
  return path.relative(process.cwd(), filePath);
}
