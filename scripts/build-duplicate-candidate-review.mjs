#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const AUDIT_PATH = path.join(REPORTS_DIR, "qbank-integrity-audit.json");
const QUESTIONS_PATH = path.join(DATASET_DIR, "questions.json");
const RAW_QUESTIONS_PATH = path.join(DATASET_DIR, "questions.raw.json");
const IMAGE_TAGS_PATH = path.join(DATASET_DIR, "image-color-tags.json");
const TRANSLATION_PATHS = {
  ko: path.join(DATASET_DIR, "translations.ko.json"),
  ja: path.join(DATASET_DIR, "translations.ja.json"),
  ru: path.join(DATASET_DIR, "translations.ru.json"),
};
const OUT_JSON = path.join(REPORTS_DIR, "duplicate-candidate-review.json");
const OUT_MD = path.join(REPORTS_DIR, "duplicate-candidate-review.md");
const OUT_HTML = path.join(REPORTS_DIR, "duplicate-candidate-review.html");
const OUT_DECISIONS_TEMPLATE = path.join(STAGING_DIR, "duplicate-candidate-review-decisions.json");

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];
const REVIEW_STATUSES = [
  "unreviewed",
  "intentional-similar",
  "likely-duplicate",
  "needs-image-review",
  "master-fix-needed",
];
const LANG_LABELS = {
  ko: "Korean",
  ja: "Japanese",
  ru: "Russian",
};

const auditDoc = readJson(AUDIT_PATH);
const questionsDoc = readJson(QUESTIONS_PATH);
const rawQuestionsDoc = readJson(RAW_QUESTIONS_PATH);
const imageTagsDoc = readJsonIfExists(IMAGE_TAGS_PATH, { questions: {} });
const translationDocs = Object.fromEntries(
  Object.entries(TRANSLATION_PATHS).map(([lang, filePath]) => [lang, readJsonIfExists(filePath, { questions: {} })]),
);

const questionMap = new Map(questionArray(questionsDoc).map((question) => [qidFor(question), question]).filter(([qid]) => qid));
const rawQuestionMap = new Map(questionArray(rawQuestionsDoc).map((question) => [qidFor(question), question]).filter(([qid]) => qid));
const imageTagMap = buildImageTagMap(imageTagsDoc);
const duplicateCandidates = extractDuplicateCandidates(auditDoc);

const groups = duplicateCandidates.map((candidate, index) => buildGroup(candidate, index + 1));
const uniqueQids = new Set(groups.flatMap((group) => group.qids));
const summary = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET,
  sourceAudit: rel(AUDIT_PATH),
  duplicateGroups: groups.length,
  totalQidsIncluded: uniqueQids.size,
  groupsWithImages: groups.filter((group) => group.diffs.hasImages).length,
  groupsWithoutImages: groups.filter((group) => !group.diffs.hasImages).length,
  groupsWithSameAnswerKey: groups.filter((group) => group.diffs.sameAnswerKey).length,
  groupsWithDifferentAnswerKey: groups.filter((group) => group.diffs.differentCorrectOptionKey).length,
  groupsWithDifferentImages: groups.filter((group) => group.diffs.differentImageAsset).length,
  groupsWithDifferentOptionText: groups.filter((group) => group.diffs.differentAnswerOptionText).length,
  renderedImageCount: groups.reduce((sum, group) => sum + group.questions.reduce((inner, question) => inner + question.images.filter((image) => image.renderable).length, 0), 0),
};

const report = {
  generatedAt: summary.generatedAt,
  dataset: DATASET,
  readOnly: true,
  sources: {
    audit: rel(AUDIT_PATH),
    questions: rel(QUESTIONS_PATH),
    rawQuestions: rel(RAW_QUESTIONS_PATH),
    imageTags: rel(IMAGE_TAGS_PATH),
    translations: Object.fromEntries(Object.entries(TRANSLATION_PATHS).map(([lang, filePath]) => [lang, rel(filePath)])),
  },
  outputs: {
    json: rel(OUT_JSON),
    markdown: rel(OUT_MD),
    html: rel(OUT_HTML),
    decisionsTemplate: rel(OUT_DECISIONS_TEMPLATE),
  },
  summary,
  groups,
};

