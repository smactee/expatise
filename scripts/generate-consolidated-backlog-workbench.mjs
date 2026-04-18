#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  GENERATED_DIR,
  IMPORTS_DIR,
  REPORTS_DIR,
  STAGING_DIR,
  ensureDir,
  fileExists,
  getBatchFiles,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = String(args.lang ?? "ja").trim().toLowerCase() || "ja";
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const backlogId = String(args["backlog-id"] ?? "consolidated-backlog").trim().toLowerCase() || "consolidated-backlog";

const sourceDocPath = path.join(STAGING_DIR, `consolidated-backlog.${lang}.json`);
const htmlPath = path.join(REPORTS_DIR, `${lang}-${backlogId}-workbench.html`);
const decisionsPath = path.join(STAGING_DIR, `${lang}-${backlogId}-workbench-decisions.json`);
const translationPath = path.join(process.cwd(), "public", "qbank", dataset, `translations.${lang}.json`);

await ensureDir(STAGING_DIR);
await ensureDir(REPORTS_DIR);

const productionSourceKeys = loadProductionSourceKeys(translationPath);
const pendingFiles = discoverPendingFiles(lang);
const items = [];
const seenKeys = new Map();
const counts = {
  unresolved: 0,
  newQuestion: 0,
};

for (const filePath of pendingFiles) {
  const doc = readJson(filePath);
  const sourceItems = Array.isArray(doc.items) ? doc.items : [];
  const batchIdMatch = path.basename(filePath).match(/(batch-\d+)/);
  const batchId = batchIdMatch?.[1] ?? "unknown-batch";
  const isNewQuestionFile = path.basename(filePath).startsWith(`new-question-candidates.${lang}.`);
  const backlogKind = isNewQuestionFile
    ? "new-question-candidate"
    : path.basename(filePath).endsWith(".unresolved.json")
      ? "unresolved-leftover"
      : "follow-up-leftover";

  for (const sourceItem of sourceItems) {
    const sourceKey = normalizeText(sourceItem.sourceImage) ?? normalizeText(sourceItem.itemId) ?? normalizeText(sourceItem.candidateId);
    if (!sourceKey || productionSourceKeys.has(sourceKey)) {
      continue;
    }

    const aggregatedItem = isNewQuestionFile
      ? buildNewQuestionBacklogItem(sourceItem, { lang, batchId, filePath, sourceKey })
      : buildUnresolvedBacklogItem(sourceItem, { lang, batchId, filePath, backlogKind, sourceKey });

    if (!aggregatedItem) {
      continue;
    }

    if (seenKeys.has(sourceKey)) {
      mergeProvenance(seenKeys.get(sourceKey), aggregatedItem);
      continue;
    }

    aggregatedItem.backlogKind = backlogKind;
    seenKeys.set(sourceKey, aggregatedItem);
    items.push(aggregatedItem);
    if (isNewQuestionFile) {
      counts.newQuestion += 1;
    } else {
      counts.unresolved += 1;
    }
  }
}

items.sort((left, right) =>
  String(left.sourceBatchId || "").localeCompare(String(right.sourceBatchId || "")) ||
  String(left.sourceImage || left.itemId || "").localeCompare(String(right.sourceImage || right.itemId || "")),
);

const sourceDoc = {
  generatedAt: stableNow(),
  lang,
  dataset,
  backlogId,
  counts: {
    unresolved: counts.unresolved,
    newQuestion: counts.newQuestion,
    total: items.length,
  },
  sourceFiles: pendingFiles.map((filePath) => path.relative(process.cwd(), filePath)),
  items,
};

await writeJson(sourceDocPath, sourceDoc);

execFileSync(process.execPath, [
  path.join(process.cwd(), "scripts", "generate-batch-workbench.mjs"),
  "--lang",
  lang,
  "--batch",
  backlogId,
  "--dataset",
  dataset,
  "--include-sections",
  "unresolved",
  "--unresolved-path",
  sourceDocPath,
  "--workbench-title",
  `${lang.toUpperCase()} Consolidated Backlog Workbench`,
  "--workbench-description",
  "Pending-only consolidated backlog across completed batches: unresolved leftovers plus staged new-question candidates. Generation only; do not apply or merge from this view without explicit follow-up.",
  "--html-path",
  htmlPath,
  "--decisions-path",
  decisionsPath,
], { stdio: "inherit" });

console.log(JSON.stringify({
  source: path.relative(process.cwd(), sourceDocPath),
  html: path.relative(process.cwd(), htmlPath),
  decisions: path.relative(process.cwd(), decisionsPath),
  unresolved: counts.unresolved,
  newQuestion: counts.newQuestion,
  total: items.length,
}, null, 2));

function discoverPendingFiles(locale) {
  const files = [];
  const roots = [
    STAGING_DIR,
    path.join(GENERATED_DIR, "archive", locale),
  ];

  for (const root of roots) {
    walk(root, files, locale);
  }

  return files.sort();
}

function walk(dirPath, files, locale) {
  if (!fileExists(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files, locale);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const name = entry.name;
    if (
      name.startsWith(`new-question-candidates.${locale}.batch-`) ||
      name.startsWith(`follow-up-review.${locale}.batch-`)
    ) {
      files.push(fullPath);
    }
  }
}

