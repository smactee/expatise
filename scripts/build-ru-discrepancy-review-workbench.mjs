#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LANG = 'ru';
const DATASET = '2023-test1';

const IMPORT_ROOT = path.join(ROOT, 'imports', LANG);
const GENERATED_ROOT = path.join(ROOT, 'qbank-tools', 'generated');
const STAGING_ROOT = path.join(GENERATED_ROOT, 'staging');
const REPORTS_ROOT = path.join(GENERATED_ROOT, 'reports');
const ARCHIVE_RU_ROOT = path.join(GENERATED_ROOT, 'archive', LANG);
const QBANK_ROOT = path.join(ROOT, 'public', 'qbank', DATASET);

const TRANSLATIONS_PATH = path.join(QBANK_ROOT, `translations.${LANG}.json`);
const QUESTIONS_PATH = path.join(QBANK_ROOT, 'questions.json');
const QUESTIONS_RAW_PATH = path.join(QBANK_ROOT, 'questions.raw.json');
const IMAGE_TAGS_PATH = path.join(QBANK_ROOT, 'image-color-tags.json');

const ITEMS_PATH = path.join(STAGING_ROOT, 'ru-discrepancy-review-items.json');
const DECISIONS_TEMPLATE_PATH = path.join(STAGING_ROOT, 'ru-discrepancy-review-decisions.template.json');
const DECISIONS_TARGET_PATH = path.join(STAGING_ROOT, 'ru-discrepancy-review-decisions.json');
const WORKBENCH_PATH = path.join(REPORTS_ROOT, 'ru-discrepancy-review-workbench.html');
const SUMMARY_PATH = path.join(REPORTS_ROOT, 'ru-discrepancy-review-summary.md');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from', 'has', 'have', 'he',
  'his', 'if', 'in', 'into', 'is', 'it', 'its', 'may', 'must', 'not', 'of', 'on', 'or', 'should',
  'that', 'the', 'their', 'them', 'there', 'this', 'to', 'when', 'where', 'with', 'you', 'your',
]);
const MCQ_OPTION_LABELS = ['A', 'B', 'C', 'D'];
const ROW_SOURCE_LABELS = ['A', 'B'];
const ROW_KEYS = new Set(['Right', 'Wrong']);

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    if (!exists(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function listDir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkFiles(dirPath) {
  const files = [];
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of listDir(current)) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attr(value) {
  return html(value);
}

function shortHash(value) {
  let hash = 2166136261;
  for (const char of String(value ?? '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

function itemAnchorId(itemId) {
  const slug = String(itemId ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 72) || 'item';
  return `item-${slug}-${shortHash(itemId)}`;
}

function md(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function batchNumber(batchName) {
  const match = batchName.match(/^batch-(\d+)$/u);
  return match ? Number(match[1]) : Number.NaN;
}

function batchNames() {
  return listDir(IMPORT_ROOT)
    .filter((entry) => entry.isDirectory() && /^batch-\d+$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => batchNumber(a) - batchNumber(b) || a.localeCompare(b));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function itemsFromDoc(doc) {
  return Array.isArray(doc?.items) ? doc.items : [];
}

function makeArtifactIndex() {
  const roots = [STAGING_ROOT, REPORTS_ROOT, ARCHIVE_RU_ROOT].filter(exists);
  const byBaseName = new Map();
  for (const root of roots) {
    for (const filePath of walkFiles(root)) {
      const baseName = path.basename(filePath);
      if (!byBaseName.has(baseName)) byBaseName.set(baseName, []);
      byBaseName.get(baseName).push(filePath);
    }
  }
  return byBaseName;
}

function artifactPaths(index, baseName) {
  return (index.get(baseName) || []).sort((a, b) => {
    const aArchived = a.includes(`${path.sep}archive${path.sep}`);
    const bArchived = b.includes(`${path.sep}archive${path.sep}`);
    if (aArchived !== bArchived) return aArchived ? 1 : -1;
    return a.localeCompare(b);
  });
}

function firstArtifact(index, baseName) {
  return artifactPaths(index, baseName)[0] || null;
}

function makeSourceIndex(batchName) {
  const batchDir = path.join(IMPORT_ROOT, batchName);
  const docs = [
    ['intake', readJson(path.join(batchDir, 'intake.json'), { items: [] })],
    ['matched', readJson(path.join(batchDir, 'matched.json'), { items: [] })],
    ['review-needed', readJson(path.join(batchDir, 'review-needed.json'), { items: [] })],
    ['unresolved', readJson(path.join(batchDir, 'unresolved.json'), { items: [] })],
  ];
  const byKey = new Map();
  for (const [sourceKind, doc] of docs) {
    for (const item of itemsFromDoc(doc)) {
      const keys = unique([item.itemId, item.sourceImage, item.file, item.id]);
      for (const key of keys) {
        const existing = byKey.get(key) || {};
        byKey.set(key, { ...existing, ...item, sourceKinds: unique([...(existing.sourceKinds || []), sourceKind]) });
      }
    }
  }
  return byKey;
}

function indexQuestionDoc(doc) {
  const map = new Map();
  const questions = Array.isArray(doc?.questions)
    ? doc.questions
    : Object.entries(doc?.questions || {}).map(([key, question]) => ({ key, ...question }));
  for (const question of questions) {
    const qid = text(question.id || question.qid);
    if (qid) map.set(qid, question);
  }
  return map;
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeOptions(options) {
  return asArray(options).map((option, index) => {
    if (typeof option === 'string') {
      const match = option.match(/^\s*([A-DА-ГВ])[\).]?\s*(.+)$/iu);
      const rawLabel = match ? match[1].trim() : optionLabel(index);
      return {
        rawLabel,
        normalizedLabel: normalizeOptionKey(rawLabel) || optionLabel(index),
        key: normalizeOptionKey(rawLabel) || optionLabel(index),
        text: match ? match[2].trim() : option.trim(),
      };
    }
    const rawLabel = text(option.originalKey || option.key || option.id || option.label) || optionLabel(index);
    const normalizedLabel = normalizeOptionKey(rawLabel) || optionLabel(index);
    return {
      rawLabel,
      normalizedLabel,
      key: normalizedLabel,
      id: text(option.id),
      text: text(option.text || option.translatedText || option.label),
    };
  });
}

function normalizeOptionKey(value) {
  const key = text(value).toUpperCase();
  if (!key) return '';
  if (key === 'А') return 'A';
  if (key === 'В') return 'B';
  if (key === 'С') return 'C';
  if (key === 'Д') return 'D';
  if (/^[A-D]$/u.test(key)) return key;
  return '';
}

function normalizeLocaleAnswerKey(value) {
  const raw = text(value);
  const option = normalizeOptionKey(raw);
  if (option) return option;
  const upper = raw.toUpperCase();
  if (upper === 'R' || upper === 'RIGHT' || upper === 'TRUE' || upper === 'CORRECT') return 'Right';
  if (upper === 'W' || upper === 'WRONG' || upper === 'FALSE' || upper === 'INCORRECT') return 'Wrong';
  if (upper === 'UNKNOWN') return 'UNKNOWN';
  return '';
}

function sourcePromptRaw(sourceItem) {
  return text(sourceItem?.promptRaw)
    || text(sourceItem?.promptRawJa)
    || text(sourceItem?.localizedPrompt)
    || text(sourceItem?.localizedText?.prompt);
}

function sourcePromptEnglish(sourceItem) {
  return text(sourceItem?.promptTranslated)
    || text(sourceItem?.translatedPrompt)
    || text(sourceItem?.promptGlossEn)
    || text(sourceItem?.translatedText?.prompt);
}

function sourceOptionsRaw(sourceItem) {
  return normalizeOptions(sourceItem?.optionsRaw || sourceItem?.optionsRawJa || sourceItem?.localizedOptions || sourceItem?.localizedText?.options);
}

function sourceOptionsEnglish(sourceItem) {
  return normalizeOptions(sourceItem?.optionsTranslated || sourceItem?.translatedOptions || sourceItem?.optionsGlossEn || sourceItem?.translatedText?.options);
}

function sourceAnswerKey(sourceItem, decision) {
  return normalizeOptionKey(decision?.confirmedCorrectOptionKey)
    || normalizeOptionKey(decision?.newQuestionLocalAnswerKey)
    || normalizeOptionKey(sourceItem?.correctKeyRaw)
    || normalizeOptionKey(sourceItem?.localizedCorrectAnswerKey)
    || '';
}

function decisionAnswerKey(decision) {
  if (decision?.answerKeyUnknown === true || decision?.unknown === true) return 'UNKNOWN';
  return normalizeOptionKey(decision?.confirmedCorrectOptionKey)
    || normalizeOptionKey(decision?.newQuestionLocalAnswerKey)
    || normalizeOptionKey(decision?.currentStagedLocaleCorrectOptionKey)
    || '';
}

function isApprovedExisting(decision) {
  return Boolean(
    text(decision?.approvedQid)
    && decision?.createNewQuestion !== true
    && decision?.keepUnresolved !== true
    && decision?.deleteQuestion !== true,
  );
}

function decisionSource(decision, index) {
  return text(decision?.sourceImage)
    || text(decision?.itemId)
    || text(decision?.file)
    || text(decision?.id)
    || `decision-${index + 1}`;
}

function sourceImagePath(batchName, sourcePath) {
  if (!sourcePath) return null;
  const absPath = path.join(IMPORT_ROOT, batchName, sourcePath);
  if (!exists(absPath)) return null;
  return relativeFromReports(absPath);
}

function relativeFromReports(absPath) {
  return path.relative(REPORTS_ROOT, absPath).split(path.sep).join('/');
}

function productionAssetSrc(assetSrc) {
  if (!assetSrc) return null;
  if (assetSrc.startsWith('/')) {
    return relativeFromReports(path.join(ROOT, 'public', assetSrc));
  }
  return relativeFromReports(path.join(ROOT, 'public', assetSrc));
}

function questionType(question) {
  return text(question?.type).toUpperCase() || (question?.options?.length ? 'MCQ' : 'ROW');
}

function masterQuestionDetails(qid, questionMap, rawQuestionMap, imageTagsDoc) {
  if (!qid) return null;
  const question = questionMap.get(qid) || rawQuestionMap.get(qid);
  const rawQuestion = rawQuestionMap.get(qid) || question;
  if (!question && !rawQuestion) return null;
  const tags = imageTagsDoc?.questions?.[qid] || null;
  const assets = asArray(rawQuestion?.assets).filter((asset) => asset?.kind === 'image' && asset?.src);
  const normalizedOptions = normalizeOptions(question?.options || rawQuestion?.options);
  return {
    qid,
    number: question?.number ?? rawQuestion?.number ?? null,
    type: questionType(question || rawQuestion),
    prompt: text(question?.prompt || rawQuestion?.prompt),
    options: normalizedOptions,
    correctRow: question?.correctRow ?? rawQuestion?.correctRow ?? null,
    correctOptionId: question?.correctOptionId ?? rawQuestion?.correctOptionId ?? null,
    answerRaw: question?.answerRaw ?? rawQuestion?.answerRaw ?? null,
    assets: assets.map((asset) => ({
      src: asset.src,
      reportSrc: productionAssetSrc(asset.src),
      hash: asset.hash ?? null,
    })),
    imageTags: tags ? {
      objectTags: asArray(tags.objectTags),
      colorTags: asArray(tags.colorTags),
      assetSrcs: asArray(tags.assetSrcs),
    } : null,
  };
}

function masterAnswerKey(questionDetails) {
  if (!questionDetails) return '';
  const raw = normalizeLocaleAnswerKey(questionDetails.answerRaw);
  if (raw) return raw;
  const row = normalizeLocaleAnswerKey(questionDetails.correctRow);
  if (row) return row;
  const optionId = text(questionDetails.correctOptionId);
  if (optionId && Array.isArray(questionDetails.options)) {
    const match = questionDetails.options.find((option) => option.id === optionId || option.key === optionId);
    if (match) return normalizeLocaleAnswerKey(match.key);
    const ordinal = optionId.match(/_o([1-4])$/u);
    if (ordinal) return String.fromCharCode(64 + Number(ordinal[1]));
  }
  return '';
}

function normalizedOptionText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function optionMeaningSimilarity(a, b) {
  const left = normalizedOptionText(a);
  const right = normalizedOptionText(b);
  if (!left || !right) return { score: 0, method: 'missing', matches: false };
  if (left === right) return { score: 1, method: 'exact', matches: true };
  if (left.includes(right) || right.includes(left)) return { score: 0.92, method: 'containment', matches: true };
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return { score: 0, method: 'no-keywords', matches: false };
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const score = overlap / Math.min(leftTokens.size, rightTokens.size);
  return { score: Number(score.toFixed(4)), method: 'keyword-overlap', matches: score >= 0.5 };
}

function normalizeRowAnswerKeyFromOptionText(value) {
  const normalized = normalizedOptionText(value);
  if (!normalized) return null;
  if (
    normalized.includes('incorrect')
    || normalized.includes('wrong')
    || normalized.includes('false')
    || normalized.includes('не правильно')
    || normalized.includes('неправильно')
  ) {
    return 'Wrong';
  }
  if (
    normalized.includes('correct')
    || normalized.includes('right')
    || normalized.includes('true')
    || normalized.includes('правильно')
  ) {
    return 'Right';
  }
  return null;
}

function rowAnswerKeyFromText(value) {
  return normalizeRowAnswerKeyFromOptionText(value) || '';
}

function parseSourceOptionRecords(options, expectedLabels) {
  const normalized = normalizeOptions(options);
  const labels = normalized.map((option) => normalizeOptionKey(option.normalizedLabel || option.key || option.rawLabel));
  const counts = new Map();
  for (const label of labels.filter(Boolean)) counts.set(label, (counts.get(label) || 0) + 1);
  const missingExpectedLabels = expectedLabels.filter((label) => !counts.has(label));
  const duplicateLabels = [...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label);
  const records = normalized.map((option, index) => {
    const normalizedLabel = normalizeOptionKey(option.normalizedLabel || option.key || option.rawLabel) || optionLabel(index);
    return {
      rawLabel: text(option.rawLabel || option.key || option.label) || optionLabel(index),
      normalizedLabel,
      key: normalizedLabel,
      text: text(option.text),
      index,
      rowAnswerKey: rowAnswerKeyFromText(option.text),
      isDuplicateLabel: duplicateLabels.includes(normalizedLabel),
      isMissingExpectedLabel: false,
    };
  });
  return {
    records,
    detectedLabels: labels.filter(Boolean),
    expectedLabels,
    duplicateLabels,
    missingExpectedLabels,
    hasDuplicateLabels: duplicateLabels.length > 0,
    hasMissingLabels: missingExpectedLabels.length > 0,
  };
}

function sourceQuestionType(sourceOptions, sourceOptionsEnglish, masterQuestion) {
  if (masterQuestion && questionType(masterQuestion) === 'ROW') return 'ROW';
  const displayOptions = sourceOptionsEnglish.length ? sourceOptionsEnglish : sourceOptions;
  if (displayOptions.length === 2 && displayOptions.every((option) => rowAnswerKeyFromText(option.text))) return 'ROW';
  if (sourceOptions.length === 2 && sourceOptions.every((option) => rowAnswerKeyFromText(option.text))) return 'ROW';
  return 'MCQ';
}

function resolveOptionRecordByKey(records, key, sourceType) {
  const normalizedKey = normalizeLocaleAnswerKey(key);
  if (!normalizedKey) return null;
  if (sourceType === 'ROW' && ROW_KEYS.has(normalizedKey)) {
    const matches = records.filter((record) => record.rowAnswerKey === normalizedKey);
    return matches.length === 1 ? matches[0] : null;
  }
  const matches = records.filter((record) => record.normalizedLabel === normalizedKey);
  return matches.length === 1 ? matches[0] : null;
}

function resolveOptionTextByKey(key, primaryRecords, fallbackRecords, sourceType) {
  const primary = resolveOptionRecordByKey(primaryRecords, key, sourceType);
  if (primary?.text) return primary.text;
  const fallback = resolveOptionRecordByKey(fallbackRecords, key, sourceType);
  return fallback?.text || '';
}

function normalizeAnswerForSourceType(key, sourceType, primaryRecords, fallbackRecords) {
  const normalizedKey = normalizeLocaleAnswerKey(key);
  if (sourceType !== 'ROW') return normalizedKey;
  if (ROW_KEYS.has(normalizedKey)) return normalizedKey;
  const record = resolveOptionRecordByKey(primaryRecords, normalizedKey, 'MCQ')
    || resolveOptionRecordByKey(fallbackRecords, normalizedKey, 'MCQ');
  return record?.rowAnswerKey || normalizedKey;
}

function masterCorrectOptionText(questionDetails, answerKey) {
  if (!questionDetails || !answerKey) return '';
  if (questionType(questionDetails) === 'ROW') return answerKey;
  const match = asArray(questionDetails.options).find((option) => normalizeLocaleAnswerKey(option.key || option.id) === answerKey);
  return text(match?.text);
}

function optionKeyExistsInSource(key, sourceType, displayRecords, rawRecords) {
  return Boolean(
    resolveOptionRecordByKey(displayRecords, key, sourceType)
    || resolveOptionRecordByKey(rawRecords, key, sourceType)
  );
}

function optionKeyIsAmbiguous(key, sourceType, records) {
  const normalizedKey = normalizeLocaleAnswerKey(key);
  if (!normalizedKey) return false;
  if (sourceType === 'ROW' && ROW_KEYS.has(normalizedKey)) {
    return records.filter((record) => record.rowAnswerKey === normalizedKey).length > 1;
  }
  return records.filter((record) => record.normalizedLabel === normalizedKey).length > 1;
}

function buildAnswerKeyAlignment({ sourceOptions, sourceOptionsEnglish, sourceAnswerKey: rawSourceAnswerKey, selectedLocaleAnswerKey, masterQuestion }) {
  const sourceType = sourceQuestionType(sourceOptions, sourceOptionsEnglish, masterQuestion);
  const expectedLabels = sourceType === 'ROW' ? ROW_SOURCE_LABELS : MCQ_OPTION_LABELS;
  const displaySourceOptions = sourceOptionsEnglish.length ? sourceOptionsEnglish : sourceOptions;
  const displayParsed = parseSourceOptionRecords(displaySourceOptions, expectedLabels);
  const rawParsed = parseSourceOptionRecords(sourceOptions, expectedLabels);
  const displayRecords = displayParsed.records;
  const rawRecords = rawParsed.records;
  const sourceRawAnswerKey = normalizeLocaleAnswerKey(rawSourceAnswerKey);
  const selectedRawLocaleAnswerKey = normalizeLocaleAnswerKey(selectedLocaleAnswerKey);
  const sourceAnswerKey = normalizeAnswerForSourceType(sourceRawAnswerKey, sourceType, displayRecords, rawRecords);
  const selectedKey = normalizeAnswerForSourceType(selectedRawLocaleAnswerKey, sourceType, displayRecords, rawRecords);
  const masterKey = masterAnswerKey(masterQuestion);
  const sourceCorrectText = resolveOptionTextByKey(sourceAnswerKey, displayRecords, rawRecords, sourceType);
  const selectedLocaleCorrectText = resolveOptionTextByKey(selectedKey, displayRecords, rawRecords, sourceType);
  const masterCorrectText = masterCorrectOptionText(masterQuestion, masterKey);
  const sourceMasterMeaning = optionMeaningSimilarity(sourceCorrectText, masterCorrectText);
  const selectedMasterMeaning = optionMeaningSimilarity(selectedLocaleCorrectText, masterCorrectText);
  const hasLetterMismatch = Boolean(sourceAnswerKey && masterKey && sourceAnswerKey !== masterKey);
  const sourceWasAutoNormalized = sourceType === 'ROW'
    && Boolean(sourceRawAnswerKey)
    && ROW_KEYS.has(sourceAnswerKey)
    && sourceRawAnswerKey !== sourceAnswerKey;
  const selectedWasAutoNormalized = sourceType === 'ROW'
    && Boolean(selectedRawLocaleAnswerKey)
    && ROW_KEYS.has(selectedKey)
    && selectedRawLocaleAnswerKey !== selectedKey;
  const selectedExistsInSource = !selectedKey || selectedKey === 'UNKNOWN'
    ? false
    : optionKeyExistsInSource(selectedKey, sourceType, displayRecords, rawRecords);
  const selectedIsAmbiguous = optionKeyIsAmbiguous(selectedKey, sourceType, displayRecords)
    || optionKeyIsAmbiguous(selectedKey, sourceType, rawRecords);
  const hasDuplicateSourceLabels = displayParsed.hasDuplicateLabels || rawParsed.hasDuplicateLabels;
  const hasMissingSourceLabels = displayParsed.hasMissingLabels || rawParsed.hasMissingLabels;
  const warnings = [];
  if (hasLetterMismatch) {
    warnings.push('Letter mismatch detected. Choose the answer key that matches the Russian/source option meaning, not blindly the master letter.');
  }
  if (selectedWasAutoNormalized || sourceWasAutoNormalized) {
    warnings.push(`Auto-normalized ROW answer: source selected key ${selectedRawLocaleAnswerKey || sourceRawAnswerKey || 'unknown'} maps to exported locale key ${selectedKey || sourceAnswerKey || 'unknown'}.`);
  }
  if (hasDuplicateSourceLabels) warnings.push('Corrupted source option labels detected.');
  if (hasMissingSourceLabels) warnings.push(`Source option labels are incomplete. Detected labels: ${displayParsed.detectedLabels.join(', ') || 'none'}.`);
  if (selectedKey && selectedKey !== 'UNKNOWN' && !selectedExistsInSource) warnings.push(`Selected locale answer ${selectedKey} was not found in the source options.`);
  if (selectedIsAmbiguous) warnings.push(`Selected locale answer ${selectedKey} is ambiguous because that source label appears more than once.`);
  return {
    sourceQuestionType: sourceType,
    sourceRawAnswerKey,
    sourceAnswerKey,
    sourceCorrectText,
    masterQuestionType: masterQuestion ? questionType(masterQuestion) : '',
    masterAnswerKey: masterKey,
    masterCorrectText,
    selectedRawLocaleAnswerKey,
    selectedLocaleAnswerKey: selectedKey,
    selectedLocaleCorrectText,
    sourceWasAutoNormalized,
    selectedWasAutoNormalized,
    autoNormalizedRowAnswer: sourceWasAutoNormalized || selectedWasAutoNormalized,
    hasLetterMismatch,
    hasDuplicateSourceLabels,
    hasMissingSourceLabels,
    selectedExistsInSource,
    selectedIsAmbiguous,
    recommendedLocaleAnswerKey: sourceAnswerKey || selectedKey || masterKey,
    warningLevel: selectedIsAmbiguous || (selectedKey && selectedKey !== 'UNKNOWN' && !selectedExistsInSource) || hasDuplicateSourceLabels || hasMissingSourceLabels ? 'high' : (hasLetterMismatch ? 'medium' : 'low'),
    sourceMasterMeaning,
    selectedMasterMeaning,
    sourceOptionRecords: displayRecords,
    rawSourceOptionRecords: rawRecords,
    expectedSourceLabels: expectedLabels,
    detectedSourceLabels: displayParsed.detectedLabels,
    duplicateSourceLabels: unique([...displayParsed.duplicateLabels, ...rawParsed.duplicateLabels]),
    missingSourceLabels: unique([...displayParsed.missingExpectedLabels, ...rawParsed.missingExpectedLabels]),
    warnings,
  };
}

function questionTextForSearch(questionDetails) {
  if (!questionDetails) return '';
  return [
    questionDetails.prompt,
    ...questionDetails.options.map((option) => option.text),
    questionDetails.answerRaw,
    questionDetails.imageTags?.objectTags?.join(' '),
    questionDetails.imageTags?.colorTags?.join(' '),
  ].filter(Boolean).join(' ');
}

function sourceTextForSearch(source) {
  return [
    source.promptEnglish,
    ...source.optionsEnglish.map((option) => option.text),
    source.promptRaw,
    ...source.optionsRaw.map((option) => option.text),
    source.correctAnswerRaw,
    source.correctAnswerEnglish,
    source.visualTags.join(' '),
  ].filter(Boolean).join(' ');
}

function tokenize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function tokenSimilarity(a, b) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (!aTokens.length || !bTokens.length) return 0;
  const aCounts = new Map();
  const bCounts = new Map();
  for (const token of aTokens) aCounts.set(token, (aCounts.get(token) || 0) + 1);
  for (const token of bTokens) bCounts.set(token, (bCounts.get(token) || 0) + 1);
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const count of aCounts.values()) aNorm += count * count;
  for (const count of bCounts.values()) bNorm += count * count;
  for (const [token, count] of aCounts.entries()) dot += count * (bCounts.get(token) || 0);
  return dot / Math.sqrt(aNorm * bNorm);
}

function visualSimilarity(sourceTags, imageTags) {
  const sourceSet = new Set(asArray(sourceTags).map((tag) => text(tag).toLowerCase()).filter(Boolean));
  const masterSet = new Set([
    ...asArray(imageTags?.objectTags),
    ...asArray(imageTags?.colorTags),
  ].map((tag) => text(tag).toLowerCase()).filter(Boolean));
  if (!sourceSet.size || !masterSet.size) return 0;
  let intersection = 0;
  for (const tag of sourceSet) {
    if (masterSet.has(tag)) intersection += 1;
  }
  return intersection / Math.max(sourceSet.size, masterSet.size);
}

function combinedSimilarity(source, questionDetails) {
  const textScore = tokenSimilarity(sourceTextForSearch(source), questionTextForSearch(questionDetails));
  const promptScore = tokenSimilarity(source.promptEnglish || source.promptRaw, questionDetails?.prompt || '');
  const optionScore = tokenSimilarity(
    source.optionsEnglish.map((option) => option.text).join(' ') || source.optionsRaw.map((option) => option.text).join(' '),
    questionDetails?.options?.map((option) => option.text).join(' ') || '',
  );
  const visualScore = visualSimilarity(source.visualTags, questionDetails?.imageTags);
  return Number((textScore * 0.5 + promptScore * 0.3 + optionScore * 0.15 + visualScore * 0.05).toFixed(4));
}

function buildSearchIndex(questionMap, rawQuestionMap, imageTagsDoc) {
  const ids = unique([...questionMap.keys(), ...rawQuestionMap.keys()]);
  return ids.map((qid) => masterQuestionDetails(qid, questionMap, rawQuestionMap, imageTagsDoc));
}

function findBestMatches(source, searchIndex, limit = 5) {
  return searchIndex
    .map((question) => ({
      qid: question.qid,
      number: question.number,
      type: question.type,
      prompt: question.prompt,
      answerKey: masterAnswerKey(question),
      score: combinedSimilarity(source, question),
    }))
    .sort((a, b) => b.score - a.score || a.qid.localeCompare(b.qid))
    .slice(0, limit);
}

function candidateDetails(sourceItem, approvedQid, questionMap, rawQuestionMap, imageTagsDoc) {
  const candidates = [];
  const addCandidate = (candidate, source) => {
    const qid = text(candidate?.qid || candidate);
    if (!qid || candidates.some((entry) => entry.qid === qid)) return;
    const master = masterQuestionDetails(qid, questionMap, rawQuestionMap, imageTagsDoc);
    candidates.push({
      qid,
      source,
      number: candidate?.number ?? master?.number ?? null,
      score: candidate?.score ?? null,
      type: candidate?.type ?? master?.type ?? null,
      prompt: text(candidate?.prompt) || master?.prompt || '',
      options: normalizeOptions(candidate?.options?.length ? candidate.options : master?.options),
      correctAnswer: text(candidate?.correctAnswer || master?.answerRaw),
      answerKey: normalizeLocaleAnswerKey(candidate?.correctAnswer) || masterAnswerKey(master),
      hasImage: Boolean(candidate?.image || master?.assets?.length),
      imageTags: master?.imageTags ?? null,
    });
  };

  addCandidate(approvedQid, 'approvedQid');
  addCandidate(sourceItem?.match, 'match');
  for (const candidate of asArray(sourceItem?.topCandidates).slice(0, 5)) addCandidate(candidate, 'topCandidates');
  return candidates;
}

function sourceDetails(batchName, decision, sourceItem, index) {
  const sourcePath = decisionSource(decision, index);
  return {
    sourcePath,
    screenshotSrc: sourceImagePath(batchName, sourcePath),
    promptRaw: sourcePromptRaw(sourceItem),
    promptEnglish: sourcePromptEnglish(sourceItem),
    optionsRaw: sourceOptionsRaw(sourceItem),
    optionsEnglish: sourceOptionsEnglish(sourceItem),
    correctKeyRaw: normalizeOptionKey(sourceItem?.correctKeyRaw),
    correctAnswerRaw: text(sourceItem?.correctAnswerRaw || sourceItem?.localizedCorrectAnswer),
    correctAnswerEnglish: text(sourceItem?.correctAnswerTranslated || sourceItem?.translatedCorrectAnswer),
    hasImage: sourceItem?.hasImage === true,
    visualTags: unique([
      ...asArray(sourceItem?.visualObjectTags),
      ...asArray(sourceItem?.visualColorTags),
      ...asArray(sourceItem?.visualNumberTags),
      ...asArray(sourceItem?.visualLayoutTags),
      ...asArray(sourceItem?.productionAssetHints),
    ]),
    sourceKinds: asArray(sourceItem?.sourceKinds),
  };
}

function currentDecisionSummary(decision) {
  if (decision?.deleteQuestion === true) return 'deleteQuestion';
  if (decision?.createNewQuestion === true) return `createNewQuestion${decision.newQuestionLocalAnswerKey ? ` answer=${decision.newQuestionLocalAnswerKey}` : ''}`;
  if (decision?.keepUnresolved === true) return 'keepUnresolved';
  if (text(decision?.approvedQid)) return `approve ${text(decision.approvedQid)}${decisionAnswerKey(decision) ? ` answer=${decisionAnswerKey(decision)}` : ''}`;
  return 'blank/no-op';
}

function reviewItem(item, productionQids) {
  const reviewSource = sourceFromReviewItem(item);
  const approvedScore = item.masterQuestion ? combinedSimilarity(reviewSource, item.masterQuestion) : 0;
  const best = item.bestMatches[0] || null;
  const bestDifferent = best && best.qid !== item.approvedQid;
  const bestLead = best ? best.score - approvedScore : 0;
  const productionHasQid = item.approvedQid ? productionQids.has(item.approvedQid) : false;

  if (item.discrepancyCategory === 'missing-production-qid') {
    if (approvedScore >= 0.24 || item.candidateQids.includes(item.approvedQid)) {
      return {
        riskLevel: approvedScore >= 0.4 ? 'medium' : 'high',
        recommendation: 'production merge missing, apply merge only',
        justification: `Approved qid ${item.approvedQid} is absent from production. Source-to-approved similarity is ${approvedScore.toFixed(2)}; current decision already selected this qid.`,
        suggestedNextAction: `Rebuild/apply batch ${item.batch} staging and review the production merge diff for ${item.approvedQid}.`,
      };
    }
    return {
      riskLevel: 'high',
      recommendation: 'needs human review',
      justification: `Approved qid ${item.approvedQid} is absent from production and source-to-approved similarity is weak (${approvedScore.toFixed(2)}).`,
      suggestedNextAction: `Open ${item.batch} workbench and verify ${item.approvedQid} before applying any merge.`,
    };
  }

  if (item.discrepancyCategory === 'duplicate-approval') {
    if (productionHasQid && approvedScore >= 0.24) {
      return {
        riskLevel: 'low',
        recommendation: 'duplicate is harmless',
        justification: `This approval maps to ${item.approvedQid}, which is already translated in production. Source-to-approved similarity is ${approvedScore.toFixed(2)}; the duplicate only explains why source count exceeds unique qid count.`,
        suggestedNextAction: 'No production action needed unless manual review finds the screenshot is a different question.',
      };
    }
    return {
      riskLevel: 'medium',
      recommendation: 'needs human review',
      justification: `Duplicate approval to ${item.approvedQid} has weak source-to-approved similarity (${approvedScore.toFixed(2)}) or the qid is not in production.`,
      suggestedNextAction: 'Review the duplicate group and decide whether this screenshot should point to another qid.',
    };
  }

  if (item.discrepancyCategory === 'create-new') {
    if (best && best.score >= 0.58) {
      return {
        riskLevel: 'high',
        recommendation: `possible better qid: ${best.qid}`,
        justification: `Current decision creates a new question, but master qbank search found ${best.qid} with similarity ${best.score.toFixed(2)}.`,
        suggestedNextAction: `Compare source against ${best.qid}; if it matches, change the decision to approve that qid instead of creating a new question.`,
      };
    }
    if (best && best.score >= 0.38) {
      return {
        riskLevel: 'medium',
        recommendation: 'needs human review',
        justification: `Create-new decision has a plausible existing-qid candidate ${best.qid} at similarity ${best.score.toFixed(2)}, but not enough evidence to auto-change.`,
        suggestedNextAction: `Review top candidates, especially ${best.qid}, before deciding whether a new production question is needed.`,
      };
    }
    return {
      riskLevel: 'low',
      recommendation: 'keep current decision',
      justification: `No strong existing-qid match was found; best candidate ${best?.qid || 'none'} scored ${best ? best.score.toFixed(2) : '0.00'}.`,
      suggestedNextAction: 'Keep as create-new candidate unless a human finds an existing qid by image/context.',
    };
  }

  if (item.discrepancyCategory === 'unresolved') {
    if (best && best.score >= 0.55) {
      return {
        riskLevel: 'high',
        recommendation: `possible better qid: ${best.qid}`,
        justification: `Unresolved item has a strong existing-qid candidate ${best.qid} at similarity ${best.score.toFixed(2)}.`,
        suggestedNextAction: `Review and consider approving ${best.qid}.`,
      };
    }
    if (best && best.score >= 0.34) {
      return {
        riskLevel: 'medium',
        recommendation: 'needs human review',
        justification: `Unresolved item has a moderate candidate ${best.qid} at similarity ${best.score.toFixed(2)}.`,
        suggestedNextAction: `Compare the screenshot/source prompt with ${best.qid} and top matcher candidates.`,
      };
    }
    return {
      riskLevel: 'medium',
      recommendation: 'change to keep unresolved',
      justification: `No reliable existing-qid candidate was found; best score is ${best ? best.score.toFixed(2) : '0.00'}.`,
      suggestedNextAction: 'Keep unresolved until a stronger qid or source evidence is found.',
    };
  }

  if (item.discrepancyCategory === 'deleted') {
    if (best && best.score >= 0.52) {
      return {
        riskLevel: 'high',
        recommendation: `possible better qid: ${best.qid}`,
        justification: `Deleted item still has meaningful source text and candidate ${best.qid} scored ${best.score.toFixed(2)}.`,
        suggestedNextAction: `Verify whether deletion was intentional; if not, approve ${best.qid} or move to unresolved.`,
      };
    }
    return {
      riskLevel: 'medium',
      recommendation: 'needs human review',
      justification: `Deletion is a terminal decision. Best existing-qid candidate is ${best?.qid || 'none'} at ${best ? best.score.toFixed(2) : '0.00'}, so this should be manually confirmed.`,
      suggestedNextAction: 'Confirm the screenshot is duplicate, invalid, or outside scope before leaving it deleted.',
    };
  }

  return {
    riskLevel: 'medium',
    recommendation: 'needs human review',
    justification: 'No category-specific review rule matched.',
    suggestedNextAction: 'Review manually.',
  };
}

function sourceFromReviewItem(item) {
  return {
    promptRaw: item.sourcePrompt,
    promptEnglish: item.sourcePromptEnglish,
    optionsRaw: item.sourceOptions,
    optionsEnglish: item.sourceOptionsEnglish,
    correctAnswerRaw: item.correctAnswerRaw,
    correctAnswerEnglish: item.correctAnswerEnglish,
    visualTags: item.sourceVisualTags,
  };
}

function buildBaseItem({ category, batchName, decision, decisionIndex, sourceItem, duplicateGroup, duplicateOrdinal, context }) {
  const source = sourceDetails(batchName, decision, sourceItem, decisionIndex);
  const approvedQid = text(decision.approvedQid);
  const approvedMaster = approvedQid
    ? masterQuestionDetails(approvedQid, context.questionMap, context.rawQuestionMap, context.imageTagsDoc)
    : null;
  const bestMatches = findBestMatches(source, context.searchIndex);
  const candidates = candidateDetails(sourceItem, approvedQid, context.questionMap, context.rawQuestionMap, context.imageTagsDoc);
  const candidateQids = unique([
    approvedQid,
    text(decision.initialSuggestedQid),
    ...candidates.map((candidate) => candidate.qid),
    ...bestMatches.map((candidate) => candidate.qid),
  ]);
  const extractedSourceAnswerKey = sourceAnswerKey(sourceItem, decision);
  const selectedLocaleAnswerKey = decisionAnswerKey(decision) || extractedSourceAnswerKey;
  const answerKeyAlignment = buildAnswerKeyAlignment({
    sourceOptions: source.optionsRaw,
    sourceOptionsEnglish: source.optionsEnglish,
    sourceAnswerKey: extractedSourceAnswerKey,
    selectedLocaleAnswerKey,
    masterQuestion: approvedMaster,
  });
  const normalizedSelectedLocaleAnswerKey = answerKeyAlignment.selectedLocaleAnswerKey || selectedLocaleAnswerKey;

  const item = {
    id: `${category}:${batchName}:${decisionIndex + 1}:${approvedQid || source.sourcePath}`,
    discrepancyCategory: category,
    batch: batchName,
    sourceScreenshotPath: source.sourcePath,
    sourceScreenshotPreviewPath: source.screenshotSrc,
    sourcePrompt: source.promptRaw,
    sourcePromptEnglish: source.promptEnglish,
    sourceOptions: source.optionsRaw,
    sourceOptionsEnglish: source.optionsEnglish,
    sourceAnswerKey: extractedSourceAnswerKey,
    localeAnswerKey: normalizedSelectedLocaleAnswerKey,
    correctAnswerRaw: source.correctAnswerRaw,
    correctAnswerEnglish: source.correctAnswerEnglish,
    translatedEnglishGloss: [
      source.promptEnglish,
      ...source.optionsEnglish.map((option) => `${option.key}. ${option.text}`),
    ].filter(Boolean).join('\n'),
    existingDecision: currentDecisionSummary(decision),
    originalDecision: {
      decisionMode: decision?.deleteQuestion === true
        ? 'delete'
        : decision?.createNewQuestion === true
          ? 'create-new'
          : decision?.keepUnresolved === true
            ? 'keep-unresolved'
            : approvedQid
              ? 'approve-existing-qid'
              : 'blank',
      approvedQid,
      localeAnswerKey: normalizeLocaleAnswerKey(normalizedSelectedLocaleAnswerKey),
      createNewQuestion: decision?.createNewQuestion === true,
      keepUnresolved: decision?.keepUnresolved === true,
      deleteQuestion: decision?.deleteQuestion === true,
      ignoreReconciliation: false,
      newQuestionTopic: text(decision?.newQuestionProvisionalTopic),
      newQuestionSubtopics: asArray(decision?.newQuestionProvisionalSubtopics).map(text).filter(Boolean),
      reviewerNotes: text(decision?.reviewerNotes),
    },
    approvedQid,
    initialSuggestedQid: text(decision.initialSuggestedQid),
    candidateQids,
    candidateDetails: candidates,
    matchingCandidateDetails: candidates.slice(0, 5),
    bestMatches,
    imageAssetScreenshotPreviewPath: source.screenshotSrc,
    productionStatus: approvedQid
      ? (context.productionQids.has(approvedQid) ? 'approved qid present in production translations' : 'approved qid missing from production translations')
      : 'no approved qid',
    reviewerNote: text(decision.reviewerNotes),
    sourceExplanation: text(decision.sourceExplanation),
    masterQuestion: approvedMaster,
    duplicateGroupInfo: duplicateGroup ? {
      qid: approvedQid,
      duplicateOrdinal,
      duplicateCount: duplicateGroup.records.length,
      extraDuplicateCount: Math.max(0, duplicateGroup.records.length - 1),
      canonical: duplicateGroup.records[0]?.summary ?? null,
      records: duplicateGroup.records.map((record) => record.summary),
    } : null,
    sourceVisualTags: source.visualTags,
    sourceKinds: source.sourceKinds,
    approvedSimilarity: approvedMaster ? combinedSimilarity(source, approvedMaster) : null,
    answerKeyAlignment,
  };

  const review = reviewItem(item, context.productionQids);
  const riskLevel = answerKeyAlignment.warningLevel === 'high' ? 'high' : review.riskLevel;
  return {
    ...item,
    riskLevel,
    aiReviewRecommendation: review.recommendation,
    aiReviewJustification: review.justification,
    suggestedNextAction: review.suggestedNextAction,
  };
}

function loadBatchRecords(batchName, artifactIndex) {
  const sourceIndex = makeSourceIndex(batchName);
  const decisionsPath = firstArtifact(artifactIndex, `${LANG}-${batchName}-workbench-decisions.json`);
  const decisionsDoc = readJson(decisionsPath, { items: [] });
  const records = itemsFromDoc(decisionsDoc).map((decision, index) => {
    const sourcePath = decisionSource(decision, index);
    const sourceItem = sourceIndex.get(sourcePath)
      || sourceIndex.get(text(decision.itemId))
      || sourceIndex.get(text(decision.sourceImage))
      || {};
    return {
      batchName,
      index,
      decision,
      sourceItem,
      sourcePath,
      approvedQid: text(decision.approvedQid),
      summary: {
        batch: batchName,
        sourceScreenshotPath: sourcePath,
        approvedQid: text(decision.approvedQid),
        answerKey: decisionAnswerKey(decision),
        currentDecision: currentDecisionSummary(decision),
      },
    };
  });

  return { batchName, decisionsPath, records };
}

function collectDiscrepancyItems(batchRecords, context) {
  const items = [];
  const approvedRecords = batchRecords.flatMap((batch) => batch.records.filter((record) => isApprovedExisting(record.decision)));
  const duplicateGroups = new Map();
  for (const record of approvedRecords) {
    if (!duplicateGroups.has(record.approvedQid)) duplicateGroups.set(record.approvedQid, []);
    duplicateGroups.get(record.approvedQid).push(record);
  }

  const duplicateGroupEntries = [...duplicateGroups.entries()]
    .map(([qid, records]) => ({
      qid,
      records: records.sort((a, b) => batchNumber(a.batchName) - batchNumber(b.batchName) || a.index - b.index),
    }))
    .filter((group) => group.records.length > 1);

  const duplicateRecordKeys = new Set();
  for (const group of duplicateGroupEntries) {
    group.records.slice(1).forEach((record, duplicateIndex) => {
      duplicateRecordKeys.add(`${record.batchName}:${record.index}`);
      items.push(buildBaseItem({
        category: 'duplicate-approval',
        batchName: record.batchName,
        decision: record.decision,
        decisionIndex: record.index,
        sourceItem: record.sourceItem,
        duplicateGroup: group,
        duplicateOrdinal: duplicateIndex + 2,
        context,
      }));
    });
  }

  for (const batch of batchRecords) {
    for (const record of batch.records) {
      const decision = record.decision;
      if (decision.createNewQuestion === true) {
        items.push(buildBaseItem({
          category: 'create-new',
          batchName: record.batchName,
          decision,
          decisionIndex: record.index,
          sourceItem: record.sourceItem,
          context,
        }));
      }
      if (decision.keepUnresolved === true) {
        items.push(buildBaseItem({
          category: 'unresolved',
          batchName: record.batchName,
          decision,
          decisionIndex: record.index,
          sourceItem: record.sourceItem,
          context,
        }));
      }
      if (decision.deleteQuestion === true) {
        items.push(buildBaseItem({
          category: 'deleted',
          batchName: record.batchName,
          decision,
          decisionIndex: record.index,
          sourceItem: record.sourceItem,
          context,
        }));
      }
      if (isApprovedExisting(decision) && !context.productionQids.has(record.approvedQid)) {
        items.push(buildBaseItem({
          category: 'missing-production-qid',
          batchName: record.batchName,
          decision,
          decisionIndex: record.index,
          sourceItem: record.sourceItem,
          context,
        }));
      }
    }
  }

  return {
    items: items.sort((a, b) => categoryRank(a.discrepancyCategory) - categoryRank(b.discrepancyCategory) || batchNumber(a.batch) - batchNumber(b.batch) || a.sourceScreenshotPath.localeCompare(b.sourceScreenshotPath)),
    duplicateGroups: duplicateGroupEntries,
    duplicateRecordKeys,
  };
}

function categoryRank(category) {
  return {
    'create-new': 1,
    unresolved: 2,
    deleted: 3,
    'duplicate-approval': 4,
    'missing-production-qid': 5,
  }[category] || 99;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function imageReportSrc(src) {
  const value = text(src);
  if (!value) return '';
  if (value.startsWith('/qbank/')) return `../../../public${value}`;
  return value;
}

function optionAnswerKey(question) {
  return normalizeLocaleAnswerKey(question?.answerKey || question?.answerRaw || question?.correctAnswer || question?.correctRow || '');
}

function renderOptions(options, currentKey = '') {
  if (!options?.length) return '<div class="hint">No options</div>';
  const selectedKey = normalizeLocaleAnswerKey(currentKey);
  return `<div class="options">${options.map((option) => {
    const key = normalizeLocaleAnswerKey(option.key || option.id);
    const isCurrent = selectedKey && key === selectedKey;
    return `<div class="option${isCurrent ? ' option-current' : ''}">
      <div class="option-row">
        <div><span class="option-key">${html(option.key || '')}.</span>${html(option.text || '')}</div>
        ${isCurrent ? '<span class="option-correct-badge">answer</span>' : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderImageFrame(src, altText, caption = '') {
  if (!src) return '<div class="image-frame"><div class="image-fallback">No screenshot preview</div></div>';
  return `<div class="image-frame"><img src="${attr(src)}" alt="${attr(altText || caption || 'image')}"></div>`;
}

function enrichCandidate(item, candidate) {
  const detailed = item.candidateDetails?.find((entry) => entry.qid === candidate.qid);
  return { ...(detailed || {}), ...candidate };
}

function renderCandidateImage(candidate) {
  const src = imageReportSrc(candidate.imageTags?.assetSrcs?.[0]);
  if (!src) return '';
  return `<div class="candidate-media"><img src="${attr(src)}" alt="${attr(candidate.qid)} production asset"></div>`;
}

function renderCandidates(item) {
  const cards = item.bestMatches.slice(0, 5).map((candidate) => {
    const enriched = enrichCandidate(item, candidate);
    const isApproved = enriched.qid === item.approvedQid;
    const answerKey = optionAnswerKey(enriched);
    const score = Number(enriched.score);
    const scoreLabel = Number.isFinite(score) ? (score > 1 ? score.toFixed(1) : score.toFixed(2)) : 'n/a';
    return `<article class="candidate${isApproved ? ' approved' : ''}">
      <div class="candidate-head">
        <div class="candidate-badges">
          <span class="pill qid">${html(enriched.qid)}</span>
          ${enriched.number ? `<span class="pill">#${html(enriched.number)}</span>` : ''}
          ${enriched.type ? `<span class="pill">${html(enriched.type)}</span>` : ''}
          <span class="pill note">score ${html(scoreLabel)}</span>
          ${answerKey ? `<span class="pill">answer ${html(answerKey)}</span>` : ''}
          ${enriched.hasImage ? '<span class="pill">has image</span>' : ''}
        </div>
        <button type="button" class="secondary small-button" data-use-qid="${attr(item.id)}" data-qid="${attr(enriched.qid)}" data-answer-key="${attr(answerKey)}" data-candidate='${attr(JSON.stringify(enriched))}'>Use qid</button>
      </div>
      ${renderCandidateImage(enriched)}
      <div class="prompt">${html(enriched.prompt || '')}</div>
      ${asArray(enriched.options).length ? renderOptions(enriched.options, answerKey) : ''}
    </article>`;
  }).join('');
  if (!cards) return '<div class="hint">No candidate data</div>';
  return `<div class="candidate-list">${cards}</div>`;
}

function renderMaster(item) {
  if (!item.masterQuestion) return '<div class="hint">No approved qid/master comparison</div>';
  const answerKey = optionAnswerKey(item.masterQuestion);
  const image = item.masterQuestion.assets?.[0]?.reportSrc
    ? `<div class="candidate-media"><img src="${attr(item.masterQuestion.assets[0].reportSrc)}" alt="${attr(item.masterQuestion.qid)} production asset"></div>`
    : '';
  return `
    <div class="fact master-box">
      <div class="candidate-head">
        <div class="candidate-badges">
          <span class="pill qid">${html(item.masterQuestion.qid)}</span>
          ${item.masterQuestion.number ? `<span class="pill">#${html(item.masterQuestion.number)}</span>` : ''}
          ${item.masterQuestion.type ? `<span class="pill">${html(item.masterQuestion.type)}</span>` : ''}
          ${answerKey ? `<span class="pill">answer ${html(answerKey)}</span>` : ''}
        </div>
      </div>
      ${image}
      <p class="prompt compact">${html(item.masterQuestion.prompt)}</p>
      ${renderOptions(item.masterQuestion.options, answerKey)}
      ${item.masterQuestion.imageTags ? `<div class="hint">Image tags: ${html([...item.masterQuestion.imageTags.objectTags, ...item.masterQuestion.imageTags.colorTags].join(', '))}</div>` : ''}
    </div>
  `;
}

function answerText(value) {
  return text(value) || 'not found';
}

function renderAnswerKeyAlignment(item) {
  const alignment = item.answerKeyAlignment || {};
  const warningClass = alignment.warningLevel === 'high' ? ' high' : alignment.warningLevel === 'medium' ? ' medium' : '';
  const warnings = asArray(alignment.warnings);
  const labelSummary = [
    alignment.detectedSourceLabels?.length ? `detected ${alignment.detectedSourceLabels.join(', ')}` : '',
    alignment.missingSourceLabels?.length ? `missing ${alignment.missingSourceLabels.join(', ')}` : '',
    alignment.duplicateSourceLabels?.length ? `duplicate ${alignment.duplicateSourceLabels.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
  return `
    <div class="answer-alignment${warningClass}" data-answer-alignment="${attr(item.id)}">
      <div class="alignment-head">
        <span class="label">Answer Key Alignment</span>
        <span class="pill risk ${html(alignment.warningLevel || 'low')}">${html(alignment.warningLevel || 'low')} risk</span>
      </div>
      <div class="alignment-grid">
        <div class="alignment-fact">
          <span class="label">Source / Local Answer</span>
          <strong>${html(alignment.sourceAnswerKey || alignment.sourceRawAnswerKey || 'not set')}</strong>
          <div>${html(answerText(alignment.sourceCorrectText))}</div>
          ${alignment.sourceQuestionType === 'ROW' && alignment.sourceRawAnswerKey && alignment.sourceRawAnswerKey !== alignment.sourceAnswerKey ? `<div class="hint">Source label ${html(alignment.sourceRawAnswerKey)} maps to ${html(alignment.sourceAnswerKey)}</div>` : ''}
        </div>
        <div class="alignment-fact">
          <span class="label">Master QID Answer</span>
          <strong>${html(alignment.masterAnswerKey || 'not set')}</strong>
          <div>${html(answerText(alignment.masterCorrectText))}</div>
          ${alignment.masterQuestionType ? `<div class="hint">Master type: ${html(alignment.masterQuestionType)}</div>` : ''}
        </div>
        <div class="alignment-fact">
          <span class="label">Selected Locale Answer</span>
          <strong data-selected-answer-key-for="${attr(item.id)}">${html(alignment.selectedLocaleAnswerKey || 'not set')}</strong>
          <div data-selected-answer-text-for="${attr(item.id)}">${html(answerText(alignment.selectedLocaleCorrectText))}</div>
          ${alignment.sourceQuestionType === 'ROW' && alignment.selectedRawLocaleAnswerKey && alignment.selectedRawLocaleAnswerKey !== alignment.selectedLocaleAnswerKey ? `<div class="hint">Selected label ${html(alignment.selectedRawLocaleAnswerKey)} maps to ${html(alignment.selectedLocaleAnswerKey)}</div>` : ''}
        </div>
        <div class="alignment-fact">
          <span class="label">Meaning Check</span>
          <strong>${alignment.sourceMasterMeaning?.matches ? 'meaning appears aligned' : 'needs confirmation'}</strong>
          <div>${html(alignment.sourceMasterMeaning?.method || 'not compared')} ${alignment.sourceMasterMeaning?.score == null ? '' : html(alignment.sourceMasterMeaning.score)}</div>
        </div>
      </div>
      ${warnings.length ? `<div class="alignment-warning">${warnings.map((warning) => `<div>${html(warning)}</div>`).join('')}</div>` : ''}
      <div class="alignment-warning runtime" data-selected-answer-warning-for="${attr(item.id)}" hidden></div>
      ${alignment.autoNormalizedRowAnswer ? `<div class="alignment-info"><strong>Auto-normalized ROW answer</strong><br>Source selected key: ${html(alignment.selectedRawLocaleAnswerKey || alignment.sourceRawAnswerKey || 'unknown')}<br>Source selected text: ${html(answerText(alignment.selectedLocaleCorrectText || alignment.sourceCorrectText))}<br>Exported locale key: ${html(alignment.selectedLocaleAnswerKey || alignment.sourceAnswerKey || 'unknown')}</div>` : ''}
      ${labelSummary ? `<div class="hint">Source label check: ${html(labelSummary)}</div>` : ''}
    </div>
  `;
}

function renderAnswerKeyChoices(item) {
  const isRow = item.answerKeyAlignment?.sourceQuestionType === 'ROW';
  return ['A', 'B', 'C', 'D', 'Right', 'Wrong', 'UNKNOWN', ''].map((key) => {
    const label = key || 'Not set';
    const isMcqLetter = /^[A-D]$/u.test(key);
    const className = isRow && isMcqLetter ? ' class="deemphasized"' : (isRow && ROW_KEYS.has(key) ? ' class="primary"' : '');
    const hint = isRow && isMcqLetter ? '<small>auto by text</small>' : '';
    return `<label${className}><input type="radio" name="answer-${attr(item.id)}" value="${attr(key)}" data-answer-key-for="${attr(item.id)}"><span>${html(label)}</span>${hint}</label>`;
  }).join('');
}

function renderDecisionControls(item) {
  const ambiguousDuplicateConfirm = item.answerKeyAlignment?.selectedIsAmbiguous ? `
      <div class="manual-confirm-block">
        <div class="alignment-warning compact">
          <strong>Duplicate source labels make this selected answer ambiguous.</strong><br>
          Leave this unchecked unless you manually verified which duplicated source option is correct.
        </div>
        <label class="manual-confirm">
          <input type="checkbox" data-confirm-ambiguous-for="${attr(item.id)}">
          <span>I manually confirmed this duplicated-label answer</span>
        </label>
      </div>
  ` : '';
  return `
    <div class="decision-block" data-decision-block="${attr(item.id)}">
      <div class="decision-row">
        <span class="label">Decision</span>
        <div class="decision-actions">
          ${[
            ['approve', 'Approve existing qid'],
            ['new', 'Create new question'],
            ['unresolved', 'Keep unresolved'],
            ['delete', 'Delete question'],
            ['ignore', 'Ignore / count reconciliation only'],
          ].map(([value, label]) => `<label><input type="radio" name="mode-${attr(item.id)}" value="${attr(value)}" data-mode-for="${attr(item.id)}"><span>${html(label)}</span></label>`).join('')}
        </div>
      </div>
      <div class="decision-row"><span class="label">Approved Qid</span><input type="text" data-approved-qid-for="${attr(item.id)}" placeholder="92 or q0092"></div>
      <div class="decision-row"><span class="label">Locale Answer Key</span><div class="answer-key-choices${item.answerKeyAlignment?.sourceQuestionType === 'ROW' ? ' row-mode' : ''}">${renderAnswerKeyChoices(item)}</div></div>
      ${ambiguousDuplicateConfirm}
      <div class="decision-row"><span class="label">New-Question Topic</span><input type="text" data-topic-for="${attr(item.id)}" placeholder="road-safety"></div>
      <div class="decision-row"><span class="label">New-Question Subtopics</span><textarea data-subtopics-for="${attr(item.id)}" placeholder="proper-driving:safe-driving, traffic-signals:road-signs"></textarea></div>
      <label class="label" for="notes-${attr(item.id)}">Reviewer Notes</label>
      <textarea id="notes-${attr(item.id)}" data-notes-for="${attr(item.id)}" placeholder="Reviewer notes for later apply step"></textarea>
      <div class="decision-toolbar">
        <button type="button" class="secondary" data-use-current="${attr(item.id)}">Use current decision</button>
        <button type="button" class="secondary" data-copy-card-json="${attr(item.id)}">Copy item JSON</button>
      </div>
    </div>
  `;
}

function renderCard(item, index) {
  const anchorId = itemAnchorId(item.id);
  const categories = [item.discrepancyCategory, item.riskLevel === 'high' ? 'high-risk' : '', recommendationClass(item.aiReviewRecommendation)].filter(Boolean).join(' ');
  const sourceOptionsEnglish = asArray(item.sourceOptionsEnglish);
  const sourceOptions = sourceOptionsEnglish.length ? sourceOptionsEnglish : asArray(item.sourceOptions);
  const sourceAnswer = item.localeAnswerKey || item.sourceAnswerKey || item.correctAnswerRaw || '';
  return `
    <article id="${attr(anchorId)}" class="item item-card" data-category="${attr(categories)}" data-item-id="${attr(item.id)}" data-anchor-id="${attr(anchorId)}">
      <div class="source-asset-column">
        <div class="eyebrow"><span class="filename-number">${html(index + 1)}.</span> ${html(item.discrepancyCategory)}</div>
        <div class="item-id"><span class="label">Item ID</span><code>${html(item.id)}</code></div>
        <h3 class="source-asset-title source-screenshot-path">${html(item.sourceScreenshotPath)}</h3>
        ${renderImageFrame(item.sourceScreenshotPreviewPath, item.sourceScreenshotPath)}
        <div class="source-card">
          <div><span class="label">Source Prompt</span><p class="prompt">${html(item.sourcePrompt || item.sourcePromptEnglish || 'No source prompt')}</p>${item.sourcePromptEnglish ? `<div class="gloss">${html(item.sourcePromptEnglish)}</div>` : ''}</div>
          <div><span class="label">Source Options</span>${renderOptions(sourceOptions, sourceAnswer)}</div>
          <div class="mini-grid single">
            <div class="fact"><span class="label">Source Answer</span><div class="value">${html(sourceAnswer || 'unknown')}</div></div>
            ${item.sourceVisualTags.length ? `<div class="fact"><span class="label">Source Visual Tags</span><div class="value">${html(item.sourceVisualTags.join(', '))}</div></div>` : ''}
          </div>
        </div>
      </div>
      <div class="source-block">
        <div class="source-card">
          <div class="card-badges">
            <span class="pill category">${html(item.discrepancyCategory)}</span>
            <span class="pill risk ${html(item.riskLevel)}">${html(item.riskLevel)} risk</span>
            <span class="pill">${html(item.batch)}</span>
          </div>
          <div class="notebook-panel${item.riskLevel === 'high' ? ' conflict' : ''}">
            <div>
              <span class="label">AI Review</span>
              <div class="card-badges"><span class="pill recommendation">${html(item.aiReviewRecommendation)}</span></div>
              <div class="fact"><div class="value">${html(item.aiReviewJustification)}</div></div>
              <div class="notebook-warning"><strong>Next:</strong> ${html(item.suggestedNextAction)}</div>
            </div>
          </div>
          <div>
            <span class="label">Current Decision</span>
            <div class="mini-grid">
              <div class="fact"><span class="label">Existing Decision</span><div class="value">${html(item.existingDecision)}</div></div>
              <div class="fact"><span class="label">Production Status</span><div class="value">${html(item.productionStatus)}</div></div>
              <div class="fact"><span class="label">Approved Similarity</span><div class="value">${item.approvedSimilarity == null ? 'n/a' : html(item.approvedSimilarity.toFixed(2))}</div></div>
              ${item.reviewerNote ? `<div class="fact"><span class="label">Reviewer Note</span><div class="value">${html(item.reviewerNote)}</div></div>` : ''}
            </div>
          </div>
          ${renderAnswerKeyAlignment(item)}
          ${item.duplicateGroupInfo ? `<div class="fact warn"><span class="label">Duplicate Group ${html(item.duplicateGroupInfo.qid)}</span><div class="value">Item ${html(item.duplicateGroupInfo.duplicateOrdinal)} of ${html(item.duplicateGroupInfo.duplicateCount)}<br>${html(item.duplicateGroupInfo.records.map((record) => `${record.batch}:${record.sourceScreenshotPath}`).join(' | '))}</div></div>` : ''}
          <div><span class="label">Best Master Matches</span>${renderCandidates(item)}</div>
          <details>
            <summary>Master / approved qid comparison</summary>
            ${renderMaster(item)}
          </details>
        </div>
      </div>
      ${renderDecisionControls(item)}
    </article>
  `;
}

function recommendationClass(recommendation) {
  if (recommendation.includes('merge')) return 'merge-needed';
  if (recommendation.includes('harmless')) return 'safe-ignore';
  if (recommendation.includes('possible better') || recommendation.includes('human')) return 'review-needed';
  return 'other';
}

function modeFromOriginalDecision(originalDecision) {
  if (originalDecision?.deleteQuestion === true || originalDecision?.decisionMode === 'delete') return 'delete';
  if (originalDecision?.createNewQuestion === true || originalDecision?.decisionMode === 'create-new') return 'new';
  if (originalDecision?.keepUnresolved === true || originalDecision?.decisionMode === 'keep-unresolved') return 'unresolved';
  if (originalDecision?.approvedQid || originalDecision?.decisionMode === 'approve-existing-qid') return 'approve';
  return 'unresolved';
}

function decisionFromItem(item) {
  const mode = modeFromOriginalDecision(item.originalDecision);
  return {
    id: item.id,
    category: item.discrepancyCategory,
    discrepancyCategory: item.discrepancyCategory,
    batch: item.batch,
    screenshotPath: item.sourceScreenshotPath,
    originalDecision: item.originalDecision,
    finalDecision: mode,
    approvedQid: item.originalDecision?.approvedQid || item.approvedQid || '',
    localeAnswerKey: normalizeLocaleAnswerKey(item.originalDecision?.localeAnswerKey || item.localeAnswerKey),
    createNewQuestion: mode === 'new',
    keepUnresolved: mode === 'unresolved',
    deleteQuestion: mode === 'delete',
    ignoreReconciliation: mode === 'ignore',
    confirmAmbiguousDuplicateLabel: item.originalDecision?.confirmAmbiguousDuplicateLabel === true,
    newQuestionTopic: item.originalDecision?.newQuestionTopic || '',
    newQuestionSubtopics: asArray(item.originalDecision?.newQuestionSubtopics),
    reviewerNotes: item.originalDecision?.reviewerNotes || '',
    aiReview: {
      recommendation: item.aiReviewRecommendation,
      riskLevel: item.riskLevel,
      justification: item.aiReviewJustification,
      suggestedNextAction: item.suggestedNextAction,
      bestMatches: item.bestMatches,
    },
    selectedCandidate: null,
  };
}

function buildDecisionTemplate(items) {
  return {
    exportedAt: null,
    lang: LANG,
    dataset: DATASET,
    source: 'ru-discrepancy-review-workbench',
    targetPath: rel(DECISIONS_TARGET_PATH),
    generatedFrom: {
      itemsPath: rel(ITEMS_PATH),
      workbenchPath: rel(WORKBENCH_PATH),
    },
    items: items.map(decisionFromItem),
  };
}

function renderWorkbench(items, counts, decisionsTemplate) {
  const categoryButtons = [
    ['all', 'All'],
    ['create-new', 'Create-new'],
    ['unresolved', 'Unresolved'],
    ['deleted', 'Deleted'],
    ['duplicate-approval', 'Duplicate approvals'],
    ['missing-production-qid', 'Missing production qids'],
    ['high-risk', 'High risk'],
  ];
  const itemsJson = JSON.stringify(items).replaceAll('<', '\\u003c');
  const decisionsTemplateJson = JSON.stringify(decisionsTemplate).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RU Discrepancy Review Workbench</title>
<style>
  :root {
    color-scheme: light;
    --bg: #f6efe4;
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
    --correct-bg: #e5f3eb;
    --correct-border: rgba(22, 93, 82, 0.28);
    --correct-shadow: 0 8px 18px rgba(22, 93, 82, 0.10);
    --danger: #9f2a1f;
    --danger-soft: #fbe7e4;
    --shadow: 0 12px 28px rgba(38, 25, 10, 0.08);
    --mono: "SFMono-Regular", Menlo, Consolas, monospace;
    --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(22, 93, 82, 0.10), transparent 32%),
      radial-gradient(circle at top right, rgba(140, 79, 22, 0.10), transparent 28%),
      var(--bg);
    color: var(--ink);
    font-family: var(--sans);
  }
  .page {
    width: min(1680px, calc(100vw - 28px));
    margin: 22px auto 44px;
  }
  .hero, .item, .export-panel {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 22px;
    box-shadow: var(--shadow);
  }
  .hero {
    padding: 24px 28px;
    margin-bottom: 18px;
  }
  .hero h1 {
    margin: 0 0 8px;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1;
  }
  .hero p {
    margin: 0;
    color: var(--muted);
    font-size: 16px;
    line-height: 1.5;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-top: 18px;
  }
  .stat {
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 12px 14px;
    background: #fcf8f1;
  }
  .stat span {
    display: block;
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stat strong {
    display: block;
    margin-top: 6px;
    font-size: 24px;
  }
  .toolbar, .export-toolbar, .decision-toolbar, .card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .toolbar {
    margin-top: 18px;
  }
  button {
    border: 0;
    border-radius: 999px;
    padding: 10px 14px;
    font: inherit;
    cursor: pointer;
    background: var(--accent);
    color: #fff;
  }
  button.secondary {
    background: #e8dfd2;
    color: var(--ink);
  }
  button.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 3px rgba(22, 93, 82, 0.14);
  }
  .export-panel {
    margin: 18px 0;
    padding: 14px 16px;
  }
  .export-panel summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
  }
  .export-toolbar {
    margin: 12px 0;
  }
  .export-status {
    padding: 10px 12px;
    border: 1px solid rgba(140, 79, 22, 0.28);
    border-radius: 14px;
    background: var(--warn-soft);
    color: var(--warn);
    font-size: 13px;
    line-height: 1.45;
  }
  #decisions-json {
    width: 100%;
    min-height: 170px;
    resize: vertical;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px;
    font-family: var(--mono);
    font-size: 12px;
    background: #fff;
  }
  .list {
    display: grid;
    gap: 14px;
    margin-top: 16px;
  }
  .item {
    padding: 14px;
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(300px, 380px) minmax(420px, 1fr) minmax(290px, 330px);
    align-items: start;
    scroll-margin-top: 20px;
  }
  .item.hash-highlight {
    border-color: rgba(22, 93, 82, 0.52);
    box-shadow: 0 0 0 4px rgba(22, 93, 82, 0.16), var(--shadow);
    animation: hashPulse 1.4s ease-in-out 2;
  }
  @keyframes hashPulse {
    0%, 100% { background: var(--paper); }
    50% { background: #eef7f4; }
  }
  .source-asset-column, .source-block, .decision-block {
    min-width: 0;
  }
  .source-asset-column, .source-card {
    display: grid;
    gap: 10px;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .filename-number {
    margin-right: 6px;
    color: var(--ink);
    font-weight: 700;
  }
  .item-id {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1.35;
    user-select: text;
    word-break: break-word;
  }
  .item-id .label {
    margin-bottom: 2px;
  }
  .item h3 {
    margin: 0;
    font-size: 21px;
    line-height: 1.15;
  }
  .item h3.source-screenshot-path {
    font-family: var(--mono);
    font-size: 10pt;
    font-weight: 600;
    color: var(--muted);
    word-break: break-word;
    user-select: text;
  }
  .image-frame {
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
    background: #f1ebdf;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .image-frame img {
    width: 100%;
    height: auto;
    display: block;
  }
  .image-fallback {
    padding: 14px;
    text-align: center;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
    word-break: break-word;
  }
  .label {
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .prompt {
    font-size: 17px;
    line-height: 1.45;
    margin: 0;
  }
  .prompt.compact {
    font-size: 15px;
  }
  .gloss, .hint {
    margin-top: 4px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }
  .options {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .option {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 9px 11px;
    background: #fbf7f0;
  }
  .option-current {
    background: var(--correct-bg);
    border-color: var(--correct-border);
    box-shadow: var(--correct-shadow);
    transform: translateY(-1px);
  }
  .option-key {
    display: inline-flex;
    min-width: 24px;
    font-family: var(--mono);
    color: var(--accent);
  }
  .option-current .option-key {
    font-weight: 800;
  }
  .option-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .option-correct-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--correct-border);
    background: rgba(22, 93, 82, 0.10);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .mini-grid.single {
    grid-template-columns: 1fr;
  }
  .fact {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #faf5ee;
    padding: 10px 12px;
  }
  .fact.warn {
    background: var(--warn-soft);
    border-color: rgba(140, 79, 22, 0.18);
  }
  .fact .value {
    font-size: 14px;
    line-height: 1.4;
    word-break: break-word;
  }
  .notebook-panel {
    border: 1px solid rgba(79, 59, 150, 0.22);
    border-radius: 14px;
    background: var(--note-soft);
    padding: 12px;
    display: grid;
    gap: 10px;
  }
  .notebook-panel.conflict {
    border-color: rgba(140, 79, 22, 0.35);
    background: var(--warn-soft);
  }
  .notebook-warning {
    border: 1px solid rgba(140, 79, 22, 0.24);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.45);
    padding: 8px 10px;
    color: var(--warn);
    font-size: 13px;
  }
  .answer-alignment {
    border: 1px solid rgba(22, 93, 82, 0.22);
    border-radius: 14px;
    background: var(--accent-soft);
    padding: 12px;
    display: grid;
    gap: 10px;
  }
  .answer-alignment.medium {
    border-color: rgba(140, 79, 22, 0.35);
    background: var(--warn-soft);
  }
  .answer-alignment.high {
    border-color: rgba(159, 42, 31, 0.32);
    background: var(--danger-soft);
  }
  .alignment-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .alignment-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .alignment-fact {
    border: 1px solid rgba(255, 255, 255, 0.62);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.48);
    padding: 9px 10px;
    font-size: 13px;
    line-height: 1.4;
  }
  .alignment-fact strong {
    display: block;
    margin-bottom: 4px;
    font-family: var(--mono);
    font-size: 14px;
  }
  .alignment-warning {
    border: 1px solid rgba(159, 42, 31, 0.24);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.52);
    color: var(--danger);
    padding: 8px 10px;
    font-size: 13px;
    line-height: 1.45;
  }
  .alignment-info {
    border: 1px solid rgba(22, 93, 82, 0.24);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.58);
    color: var(--accent);
    padding: 8px 10px;
    font-size: 13px;
    line-height: 1.45;
  }
  .alignment-warning[hidden] {
    display: none;
  }
  .alignment-warning.compact {
    font-size: 12px;
  }
  .manual-confirm-block {
    border: 1px solid rgba(159, 42, 31, 0.24);
    border-radius: 12px;
    background: var(--danger-soft);
    padding: 10px;
    display: grid;
    gap: 8px;
  }
  .manual-confirm {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.35;
    color: var(--ink);
  }
  .manual-confirm input {
    margin-top: 2px;
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
  .candidate.approved {
    border-color: var(--correct-border);
    background: var(--correct-bg);
    box-shadow: var(--correct-shadow);
  }
  .candidate-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .candidate-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .candidate-media {
    margin: 0 0 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fffdf8;
  }
  .candidate-media img {
    display: block;
    width: 100%;
    max-height: 190px;
    object-fit: contain;
  }
  .candidate .prompt {
    font-size: 15px;
    margin-bottom: 8px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12px;
    background: #f3ede4;
    color: var(--muted);
    font-weight: 700;
  }
  .pill.qid, .pill.category {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: rgba(22, 93, 82, 0.22);
  }
  .pill.note {
    background: var(--note-soft);
    color: var(--note);
    border-color: rgba(79, 59, 150, 0.18);
  }
  .pill.recommendation {
    background: #fff;
    color: var(--note);
    border-color: rgba(79, 59, 150, 0.2);
  }
  .pill.risk.low {
    color: var(--accent);
    background: var(--correct-bg);
    border-color: var(--correct-border);
  }
  .pill.risk.medium {
    color: var(--warn);
    background: var(--warn-soft);
    border-color: rgba(140, 79, 22, 0.22);
  }
  .pill.risk.high {
    color: var(--danger);
    background: var(--danger-soft);
    border-color: rgba(159, 42, 31, 0.22);
  }
  .decision-block {
    border: 1px solid var(--line);
    border-radius: 16px;
    background: #fcf8f1;
    padding: 14px;
    position: sticky;
    top: 14px;
  }
  .decision-row {
    margin-bottom: 12px;
  }
  .decision-actions {
    display: grid;
    gap: 8px;
  }
  .decision-actions label, .answer-key-choices label {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 8px 10px;
    background: #fff;
    cursor: pointer;
  }
  .decision-actions label:has(input:checked),
  .answer-key-choices label:has(input:checked) {
    border-color: var(--correct-border);
    background: var(--accent-soft);
    box-shadow: 0 0 0 2px rgba(22, 93, 82, 0.08);
  }
  .answer-key-choices.row-mode label.primary {
    border-color: var(--correct-border);
    background: #fff;
    font-weight: 700;
  }
  .answer-key-choices.row-mode label.deemphasized {
    opacity: 0.48;
    background: #f7f1e8;
  }
  .answer-key-choices label small {
    margin-left: auto;
    color: var(--muted);
    font-size: 10px;
  }
  .decision-actions input, .answer-key-choices input {
    margin: 0;
  }
  input[type="text"], textarea {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
    font: inherit;
    background: #fff;
  }
  textarea {
    min-height: 74px;
    resize: vertical;
  }
  .answer-key-choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  details {
    margin-top: 10px;
  }
  summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 1180px) {
    .item {
      grid-template-columns: 1fr;
    }
    .alignment-grid {
      grid-template-columns: 1fr;
    }
    .decision-block {
      position: static;
    }
  }
</style>
</head>
<body>
<div class="page">
  <section class="hero">
    <h1>RU Discrepancy Review Workbench</h1>
    <p>Editable reconciliation pass for remaining Russian discrepancy items. Export target: ${html(rel(DECISIONS_TARGET_PATH))}</p>
    <div class="stats">
      <div class="stat"><span>Total</span><strong>${items.length}</strong></div>
      ${Object.entries(counts.byCategory).map(([key, value]) => `<div class="stat"><span>${html(key)}</span><strong>${value}</strong></div>`).join('')}
      <div class="stat"><span>High risk</span><strong>${items.filter((item) => item.riskLevel === 'high').length}</strong></div>
    </div>
    <div class="toolbar">
      ${categoryButtons.map(([filter, label]) => `<button type="button" data-filter="${attr(filter)}"${filter === 'all' ? ' class="active"' : ''}>${html(label)}</button>`).join('')}
    </div>
  </section>
  <details class="export-panel">
    <summary>Export / import decisions JSON</summary>
    <div class="export-toolbar">
      <button type="button" id="download-json">Download decisions JSON</button>
      <button type="button" class="secondary" id="copy-json">Copy JSON</button>
      <button type="button" class="secondary" id="load-json">Load JSON from textarea</button>
      <button type="button" class="secondary" id="reset-template">Reset to template</button>
      <span class="export-status" id="export-status">Target: ${html(rel(DECISIONS_TARGET_PATH))}</span>
    </div>
    <textarea id="decisions-json" spellcheck="false" aria-label="Editable decisions JSON export"></textarea>
  </details>
  <main class="list">
    ${items.map(renderCard).join('\n')}
  </main>
</div>
<script>
  const REVIEW_ITEMS = ${itemsJson};
  const INITIAL_DECISIONS_TEMPLATE = ${decisionsTemplateJson};
  const TARGET_FILE_NAME = 'ru-discrepancy-review-decisions.json';
  const STORAGE_KEY = 'ru-discrepancy-review-workbench:v1';

  const buttons = document.querySelectorAll('[data-filter]');
  const cards = document.querySelectorAll('.item-card');
  const itemsById = new Map(REVIEW_ITEMS.map((item) => [item.id, item]));
  let state = loadInitialState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadInitialState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items) && parsed.items.length === INITIAL_DECISIONS_TEMPLATE.items.length) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Unable to load saved discrepancy decisions', error);
    }
    return clone(INITIAL_DECISIONS_TEMPLATE);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeQid(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^(?:q)?(\\d{1,4})$/i);
    if (!match) return raw;
    return 'q' + match[1].padStart(4, '0');
  }

  function normalizeAnswerKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    if (/^[A-D]$/.test(upper)) return upper;
    if (['R', 'RIGHT', 'TRUE', 'CORRECT'].includes(upper)) return 'Right';
    if (['W', 'WRONG', 'FALSE', 'INCORRECT'].includes(upper)) return 'Wrong';
    if (upper === 'UNKNOWN') return 'UNKNOWN';
    return raw;
  }

  function decisionById(id) {
    return state.items.find((item) => item.id === id);
  }

  function templateDecisionById(id) {
    return INITIAL_DECISIONS_TEMPLATE.items.find((item) => item.id === id);
  }

  function modePatch(mode) {
    return {
      finalDecision: mode,
      createNewQuestion: mode === 'new',
      keepUnresolved: mode === 'unresolved',
      deleteQuestion: mode === 'delete',
      ignoreReconciliation: mode === 'ignore',
    };
  }

  function updateDecision(id, patch, options = {}) {
    const decision = decisionById(id);
    if (!decision) return;
    Object.assign(decision, patch);
    if ('approvedQid' in patch) decision.approvedQid = normalizeQid(decision.approvedQid);
    if ('localeAnswerKey' in patch) decision.localeAnswerKey = normalizeLocaleAnswerForReviewItem(id, decision.localeAnswerKey);
    saveState();
    if (options.sync !== false) syncCard(id);
    updateJsonTextarea();
  }

  function normalizeLocaleAnswerForReviewItem(id, answerKey) {
    const reviewItem = itemsById.get(id);
    const alignment = reviewItem?.answerKeyAlignment || {};
    const normalized = normalizeAnswerKey(answerKey);
    if (alignment.sourceQuestionType !== 'ROW') return normalized;
    if (normalized === 'Right' || normalized === 'Wrong' || normalized === 'UNKNOWN' || !normalized) return normalized;
    const records = [...(alignment.sourceOptionRecords || []), ...(alignment.rawSourceOptionRecords || [])];
    const rowValues = [...new Set(records
      .filter((record) => record.normalizedLabel === normalized && record.rowAnswerKey)
      .map((record) => record.rowAnswerKey)
      .filter(Boolean))];
    return rowValues.length === 1 ? rowValues[0] : normalized;
  }

  function exportPayload() {
    return {
      ...state,
      exportedAt: new Date().toISOString(),
      targetPath: INITIAL_DECISIONS_TEMPLATE.targetPath,
      items: state.items.map((item) => ({
        ...item,
        approvedQid: normalizeQid(item.approvedQid),
        localeAnswerKey: normalizeLocaleAnswerForReviewItem(item.id, item.localeAnswerKey),
        confirmAmbiguousDuplicateLabel: item.confirmAmbiguousDuplicateLabel === true,
        newQuestionSubtopics: Array.isArray(item.newQuestionSubtopics)
          ? item.newQuestionSubtopics
          : String(item.newQuestionSubtopics || '').split(/[,\\n]/).map((entry) => entry.trim()).filter(Boolean),
      })),
    };
  }

  function updateJsonTextarea() {
    const textarea = document.getElementById('decisions-json');
    if (textarea) textarea.value = JSON.stringify(exportPayload(), null, 2);
  }

  function setStatus(message) {
    const status = document.getElementById('export-status');
    if (status) status.textContent = message || ('Target: ' + INITIAL_DECISIONS_TEMPLATE.targetPath);
  }

  function selectedAnswerText(reviewItem, answerKey) {
    const alignment = reviewItem?.answerKeyAlignment || {};
    const sourceType = alignment.sourceQuestionType || 'MCQ';
    const key = normalizeAnswerKey(answerKey);
    const records = [
      ...(alignment.sourceOptionRecords || []),
      ...(alignment.rawSourceOptionRecords || []),
    ];
    if (!key) return '';
    if ((key === 'Right' || key === 'Wrong') && sourceType === 'ROW') {
      const rowMatch = records.find((record) => record.rowAnswerKey === key);
      return rowMatch?.text || key;
    }
    const match = records.find((record) => record.normalizedLabel === key);
    return match?.text || '';
  }

  function syncAnswerAlignment(id) {
    const decision = decisionById(id);
    const reviewItem = itemsById.get(id);
    if (!decision || !reviewItem?.answerKeyAlignment) return;
    const alignment = reviewItem.answerKeyAlignment;
    const key = normalizeAnswerKey(decision.localeAnswerKey);
    const text = selectedAnswerText(reviewItem, key);
    const keyNode = document.querySelector('[data-selected-answer-key-for=' + JSON.stringify(id) + ']');
    const textNode = document.querySelector('[data-selected-answer-text-for=' + JSON.stringify(id) + ']');
    const warningNode = document.querySelector('[data-selected-answer-warning-for=' + JSON.stringify(id) + ']');
    if (keyNode) keyNode.textContent = key || 'not set';
    if (textNode) textNode.textContent = text || 'not found';
    if (warningNode) {
      const warnings = [];
      if (key && key !== 'UNKNOWN' && !text) warnings.push('Selected locale answer was not found in the source options.');
      if (alignment.hasLetterMismatch) warnings.push('Letter mismatch detected. Keep the locale answer tied to the Russian/source option meaning.');
      if (alignment.sourceQuestionType === 'ROW' && alignment.autoNormalizedRowAnswer) warnings.push('ROW answer is exported as Right/Wrong based on option text.');
      if (alignment.selectedIsAmbiguous) {
        warnings.push(decision.confirmAmbiguousDuplicateLabel === true
          ? 'Duplicate-label answer has been manually confirmed.'
          : 'Duplicate source labels: manual confirmation is required before apply.');
      }
      warningNode.textContent = warnings.join(' ');
      warningNode.hidden = warnings.length === 0;
    }
  }

  function syncCard(id) {
    const decision = decisionById(id);
    if (!decision) return;
    decision.localeAnswerKey = normalizeLocaleAnswerForReviewItem(id, decision.localeAnswerKey);
    document.querySelectorAll('[data-mode-for=' + JSON.stringify(id) + ']').forEach((input) => {
      input.checked = input.value === decision.finalDecision;
    });
    const qid = document.querySelector('[data-approved-qid-for=' + JSON.stringify(id) + ']');
    if (qid) qid.value = decision.approvedQid || '';
    const answerValue = normalizeLocaleAnswerForReviewItem(id, decision.localeAnswerKey);
    document.querySelectorAll('[data-answer-key-for=' + JSON.stringify(id) + ']').forEach((control) => {
      if (control.type === 'radio') {
        control.checked = control.value === answerValue;
      } else {
        control.value = answerValue;
      }
    });
    const topic = document.querySelector('[data-topic-for=' + JSON.stringify(id) + ']');
    if (topic) topic.value = decision.newQuestionTopic || '';
    const subtopics = document.querySelector('[data-subtopics-for=' + JSON.stringify(id) + ']');
    if (subtopics) subtopics.value = Array.isArray(decision.newQuestionSubtopics) ? decision.newQuestionSubtopics.join(', ') : (decision.newQuestionSubtopics || '');
    const notes = document.querySelector('[data-notes-for=' + JSON.stringify(id) + ']');
    if (notes) notes.value = decision.reviewerNotes || '';
    const ambiguousConfirm = document.querySelector('[data-confirm-ambiguous-for=' + JSON.stringify(id) + ']');
    if (ambiguousConfirm) ambiguousConfirm.checked = decision.confirmAmbiguousDuplicateLabel === true;
    syncAnswerAlignment(id);
  }

  function syncAllCards() {
    state.items.forEach((item) => syncCard(item.id));
    updateJsonTextarea();
  }

  function useCurrentDecision(id) {
    const template = templateDecisionById(id);
    if (!template) return;
    const decision = decisionById(id);
    Object.assign(decision, clone(template));
    saveState();
    syncCard(id);
    updateJsonTextarea();
  }

  function useCandidate(id, candidate, answerKey) {
    const qid = normalizeQid(candidate?.qid || '');
    if (!qid) return;
    const reviewItem = itemsById.get(id);
    const recommendedAnswer = normalizeAnswerKey(reviewItem?.answerKeyAlignment?.recommendedLocaleAnswerKey);
    const patch = {
      ...modePatch('approve'),
      approvedQid: qid,
      selectedCandidate: candidate || { qid },
    };
    const normalizedAnswer = normalizeAnswerKey(answerKey || candidate?.answerKey);
    if (recommendedAnswer && recommendedAnswer !== 'UNKNOWN') {
      patch.localeAnswerKey = recommendedAnswer;
    } else if (normalizedAnswer && normalizedAnswer !== 'UNKNOWN' && !reviewItem?.answerKeyAlignment?.hasLetterMismatch) {
      patch.localeAnswerKey = normalizedAnswer;
    }
    updateDecision(id, patch);
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      buttons.forEach((entry) => entry.classList.toggle('active', entry === button));
      cards.forEach((card) => {
        const categories = (card.dataset.category || '').split(/\\s+/);
        card.style.display = filter === 'all' || categories.includes(filter) ? '' : 'none';
      });
    });
  });

  document.querySelectorAll('[data-mode-for]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      updateDecision(input.dataset.modeFor, modePatch(input.value));
    });
  });

  document.querySelectorAll('[data-approved-qid-for]').forEach((input) => {
    input.addEventListener('input', () => updateDecision(input.dataset.approvedQidFor, {
      ...modePatch('approve'),
      approvedQid: input.value,
    }, { sync: false }));
    input.addEventListener('blur', () => syncCard(input.dataset.approvedQidFor));
  });

  document.querySelectorAll('[data-answer-key-for]').forEach((control) => {
    control.addEventListener('change', () => {
      if (control.type === 'radio' && !control.checked) return;
      updateDecision(control.dataset.answerKeyFor, { localeAnswerKey: control.value }, { sync: false });
    });
  });

  document.querySelectorAll('[data-topic-for]').forEach((input) => {
    input.addEventListener('input', () => updateDecision(input.dataset.topicFor, { newQuestionTopic: input.value }, { sync: false }));
  });

  document.querySelectorAll('[data-subtopics-for]').forEach((textarea) => {
    textarea.addEventListener('input', () => updateDecision(textarea.dataset.subtopicsFor, {
      newQuestionSubtopics: textarea.value.split(/[,\\n]/).map((entry) => entry.trim()).filter(Boolean),
    }, { sync: false }));
  });

  document.querySelectorAll('[data-notes-for]').forEach((textarea) => {
    textarea.addEventListener('input', () => updateDecision(textarea.dataset.notesFor, { reviewerNotes: textarea.value }, { sync: false }));
  });

  document.querySelectorAll('[data-confirm-ambiguous-for]').forEach((input) => {
    input.addEventListener('change', () => updateDecision(input.dataset.confirmAmbiguousFor, {
      confirmAmbiguousDuplicateLabel: input.checked,
    }));
  });

  document.querySelectorAll('[data-use-current]').forEach((button) => {
    button.addEventListener('click', () => useCurrentDecision(button.dataset.useCurrent));
  });

  document.querySelectorAll('[data-use-qid]').forEach((button) => {
    button.addEventListener('click', () => {
      let candidate = null;
      try { candidate = JSON.parse(button.dataset.candidate || 'null'); } catch {}
      useCandidate(button.dataset.useQid, candidate || { qid: button.dataset.qid }, button.dataset.answerKey);
    });
  });

  document.querySelectorAll('[data-copy-card-json]').forEach((button) => {
    button.addEventListener('click', async () => {
      const decision = decisionById(button.dataset.copyCardJson);
      if (!decision) return;
      await navigator.clipboard.writeText(JSON.stringify(decision, null, 2));
      setStatus('Copied item JSON for ' + decision.id);
    });
  });

  document.getElementById('download-json')?.addEventListener('click', () => {
    const content = JSON.stringify(exportPayload(), null, 2) + '\\n';
    download(TARGET_FILE_NAME, content, 'application/json');
    setStatus('Downloaded ' + TARGET_FILE_NAME);
  });

  document.getElementById('copy-json')?.addEventListener('click', async () => {
    const content = JSON.stringify(exportPayload(), null, 2);
    await navigator.clipboard.writeText(content);
    setStatus('Copied decisions JSON');
  });

  document.getElementById('load-json')?.addEventListener('click', () => {
    const textarea = document.getElementById('decisions-json');
    try {
      const parsed = JSON.parse(textarea.value);
      if (!Array.isArray(parsed.items)) throw new Error('JSON must have an items array');
      state = parsed;
      saveState();
      syncAllCards();
      setStatus('Loaded JSON from textarea');
    } catch (error) {
      setStatus('Could not load JSON: ' + error.message);
    }
  });

  document.getElementById('reset-template')?.addEventListener('click', () => {
    state = clone(INITIAL_DECISIONS_TEMPLATE);
    saveState();
    syncAllCards();
    setStatus('Reset to embedded template');
  });

  function focusHashItem() {
    const rawHash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
    if (!rawHash) return;
    const target = document.getElementById(rawHash);
    if (!target) return;
    if (target.style.display === 'none') {
      buttons.forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
      cards.forEach((card) => { card.style.display = ''; });
    }
    document.querySelectorAll('.item.hash-highlight').forEach((card) => card.classList.remove('hash-highlight'));
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.add('hash-highlight');
    const decisionControl = target.querySelector('[data-decision-block] input, [data-decision-block] textarea, [data-decision-block] button');
    if (decisionControl && typeof decisionControl.focus === 'function') {
      decisionControl.focus({ preventScroll: true });
    }
    window.setTimeout(() => target.classList.remove('hash-highlight'), 6000);
  }

  window.addEventListener('hashchange', focusHashItem);
  syncAllCards();
  focusHashItem();
