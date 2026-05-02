import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  fileExists,
  readJson,
} from "./pipeline.mjs";

export const BACKFILL_SOURCE = "english_master_backfill";

export function backfillPaths({ lang, dataset = DEFAULT_DATASET, input = null } = {}) {
  const safeLang = normalizeLang(lang);
  const datasetDir = path.join(ROOT, "public", "qbank", dataset);

  return {
    dataset,
    lang: safeLang,
    datasetDir,
    masterPath: path.join(datasetDir, "questions.json"),
    rawMasterPath: path.join(datasetDir, "questions.raw.json"),
    translationsPath: path.join(datasetDir, `translations.${safeLang}.json`),
    imageColorTagsPath: path.join(datasetDir, "image-color-tags.json"),
    missingItemsPath: path.join(STAGING_DIR, `backfill.${safeLang}.missing-qids.json`),
    generatedDraftPath: input
      ? path.resolve(String(input))
      : path.join(STAGING_DIR, `backfill.${safeLang}.generated-draft.json`),
    reviewedPath: input
      ? path.resolve(String(input))
      : path.join(STAGING_DIR, `backfill.${safeLang}.reviewed.json`),
    validationJsonPath: path.join(REPORTS_DIR, `backfill-validation.${safeLang}.json`),
    validationMdPath: path.join(REPORTS_DIR, `backfill-validation.${safeLang}.md`),
    mergeJsonPath: path.join(REPORTS_DIR, `backfill-production-merge.${safeLang}.json`),
    mergeMdPath: path.join(REPORTS_DIR, `backfill-production-merge.${safeLang}.md`),
  };
}

export function normalizeLang(value) {
  return String(value ?? "").trim().toLowerCase() || "ru";
}

