#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_DATASET,
  IMPORTS_DIR,
  REPORTS_DIR,
  STAGING_DIR,
  fileExists,
  loadQbankContext,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const LANG = "fr";
const STORAGE_KEY = "expatise:fr-final-audit-workbench:v1";
const SOURCE_AUDIT_REL = "qbank-tools/generated/reports/fr-final-fast-audit.json";
const SOURCE_AUDIT_PATH = path.join(process.cwd(), SOURCE_AUDIT_REL);
const OUTPUT_HTML_PATH = path.join(REPORTS_DIR, "fr-final-audit-workbench.html");
const OUTPUT_JSON_PATH = path.join(REPORTS_DIR, "fr-final-audit-workbench.json");
const OUTPUT_DECISIONS_PATH = path.join(STAGING_DIR, "fr-final-audit-workbench-decisions.json");

const AUDIT_SECTION_LABELS = {
  "duplicate-approved-qid-groups": "Duplicate approvedQid groups",
  "likely-duplicate-groups": "Likely duplicate groups",
  "possible-legitimate-reused-qid-groups": "Possible legitimate reused qid groups",
  "needs-manual-inspection-groups": "Needs manual inspection groups",
  "create-new-questions": "Create new question items",
  "keep-unresolved": "Keep unresolved items",
  "delete-question": "Existing deleteQuestion items",
};

const GROUP_STATUS_OPTIONS = [
  "intentional-reuse",
  "likely-duplicate",
  "needs-manual-review",
  "needs-master-fix",
  "split-to-new-question",
];

const DECISION_OPTIONS = [
  "approveExistingQid",
  "createNewQuestion",
  "keepUnresolved",
  "deleteQuestion",
];

const ANSWER_KEY_OPTIONS = ["", "A", "B", "C", "D", "R", "W", "UNKNOWN"];