function loadProductionSourceKeys(filePath) {
  if (!fileExists(filePath)) {
    return new Set();
  }

  const doc = readJson(filePath);
  const keys = new Set();
  for (const entry of Object.values(doc?.questions ?? {})) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const sourceImage = normalizeText(entry.sourceImage);
    const sourceItemId = normalizeText(entry.sourceItemId);
    if (sourceImage) {
      keys.add(sourceImage);
    }
    if (sourceItemId) {
      keys.add(sourceItemId);
    }
  }
  return keys;
}

function buildNewQuestionBacklogItem(item, { lang: sourceLang, batchId, filePath, sourceKey }) {
  const sourceImage = normalizeText(item.sourceImage);
  return {
    itemId: `${batchId}:${sourceKey}`,
    sourceImage: sourceImage ?? sourceKey,
    screenshotPath: sourceImage ? screenshotPathForBatch(sourceLang, batchId, sourceImage) : null,
    hasImage: Boolean(sourceImage),
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: Array.isArray(item.optionsRawJa) ? item.optionsRawJa : [],
    optionsGlossEn: Array.isArray(item.optionsGlossEn) ? item.optionsGlossEn : [],
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item.newQuestionLocalAnswerKey),
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item.correctKeyRaw),
    effectiveQuestionType: inferBacklogQuestionType(item),
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    topCandidates: buildLinkedCandidate(item.linkedExistingAssetCandidate),
    reason: `Pending new-question candidate from ${batchId}.`,
    sourceBatchId: batchId,
    backlogStatus: normalizeText(item.status) ?? "pending-superset-review",
    sourceBacklogPath: path.relative(process.cwd(), filePath),
    defaultCreateNewQuestion: true,
    provenance: [
      {
        batchId,
        sourcePath: path.relative(process.cwd(), filePath),
        sourceType: "new-question-candidate",
      },
    ],
  };
}

function buildUnresolvedBacklogItem(item, { lang: sourceLang, batchId, filePath, backlogKind, sourceKey }) {
  const sourceImage = normalizeText(item.sourceImage) ?? normalizeText(item.itemId);
  return {
    itemId: `${batchId}:${sourceKey}`,
    sourceImage: sourceImage ?? sourceKey,
    screenshotPath: sourceImage ? screenshotPathForBatch(sourceLang, batchId, sourceImage) : null,
    hasImage: Boolean(sourceImage),
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: Array.isArray(item.optionsRawJa) ? item.optionsRawJa : [],
    optionsGlossEn: Array.isArray(item.optionsGlossEn) ? item.optionsGlossEn : [],
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item.newQuestionLocalAnswerKey),
    effectiveQuestionType: inferBacklogQuestionType(item),
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    topCandidates: Array.isArray(item.topCandidates) ? item.topCandidates : [],
    reason: normalizeText(item.reason) ?? `Pending ${backlogKind.replace(/-/g, " ")} from ${batchId}.`,
    analysis: item.analysis ?? null,
    sourceConceptSlots: item.sourceConceptSlots ?? null,
    sourceBatchId: batchId,
    backlogStatus: normalizeText(item.status) ?? null,
    sourceBacklogPath: path.relative(process.cwd(), filePath),
    defaultCreateNewQuestion: false,
    provenance: [
      {
        batchId,
        sourcePath: path.relative(process.cwd(), filePath),
        sourceType: backlogKind,
      },
    ],
  };
}

function buildLinkedCandidate(candidate) {
  if (!candidate?.qid) {
    return [];
  }

  return [
    {
      qid: candidate.qid,
      number: candidate.number ?? null,
      score: candidate.score ?? null,
      image: {
        currentAssetSrc: candidate.currentAssetSrc ?? null,
        assetHashes: Array.isArray(candidate.assetHashes) ? candidate.assetHashes : [],
      },
    },
  ];
}

function screenshotPathForBatch(lang, batchId, sourceImage) {
  const batchDir = getBatchFiles(lang, batchId).batchDir;
  return path.relative(REPORTS_DIR, path.join(batchDir, sourceImage)).split(path.sep).join("/");
}

function mergeProvenance(target, incoming) {
  const existing = Array.isArray(target.provenance) ? target.provenance : [];
  const additions = Array.isArray(incoming.provenance) ? incoming.provenance : [];
  target.provenance = [
    ...existing,
    ...additions.filter((entry) =>
      !existing.some((current) => current.batchId === entry.batchId && current.sourcePath === entry.sourcePath),
    ),
  ];
}

function inferBacklogQuestionType(item) {
  const explicitType = normalizeText(item?.effectiveQuestionType) ??
    normalizeText(item?.analysis?.effectiveQuestionType) ??
    normalizeText(item?.analysis?.declaredQuestionType);
  if (explicitType) {
    return explicitType.toUpperCase();
  }

  const optionCount = Math.max(
    Array.isArray(item?.optionsRawJa) ? item.optionsRawJa.length : 0,
    Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn.length : 0,
  );

  if (optionCount === 2) {
    return "ROW";
  }

  if (optionCount >= 3) {
    return "MCQ";
  }

  return null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}