export function parseLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Invalid --limit value: ${value}`);
  }
  return limit;
}

export function loadBackfillContext({ lang, dataset = DEFAULT_DATASET } = {}) {
  const paths = backfillPaths({ lang, dataset });
  const masterDoc = readJson(paths.masterPath);
  const translationsDoc = fileExists(paths.translationsPath)
    ? readJson(paths.translationsPath)
    : { meta: { locale: paths.lang }, questions: {} };
  const imageTagsDoc = fileExists(paths.imageColorTagsPath)
    ? readJson(paths.imageColorTagsPath)
    : { meta: {}, questions: {} };

  const masterQuestions = questionArray(masterDoc);
  const masterByQid = new Map(masterQuestions.map((question) => [questionQid(question), question]).filter(([qid]) => qid));
  const translations = translationQuestions(translationsDoc);
  const translationQids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
  const missingQids = [...masterByQid.keys()].filter((qid) => !translationQids.has(qid)).sort(compareQid);

  return {
    paths,
    masterDoc,
    translationsDoc,
    imageTagsDoc,
    masterQuestions,
    masterByQid,
    translations,
    translationQids,
    missingQids,
  };
}

export function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

export function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions)
    ? doc.questions
    : {};
}

export function questionQid(question) {
  return normalizeQid(question?.id ?? question?.qid);
}

export function normalizeQid(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

export function compareQid(left, right) {
  const leftNumber = Number(String(left).replace(/^q/i, ""));
  const rightNumber = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right));
}

export function questionType(question) {
  return String(question?.type ?? "").trim().toLowerCase() === "row" ? "row" : "mcq";
}

export function masterOptions(question) {
  return Array.isArray(question?.options)
    ? question.options.map((option, index) => ({
        key: normalizeMcqKey(option?.originalKey) ?? keyFromIndex(index),
        id: String(option?.id ?? "").trim() || `${questionQid(question)}_o${index + 1}`,
        text: String(option?.text ?? "").trim(),
      }))
    : [];
}

export function masterCorrectOptionKey(question) {
  if (questionType(question) === "row") {
    return normalizeRowKey(question?.answerRaw ?? question?.correctRow);
  }

  const options = masterOptions(question);
  const correctOptionId = String(question?.correctOptionId ?? "").trim();
  const byId = options.find((option) => option.id === correctOptionId);
  return byId?.key ?? normalizeMcqKey(question?.answerRaw);
}

export function normalizeAnswerKey(value, type = "mcq") {
  return type === "row" ? normalizeRowKey(value) : normalizeMcqKey(value);
}

export function normalizeMcqKey(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(raw) ? raw : null;
}

export function normalizeRowKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["r", "right", "true", "correct"].includes(raw)) return "Right";
  if (["w", "wrong", "false", "incorrect"].includes(raw)) return "Wrong";
  return null;
}

export function keyFromIndex(index) {
  return ["A", "B", "C", "D"][index] ?? null;
}

export function deriveTopicInfo(question) {
  const tags = question?.tags && typeof question.tags === "object" ? question.tags : {};
  const userTags = Array.isArray(tags.user) ? tags.user : [];
  const autoTags = Array.isArray(tags.auto) ? tags.auto : [];
  const suggestedTags = Array.isArray(tags.suggested)
    ? [...tags.suggested]
        .sort((left, right) => Number(right?.score ?? 0) - Number(left?.score ?? 0))
        .map((entry) => entry?.tag)
    : [];
  const normalized = [...userTags, ...suggestedTags, ...autoTags]
    .map(cleanTag)
    .filter((tag) => tag && !["mcq", "row", "pic"].includes(tag));

  return {
    topic: normalized[0] ?? null,
    subtopic: normalized[1] ?? null,
    tags,
  };
}

export function cleanTag(value) {
  return String(value ?? "").trim().replace(/^#/, "").toLowerCase() || null;
}

export function imageInfo(question, imageTagsDoc) {
  const qid = questionQid(question);
  const tagEntry = imageTagsDoc?.questions?.[qid] ?? null;
  const assets = Array.isArray(question?.assets) ? question.assets : [];
  const assetSrcs = [
    ...assets.map((asset) => asset?.src).filter(Boolean),
    ...(Array.isArray(tagEntry?.assetSrcs) ? tagEntry.assetSrcs : []),
  ];
  const uniqueAssetSrcs = [...new Set(assetSrcs)];

  return {
    image: uniqueAssetSrcs[0] ?? null,
    imageAssets: uniqueAssetSrcs,
    imageTags: tagEntry,
    objectTags: Array.isArray(tagEntry?.objectTags) ? tagEntry.objectTags : [],
  };
}

export function buildMissingBackfillItems(context, { limit = null } = {}) {
  const qids = limit ? context.missingQids.slice(0, limit) : context.missingQids;

  return qids.map((qid) => {
    const question = context.masterByQid.get(qid);
    const type = questionType(question);
    const topicInfo = deriveTopicInfo(question);
    const image = imageInfo(question, context.imageTagsDoc);

    return {
      qid,
      number: Number(question?.number ?? qid.replace(/^q/i, "")),
      type,
      englishPrompt: String(question?.prompt ?? "").trim(),
      englishOptions: masterOptions(question),
      englishExplanation: String(question?.explanation ?? "").trim(),
      correctOptionKey: masterCorrectOptionKey(question),
      topic: topicInfo.topic,
      subtopic: topicInfo.subtopic,
      tags: topicInfo.tags,
      image: image.image,
      imageAssets: image.imageAssets,
      imageTags: image.imageTags,
      objectTags: image.objectTags,
      translationStatus: "needs_generation",
      reviewStatus: "pending",
    };
  });
}

export function generatedOptionsSkeleton(item) {
  if (item.type === "row") return {};
  return Object.fromEntries((item.englishOptions ?? []).map((option) => [option.id, ""]));
}

export function reviewedTranslationToProductionEntry({ item, masterQuestion }) {
  const type = questionType(masterQuestion);
  const generated = item.generatedTranslation ?? {};
  const prompt = String(generated.prompt ?? "").trim();
  const explanation = String(generated.explanation ?? "").trim();
  const base = {
    prompt,
    explanation,
    sourceMode: BACKFILL_SOURCE,
    confidence: String(item.reviewConfidence ?? item.generationConfidence ?? "medium").trim() || "medium",
    reviewStatus: "ready",
  };

  if (type === "row") {
    return base;
  }

  const optionMap = normalizeGeneratedOptions(generated.options, masterQuestion);
  const options = Object.fromEntries(optionMap.map((entry) => [entry.id, entry.text]));
  const localeOptionOrder = optionMap.map((entry, index) => ({
    sourceIndex: index,
    sourceKey: entry.key,
    sourceText: entry.text,
    sourceTextBody: entry.text,
    canonicalOptionId: entry.id,
    canonicalOptionKey: entry.key,
    canonicalOptionText: entry.englishText,
    alignmentScore: 1,
    alignmentMethod: "english-master-order-preserved",
    manualAnswerKeyConfirmed: true,
  }));

  return {
    ...base,
    options,
    localeOptionOrder,
    optionMeaningMap: localeOptionOrder,
    localeCorrectOptionKey: masterCorrectOptionKey(masterQuestion),
  };
}

export function normalizeGeneratedOptions(optionsValue, masterQuestion) {
  const master = masterOptions(masterQuestion);
  const byIdOrKey = new Map();

  if (Array.isArray(optionsValue)) {
    for (const entry of optionsValue) {
      const id = String(entry?.id ?? "").trim();
      const key = normalizeMcqKey(entry?.key ?? entry?.sourceKey ?? entry?.originalKey);
      const text = String(entry?.text ?? "").trim();
      if (id) byIdOrKey.set(id, text);
      if (key) byIdOrKey.set(key, text);
    }
  } else if (optionsValue && typeof optionsValue === "object") {
    for (const [key, value] of Object.entries(optionsValue)) {
      if (typeof value === "string") {
        byIdOrKey.set(key, value.trim());
      } else if (value && typeof value === "object") {
        byIdOrKey.set(key, String(value.text ?? "").trim());
      }
    }
  }

  return master.map((option) => ({
    id: option.id,
    key: option.key,
    englishText: option.text,
    text: byIdOrKey.get(option.id) ?? byIdOrKey.get(option.key) ?? "",
  }));
}

export function validateDraftItems({ items, context, requireGeneratedText = false, requireApproved = false } = {}) {
  const errors = [];
  const warnings = [];
  const itemReports = [];
  const seen = new Set();

  for (const [index, item] of items.entries()) {
    const qid = normalizeQid(item?.qid);
    const itemErrors = [];
    const itemWarnings = [];
    const master = context.masterByQid.get(qid);
    const type = master ? questionType(master) : String(item?.type ?? "").toLowerCase();

    if (!qid) itemErrors.push("missing qid");
    if (qid && seen.has(qid)) itemErrors.push("duplicate qid in input");
    if (qid) seen.add(qid);
    if (qid && !master) itemErrors.push("qid does not exist in English master questions.json");
    if (qid && context.translationQids.has(qid)) itemErrors.push("qid already exists in production translations");

    if (requireApproved && item?.reviewStatus !== "approved") {
      itemErrors.push(`reviewStatus must be approved, got ${String(item?.reviewStatus ?? "") || "missing"}`);
    }

    if (item?.needsHumanReview !== true) {
      itemErrors.push("needsHumanReview must be true");
    }

    if (master) {
      const expectedCorrectKey = masterCorrectOptionKey(master);
      const actualCorrectKey = item?.correctOptionKey ? normalizeAnswerKey(item.correctOptionKey, type) : expectedCorrectKey;
      if (expectedCorrectKey && actualCorrectKey !== expectedCorrectKey) {
        itemErrors.push(`correctOptionKey mismatch: expected ${expectedCorrectKey}, got ${actualCorrectKey ?? "missing"}`);
      }

      if (type === "mcq") {
        const generatedOptions = normalizeGeneratedOptions(item?.generatedTranslation?.options, master);
        const missingOptionIds = generatedOptions.filter((entry) => !entry.text).map((entry) => entry.id);
        if (requireGeneratedText && missingOptionIds.length > 0) {
          itemErrors.push(`missing generated option text for ${missingOptionIds.join(", ")}`);
        } else if (missingOptionIds.length > 0) {
          itemWarnings.push(`not generated for option ids: ${missingOptionIds.join(", ")}`);
        }
      }
    }

    const prompt = String(item?.generatedTranslation?.prompt ?? "").trim();
    if (requireGeneratedText && !prompt) {
      itemErrors.push("missing generated prompt");
    } else if (!prompt) {
      itemWarnings.push("generated prompt is empty");
    }

    if (item?.generationStatus === "not_generated") {
      itemWarnings.push("generationStatus is not_generated");
    }

    for (const error of itemErrors) errors.push({ index, qid, error });
    for (const warning of itemWarnings) warnings.push({ index, qid, warning });
    itemReports.push({ index, qid, type, valid: itemErrors.length === 0, errors: itemErrors, warnings: itemWarnings });
  }

  return {
    valid: errors.length === 0,
    counts: {
      inputItems: items.length,
      validItems: itemReports.filter((item) => item.valid).length,
      errorCount: errors.length,
      warningCount: warnings.length,
      duplicateQidCount: items.length - seen.size,
    },
    errors,
    warnings,
    items: itemReports,
  };
}

export function renderValidationMarkdown(report) {
  const lines = [
    `# Missing Localization Backfill Validation (${report.lang})`,
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Master qids: ${report.counts.masterQids}`,
    `- Production translations: ${report.counts.productionTranslations}`,
    `- Missing production qids: ${report.counts.missingQids}`,
    `- Input items: ${report.validation.counts.inputItems}`,
    `- Valid: ${report.validation.valid ? "yes" : "no"}`,
    `- Merge ready: ${report.mergeReady ? "yes" : "no"}`,
    `- Errors: ${report.validation.counts.errorCount}`,
    `- Warnings: ${report.validation.counts.warningCount}`,
    "",
  ];

  if (report.notes?.length) {
    lines.push("## Notes", "", ...report.notes.map((note) => `- ${note}`), "");
  }

  if (report.validation.errors.length) {
    lines.push("## Errors", "", ...report.validation.errors.map((entry) => `- ${entry.qid || `item ${entry.index}`}: ${entry.error}`), "");
  }

  if (report.validation.warnings.length) {
    lines.push("## Warnings", "", ...report.validation.warnings.slice(0, 100).map((entry) => `- ${entry.qid || `item ${entry.index}`}: ${entry.warning}`), "");
    if (report.validation.warnings.length > 100) {
      lines.push(`- ... ${report.validation.warnings.length - 100} more warnings omitted from markdown`, "");
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderMergeMarkdown(report) {
  const lines = [
    `# Missing Localization Backfill Production Merge (${report.lang})`,
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Apply requested: ${report.applyRequested ? "yes" : "no"}`,
    `- Applied: ${report.applied ? "yes" : "no"}`,
    `- Input items: ${report.validation.counts.inputItems}`,
    `- Valid: ${report.validation.valid ? "yes" : "no"}`,
    `- Mergeable items: ${report.mergeableQids.length}`,
    `- Existing production overlaps: ${report.overlappingProductionQids.length}`,
    `- Errors: ${report.validation.counts.errorCount}`,
    "",
  ];

  if (report.mergeableQids.length) {
    lines.push("## Mergeable Qids", "", report.mergeableQids.join(", "), "");
  }

  if (report.validation.errors.length) {
    lines.push("## Errors", "", ...report.validation.errors.map((entry) => `- ${entry.qid || `item ${entry.index}`}: ${entry.error}`), "");
  }

  return `${lines.join("\n")}\n`;
}