</script>
</body>
</html>`;
}

function renderSummary(items, counts) {
  const highRisk = items.filter((item) => item.riskLevel === 'high');
  const safeIgnore = items.filter((item) => item.aiReviewRecommendation === 'duplicate is harmless');
  const mergeNeeded = items.filter((item) => item.aiReviewRecommendation === 'production merge missing, apply merge only');
  const mayBeWrong = items.filter((item) => (
    item.aiReviewRecommendation.startsWith('possible better qid:')
    || item.aiReviewRecommendation === 'needs human review'
  ));
  const topHuman = [...highRisk, ...mayBeWrong.filter((item) => item.riskLevel !== 'high')].slice(0, 20);

  const lines = [];
  lines.push('# RU Discrepancy Review Summary');
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Total discrepancy items collected: **${items.length}**`);
  lines.push('');
  lines.push('## Review Method');
  lines.push('');
  lines.push('The Codex review pass compares source Russian text, extracted English glosses, source options, existing matcher candidates, master qbank prompt/options, and available image asset/color/object tags. It is display-only QC assistance; it does not modify decisions or production qbank files.');
  lines.push('');
  lines.push('## Counts By Category');
  lines.push('');
  lines.push('| category | count |');
  lines.push('|---|---:|');
  for (const [key, value] of Object.entries(counts.byCategory)) lines.push(`| ${key} | ${value} |`);
  lines.push('');
  lines.push('## Counts By AI Recommendation');
  lines.push('');
  lines.push('| recommendation | count |');
  lines.push('|---|---:|');
  for (const [key, value] of Object.entries(counts.byRecommendation)) lines.push(`| ${md(key)} | ${value} |`);
  lines.push('');
  lines.push('## High-Risk Items');
  lines.push('');
  lines.push(formatMarkdownItems(highRisk));
  lines.push('');
  lines.push('## Items That May Be Safely Ignored');
  lines.push('');
  lines.push(formatMarkdownItems(safeIgnore, 40));
  lines.push('');
  lines.push('## Items That Likely Need Production Merge');
  lines.push('');
  lines.push(formatMarkdownItems(mergeNeeded));
  lines.push('');
  lines.push('## Items Where Current Decision May Be Wrong');
  lines.push('');
  lines.push(formatMarkdownItems(mayBeWrong, 40));
  lines.push('');
  lines.push('## Top Human Review Queue');
  lines.push('');
  lines.push(formatMarkdownItems(topHuman, 20));
  lines.push('');
  lines.push('## Prioritized Next Actions');
  lines.push('');
  lines.push('1. Review the two `batch-08` missing-production approvals (`q0245`, `q0176`) and decide whether to rebuild/apply batch-08 staging.');
  lines.push('2. Review high-risk create-new/unresolved/deleted items where the best master match is strong enough to suggest a possible existing qid.');
  lines.push('3. Treat low-risk duplicate approvals as count reconciliation unless the source screenshot clearly belongs to a different qid.');
  lines.push('4. Do not run production merge commands until the workbench findings are manually accepted.');
  lines.push('');
  lines.push('## Outputs');
  lines.push('');
  lines.push(`- Data: \`${rel(ITEMS_PATH)}\``);
  lines.push(`- Decisions template: \`${rel(DECISIONS_TEMPLATE_PATH)}\``);
  lines.push(`- Workbench: \`${rel(WORKBENCH_PATH)}\``);
  lines.push(`- Summary: \`${rel(SUMMARY_PATH)}\``);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function formatMarkdownItems(items, limit = 30) {
  if (!items.length) return 'None found.';
  const shown = items.slice(0, limit).map((item) => {
    const best = item.bestMatches[0];
    return `- **${item.riskLevel}** ${item.discrepancyCategory} ${item.batch} \`${item.sourceScreenshotPath}\`${item.approvedQid ? ` approved=${item.approvedQid}` : ''}: ${item.aiReviewRecommendation}. ${item.aiReviewJustification}${best ? ` Best=${best.qid} (${best.score.toFixed(2)}).` : ''}`;
  });
  if (items.length > limit) shown.push(`- ... ${items.length - limit} more`);
  return shown.join('\n');
}