function toPosix(value) {
  return String(value ?? "").split(path.sep).join("/");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanItemId(value) {
  const text = String(value ?? "").trim();
  return text.replace(/^(auto-matched|review-needed|answer-key|unresolved|preserved):/, "");
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  if (/^q\d{4}$/i.test(text)) {
    return text.toLowerCase();
  }
  const digits = text.match(/\d{1,4}/)?.[0];
  return digits ? `q${digits.padStart(4, "0")}` : text;
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return ANSWER_KEY_OPTIONS.includes(text) ? text || null : text || null;
}

function asList(doc) {
  if (Array.isArray(doc)) {
    return doc;
  }
  for (const key of ["items", "questions", "reviewNeeded", "review_needed", "unresolved", "matched", "matches"]) {
    if (Array.isArray(doc?.[key])) {
      return doc[key];
    }
  }
  return [];
}

function stableBatchFromFilename(fileName) {
  return fileName.match(/^fr-(batch-\d+)-/)?.[1] ?? null;
}

function decisionAction(decision) {
  const explicit = String(decision?.decision ?? decision?.action ?? "").trim();
  if (DECISION_OPTIONS.includes(explicit)) {
    return explicit;
  }
  if (decision?.deleteQuestion === true) {
    return "deleteQuestion";
  }
  if (decision?.createNewQuestion === true) {
    return "createNewQuestion";
  }
  if (decision?.keepUnresolved === true) {
    return "keepUnresolved";
  }
  if (decision?.approvedQid) {
    return "approveExistingQid";
  }
  return null;
}

function itemLocalAnswerKey(decision) {
  return normalizeAnswerKey(
    decision?.localAnswerKey ??
      decision?.confirmedCorrectOptionKey ??
      decision?.newQuestionLocalAnswerKey ??
      decision?.currentStagedLocaleCorrectOptionKey ??
      null,
  );
}

function relFromReports(absPath) {
  if (!absPath) {
    return null;
  }
  return toPosix(path.relative(REPORTS_DIR, absPath));
}

function sourceScreenshotAbs(batch, sourceImage) {
  if (!batch || !sourceImage) {
    return null;
  }
  if (path.isAbsolute(sourceImage)) {
    return sourceImage;
  }
  return path.join(IMPORTS_DIR, LANG, batch, sourceImage);
}

function sourceScreenshotHtmlPath(batch, sourceImage) {
  const absPath = sourceScreenshotAbs(batch, sourceImage);
  return absPath ? relFromReports(absPath) : null;
}

function qbankAssetAbs(assetSrc) {
  if (!assetSrc) {
    return null;
  }
  if (path.isAbsolute(assetSrc) && !assetSrc.startsWith("/qbank/")) {
    return assetSrc;
  }
  const clean = String(assetSrc).replace(/^\//, "");
  if (clean.startsWith("qbank/")) {
    return path.join(process.cwd(), "public", clean);
  }
  return path.join(process.cwd(), clean);
}

function qbankAssetHtmlPath(assetSrc) {
  const absPath = qbankAssetAbs(assetSrc);
  return absPath ? relFromReports(absPath) : null;
}

function richScore(record) {
  return [
    record?.promptRawJa,
    record?.promptGlossEn,
    record?.sourcePrompt,
    record?.sourcePromptGloss,
    record?.optionsRawJa?.length,
    record?.optionsGlossEn?.length,
    record?.topCandidates?.length,
    record?.candidateQids?.length,
    record?.correctKeyRaw,
    record?.correctAnswerRaw,
  ].filter(Boolean).length;
}

function extractCandidateQids(record) {
  const direct = record?.topCandidateQids ?? record?.candidateQids;
  const qids = [];
  if (Array.isArray(direct)) {
    qids.push(...direct.map(normalizeQid));
  }
  for (const key of ["topCandidates", "candidates", "matches"]) {
    if (Array.isArray(record?.[key])) {
      qids.push(...record[key].map((candidate) => normalizeQid(candidate?.qid ?? candidate?.id ?? candidate?.approvedQid)));
    }
  }
  qids.push(normalizeQid(record?.initialSuggestedQid));
  qids.push(normalizeQid(record?.approvedQid));
  qids.push(normalizeQid(record?.qid));
  return uniq(qids);
}

function listFiles(dir, predicate) {
  if (!fileExists(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function listBatchDirs() {
  const frImportsDir = path.join(IMPORTS_DIR, LANG);
  if (!fileExists(frImportsDir)) {
    return [];
  }
  return fs
    .readdirSync(frImportsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^batch-\d+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function indexSourceImports() {
  const sourceByKey = new Map();
  const filesByBatch = new Map();
  for (const batch of listBatchDirs()) {
    const batchDir = path.join(IMPORTS_DIR, LANG, batch);
    const fileNames = ["intake.json", "matched.json", "review-needed.json", "unresolved.json"];
    filesByBatch.set(batch, fileNames.filter((name) => fileExists(path.join(batchDir, name))));
    for (const fileName of fileNames) {
      const filePath = path.join(batchDir, fileName);
      if (!fileExists(filePath)) {
        continue;
      }
      const doc = readJson(filePath);
      for (const record of asList(doc)) {
        const id = cleanItemId(record.itemId ?? record.id ?? record.sourceImage);
        if (!id) {
          continue;
        }
        const key = `${batch}::${id}`;
        const existing = sourceByKey.get(key);
        if (!existing || richScore(record) > richScore(existing.record)) {
          sourceByKey.set(key, { batch, sourceFile: fileName, record });
        }
      }
    }
  }
  return { sourceByKey, filesByBatch };
}

function indexDecisionFiles() {
  const decisionByKey = new Map();
  const codexByKey = new Map();
  const decisionFiles = listFiles(
    STAGING_DIR,
    (name) => /^fr-batch-\d+-workbench-decisions\.json$/.test(name),
  );
  const codexFiles = listFiles(
    STAGING_DIR,
    (name) => /^fr-batch-\d+-codex-recommendations\.json$/.test(name),
  );

  for (const filePath of decisionFiles) {
    const batch = stableBatchFromFilename(path.basename(filePath));
    if (!batch) {
      continue;
    }
    const doc = readJson(filePath);
    for (const item of asList(doc)) {
      const id = cleanItemId(item.itemId ?? item.id ?? item.sourceImage ?? item.sourceId);
      if (id) {
        decisionByKey.set(`${batch}::${id}`, { batch, filePath, item });
      }
    }
  }

  for (const filePath of codexFiles) {
    const batch = stableBatchFromFilename(path.basename(filePath));
    if (!batch) {
      continue;
    }
    const doc = readJson(filePath);
    for (const item of asList(doc)) {
      const id = cleanItemId(item.itemId ?? item.sourceId ?? item.id ?? item.sourceImage);
      if (id) {
        codexByKey.set(`${batch}::${id}`, { batch, filePath, item });
      }
    }
  }

  return { decisionByKey, codexByKey, decisionFiles, codexFiles };
}

function loadRawQuestionMap() {
  const rawPath = path.join(process.cwd(), "public", "qbank", DEFAULT_DATASET, "questions.raw.json");
  const rawDoc = readJson(rawPath);
  return new Map(asList(rawDoc).map((question) => [question.id, question]));
}

function loadFrenchTranslations() {
  const translationsPath = path.join(process.cwd(), "public", "qbank", DEFAULT_DATASET, "translations.fr.json");
  if (!fileExists(translationsPath)) {
    return {};
  }
  const doc = readJson(translationsPath);
  return doc?.questions && typeof doc.questions === "object" ? doc.questions : {};
}

function buildQuestionMaps() {
  const qbank = loadQbankContext({ dataset: DEFAULT_DATASET, referenceLang: "ko" });
  const rawQuestions = loadRawQuestionMap();
  const translationsFr = loadFrenchTranslations();
  const imageTags = qbank.imageTags ?? {};
  const byQid = new Map();
  const masterCandidateByQid = {};

  for (const question of qbank.questions ?? []) {
    const qid = normalizeQid(question.qid ?? question.id);
    if (!qid) {
      continue;
    }
    byQid.set(qid, question);
    masterCandidateByQid[qid] = buildCandidateCard(question, rawQuestions.get(qid), imageTags[qid], translationsFr[qid]);
  }

  return { qbank, byQid, rawQuestions, imageTags, translationsFr, masterCandidateByQid };
}

function answerKeyForQuestion(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  if (question?.correctOptionId) {
    const option = options.find((candidate) => candidate.id === question.correctOptionId);
    if (option?.originalKey) {
      return option.originalKey;
    }
  }
  if (/^[A-D]$/i.test(String(question?.answerRaw ?? ""))) {
    return String(question.answerRaw).toUpperCase();
  }
  if (/^(R|W)$/i.test(String(question?.correctRow ?? ""))) {
    return String(question.correctRow).toUpperCase();
  }
  if (/right/i.test(String(question?.answerRaw ?? ""))) {
    return "R";
  }
  if (/wrong/i.test(String(question?.answerRaw ?? ""))) {
    return "W";
  }
  return null;
}

function buildCandidateCard(question, rawQuestion, imageTagRecord, translationFr) {
  const qid = normalizeQid(question?.qid ?? question?.id);
  const assets = Array.isArray(question?.assets) ? question.assets : [];
  const imageSrc = assets.find((asset) => asset?.src)?.src ?? imageTagRecord?.assetSrcs?.[0] ?? null;
  return {
    qid,
    number: question?.number ?? rawQuestion?.number ?? null,
    type: String(question?.type ?? rawQuestion?.type ?? "").toUpperCase(),
    prompt: question?.prompt ?? rawQuestion?.prompt ?? null,
    rawPrompt: rawQuestion?.prompt ?? null,
    frenchPrompt: translationFr?.prompt ?? null,
    options: (Array.isArray(question?.options) ? question.options : rawQuestion?.options ?? []).map((option) => ({
      key: option.originalKey ?? option.key ?? null,
      text: option.text ?? null,
    })),
    answerKey: answerKeyForQuestion(question ?? rawQuestion),
    answerRaw: question?.answerRaw ?? rawQuestion?.answerRaw ?? null,
    imageSrc,
    imagePath: qbankAssetHtmlPath(imageSrc),
    imageTags: imageTagRecord
      ? {
          colors: imageTagRecord.colorTags ?? [],
          objects: imageTagRecord.objectTags ?? [],
          assetSrcs: imageTagRecord.assetSrcs ?? [],
        }
      : null,
  };
}

function sourceRecordFor(sourceByKey, batch, auditItem) {
  const id = cleanItemId(auditItem?.itemId ?? auditItem?.id ?? auditItem?.sourceImage);
  return sourceByKey.get(`${batch}::${id}`)?.record ?? {};
}

function decisionRecordFor(decisionByKey, batch, auditItem) {
  const id = cleanItemId(auditItem?.itemId ?? auditItem?.id ?? auditItem?.sourceImage);
  return decisionByKey.get(`${batch}::${id}`)?.item ?? {};
}

function codexRecordFor(codexByKey, batch, auditItem) {
  const id = cleanItemId(auditItem?.itemId ?? auditItem?.id ?? auditItem?.sourceImage);
  return codexByKey.get(`${batch}::${id}`)?.item ?? {};
}

function sourceOptions(source, auditItem) {
  const raw = source?.optionsRawJa ?? auditItem?.sourceOptions ?? auditItem?.options ?? [];
  const gloss = source?.optionsGlossEn ?? auditItem?.sourceOptionGlosses ?? auditItem?.optionsGlossEn ?? [];
  const count = Math.max(raw.length ?? 0, gloss.length ?? 0);
  return Array.from({ length: count }, (_, index) => ({
    key: String.fromCharCode(65 + index),
    text: raw[index] ?? null,
    gloss: gloss[index] ?? null,
  }));
}

function buildStandardItem({
  auditItem,
  itemType,
  section,
  sourceByKey,
  decisionByKey,
  codexByKey,
  masterCandidateByQid,
}) {
  const batch = auditItem.batch ?? null;
  const source = sourceRecordFor(sourceByKey, batch, auditItem);
  const currentDecision = decisionRecordFor(decisionByKey, batch, auditItem);
  const codex = codexRecordFor(codexByKey, batch, auditItem);
  const sourceId = cleanItemId(auditItem.itemId ?? auditItem.id ?? auditItem.sourceImage);
  const sourceImage = auditItem.sourceImage ?? source.sourceImage ?? null;
  const screenshotAbs = sourceScreenshotAbs(batch, sourceImage);
  const defaultAction = itemType === "createNewQuestion"
    ? "createNewQuestion"
    : itemType === "keepUnresolved"
      ? "keepUnresolved"
      : itemType === "deleteQuestion"
        ? "deleteQuestion"
        : decisionAction(currentDecision) ?? "keepUnresolved";
  const candidateQids = uniq([
    ...extractCandidateQids(auditItem),
    ...extractCandidateQids(source),
    ...extractCandidateQids(currentDecision),
    ...extractCandidateQids(codex),
  ]).slice(0, 8);

  return {
    id: `${itemType}:${batch}:${sourceId}`,
    itemType,
    section,
    sourceBatch: batch,
    sourceId,
    sourceItemId: sourceId,
    sourceScreenshot: sourceImage,
    sourceScreenshotPath: sourceScreenshotHtmlPath(batch, sourceImage),
    sourceScreenshotExists: screenshotAbs ? fileExists(screenshotAbs) : false,
    sourcePrompt: auditItem.sourcePrompt ?? source.promptRawJa ?? currentDecision.sourcePrompt ?? null,
    sourcePromptGloss: auditItem.sourcePromptGloss ?? source.promptGlossEn ?? currentDecision.sourcePromptGloss ?? null,
    sourceOptions: sourceOptions(source, auditItem),
    sourceAnswerKey: normalizeAnswerKey(source.correctKeyRaw ?? currentDecision.confirmedCorrectOptionKey ?? auditItem.localAnswerKey),
    currentDecision: {
      action: decisionAction(currentDecision) ?? defaultAction,
      approvedQid: normalizeQid(currentDecision.approvedQid ?? auditItem.approvedQid),
      localAnswerKey: itemLocalAnswerKey(currentDecision) ?? normalizeAnswerKey(auditItem.localAnswerKey),
      reviewerNotes: currentDecision.reviewerNotes ?? auditItem.reviewerNote ?? null,
      topic: currentDecision.newQuestionProvisionalTopic ?? auditItem.topic ?? source.provisionalTopic ?? null,
      subtopics: currentDecision.newQuestionProvisionalSubtopics ?? auditItem.subtopics ?? source.provisionalSubtopics ?? [],
    },
    codexRecommendation: Object.keys(codex).length
      ? {
          action: decisionAction(codex),
          approvedQid: normalizeQid(codex.approvedQid ?? codex.recommendedQid),
          localAnswerKey: itemLocalAnswerKey(codex),
          reviewerNotes: codex.reviewerNotes ?? codex.reviewerNote ?? codex.rationale ?? null,
        }
      : null,
    candidateQids,
    candidates: candidateQids.map((qid) => masterCandidateByQid[qid] ?? { qid, missing: true }),
    machineTopScore: auditItem.machineTopScore ?? source.topCandidates?.[0]?.score ?? null,
    topic: currentDecision.newQuestionProvisionalTopic ?? auditItem.topic ?? source.provisionalTopic ?? null,
    subtopics: currentDecision.newQuestionProvisionalSubtopics ?? auditItem.subtopics ?? source.provisionalSubtopics ?? [],
    reviewerNote: currentDecision.reviewerNotes ?? auditItem.reviewerNote ?? null,
  };
}

function groupStatusForClassification(classification) {
  const lower = String(classification ?? "").toLowerCase();
  if (lower.includes("likely duplicate")) {
    return "likely-duplicate";
  }
  if (lower.includes("possible legitimate")) {
    return "intentional-reuse";
  }
  if (lower.includes("master")) {
    return "needs-master-fix";
  }
  return "needs-manual-review";
}

function duplicateClassificationBucket(classification) {
  const status = groupStatusForClassification(classification);
  if (status === "likely-duplicate") {
    return "likely-duplicate-groups";
  }
  if (status === "intentional-reuse") {
    return "possible-legitimate-reused-qid-groups";
  }
  return "needs-manual-inspection-groups";
}

function buildDuplicateGroup({
  group,
  index,
  sourceByKey,
  decisionByKey,
  codexByKey,
  masterCandidateByQid,
}) {
  const qid = normalizeQid(group.approvedQid);
  const groupStatus = groupStatusForClassification(group.classification);
  const uses = (group.uses ?? []).map((use, useIndex) => {
    const source = sourceRecordFor(sourceByKey, use.batch, use);
    const currentDecision = decisionRecordFor(decisionByKey, use.batch, use);
    const codex = codexRecordFor(codexByKey, use.batch, use);
    const sourceId = cleanItemId(use.itemId ?? use.id ?? use.sourceImage);
    const sourceImage = use.sourceImage ?? source.sourceImage ?? null;
    const screenshotAbs = sourceScreenshotAbs(use.batch, sourceImage);
    return {
      id: `${use.batch}:${sourceId || useIndex}`,
      sourceBatch: use.batch,
      sourceId,
      sourceScreenshot: sourceImage,
      sourceScreenshotPath: sourceScreenshotHtmlPath(use.batch, sourceImage),
      sourceScreenshotExists: screenshotAbs ? fileExists(screenshotAbs) : false,
      sourcePrompt: use.sourcePrompt ?? source.promptRawJa ?? null,
      sourcePromptGloss: use.sourcePromptGloss ?? source.promptGlossEn ?? null,
      sourceOptions: sourceOptions(source, use),
      action: decisionAction(currentDecision) ?? use.action ?? null,
      approvedQid: normalizeQid(currentDecision.approvedQid ?? qid),
      localAnswerKey: itemLocalAnswerKey(currentDecision) ?? normalizeAnswerKey(use.localAnswerKey),
      reviewerNote: currentDecision.reviewerNotes ?? use.reviewerNote ?? null,
      codexRecommendation: Object.keys(codex).length
        ? {
            action: decisionAction(codex),
            approvedQid: normalizeQid(codex.approvedQid ?? codex.recommendedQid),
            localAnswerKey: itemLocalAnswerKey(codex),
            reviewerNotes: codex.reviewerNotes ?? codex.reviewerNote ?? codex.rationale ?? null,
          }
        : null,
    };
  });

  return {
    id: `duplicateGroup:${qid ?? `unknown-${index + 1}`}`,
    itemType: "duplicateGroup",
    section: "duplicate-approved-qid-groups",
    classificationSection: duplicateClassificationBucket(group.classification),
    groupStatus,
    approvedQid: qid,
    useCount: group.useCount ?? uses.length,
    inTranslationsFr: group.inTranslationsFr === true,
    classification: group.classification ?? null,
    classificationReason: group.classificationReason ?? null,
    uses,
    candidates: qid ? [masterCandidateByQid[qid] ?? { qid, missing: true }] : [],
    reviewerNote: group.classificationReason ?? null,
  };
}

function decisionTemplateForItem(item) {
  const current = item.currentDecision ?? {};
  const baseDecision = item.itemType === "duplicateGroup"
    ? "keepUnresolved"
    : current.action ?? (item.itemType === "createNewQuestion"
      ? "createNewQuestion"
      : item.itemType === "deleteQuestion"
        ? "deleteQuestion"
        : "keepUnresolved");

  return {
    itemId: item.id,
    itemType: item.itemType,
    sourceBatch: item.sourceBatch ?? null,
    sourceId: item.sourceId ?? null,
    sourceScreenshot: item.sourceScreenshot ?? null,
    decision: baseDecision,
    approvedQid: item.itemType === "duplicateGroup" ? item.approvedQid : current.approvedQid ?? null,
    localAnswerKey: item.itemType === "duplicateGroup" ? null : current.localAnswerKey ?? null,
    groupStatus: item.itemType === "duplicateGroup" ? item.groupStatus : null,
    topic: item.itemType === "duplicateGroup" ? null : current.topic ?? item.topic ?? null,
    subtopics: item.itemType === "duplicateGroup" ? [] : current.subtopics ?? item.subtopics ?? [],
    reviewerNotes: item.reviewerNote ?? current.reviewerNotes ?? "",
    explanation: item.itemType === "duplicateGroup" ? item.classificationReason ?? "" : "",
    reviewedAt: null,
  };
}

function mergeExistingFinalDecisions(baseDocument) {
  if (!fileExists(OUTPUT_DECISIONS_PATH)) {
    return baseDocument;
  }
  const existing = readJson(OUTPUT_DECISIONS_PATH);
  const existingItems = new Map(asList(existing).map((item) => [item.itemId, item]));
  const editableFields = [
    "decision",
    "approvedQid",
    "localAnswerKey",
    "groupStatus",
    "topic",
    "subtopics",
    "reviewerNotes",
    "explanation",
    "reviewedAt",
  ];
  return {
    ...baseDocument,
    generatedAt: stableNow(),
    items: baseDocument.items.map((item) => {
      const prior = existingItems.get(item.itemId);
      if (!prior) {
        return item;
      }
      const merged = { ...item };
      for (const field of editableFields) {
        if (Object.hasOwn(prior, field)) {
          merged[field] = prior[field];
        }
      }
      return merged;
    }),
  };
}

function buildSections(items) {
  const duplicateGroups = items.filter((item) => item.itemType === "duplicateGroup");
  const countFor = (predicate) => items.filter(predicate).length;
  return [
    {
      id: "duplicate-approved-qid-groups",
      label: AUDIT_SECTION_LABELS["duplicate-approved-qid-groups"],
      count: duplicateGroups.length,
      filter: "duplicate",
    },
    {
      id: "likely-duplicate-groups",
      label: AUDIT_SECTION_LABELS["likely-duplicate-groups"],
      count: countFor((item) => item.classificationSection === "likely-duplicate-groups"),
      filter: "likely-duplicate",
    },
    {
      id: "possible-legitimate-reused-qid-groups",
      label: AUDIT_SECTION_LABELS["possible-legitimate-reused-qid-groups"],
      count: countFor((item) => item.classificationSection === "possible-legitimate-reused-qid-groups"),
      filter: "possible-legitimate",
    },
    {
      id: "needs-manual-inspection-groups",
      label: AUDIT_SECTION_LABELS["needs-manual-inspection-groups"],
      count: countFor((item) => item.classificationSection === "needs-manual-inspection-groups"),
      filter: "needs-manual",
    },
    {
      id: "create-new-questions",
      label: AUDIT_SECTION_LABELS["create-new-questions"],
      count: countFor((item) => item.itemType === "createNewQuestion"),
      filter: "createNewQuestion",
    },
    {
      id: "keep-unresolved",
      label: AUDIT_SECTION_LABELS["keep-unresolved"],
      count: countFor((item) => item.itemType === "keepUnresolved"),
      filter: "keepUnresolved",
    },
    {
      id: "delete-question",
      label: AUDIT_SECTION_LABELS["delete-question"],
      count: countFor((item) => item.itemType === "deleteQuestion"),
      filter: "deleteQuestion",
    },
  ];
}

function screenshotStats(items) {
  let referenced = 0;
  let existing = 0;
  for (const item of items) {
    if (item.itemType === "duplicateGroup") {
      for (const use of item.uses ?? []) {
        if (use.sourceScreenshotPath) {
          referenced += 1;
          if (use.sourceScreenshotExists) {
            existing += 1;
          }
        }
      }
    } else if (item.sourceScreenshotPath) {
      referenced += 1;
      if (item.sourceScreenshotExists) {
        existing += 1;
      }
    }
  }
  return { referenced, existing, missing: referenced - existing };
}

function buildWorkbench() {
  if (!fileExists(SOURCE_AUDIT_PATH)) {
    throw new Error(`Missing input audit: ${SOURCE_AUDIT_REL}`);
  }
  const audit = readJson(SOURCE_AUDIT_PATH);
  const { sourceByKey, filesByBatch } = indexSourceImports();
  const { decisionByKey, codexByKey, decisionFiles, codexFiles } = indexDecisionFiles();
  const { masterCandidateByQid } = buildQuestionMaps();

  const duplicateItems = (audit.duplicateGroups ?? []).map((group, index) =>
    buildDuplicateGroup({
      group,
      index,
      sourceByKey,
      decisionByKey,
      codexByKey,
      masterCandidateByQid,
    }));
  const createItems = (audit.createNewQuestionItems ?? []).map((auditItem) =>
    buildStandardItem({
      auditItem,
      itemType: "createNewQuestion",
      section: "create-new-questions",
      sourceByKey,
      decisionByKey,
      codexByKey,
      masterCandidateByQid,
    }));
  const unresolvedItems = (audit.keepUnresolvedItems ?? []).map((auditItem) =>
    buildStandardItem({
      auditItem,
      itemType: "keepUnresolved",
      section: "keep-unresolved",
      sourceByKey,
      decisionByKey,
      codexByKey,
      masterCandidateByQid,
    }));
  const deleteItems = (audit.deleteQuestionItems ?? []).map((auditItem) =>
    buildStandardItem({
      auditItem,
      itemType: "deleteQuestion",
      section: "delete-question",
      sourceByKey,
      decisionByKey,
      codexByKey,
      masterCandidateByQid,
    }));

  const items = [...duplicateItems, ...createItems, ...unresolvedItems, ...deleteItems];
  const sections = buildSections(items);
  const decisionsTemplate = mergeExistingFinalDecisions({
    schemaVersion: 1,
    lang: LANG,
    generatedAt: stableNow(),
    sourceAudit: SOURCE_AUDIT_REL,
    items: items.map(decisionTemplateForItem),
  });
  const stats = {
    sourceAuditSummary: audit.summary ?? {},
    sections: Object.fromEntries(sections.map((section) => [section.id, section.count])),
    itemCount: items.length,
    duplicateGroupCount: duplicateItems.length,
    createNewQuestionCount: createItems.length,
    keepUnresolvedCount: unresolvedItems.length,
    deleteQuestionCount: deleteItems.length,
    screenshots: screenshotStats(items),
    decisionFilesRead: decisionFiles.map((filePath) => toPosix(path.relative(process.cwd(), filePath))),
    codexFilesRead: codexFiles.map((filePath) => toPosix(path.relative(process.cwd(), filePath))),
    importFilesReadByBatch: Object.fromEntries(filesByBatch),
  };

  return {
    schemaVersion: 1,
    lang: LANG,
    generatedAt: stableNow(),
    sourceAudit: SOURCE_AUDIT_REL,
    storageKey: STORAGE_KEY,
    outputs: {
      html: toPosix(path.relative(process.cwd(), OUTPUT_HTML_PATH)),
      json: toPosix(path.relative(process.cwd(), OUTPUT_JSON_PATH)),
      decisions: toPosix(path.relative(process.cwd(), OUTPUT_DECISIONS_PATH)),
    },
    sections,
    stats,
    items,
    decisionsTemplate,
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildHtml(workbench) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>French Final Audit Workbench</title>
  <style>
    :root {
      --bg: #f4f0e8;
      --paper: #fffdf8;
      --ink: #1f1a17;
      --muted: #6d6257;
      --line: #d8cec1;
      --accent: #165d52;
      --accent-soft: #e4f2ef;
      --warn: #8c4f16;
      --warn-soft: #f8ead7;
      --note: #4f3b96;
      --note-soft: #ece8ff;
      --shadow: 0 12px 28px rgba(38, 25, 10, 0.08);
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--serif);
    }
    .page {
      width: min(1680px, calc(100vw - 28px));
      margin: 22px auto 48px;
    }
    .hero, .panel, .item {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 24px 28px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 3.8vw, 42px);
      line-height: 1.04;
    }
    h2, h3 { margin: 0; }
    .muted { color: var(--muted); }
    .mono { font-family: var(--mono); }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 12px;
      background: #fcf8f1;
    }
    .stat strong {
      display: block;
      margin-top: 4px;
      font-size: 24px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 18px;
    }
    button, .file-button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
    }
    button.secondary, .file-button.secondary {
      background: #e8dfd2;
      color: var(--ink);
    }
    input[type="file"] { display: none; }
    input[type="search"], input[type="text"], select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 9px 10px;
      background: #fffaf2;
      color: var(--ink);
      font: inherit;
    }
    textarea {
      min-height: 86px;
      resize: vertical;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 18px 0;
    }
    .filter {
      border: 1px solid var(--line);
      background: #fcf8f1;
      color: var(--muted);
    }
    .filter.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .panel {
      padding: 16px;
      margin-bottom: 16px;
    }
    .items {
      display: grid;
      gap: 16px;
    }
    .item {
      padding: 18px;
    }
    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 8px;
      background: #f3ede4;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.2;
    }
    .pill.note {
      color: var(--note);
      background: var(--note-soft);
      border-color: rgba(79, 59, 150, 0.18);
    }
    .pill.warn {
      color: var(--warn);
      background: var(--warn-soft);
      border-color: rgba(140, 79, 22, 0.18);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
      gap: 14px;
    }
    .subgrid {
      display: grid;
      gap: 12px;
    }
    .box {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcf8f1;
      padding: 12px;
    }
    .label {
      margin-bottom: 6px;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .prompt {
      font-size: 18px;
      line-height: 1.35;
    }
    .gloss {
      color: var(--muted);
      margin-top: 6px;
      line-height: 1.35;
    }
    .options {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .option {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 8px 10px;
      background: #fffdf8;
    }
    .option .key {
      color: var(--accent);
      font-family: var(--mono);
      font-weight: 700;
    }
    .image-frame {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #eee7dc;
      min-height: 120px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .image-frame img {
      display: block;
      width: 100%;
      max-height: 340px;
      object-fit: contain;
      background: #eee7dc;
    }
    .candidate-list {
      display: grid;
      gap: 10px;
    }
    .candidate {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcf8f1;
      padding: 12px;
    }
    .candidate-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .candidate .prompt {
      font-size: 16px;
    }
    .candidate .image-frame {
      margin: 8px 0;
      min-height: 90px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .decision-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .decision-grid .wide {
      grid-column: 1 / -1;
    }
    .use-list {
      display: grid;
      gap: 10px;
    }
    .use {
      border: 1px dashed rgba(109, 98, 87, 0.42);
      border-radius: 14px;
      padding: 12px;
      background: #fffaf2;
    }
    .use-grid {
      display: grid;
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 12px;
    }
    .status {
      min-height: 22px;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 980px) {
      .grid, .use-grid { grid-template-columns: 1fr; }
      .decision-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>French Final Audit Workbench</h1>
      <p class="muted">Review-only artifact built from ${htmlEscape(SOURCE_AUDIT_REL)}. Decisions autosave locally and export to the final-audit decision template schema.</p>
      <div class="stats" id="stats"></div>
      <div class="toolbar">
        <button id="export-json">Export decisions JSON</button>
        <label class="file-button secondary" for="import-json">Import decisions JSON</label>
        <input id="import-json" type="file" accept="application/json,.json">
        <button class="secondary" id="clear-local">Clear local decisions</button>
        <div class="status" id="status"></div>
      </div>
    </section>
    <section class="panel">
      <input id="search" type="search" placeholder="Filter by qid, batch, screenshot, prompt, or note">
      <div class="filters" id="filters"></div>
    </section>
    <section class="items" id="items"></section>
  </main>
  <script>
    const WORKBENCH = ${jsonScript(workbench)};
    const INITIAL_DECISIONS = ${jsonScript(workbench.decisionsTemplate)};
    const STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
    const DECISION_OPTIONS = ${jsonScript(DECISION_OPTIONS)};
    const ANSWER_KEY_OPTIONS = ${jsonScript(ANSWER_KEY_OPTIONS)};
    const GROUP_STATUS_OPTIONS = ${jsonScript(GROUP_STATUS_OPTIONS)};
    let activeFilter = "all";
    let query = "";

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function optionTags(values, selected) {
      return values.map((value) => {
        const text = value || "";
        return '<option value="' + escapeHtml(text) + '"' + (text === (selected ?? "") ? " selected" : "") + '>' + escapeHtml(text || "blank") + '</option>';
      }).join("");
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(INITIAL_DECISIONS);
        const parsed = JSON.parse(raw);
        const incoming = Array.isArray(parsed) ? { ...INITIAL_DECISIONS, items: parsed } : parsed;
        const incomingById = new Map((incoming.items || []).map((item) => [item.itemId, item]));
        return {
          ...INITIAL_DECISIONS,
          generatedAt: incoming.generatedAt || INITIAL_DECISIONS.generatedAt,
          items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(incomingById.get(item.itemId) || {}) })),
        };
      } catch {
        return structuredClone(INITIAL_DECISIONS);
      }
    }

    let state = loadState();

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function decisionFor(itemId) {
      return state.items.find((item) => item.itemId === itemId);
    }

    function setStatus(text) {
      document.getElementById("status").textContent = text || "";
    }

    function imageHtml(path, alt) {
      if (!path) {
        return '<div class="image-frame"><span class="muted">No image</span></div>';
      }
      return '<div class="image-frame"><img src="' + encodeURI(path) + '" alt="' + escapeHtml(alt || "image") + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\\'span\\'),{className:\\'muted\\',textContent:\\'Image unavailable\\'}))"></div>';
    }

    function sourceOptionsHtml(options) {
      if (!options || !options.length) return "";
      return '<div class="options">' + options.map((option) =>
        '<div class="option"><div class="key">' + escapeHtml(option.key) + '</div><div><div>' + escapeHtml(option.text || "") + '</div>' +
        (option.gloss ? '<div class="gloss">' + escapeHtml(option.gloss) + '</div>' : '') +
        '</div></div>'
      ).join("") + '</div>';
    }

    function candidateHtml(candidate) {
      if (!candidate || candidate.missing) {
        return '<article class="candidate"><div class="candidate-head"><span class="pill warn">' + escapeHtml(candidate?.qid || "missing qid") + '</span></div><div class="muted">Candidate not found in master qbank.</div></article>';
      }
      const options = candidate.options?.length
        ? '<div class="options">' + candidate.options.map((option) =>
          '<div class="option"><div class="key">' + escapeHtml(option.key || "") + '</div><div>' + escapeHtml(option.text || "") + '</div></div>'
        ).join("") + '</div>'
        : "";
      const tags = candidate.imageTags
        ? '<div class="tags">' +
          [...(candidate.imageTags.colors || []), ...(candidate.imageTags.objects || [])].slice(0, 12).map((tag) => '<span class="pill">' + escapeHtml(tag) + '</span>').join("") +
          '</div>'
        : "";
      return '<article class="candidate">' +
        '<div class="candidate-head"><div class="badges"><span class="pill note">' + escapeHtml(candidate.qid) + '</span><span class="pill">#' + escapeHtml(candidate.number || "") + '</span><span class="pill">' + escapeHtml(candidate.type || "") + '</span><span class="pill">answer ' + escapeHtml(candidate.answerKey || candidate.answerRaw || "unknown") + '</span></div>' +
        '<button class="secondary use-qid" data-qid="' + escapeHtml(candidate.qid) + '">Use qid</button></div>' +
        '<div class="prompt">' + escapeHtml(candidate.prompt || "") + '</div>' +
        (candidate.frenchPrompt ? '<div class="gloss">FR production: ' + escapeHtml(candidate.frenchPrompt) + '</div>' : '') +
        imageHtml(candidate.imagePath, candidate.qid) +
        options + tags +
        '</article>';
    }

    function decisionControlsHtml(item, decision) {
      const isGroup = item.itemType === "duplicateGroup";
      return '<div class="decision-grid">' +
        '<label><div class="label">Decision</div><select data-field="decision">' + optionTags(DECISION_OPTIONS, decision.decision) + '</select></label>' +
        '<label><div class="label">Approved qid</div><input data-field="approvedQid" type="text" value="' + escapeHtml(decision.approvedQid || "") + '"></label>' +
        '<label><div class="label">Local answer key</div><select data-field="localAnswerKey">' + optionTags(ANSWER_KEY_OPTIONS, decision.localAnswerKey || "") + '</select></label>' +
        (isGroup ? '<label><div class="label">Group status</div><select data-field="groupStatus">' + optionTags(GROUP_STATUS_OPTIONS, decision.groupStatus || "") + '</select></label>' : '<label><div class="label">Topic</div><input data-field="topic" type="text" value="' + escapeHtml(decision.topic || "") + '"></label>') +
        (!isGroup ? '<label class="wide"><div class="label">Subtopics</div><input data-field="subtopics" type="text" value="' + escapeHtml((decision.subtopics || []).join(", ")) + '"></label>' : '') +
        '<label class="wide"><div class="label">Reviewer notes</div><textarea data-field="reviewerNotes">' + escapeHtml(decision.reviewerNotes || "") + '</textarea></label>' +
        '<label class="wide"><div class="label">Explanation</div><textarea data-field="explanation">' + escapeHtml(decision.explanation || "") + '</textarea></label>' +
        '<div class="wide"><button class="secondary mark-reviewed">Mark reviewed</button> <span class="muted">' + (decision.reviewedAt ? 'Reviewed ' + escapeHtml(decision.reviewedAt) : 'Not marked reviewed') + '</span></div>' +
      '</div>';
    }

    function duplicateGroupHtml(item) {
      const decision = decisionFor(item.id);
      const uses = (item.uses || []).map((use) =>
        '<article class="use">' +
        '<div class="use-grid">' +
        imageHtml(use.sourceScreenshotPath, use.sourceId) +
        '<div><div class="badges"><span class="pill">' + escapeHtml(use.sourceBatch) + '</span><span class="pill">' + escapeHtml(use.sourceId) + '</span><span class="pill">key ' + escapeHtml(use.localAnswerKey || "unknown") + '</span><span class="pill">' + escapeHtml(use.action || "no action") + '</span></div>' +
        '<div class="prompt">' + escapeHtml(use.sourcePrompt || "") + '</div>' +
        (use.sourcePromptGloss ? '<div class="gloss">' + escapeHtml(use.sourcePromptGloss) + '</div>' : '') +
        sourceOptionsHtml(use.sourceOptions) +
        (use.reviewerNote ? '<div class="gloss">' + escapeHtml(use.reviewerNote) + '</div>' : '') +
        '</div></div></article>'
      ).join("");
      return '<article class="item" data-item-id="' + escapeHtml(item.id) + '" data-filter-text="' + escapeHtml(searchText(item)) + '">' +
        '<div class="item-head"><div><h2>' + escapeHtml(item.approvedQid || "Duplicate group") + '</h2><div class="muted">' + escapeHtml(item.classificationReason || "") + '</div></div>' +
        '<div class="badges"><span class="pill note">' + escapeHtml(item.classification || "duplicate") + '</span><span class="pill">' + escapeHtml(item.useCount) + ' uses</span><span class="pill">' + (item.inTranslationsFr ? "in translations.fr" : "not in translations.fr") + '</span></div></div>' +
        '<div class="grid"><div class="subgrid"><div class="box"><div class="label">Duplicate uses</div><div class="use-list">' + uses + '</div></div></div>' +
        '<div class="subgrid"><div class="box"><div class="label">Current group decision</div>' + decisionControlsHtml(item, decision) + '</div><div class="box"><div class="label">Approved qid candidate</div><div class="candidate-list">' + (item.candidates || []).map(candidateHtml).join("") + '</div></div></div></div>' +
        '</article>';
    }

    function standardItemHtml(item) {
      const decision = decisionFor(item.id);
      return '<article class="item" data-item-id="' + escapeHtml(item.id) + '" data-filter-text="' + escapeHtml(searchText(item)) + '">' +
        '<div class="item-head"><div><h2>' + escapeHtml(item.sourceBatch || "") + ' / ' + escapeHtml(item.sourceId || "") + '</h2><div class="muted">' + escapeHtml(item.itemType) + '</div></div>' +
        '<div class="badges"><span class="pill note">' + escapeHtml(item.currentDecision?.action || item.itemType) + '</span><span class="pill">key ' + escapeHtml(item.currentDecision?.localAnswerKey || "unknown") + '</span></div></div>' +
        '<div class="grid"><div class="subgrid">' +
        '<div class="box"><div class="label">Source</div>' + imageHtml(item.sourceScreenshotPath, item.sourceId) + '<div class="prompt">' + escapeHtml(item.sourcePrompt || "") + '</div>' + (item.sourcePromptGloss ? '<div class="gloss">' + escapeHtml(item.sourcePromptGloss) + '</div>' : '') + sourceOptionsHtml(item.sourceOptions) + '</div>' +
        '<div class="box"><div class="label">Current / Codex context</div><div class="gloss">' + escapeHtml(item.reviewerNote || "") + '</div>' + (item.codexRecommendation ? '<div class="gloss">Codex snapshot: ' + escapeHtml(item.codexRecommendation.action || "") + ' ' + escapeHtml(item.codexRecommendation.approvedQid || "") + '</div>' : '') + '</div>' +
        '</div><div class="subgrid">' +
        '<div class="box"><div class="label">Decision</div>' + decisionControlsHtml(item, decision) + '</div>' +
        '<div class="box"><div class="label">Candidate cards</div><div class="candidate-list">' + (item.candidates || []).map(candidateHtml).join("") + '</div></div>' +
        '</div></div></article>';
    }

    function searchText(item) {
      const parts = [item.id, item.itemType, item.approvedQid, item.sourceBatch, item.sourceId, item.sourcePrompt, item.sourcePromptGloss, item.reviewerNote, item.classification, item.classificationReason];
      for (const candidate of item.candidates || []) parts.push(candidate.qid, candidate.prompt);
      for (const use of item.uses || []) parts.push(use.sourceBatch, use.sourceId, use.sourcePrompt, use.sourcePromptGloss, use.reviewerNote);
      return parts.filter(Boolean).join(" ").toLowerCase();
    }

    function itemMatchesFilter(item) {
      if (activeFilter === "all") return true;
      if (activeFilter === "duplicate") return item.itemType === "duplicateGroup";
      if (activeFilter === "likely-duplicate") return item.classificationSection === "likely-duplicate-groups";
      if (activeFilter === "possible-legitimate") return item.classificationSection === "possible-legitimate-reused-qid-groups";
      if (activeFilter === "needs-manual") return item.classificationSection === "needs-manual-inspection-groups";
      return item.itemType === activeFilter;
    }

    function renderStats() {
      const stats = WORKBENCH.stats;
      const rows = [
        ["Review items", stats.itemCount],
        ["Duplicate groups", stats.duplicateGroupCount],
        ["Create new", stats.createNewQuestionCount],
        ["Unresolved", stats.keepUnresolvedCount],
        ["Delete", stats.deleteQuestionCount],
        ["Screenshots found", stats.screenshots.existing + " / " + stats.screenshots.referenced],
      ];
      document.getElementById("stats").innerHTML = rows.map(([label, value]) => '<div class="stat"><span class="muted">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join("");
    }

    function renderFilters() {
      const filters = [{ id: "all", label: "All", count: WORKBENCH.stats.itemCount }, ...WORKBENCH.sections.map((section) => ({ id: section.filter, label: section.label, count: section.count }))];
      document.getElementById("filters").innerHTML = filters.map((filter) =>
        '<button class="filter ' + (filter.id === activeFilter ? 'active' : '') + '" data-filter="' + escapeHtml(filter.id) + '">' + escapeHtml(filter.label) + ' · ' + escapeHtml(filter.count) + '</button>'
      ).join("");
    }

    function renderItems() {
      const filtered = WORKBENCH.items.filter(itemMatchesFilter).filter((item) => !query || searchText(item).includes(query));
      document.getElementById("items").innerHTML = filtered.map((item) => item.itemType === "duplicateGroup" ? duplicateGroupHtml(item) : standardItemHtml(item)).join("") || '<section class="panel muted">No items match the current filters.</section>';
    }

    function render() {
      renderStats();
      renderFilters();
      renderItems();
    }

    document.addEventListener("input", (event) => {
      const field = event.target?.dataset?.field;
      if (event.target?.id === "search") {
        query = event.target.value.toLowerCase().trim();
        renderItems();
        return;
      }
      if (!field) return;
      const card = event.target.closest(".item");
      const decision = decisionFor(card?.dataset?.itemId);
      if (!decision) return;
      if (field === "subtopics") {
        decision[field] = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
      } else {
        decision[field] = event.target.value || null;
      }
      saveState();
      setStatus("Autosaved locally");
    });

    document.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-filter]");
      if (filterButton) {
        activeFilter = filterButton.dataset.filter;
        render();
        return;
      }
      const useQid = event.target.closest(".use-qid");
      if (useQid) {
        const card = event.target.closest(".item");
        const decision = decisionFor(card?.dataset?.itemId);
        if (decision) {
          decision.decision = "approveExistingQid";
          decision.approvedQid = useQid.dataset.qid;
          saveState();
          renderItems();
          setStatus("Qid selected and autosaved");
        }
        return;
      }
      if (event.target.closest(".mark-reviewed")) {
        const card = event.target.closest(".item");
        const decision = decisionFor(card?.dataset?.itemId);
        if (decision) {
          decision.reviewedAt = new Date().toISOString();
          saveState();
          renderItems();
          setStatus("Marked reviewed");
        }
      }
    });

    document.getElementById("export-json").addEventListener("click", () => {
      const payload = { ...state, generatedAt: new Date().toISOString(), sourceAudit: WORKBENCH.sourceAudit };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fr-final-audit-workbench-decisions.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Exported decisions JSON");
    });

    document.getElementById("import-json").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = Array.isArray(parsed) ? { items: parsed } : parsed;
        const byId = new Map((incoming.items || []).map((item) => [item.itemId, item]));
        state = {
          ...INITIAL_DECISIONS,
          items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(byId.get(item.itemId) || {}) })),
        };
        saveState();
        render();
        setStatus("Imported decisions and autosaved locally");
      } catch (error) {
        setStatus("Import failed: " + error.message);
      } finally {
        event.target.value = "";
      }
    });

    document.getElementById("clear-local").addEventListener("click", () => {
      if (!confirm("Clear locally autosaved final-audit decisions?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = structuredClone(INITIAL_DECISIONS);
      render();
      setStatus("Local decisions cleared");
    });

    render();
  </script>
</body>
</html>
`;
}

const workbench = buildWorkbench();
await writeJson(OUTPUT_JSON_PATH, {
  ...workbench,
  decisionsTemplate: undefined,
});
await writeJson(OUTPUT_DECISIONS_PATH, workbench.decisionsTemplate);
await writeText(OUTPUT_HTML_PATH, buildHtml(workbench));

console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_HTML_PATH))}`);
console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_JSON_PATH))}`);
console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_DECISIONS_PATH))}`);
console.log(`Rendered ${workbench.sections.length} sections and ${workbench.stats.itemCount} review items.`);
console.log(`Screenshots found: ${workbench.stats.screenshots.existing}/${workbench.stats.screenshots.referenced}`);