const decisionsTemplate = {
  schemaVersion: 1,
  generatedAt: summary.generatedAt,
  sourceReport: rel(OUT_JSON),
  decisions: groups.map((group) => ({
    groupId: group.id,
    qids: group.qids,
    status: "unreviewed",
    notes: "",
    reviewedAt: null,
  })),
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.mkdir(STAGING_DIR, { recursive: true });
await writeJson(OUT_JSON, report);
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");
await fsp.writeFile(OUT_HTML, renderHtml(report), "utf8");
await writeJson(OUT_DECISIONS_TEMPLATE, decisionsTemplate);

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Wrote ${rel(OUT_HTML)}`);
console.log(`Wrote ${rel(OUT_DECISIONS_TEMPLATE)}`);
console.log(`Duplicate groups found: ${summary.duplicateGroups}`);
console.log(`Total qids included: ${summary.totalQidsIncluded}`);
console.log(`Rendered image references: ${summary.renderedImageCount}`);

function buildGroup(candidate, ordinal) {
  const qids = unique(candidate.qids.map(normalizeQid).filter(Boolean));
  const questions = qids.map((qid) => buildQuestionReview(qid));
  const diffs = compareGroup(questions);
  return {
    id: `duplicate-set-${String(ordinal).padStart(3, "0")}`,
    confidence: candidate.confidence ?? "unknown",
    qids,
    reviewStatus: "unreviewed",
    auditEvidence: {
      prompts: Array.isArray(candidate.prompts) ? candidate.prompts : [],
      answerLogic: Array.isArray(candidate.answerLogic) ? candidate.answerLogic : [],
      imageRefs: Array.isArray(candidate.imageRefs) ? candidate.imageRefs : [],
      reason: candidate.reason ?? null,
    },
    diffs,
    questions,
  };
}

function buildQuestionReview(qid) {
  const master = questionMap.get(qid) ?? null;
  const raw = rawQuestionMap.get(qid) ?? null;
  const tagEntry = imageTagMap.get(qid) ?? null;
  const baseQuestion = master ?? raw ?? { id: qid };
  const options = optionRecords(baseQuestion);
  const correctKey = correctOptionKey(baseQuestion, options);
  const correctText = correctAnswerText(baseQuestion, options, correctKey);
  const images = collectImages(master, raw, tagEntry).map((src) => {
    const render = imageRenderInfo(src);
    return {
      src,
      htmlSrc: render.htmlSrc,
      renderable: render.renderable,
      fileExists: render.fileExists,
    };
  });

  return {
    qid,
    number: numberOrNull(master?.number ?? raw?.number),
    type: stringOrNull(master?.type ?? raw?.type),
    english: {
      prompt: stringOrNull(master?.prompt ?? raw?.prompt),
      rawPrompt: stringOrNull(raw?.prompt),
      promptDiffersFromRaw: Boolean(master?.prompt && raw?.prompt && normalizeText(master.prompt) !== normalizeText(raw.prompt)),
      options,
      correctOptionKey: correctKey,
      correctAnswerText: correctText,
      answerRaw: stringOrNull(master?.answerRaw ?? raw?.answerRaw),
      correctRow: stringOrNull(master?.correctRow ?? raw?.correctRow),
      correctOptionId: stringOrNull(master?.correctOptionId ?? raw?.correctOptionId),
    },
    images,
    imageTags: summarizeImageTags(tagEntry),
    questionTags: summarizeQuestionTags(master?.tags ?? raw?.tags),
    translations: Object.fromEntries(
      Object.entries(translationDocs).map(([lang, doc]) => [
        lang,
        summarizeTranslation(doc?.questions?.[qid] ?? null, lang, options, correctKey),
      ]),
    ),
    foundInMaster: Boolean(master),
    foundInRaw: Boolean(raw),
  };
}

function compareGroup(questions) {
  const prompts = questions.map((question) => normalizeText(question.english.prompt)).filter(Boolean);
  const imageSigs = questions.map((question) => signature(question.images.map((image) => image.src)));
  const correctKeys = questions.map((question) => question.english.correctOptionKey).filter(Boolean);
  const optionSigs = questions.map((question) => signature(question.english.options.map((option) => `${option.key}:${normalizeText(option.text)}`)));
  const hasImages = questions.some((question) => question.images.length > 0);
  const uniquePromptCount = unique(prompts).length;
  const uniqueImageCount = unique(imageSigs).length;
  const uniqueCorrectKeyCount = unique(correctKeys).length;
  const uniqueOptionSigCount = unique(optionSigs).length;
  const differentImageAsset = uniqueImageCount > 1;
  const differentCorrectOptionKey = uniqueCorrectKeyCount > 1;
  const differentAnswerOptionText = uniqueOptionSigCount > 1;
  const samePrompt = prompts.length > 0 && uniquePromptCount === 1;
  const differentPrompt = uniquePromptCount > 1;
  const sameImageButDifferentPrompt = hasImages && !differentImageAsset && differentPrompt;
  const samePromptButDifferentImage = samePrompt && differentImageAsset;
  const sameAnswerKey = correctKeys.length > 0 && uniqueCorrectKeyCount === 1;
  const highlights = [
    differentImageAsset ? "different image asset" : null,
    differentCorrectOptionKey ? "different correctOptionKey" : null,
    differentAnswerOptionText ? "different answer option text" : null,
    samePromptButDifferentImage ? "same prompt but different image" : null,
    sameImageButDifferentPrompt ? "same image but different prompt" : null,
  ].filter(Boolean);

  return {
    hasImages,
    differentImageAsset,
    differentCorrectOptionKey,
    differentAnswerOptionText,
    samePromptButDifferentImage,
    sameImageButDifferentPrompt,
    sameAnswerKey,
    differentAnswerKey: differentCorrectOptionKey,
    highlights,
  };
}

function extractDuplicateCandidates(audit) {
  const direct = Array.isArray(audit?.duplicates?.candidates) ? audit.duplicates.candidates : [];
  const warnings = Array.isArray(audit?.warnings) ? audit.warnings : [];
  const fromWarnings = warnings
    .filter((warning) => warning?.type === "duplicate-candidate")
    .map((warning) => ({
      ...(warning.details ?? {}),
      reason: warning.reason ?? warning.details?.reason ?? null,
    }));
  return (direct.length ? direct : fromWarnings)
    .filter((candidate) => Array.isArray(candidate?.qids) && candidate.qids.length > 1)
    .map((candidate) => ({
      confidence: candidate.confidence ?? "unknown",
      qids: candidate.qids,
      prompts: candidate.prompts ?? [],
      answerLogic: candidate.answerLogic ?? [],
      imageRefs: candidate.imageRefs ?? [],
      reason: candidate.reason ?? null,
    }));
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  if (doc?.questions && typeof doc.questions === "object") {
    return Object.entries(doc.questions).map(([qid, question]) => ({ id: qid, ...question }));
  }
  return [];
}

function buildImageTagMap(doc) {
  const questions = doc?.questions && typeof doc.questions === "object" ? doc.questions : {};
  return new Map(Object.entries(questions).map(([qid, entry]) => [normalizeQid(qid), entry]));
}

function optionRecords(question) {
  const options = Array.isArray(question?.options)
    ? question.options
    : Array.isArray(question?.choices)
      ? question.choices
      : [];
  return options.map((option, index) => {
    const key = stringOrNull(option?.originalKey ?? option?.key ?? option?.label ?? OPTION_KEYS[index]);
    return {
      id: stringOrNull(option?.id ?? option?.optionId ?? `${qidFor(question)}_o${index + 1}`),
      key,
      text: stringOrNull(option?.text ?? option?.labelText ?? option?.value ?? option) ?? "",
    };
  });
}

function correctOptionKey(question, options) {
  const explicit = normalizeAnswerKey(question?.correctOptionKey ?? question?.localeCorrectOptionKey);
  if (explicit) return explicit;
  const correctOptionId = stringOrNull(question?.correctOptionId);
  if (correctOptionId) {
    const option = options.find((candidate) => candidate.id === correctOptionId);
    if (option?.key) return option.key;
  }
  const raw = normalizeAnswerKey(question?.answerRaw ?? question?.correctAnswer ?? question?.correctRow);
  if (raw) return raw;
  return null;
}

function correctAnswerText(question, options, correctKey) {
  if (!correctKey) return null;
  if (correctKey === "Right" || correctKey === "Wrong") return correctKey;
  const option = options.find((candidate) => candidate.key === correctKey);
  return option?.text ?? null;
}

function collectImages(master, raw, tagEntry) {
  const srcs = [];
  for (const question of [master, raw]) {
    for (const asset of Array.isArray(question?.assets) ? question.assets : []) {
      if (!asset?.src) continue;
      if (asset.kind && asset.kind !== "image") continue;
      srcs.push(String(asset.src));
    }
  }
  if (Array.isArray(tagEntry?.assetSrcs)) srcs.push(...tagEntry.assetSrcs.map(String));
  return unique(srcs);
}

function summarizeImageTags(entry) {
  if (!entry) {
    return {
      assetSrcs: [],
      tagArrays: {},
      flatTags: [],
    };
  }
  const tagArrays = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === "assetSrcs" || key === "dominantByAsset") continue;
    if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
      tagArrays[key] = value.map(String);
    }
  }
  return {
    assetSrcs: Array.isArray(entry.assetSrcs) ? entry.assetSrcs.map(String) : [],
    tagArrays,
    flatTags: unique(Object.values(tagArrays).flat()),
  };
}

function summarizeQuestionTags(tags) {
  if (!tags || typeof tags !== "object") return [];
  const out = [];
  for (const [key, value] of Object.entries(tags)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") out.push(`${key}:${item}`);
        else if (item?.tag) out.push(`${key}:${item.tag}`);
      }
    }
  }
  return unique(out);
}

function summarizeTranslation(entry, lang, masterOptions, masterCorrectKey) {
  if (!entry) {
    return {
      lang,
      label: LANG_LABELS[lang] ?? lang,
      present: false,
      prompt: null,
      options: [],
      localeCorrectOptionKey: null,
      correctOptionKey: null,
      confirmedAsCorrectKey: null,
      effectiveCorrectOptionKey: null,
      effectiveCorrectAnswerText: null,
      reviewStatus: null,
      translationStatus: null,
      confidence: null,
      sourceMode: null,
      flags: [],
      notes: [],
    };
  }
  const optionMap = entry.options ?? entry.answers ?? entry.choices ?? {};
  const localizedOptions = localizedOptionRecords(optionMap, masterOptions);
  const localeKey = normalizeAnswerKey(entry.localeCorrectOptionKey);
  const correctKey = normalizeAnswerKey(entry.correctOptionKey);
  const confirmedKey = normalizeAnswerKey(entry.confirmedAsCorrectKey);
  const effectiveKey = localeKey ?? correctKey ?? confirmedKey ?? masterCorrectKey ?? null;
  const effectiveAnswer = localizedOptions.find((option) => option.key === effectiveKey)?.text ?? null;
  return {
    lang,
    label: LANG_LABELS[lang] ?? lang,
    present: true,
    prompt: stringOrNull(entry.prompt),
    options: localizedOptions,
    localeCorrectOptionKey: localeKey,
    correctOptionKey: correctKey,
    confirmedAsCorrectKey: confirmedKey,
    effectiveCorrectOptionKey: effectiveKey,
    effectiveCorrectAnswerText: effectiveAnswer,
    reviewStatus: stringOrNull(entry.reviewStatus),
    translationStatus: stringOrNull(entry.translationStatus),
    confidence: stringOrNull(entry.confidence),
    sourceMode: stringOrNull(entry.sourceMode),
    flags: Array.isArray(entry.flags) ? entry.flags.map(String) : [],
    notes: Array.isArray(entry.notes) ? entry.notes.map(String) : [],
  };
}

function localizedOptionRecords(optionMap, masterOptions) {
  if (Array.isArray(optionMap)) {
    return optionMap.map((option, index) => ({
      id: stringOrNull(option?.id ?? masterOptions[index]?.id ?? null),
      key: stringOrNull(option?.originalKey ?? option?.key ?? masterOptions[index]?.key ?? OPTION_KEYS[index]),
      text: stringOrNull(option?.text ?? option?.value ?? option) ?? "",
    }));
  }
  if (optionMap && typeof optionMap === "object") {
    const fromMasterOrder = masterOptions
      .map((masterOption) => ({
        id: masterOption.id,
        key: masterOption.key,
        text: stringOrNull(optionMap[masterOption.id]) ?? "",
      }))
      .filter((option) => option.text !== "");
    if (fromMasterOrder.length > 0) return fromMasterOrder;
    return Object.entries(optionMap).map(([id, text], index) => ({
      id,
      key: masterOptions[index]?.key ?? OPTION_KEYS[index] ?? null,
      text: stringOrNull(text) ?? "",
    }));
  }
  return [];
}

function imageRenderInfo(src) {
  if (!src) return { htmlSrc: null, renderable: false, fileExists: false };
  if (/^https?:\/\//i.test(src)) return { htmlSrc: src, renderable: true, fileExists: true };
  const localPath = imageLocalPath(src);
  const fileExists = localPath ? fs.existsSync(localPath) : false;
  if (!localPath || !fileExists) return { htmlSrc: src, renderable: false, fileExists };
  return {
    htmlSrc: path.relative(path.dirname(OUT_HTML), localPath).split(path.sep).join("/"),
    renderable: true,
    fileExists,
  };
}

function imageLocalPath(src) {
  if (!src) return null;
  if (src.startsWith("/qbank/")) return path.join(ROOT, "public", src.slice(1));
  if (src.startsWith("public/")) return path.join(ROOT, src);
  if (src.startsWith("./") || src.startsWith("../")) return path.resolve(REPORTS_DIR, src);
  return path.join(ROOT, src);
}

function htmlImageSrc(image) {
  const localPath = imageLocalPath(image.src);
  if (!localPath || !fs.existsSync(localPath)) return image.htmlSrc ?? image.src;
  const data = fs.readFileSync(localPath);
  return `data:${mimeTypeFor(localPath)};base64,${data.toString("base64")}`;
}

function mimeTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Duplicate Candidate Review");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("This is a read-only review artifact. It does not merge, delete, or modify qbank records.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Duplicate groups: ${report.summary.duplicateGroups}`);
  lines.push(`- Total qids included: ${report.summary.totalQidsIncluded}`);
  lines.push(`- Groups with images: ${report.summary.groupsWithImages}`);
  lines.push(`- Groups without images: ${report.summary.groupsWithoutImages}`);
  lines.push(`- Same answer key groups: ${report.summary.groupsWithSameAnswerKey}`);
  lines.push(`- Different answer key groups: ${report.summary.groupsWithDifferentAnswerKey}`);
  lines.push(`- Rendered image references in HTML: ${report.summary.renderedImageCount}`);
  lines.push("");
  for (const group of report.groups) {
    lines.push(`## ${group.id}: ${group.qids.join(", ")}`);
    lines.push("");
    lines.push(`- Confidence: ${group.confidence}`);
    lines.push(`- Review status: ${group.reviewStatus}`);
    lines.push(`- Highlights: ${group.diffs.highlights.length ? group.diffs.highlights.join("; ") : "none flagged"}`);
    if (group.auditEvidence.answerLogic.length) lines.push(`- Audit answer logic: ${group.auditEvidence.answerLogic.join(", ")}`);
    if (group.auditEvidence.imageRefs.length) lines.push(`- Audit image refs: ${group.auditEvidence.imageRefs.join(", ")}`);
    if (group.auditEvidence.prompts.length) {
      lines.push("- Audit prompts:");
      for (const prompt of group.auditEvidence.prompts) {
        lines.push(`  - ${prompt.qid}: ${md(prompt.prompt)}`);
      }
    }
    lines.push("");
    for (const question of group.questions) {
      lines.push(`### ${question.qid}${question.number ? ` (#${question.number})` : ""}`);
      lines.push("");
      lines.push(`- Type: ${question.type ?? "unknown"}`);
      lines.push(`- Prompt: ${md(question.english.prompt ?? "")}`);
      lines.push(`- Correct key: ${question.english.correctOptionKey ?? "unknown"}`);
      lines.push(`- Correct text: ${md(question.english.correctAnswerText ?? "unknown")}`);
      lines.push(`- Images: ${question.images.length ? question.images.map((image) => image.src).join(", ") : "none"}`);
      lines.push(`- Image tags: ${question.imageTags.flatTags.length ? question.imageTags.flatTags.join(", ") : "none"}`);
      if (question.english.options.length) {
        lines.push("- English options:");
        for (const option of question.english.options) {
          lines.push(`  - ${option.key}: ${md(option.text)}`);
        }
      }
      for (const [lang, translation] of Object.entries(question.translations)) {
        lines.push(`- ${translation.label}: ${translation.present ? "present" : "missing"}`);
        if (!translation.present) continue;
        lines.push(`  - Prompt: ${md(translation.prompt ?? "")}`);
        lines.push(`  - Effective answer key: ${translation.effectiveCorrectOptionKey ?? "unknown"}`);
        lines.push(`  - Locale answer key: ${translation.localeCorrectOptionKey ?? "missing"}`);
        lines.push(`  - Review: ${translation.reviewStatus ?? "unknown"}; confidence: ${translation.confidence ?? "unknown"}; source: ${translation.sourceMode ?? "unknown"}`);
        if (translation.options.length) {
          lines.push(`  - Options: ${translation.options.map((option) => `${option.key}: ${mdInline(option.text)}`).join("; ")}`);
        }
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Duplicate Candidate Review</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --panel: #ffffff;
      --ink: #1d2526;
      --muted: #657071;
      --line: #d9dfdc;
      --soft: #eef2ef;
      --warn-bg: #fff4db;
      --warn-line: #d99b13;
      --good-bg: #eaf6ef;
      --bad-bg: #fdebea;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(247, 247, 244, 0.96);
      backdrop-filter: blur(8px);
    }
    h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: 0; }
    h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 12px 0 8px; font-size: 15px; letter-spacing: 0; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-height: 28px;
      padding: 4px 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button {
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      color: var(--ink);
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    button.active { border-color: #1d2526; background: #1d2526; color: #fff; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
    }
    .file-label {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      color: var(--ink);
      padding: 6px 10px;
      cursor: pointer;
      font-size: 13px;
    }
    .file-label input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .message {
      min-height: 20px;
      color: var(--muted);
      font-size: 12px;
    }
    .message.error { color: #9b1c17; }
    .message.success { color: #1e5b35; }
    .decision-counts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    main { padding: 18px 24px 42px; }
    .group {
      margin: 0 0 20px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      overflow: hidden;
    }
    .group-head {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: #fbfbf9;
    }
    .group-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
    .flag { background: var(--warn-bg); border-color: var(--warn-line); color: #654400; }
    .ok { background: var(--good-bg); color: #1e5b35; }
    .danger { background: var(--bad-bg); color: #7b1f1a; }
    .audit {
      margin-top: 10px;
      padding: 10px;
      border-radius: 6px;
      background: var(--soft);
      color: var(--muted);
      font-size: 13px;
    }
    .review-area {
      display: grid;
      grid-template-columns: minmax(160px, 220px) 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      padding: 8px;
    }
    textarea { min-height: 62px; resize: vertical; }
    .qid-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 12px;
      padding: 14px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .card-head {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #fcfcfa;
    }
    .card-body { padding: 12px; }
    .prompt { font-weight: 650; margin: 0 0 10px; }
    .muted { color: var(--muted); font-size: 12px; }
    .section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .diff-section {
      border-left: 3px solid var(--warn-line);
      padding-left: 8px;
    }
    .image-list { display: flex; flex-wrap: wrap; gap: 8px; }
    figure {
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fafafa;
      overflow: hidden;
      width: min(100%, 220px);
    }
    img {
      display: block;
      width: 100%;
      max-height: 180px;
      object-fit: contain;
      background: #fff;
    }
    figcaption {
      padding: 6px;
      color: var(--muted);
      font-size: 11px;
      overflow-wrap: anywhere;
      border-top: 1px solid var(--line);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 6px 4px;
      text-align: left;
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 600; }
    tr.correct { background: var(--good-bg); }
    .translation {
      margin-top: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
    }
    details.translation > summary {
      cursor: pointer;
      padding: 8px;
      background: #fbfbf9;
      font-size: 13px;
      font-weight: 650;
    }
    .translation-body { padding: 8px; }
    code {
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--soft);
      font-size: 12px;
    }
    .hidden { display: none; }
    @media (max-width: 720px) {
      header, main { padding-left: 14px; padding-right: 14px; }
      .review-area { grid-template-columns: 1fr; }
      .qid-grid { grid-template-columns: 1fr; padding: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Duplicate Candidate Review</h1>
    <div class="muted">Generated ${escapeHtml(report.generatedAt)} from ${escapeHtml(report.sources.audit)}. Read-only artifact.</div>
    <div class="summary">
      <span class="pill">${report.summary.duplicateGroups} groups</span>
      <span class="pill">${report.summary.totalQidsIncluded} qids</span>
      <span class="pill">${report.summary.groupsWithImages} with images</span>
      <span class="pill">${report.summary.groupsWithDifferentAnswerKey} answer-key differences</span>
      <span class="pill">${report.summary.renderedImageCount} rendered images</span>
    </div>
    <div class="decision-counts" aria-label="Decision counts">
      <span class="pill">total groups <strong data-count="total">${report.summary.duplicateGroups}</strong></span>
      ${REVIEW_STATUSES.map((status) => `<span class="pill">${escapeHtml(status)} <strong data-count="${escapeAttr(status)}">${status === "unreviewed" ? report.summary.duplicateGroups : 0}</strong></span>`).join("")}
    </div>
    <div class="actions" aria-label="Decision persistence controls">
      <button type="button" id="export-decisions">Export decisions JSON</button>
      <label class="file-label">Import decisions JSON<input type="file" id="import-decisions" accept="application/json,.json"></label>
      <button type="button" id="clear-decisions">Clear local decisions</button>
      <span id="decision-message" class="message" role="status" aria-live="polite">No local decisions loaded.</span>
    </div>
    <div class="filters" aria-label="Filters">
      <button type="button" class="active" data-filter="all">all</button>
      <button type="button" data-filter="with-images">groups with images</button>
      <button type="button" data-filter="without-images">groups without images</button>
      <button type="button" data-filter="same-answer-key">groups with same answer key</button>
      <button type="button" data-filter="different-answer-key">groups with different answer key</button>
    </div>
  </header>
  <main>
    ${report.groups.map(renderGroupHtml).join("\n")}
  </main>
  <script>
    const STORAGE_KEY = "expatise:duplicate-candidate-review:v1";
    const EXPORT_FILENAME = "duplicate-candidate-review-decisions.json";
    const SOURCE_ARTIFACT = "${escapeJsString(rel(OUT_HTML))}";
    const REVIEW_STATUSES = ${scriptJson(REVIEW_STATUSES)};
    const GROUP_DATA = ${scriptJson(report.groups.map((group) => ({ groupId: group.id, qids: group.qids })))};
    const buttons = [...document.querySelectorAll("[data-filter]")];
    const groups = [...document.querySelectorAll(".group")];
    const groupById = new Map(GROUP_DATA.map((group) => [group.groupId, group]));
    let decisions = defaultDecisions();

    function applyFilter(filter) {
      for (const button of buttons) button.classList.toggle("active", button.dataset.filter === filter);
      for (const group of groups) {
        const show =
          filter === "all" ||
          (filter === "with-images" && group.dataset.hasImages === "true") ||
          (filter === "without-images" && group.dataset.hasImages === "false") ||
          (filter === "same-answer-key" && group.dataset.sameAnswerKey === "true") ||
          (filter === "different-answer-key" && group.dataset.differentAnswerKey === "true");
        group.classList.toggle("hidden", !show);
      }
    }
    for (const button of buttons) button.addEventListener("click", () => applyFilter(button.dataset.filter));

    function defaultDecisions() {
      const out = {};
      for (const group of GROUP_DATA) {
        out[group.groupId] = {
          groupId: group.groupId,
          qids: group.qids,
          status: "unreviewed",
          notes: "",
          reviewedAt: null,
        };
      }
      return out;
    }

    function controlsFor(groupId) {
      const group = document.querySelector('.group[data-group-id="' + cssEscape(groupId) + '"]');
      if (!group) return null;
      return {
        group,
        status: group.querySelector('[data-role="decision-status"]'),
        notes: group.querySelector('[data-role="decision-notes"]'),
        pill: group.querySelector('[data-role="status-pill"]'),
      };
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
      return String(value).replace(/["\\\\]/g, "\\\\$&");
    }

    function normalizeDecision(input) {
      if (!input || typeof input !== "object") return null;
      if (typeof input.groupId !== "string" || !groupById.has(input.groupId)) return null;
      if (!REVIEW_STATUSES.includes(input.status)) return null;
      const group = groupById.get(input.groupId);
      const notes = typeof input.notes === "string" ? input.notes : "";
      const reviewedAt = typeof input.reviewedAt === "string" && input.reviewedAt.trim() ? input.reviewedAt : null;
      return {
        groupId: input.groupId,
        qids: group.qids,
        status: input.status,
        notes,
        reviewedAt,
      };
    }

    function currentDecisionFor(groupId) {
      const group = groupById.get(groupId);
      const controls = controlsFor(groupId);
      const previous = decisions[groupId] || null;
      const status = controls?.status?.value || previous?.status || "unreviewed";
      const notes = controls?.notes?.value || "";
      let reviewedAt = previous?.reviewedAt || null;
      if (status === "unreviewed" && notes.trim() === "") reviewedAt = null;
      if ((status !== "unreviewed" || notes.trim() !== "") && !reviewedAt) reviewedAt = new Date().toISOString();
      return {
        groupId,
        qids: group.qids,
        status,
        notes,
        reviewedAt,
      };
    }

    function applyDecisionToDom(decision) {
      const controls = controlsFor(decision.groupId);
      if (!controls) return;
      controls.status.value = decision.status;
      controls.notes.value = decision.notes || "";
      updateGroupStatus(decision.groupId);
    }

    function updateGroupStatus(groupId) {
      const controls = controlsFor(groupId);
      if (!controls) return;
      const status = controls.status.value;
      controls.group.dataset.reviewStatus = status;
      if (controls.pill) controls.pill.textContent = "status: " + status;
    }

    function updateCounts() {
      const counts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0]));
      for (const group of GROUP_DATA) {
        const status = decisions[group.groupId]?.status || "unreviewed";
        counts[status] = (counts[status] || 0) + 1;
      }
      const total = document.querySelector('[data-count="total"]');
      if (total) total.textContent = String(GROUP_DATA.length);
      for (const status of REVIEW_STATUSES) {
        const node = document.querySelector('[data-count="' + status + '"]');
        if (node) node.textContent = String(counts[status] || 0);
      }
    }

    function storagePayload() {
      return {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        sourceArtifact: SOURCE_ARTIFACT,
        decisions: GROUP_DATA.map((group) => decisions[group.groupId] || currentDecisionFor(group.groupId)),
      };
    }

    function saveLocal(message) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storagePayload()));
      updateCounts();
      setMessage(message || "saved locally", "success");
    }

    function restoreLocal() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        updateCounts();
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const imported = parseDecisionPayload(parsed);
        for (const decision of imported) decisions[decision.groupId] = decision;
        for (const decision of Object.values(decisions)) applyDecisionToDom(decision);
        updateCounts();
        setMessage("restored local decisions", "success");
      } catch (error) {
        updateCounts();
        setMessage("Could not restore local decisions: " + error.message, "error");
      }
    }

    function parseDecisionPayload(payload) {
      if (!payload || typeof payload !== "object") throw new Error("Invalid decisions file.");
      if (payload.schemaVersion !== 1) throw new Error("Unsupported schemaVersion.");
      if (!Array.isArray(payload.decisions)) throw new Error("Missing decisions array.");
      const parsed = [];
      for (const item of payload.decisions) {
        const decision = normalizeDecision(item);
        if (!decision) {
          if (item && typeof item.groupId === "string" && !groupById.has(item.groupId)) continue;
          throw new Error("Invalid decision entry.");
        }
        parsed.push(decision);
      }
      if (parsed.length === 0) throw new Error("No decisions matched this artifact.");
      return parsed;
    }

    function exportDecisions() {
      for (const group of GROUP_DATA) decisions[group.groupId] = currentDecisionFor(group.groupId);
      const payload = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        sourceArtifact: SOURCE_ARTIFACT,
        decisions: GROUP_DATA.map((group) => decisions[group.groupId]),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = EXPORT_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      saveLocal("exported decisions JSON");
    }

    function importDecisions(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          const payload = JSON.parse(String(reader.result || ""));
          const imported = parseDecisionPayload(payload);
          const next = { ...decisions };
          for (const decision of imported) next[decision.groupId] = decision;
          decisions = next;
          for (const decision of Object.values(decisions)) applyDecisionToDom(decision);
          saveLocal("imported " + imported.length + " decisions");
        } catch (error) {
          setMessage("Import failed: " + error.message, "error");
        } finally {
          document.getElementById("import-decisions").value = "";
        }
      });
      reader.addEventListener("error", () => {
        setMessage("Import failed: could not read file.", "error");
      });
      reader.readAsText(file);
    }

    function clearLocalDecisions() {
      if (!confirm("Clear local duplicate review decisions for this artifact?")) return;
      localStorage.removeItem(STORAGE_KEY);
      decisions = defaultDecisions();
      for (const decision of Object.values(decisions)) applyDecisionToDom(decision);
      updateCounts();
      setMessage("local decisions cleared", "success");
    }

    function setMessage(text, kind) {
      const message = document.getElementById("decision-message");
      if (!message) return;
      message.textContent = text;
      message.classList.toggle("error", kind === "error");
      message.classList.toggle("success", kind === "success");
    }

    for (const group of GROUP_DATA) {
      const controls = controlsFor(group.groupId);
      if (!controls) continue;
      const handleChange = () => {
        decisions[group.groupId] = currentDecisionFor(group.groupId);
        updateGroupStatus(group.groupId);
        saveLocal("saved locally");
      };
      controls.status.addEventListener("change", handleChange);
      controls.notes.addEventListener("input", handleChange);
    }
    document.getElementById("export-decisions").addEventListener("click", exportDecisions);
    document.getElementById("import-decisions").addEventListener("change", (event) => importDecisions(event.target.files?.[0]));
    document.getElementById("clear-decisions").addEventListener("click", clearLocalDecisions);
    restoreLocal();
  </script>
</body>
</html>`;
}

function renderGroupHtml(group) {
  return `<section class="group" data-group-id="${escapeAttr(group.id)}" data-review-status="${escapeAttr(group.reviewStatus)}" data-has-images="${group.diffs.hasImages}" data-same-answer-key="${group.diffs.sameAnswerKey}" data-different-answer-key="${group.diffs.differentAnswerKey}">
  <div class="group-head">
    <h2>${escapeHtml(group.id)}: ${escapeHtml(group.qids.join(", "))}</h2>
    <div class="group-meta">
      <span class="pill">confidence: ${escapeHtml(group.confidence)}</span>
      <span class="pill" data-role="status-pill">status: ${escapeHtml(group.reviewStatus)}</span>
      ${group.diffs.highlights.length ? group.diffs.highlights.map((flag) => `<span class="pill flag">${escapeHtml(flag)}</span>`).join("") : `<span class="pill ok">no automatic diff flags</span>`}
    </div>
    <div class="audit">
      ${renderAuditHtml(group.auditEvidence)}
    </div>
    <div class="review-area">
      <label>
        <span class="muted">Suggested review status</span>
        <select data-role="decision-status">
          ${REVIEW_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${status === group.reviewStatus ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span class="muted">Reviewer notes</span>
        <textarea data-role="decision-notes" placeholder="Saved locally in this browser. Export JSON for durable handoff."></textarea>
      </label>
    </div>
  </div>
  <div class="qid-grid">
    ${group.questions.map((question) => renderQuestionCardHtml(question, group.diffs)).join("\n")}
  </div>
</section>`;
}

function renderAuditHtml(auditEvidence) {
  const lines = [];
  if (auditEvidence.answerLogic.length) lines.push(`<div><strong>Answer logic:</strong> ${escapeHtml(auditEvidence.answerLogic.join(", "))}</div>`);
  if (auditEvidence.imageRefs.length) lines.push(`<div><strong>Audit image refs:</strong> ${escapeHtml(auditEvidence.imageRefs.join(", "))}</div>`);
  if (auditEvidence.prompts.length) {
    lines.push(`<div><strong>Audit prompts:</strong></div>`);
    lines.push(`<ul>${auditEvidence.prompts.map((prompt) => `<li><code>${escapeHtml(prompt.qid)}</code> ${escapeHtml(prompt.prompt ?? "")}</li>`).join("")}</ul>`);
  }
  return lines.length ? lines.join("") : "No extra audit evidence available.";
}

function renderQuestionCardHtml(question, diffs) {
  return `<article class="card">
  <div class="card-head">
    <strong>${escapeHtml(question.qid)}</strong>${question.number ? ` <span class="muted">#${escapeHtml(question.number)}</span>` : ""}
    <div class="muted">type: ${escapeHtml(question.type ?? "unknown")} | master: ${question.foundInMaster ? "yes" : "no"} | raw: ${question.foundInRaw ? "yes" : "no"}</div>
  </div>
  <div class="card-body">
    <p class="prompt">${escapeHtml(question.english.prompt ?? "")}</p>
    ${question.english.promptDiffersFromRaw ? `<div class="pill flag">raw prompt differs</div>` : ""}
    <div class="${diffs.differentCorrectOptionKey ? "section diff-section" : "section"}">
      <div><strong>Correct:</strong> <code>${escapeHtml(question.english.correctOptionKey ?? "unknown")}</code> ${escapeHtml(question.english.correctAnswerText ?? "")}</div>
      <div class="muted">answerRaw: ${escapeHtml(question.english.answerRaw ?? "n/a")} | correctOptionId: ${escapeHtml(question.english.correctOptionId ?? "n/a")}</div>
    </div>
    ${renderOptionsHtml(question.english.options, question.english.correctOptionKey, diffs.differentAnswerOptionText)}
    ${renderImagesHtml(question, diffs)}
    ${renderTagsHtml(question)}
    <div class="section">
      <h3>Translations</h3>
      ${Object.values(question.translations).map(renderTranslationHtml).join("\n")}
    </div>
  </div>
</article>`;
}

function renderOptionsHtml(options, correctKey, isDiff) {
  if (!options.length) return `<div class="section muted">No English answer options.</div>`;
  return `<div class="${isDiff ? "section diff-section" : "section"}">
    <h3>English Options</h3>
    <table>
      <thead><tr><th>Key</th><th>Text</th></tr></thead>
      <tbody>
        ${options.map((option) => `<tr class="${option.key === correctKey ? "correct" : ""}"><td><code>${escapeHtml(option.key ?? "")}</code></td><td>${escapeHtml(option.text ?? "")}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function renderImagesHtml(question, diffs) {
  if (!question.images.length) return `<div class="section muted">No image asset.</div>`;
  return `<div class="${diffs.differentImageAsset || diffs.samePromptButDifferentImage || diffs.sameImageButDifferentPrompt ? "section diff-section" : "section"}">
    <h3>Images</h3>
    <div class="image-list">
      ${question.images.map((image) => {
        if (!image.renderable) {
          return `<figure><figcaption>Missing or non-renderable: ${escapeHtml(image.src)}</figcaption></figure>`;
        }
        return `<figure><img src="${escapeAttr(htmlImageSrc(image))}" alt="${escapeAttr(question.qid)} image"><figcaption>${escapeHtml(image.src)}</figcaption></figure>`;
      }).join("")}
    </div>
  </div>`;
}

function renderTagsHtml(question) {
  const tagLines = [];
  for (const [key, values] of Object.entries(question.imageTags.tagArrays)) {
    if (values.length) tagLines.push(`<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(values.join(", "))}</div>`);
  }
  if (question.questionTags.length) tagLines.push(`<div><strong>question tags:</strong> ${escapeHtml(question.questionTags.join(", "))}</div>`);
  return `<div class="section">
    <h3>Image / Question Tags</h3>
    ${tagLines.length ? tagLines.join("") : `<div class="muted">No tags found.</div>`}
  </div>`;
}

function renderTranslationHtml(translation) {
  if (!translation.present) {
    return `<details class="translation"><summary>${escapeHtml(translation.label)}: missing</summary></details>`;
  }
  return `<details class="translation">
    <summary>${escapeHtml(translation.label)}: ${escapeHtml(translation.reviewStatus ?? "unknown")} | locale key ${escapeHtml(translation.localeCorrectOptionKey ?? "missing")}</summary>
    <div class="translation-body">
      <div><strong>Prompt:</strong> ${escapeHtml(translation.prompt ?? "")}</div>
      <div class="muted">confidence: ${escapeHtml(translation.confidence ?? "unknown")} | source: ${escapeHtml(translation.sourceMode ?? "unknown")} | status: ${escapeHtml(translation.translationStatus ?? "n/a")}</div>
      <div><strong>Effective answer:</strong> <code>${escapeHtml(translation.effectiveCorrectOptionKey ?? "unknown")}</code> ${escapeHtml(translation.effectiveCorrectAnswerText ?? "")}</div>
      ${translation.options.length ? renderLocalizedOptionsHtml(translation.options, translation.effectiveCorrectOptionKey) : `<div class="muted">No localized options.</div>`}
      ${translation.flags.length ? `<div class="muted">flags: ${escapeHtml(translation.flags.join(", "))}</div>` : ""}
      ${translation.notes.length ? `<div class="muted">notes: ${escapeHtml(translation.notes.join("; "))}</div>` : ""}
    </div>
  </details>`;
}

function renderLocalizedOptionsHtml(options, correctKey) {
  return `<table>
    <thead><tr><th>Key</th><th>Localized text</th></tr></thead>
    <tbody>
      ${options.map((option) => `<tr class="${option.key === correctKey ? "correct" : ""}"><td><code>${escapeHtml(option.key ?? "")}</code></td><td>${escapeHtml(option.text ?? "")}</td></tr>`).join("")}
    </tbody>
  </table>`;
}

function normalizeAnswerKey(value) {
  const text = stringOrNull(value);
  if (!text) return null;
  const normalized = text.trim();
  if (/^[A-F]$/i.test(normalized)) return normalized.toUpperCase();
  if (/^(R|right|true)$/i.test(normalized)) return "Right";
  if (/^(W|wrong|false)$/i.test(normalized)) return "Wrong";
  return normalized;
}

function qidFor(question) {
  return normalizeQid(question?.id ?? question?.qid);
}

function normalizeQid(value) {
  const text = stringOrNull(value);
  return text ? text.trim() : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return stringOrNull(value)
    ?.toLowerCase()
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function signature(values) {
  return unique(values.filter(Boolean).map(String).map((value) => value.trim()).filter(Boolean).sort()).join("|");
}

function unique(values) {
  return [...new Set(values)];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return readJson(filePath);
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJsString(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("</script", "<\\/script");
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll("</script", "<\\/script");
}

function md(value) {
  return String(value ?? "").replace(/\n/g, " ").trim();
}

function mdInline(value) {
  return md(value).replace(/\|/g, "\\|");
}