function main() {
  const artifactIndex = makeArtifactIndex();
  const translations = readJson(TRANSLATIONS_PATH, { questions: {} });
  const productionQids = new Set(Object.keys(translations.questions || {}));
  const questionMap = indexQuestionDoc(readJson(QUESTIONS_PATH, { questions: [] }));
  const rawQuestionMap = indexQuestionDoc(readJson(QUESTIONS_RAW_PATH, { questions: [] }));
  const imageTagsDoc = readJson(IMAGE_TAGS_PATH, { questions: {} });
  const searchIndex = buildSearchIndex(questionMap, rawQuestionMap, imageTagsDoc);
  const context = { productionQids, questionMap, rawQuestionMap, imageTagsDoc, searchIndex };

  const batches = batchNames();
  const batchRecords = batches.map((batchName) => loadBatchRecords(batchName, artifactIndex));
  const { items, duplicateGroups } = collectDiscrepancyItems(batchRecords, context);
  const counts = {
    byCategory: countBy(items, (item) => item.discrepancyCategory),
    byRecommendation: countBy(items, (item) => item.aiReviewRecommendation),
    byRisk: countBy(items, (item) => item.riskLevel),
  };
  const decisionsTemplate = buildDecisionTemplate(items);

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      lang: LANG,
      dataset: DATASET,
      source: 'scripts/build-ru-discrepancy-review-workbench.mjs',
      strictScope: 'investigation/review only; production qbank and existing decisions are not modified',
      productionTranslationCount: productionQids.size,
      batchCount: batches.length,
      duplicateGroupCount: duplicateGroups.length,
    },
    counts,
    items,
  };

  ensureDir(path.dirname(ITEMS_PATH));
  ensureDir(path.dirname(WORKBENCH_PATH));
  fs.writeFileSync(ITEMS_PATH, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(DECISIONS_TEMPLATE_PATH, `${JSON.stringify(decisionsTemplate, null, 2)}\n`);
  fs.writeFileSync(WORKBENCH_PATH, renderWorkbench(items, counts, decisionsTemplate));
  fs.writeFileSync(SUMMARY_PATH, renderSummary(items, counts));

  console.log(`Wrote ${rel(ITEMS_PATH)}`);
  console.log(`Wrote ${rel(DECISIONS_TEMPLATE_PATH)}`);
  console.log(`Wrote ${rel(WORKBENCH_PATH)}`);
  console.log(`Wrote ${rel(SUMMARY_PATH)}`);
  console.log(`Collected ${items.length} discrepancy review items`);
}

main();
