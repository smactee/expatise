#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);

const previewPath = args["preview-path"]
  ? path.resolve(String(args["preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const reviewDecisionPath = args["review-decisions-path"]
  ? path.resolve(String(args["review-decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-review-decisions.json`);
const answerKeyDecisionPath = args["answer-key-decisions-path"]
  ? path.resolve(String(args["answer-key-decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-answer-key-decisions.json`);

const dryRunPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.merge-dry-run.json`);
const reportJsonPath = path.join(REPORTS_DIR, `dry-run-merge-review-${lang}-${batchId}.json`);
const reportMdPath = path.join(REPORTS_DIR, `dry-run-merge-review-${lang}-${batchId}.md`);

await ensurePipelineDirs({ lang, batchId });

if (!fileExists(previewPath)) {
  throw new Error(`Preview file not found: ${path.relative(process.cwd(), previewPath)}`);
}

if (!fileExists(reviewDecisionPath)) {
  throw new Error(`Review decisions file not found: ${path.relative(process.cwd(), reviewDecisionPath)}`);
}

if (!fileExists(answerKeyDecisionPath)) {
  throw new Error(`Answer-key decisions file not found: ${path.relative(process.cwd(), answerKeyDecisionPath)}`);
}

const datasetPaths = getDatasetPaths(dataset, lang);
const productionPaths = listProductionFiles(datasetPaths);
const productionHashesBefore = hashFiles(productionPaths);

const previewDoc = readJson(previewPath);
const reviewDecisionsDoc = readJson(reviewDecisionPath);
const answerKeyDecisionsDoc = readJson(answerKeyDecisionPath);
const masterQuestions = buildMasterQuestionMap(datasetPaths.questionsPath);
const previewQuestions = previewDoc?.questions && typeof previewDoc.questions === "object"
  ? previewDoc.questions
  : {};
const previewEntries = Object.entries(previewQuestions).map(([qid, question]) => ({ qid, question }));

const approvedReviewSet = new Set(
  (Array.isArray(reviewDecisionsDoc.items) ? reviewDecisionsDoc.items : [])
    .filter((item) => typeof item?.approvedQid === "string" && item.approvedQid.trim())
    .map((item) => String(item.approvedQid).trim()),
);
const answerKeyDecisionMap = new Map(
  (Array.isArray(answerKeyDecisionsDoc.items) ? answerKeyDecisionsDoc.items : []).map((item) => [
    String(item?.qid ?? "").trim(),
    {
      confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
      unknown: item?.unknown === true,
    },
  ]),
);

const validations = [];
const blockers = [];

for (const { qid, question } of previewEntries) {
  const master = masterQuestions.get(qid) ?? null;
  const canonicalType = normalizeQuestionType(question.canonicalQuestionType);
  const validation = {
    qid,
    qidExists: Boolean(master),
    approvedReviewDecisionPresent: approvedReviewSet.has(qid),
    canonicalType,
    rowRemainsRow: canonicalType === "ROW"
      ? normalizeQuestionType(master?.type) === "ROW" && !normalizeChoiceKey(question.localeCorrectOptionKey)
      : true,
    localeOptionOrderPreserved: canonicalType === "MCQ"
      ? localeOrderPreserved(question)
      : true,
    localeCorrectOptionKeyPresent: canonicalType === "MCQ"
      ? Boolean(normalizeChoiceKey(question.localeCorrectOptionKey))
      : true,
    optionMeaningMapAligned: canonicalType === "MCQ"
      ? optionMeaningMapAligned(question)
      : true,
    answerKeyDecisionConsistent: canonicalType === "MCQ"
      ? answerKeyDecisionConsistent(question, answerKeyDecisionMap.get(qid))
      : true,
  };

  validation.ready = Object.entries(validation)
    .filter(([key]) => key !== "qid" && key !== "canonicalType")
    .every(([, value]) => value === true);

  validations.push(validation);

  if (!validation.ready) {
    blockers.push({
      qid,
      reasons: Object.entries(validation)
        .filter(([key]) => !["qid", "canonicalType", "ready"].includes(key))
        .filter(([, value]) => value !== true)
        .map(([key]) => key),
    });
  }
}

const existingProduction = fileExists(datasetPaths.translationPath)
  ? readJson(datasetPaths.translationPath)
  : { meta: { locale: lang }, questions: {} };
const mergedQuestions = {
  ...(existingProduction?.questions && typeof existingProduction.questions === "object" ? existingProduction.questions : {}),
};

for (const { qid, question } of previewEntries) {
  mergedQuestions[qid] = structuredClone(question);
}

const dryRunMerge = {
  meta: {
    ...(existingProduction?.meta && typeof existingProduction.meta === "object" ? existingProduction.meta : {}),
    locale: lang,
    dataset,
    generatedAt: stableNow(),
    dryRun: true,
    dryRunBatchId: batchId,
    sourcePreviewPath: path.relative(process.cwd(), previewPath),
    sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionPath),
    sourceAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionPath),
    readyQidCount: previewEntries.length - blockers.length,
    blockerCount: blockers.length,
  },
  questions: mergedQuestions,
};

const diffSummary = previewEntries.map(({ qid, question }) => ({
  qid,
  prompt: question.prompt ?? question.promptRawJa ?? null,
  options: question.options && typeof question.options === "object" ? question.options : {},
  localeOptionOrder: Array.isArray(question.localeOptionOrder)
    ? question.localeOptionOrder.map((entry) => ({
      sourceKey: entry?.sourceKey ?? null,
      sourceText: entry?.sourceText ?? null,
      sourceGlossEn: entry?.sourceGlossEn ?? null,
    }))
    : [],
  localeCorrectOptionKey: normalizeChoiceKey(question.localeCorrectOptionKey),
  sourceImage: question.sourceImage ?? null,
  canonicalQuestionType: normalizeQuestionType(question.canonicalQuestionType),
}));

await writeJson(dryRunPath, dryRunMerge);

const productionHashesAfter = hashFiles(productionPaths);
const productionFilesUnchanged = compareHashes(productionHashesBefore, productionHashesAfter);

const reportJson = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope: "preview-only",
  sourcePreviewPath: path.relative(process.cwd(), previewPath),
  sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionPath),
  sourceAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionPath),
  dryRunMergePath: path.relative(process.cwd(), dryRunPath),
  totalPreviewQids: previewEntries.length,
  totalQidsReadyForMerge: previewEntries.length - blockers.length,
  blockers,
  validations,
  diffSummary,
  productionFilesUnchanged,
  productionFiles: productionPaths.map((filePath) => path.relative(process.cwd(), filePath)),
  safeToMergeNextStep: blockers.length === 0,
  note: "This dry-run merge review covers the qids present in the staged preview file.",
};

await writeJson(reportJsonPath, reportJson);
await writeText(reportMdPath, buildMarkdownReport(reportJson));

if (!productionFilesUnchanged) {
  throw new Error("Production files changed unexpectedly during dry-run merge review generation.");
}

console.log(
  `Prepared dry-run merge review for ${previewEntries.length - blockers.length}/${previewEntries.length} preview qid(s).`,
);

function buildMasterQuestionMap(questionsPath) {
  const doc = readJson(questionsPath);
  const list = Array.isArray(doc?.questions) ? doc.questions : Object.values(doc?.questions ?? {});
  return new Map(list.map((question) => [String(question?.id ?? "").trim(), question]));
}

function normalizeQuestionType(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MCQ" || normalized === "ROW") {
    return normalized;
  }
  return normalized || null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function localeOrderPreserved(question) {
  const raw = Array.isArray(question.optionsRawJa) ? question.optionsRawJa : [];
  const ordered = Array.isArray(question.localeOptionOrder) ? question.localeOptionOrder : [];
  if (raw.length !== ordered.length || raw.length === 0) {
    return false;
  }

  return raw.every((text, index) => String(text ?? "") === String(ordered[index]?.sourceText ?? ""));
}

function optionMeaningMapAligned(question) {
  const key = normalizeChoiceKey(question.localeCorrectOptionKey);
  if (!key) {
    return false;
  }

  const mapping = (Array.isArray(question.optionMeaningMap) ? question.optionMeaningMap : [])
    .find((entry) => normalizeChoiceKey(entry?.sourceKey) === key);

  if (!mapping) {
    return false;
  }

  return (
    String(mapping.canonicalOptionId ?? "") === String(question.canonicalCorrectOptionId ?? "") &&
    String(mapping.canonicalOptionKey ?? "") === String(question.canonicalCorrectOptionKey ?? "")
  );
}

function answerKeyDecisionConsistent(question, decision) {
  if (!decision) {
    return question?.answerKeyNeedsManualConfirmation !== true && Boolean(normalizeChoiceKey(question?.localeCorrectOptionKey));
  }

  if (decision.unknown) {
    return false;
  }

  return normalizeChoiceKey(question.localeCorrectOptionKey) === decision.confirmedCorrectOptionKey;
}

function listProductionFiles(paths) {
  const files = [
    paths.questionsPath,
    paths.rawQuestionsPath,
    paths.tagsPatchPath,
  ].filter((filePath) => fileExists(filePath));

  if (fileExists(paths.datasetDir)) {
    for (const entry of fs.readdirSync(paths.datasetDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      if (/^translations\.[a-z0-9-]+\.json$/i.test(entry.name)) {
        files.push(path.join(paths.datasetDir, entry.name));
      }
    }
  }

  return [...new Set(files)].sort();
}

function hashFiles(files) {
  const hashes = new Map();
  for (const filePath of files) {
    hashes.set(filePath, hashFile(filePath));
  }
  return hashes;
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function compareHashes(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [filePath, hash] of left.entries()) {
    if (right.get(filePath) !== hash) {
      return false;
    }
  }

  return true;
}

function buildMarkdownReport(report) {
  const lines = [
    `# Dry-Run Merge Review: ${report.lang} ${report.batchId}`,
    "",
    `- Dataset: \`${report.dataset}\``,
    `- Scope: \`${report.scope}\``,
    `- Preview qids: ${report.totalPreviewQids}`,
    `- Ready for merge: ${report.totalQidsReadyForMerge}`,
    `- Blockers: ${report.blockers.length}`,
    `- Safe to merge next step: ${report.safeToMergeNextStep ? "yes" : "no"}`,
    `- Dry-run artifact: \`${report.dryRunMergePath}\``,
    "",
  ];

  if (report.blockers.length > 0) {
    lines.push("## Blockers", "");
    for (const blocker of report.blockers) {
      lines.push(`- \`${blocker.qid}\`: ${blocker.reasons.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Diff Summary", "");

  for (const entry of report.diffSummary) {
    lines.push(`### ${entry.qid}`, "");
    lines.push("```diff");
    lines.push(`+ qid: ${entry.qid}`);
    lines.push(`+ type: ${entry.canonicalQuestionType}`);
    lines.push(`+ prompt: ${entry.prompt ?? ""}`);
    lines.push(`+ localeCorrectOptionKey: ${entry.localeCorrectOptionKey ?? "n/a"}`);
    lines.push(`+ sourceImage: ${entry.sourceImage ?? ""}`);
    if (entry.canonicalQuestionType === "MCQ") {
      lines.push("+ localeOptionOrder:");
      for (const option of entry.localeOptionOrder) {
        const gloss = option.sourceGlossEn ? ` (${option.sourceGlossEn})` : "";
        lines.push(`+   ${option.sourceKey}: ${option.sourceText ?? ""}${gloss}`);
      }
      lines.push("+ options:");
      for (const [optionId, text] of Object.entries(entry.options ?? {})) {
        lines.push(`+   ${optionId}: ${text ?? ""}`);
      }
    }
    lines.push("```", "");
  }

  return `${lines.join("\n")}\n`;
}
