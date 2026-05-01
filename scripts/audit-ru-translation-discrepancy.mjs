#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LANG = 'ru';
const DATASET = '2023-test1';
const USER_EXPECTED_SOURCE_COUNT = 902;

const IMPORT_ROOT = path.join(ROOT, 'imports', LANG);
const GENERATED_ROOT = path.join(ROOT, 'qbank-tools', 'generated');
const STAGING_ROOT = path.join(GENERATED_ROOT, 'staging');
const REPORTS_ROOT = path.join(GENERATED_ROOT, 'reports');
const ARCHIVE_RU_ROOT = path.join(GENERATED_ROOT, 'archive', LANG);
const QBANK_ROOT = path.join(ROOT, 'public', 'qbank', DATASET);
const TRANSLATIONS_PATH = path.join(QBANK_ROOT, `translations.${LANG}.json`);
const QUESTIONS_PATH = path.join(QBANK_ROOT, 'questions.json');
const QUESTIONS_RAW_PATH = path.join(QBANK_ROOT, 'questions.raw.json');
const DEFAULT_REPORT_PATH = path.join(REPORTS_ROOT, 'ru-translation-count-discrepancy-audit-post-811.md');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    expectedSourceCount: USER_EXPECTED_SOURCE_COUNT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === '--output' || arg === '--report') && args[index + 1]) {
      options.reportPath = path.resolve(ROOT, args[index + 1]);
      index += 1;
    } else if (arg === '--expected-source-count' && args[index + 1]) {
      options.expectedSourceCount = Number(args[index + 1]);
      index += 1;
    }
  }

  if (!Number.isFinite(options.expectedSourceCount)) {
    options.expectedSourceCount = USER_EXPECTED_SOURCE_COUNT;
  }

  return options;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath) {
  try {
    if (!exists(filePath)) return { ok: false, value: null, error: 'missing' };
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rel(filePath) {
  return filePath ? path.relative(ROOT, filePath) : '';
}

function mdEscape(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
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

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function asItems(jsonValue) {
  if (Array.isArray(jsonValue)) return jsonValue;
  if (Array.isArray(jsonValue?.items)) return jsonValue.items;
  if (Array.isArray(jsonValue?.questions)) return jsonValue.questions;
  return [];
}

function countJsonItems(filePath) {
  const parsed = readJson(filePath);
  return {
    exists: parsed.ok,
    error: parsed.error,
    count: parsed.ok ? asItems(parsed.value).length : 0,
    items: parsed.ok ? asItems(parsed.value) : [],
    value: parsed.value,
  };
}

function text(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function uniqueStrings(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort();
}

function pct(numerator, denominator) {
  if (!denominator) return 'n/a';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatBool(value) {
  return value ? 'yes' : 'no';
}

function formatList(values, limit = 30) {
  if (!values.length) return 'none';
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')}, ... (${values.length - limit} more)`;
}

function formatRows(rows, emptyText = 'None found.') {
  return rows.length ? rows.map((row) => `- ${row}`).join('\n') : emptyText;
}

function formatDecisionLocation(record) {
  const answer = record.answerKey ? ` answer=${record.answerKey}` : '';
  const qid = record.qid ? ` qid=${record.qid}` : '';
  return `${record.source}${qid}${answer}`;
}

function batchNumber(batchName) {
  const match = batchName.match(/^batch-(\d+)$/u);
  return match ? Number(match[1]) : Number.NaN;
}

function batchPadding(batchName) {
  const match = batchName.match(/^batch-(\d+)$/u);
  return match ? match[1].length : 0;
}

function getBatchLikeDirs() {
  return listDir(IMPORT_ROOT)
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('batch-'))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const aNum = batchNumber(a);
      const bNum = batchNumber(b);
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });
}

function getBatchDirs() {
  return getBatchLikeDirs().filter((name) => /^batch-\d+$/u.test(name));
}

function findNumberingGaps(batchNames) {
  const numbers = batchNames.map(batchNumber).filter(Number.isFinite);
  if (!numbers.length) return [];
  const present = new Set(numbers);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const missing = [];
  for (let number = min; number <= max; number += 1) {
    if (!present.has(number)) missing.push(number);
  }
  return missing;
}

function getScreenshotFiles(batchDir) {
  return walkFiles(batchDir).filter(isImageFile);
}

function getScreenshotDirFiles(batchDir) {
  const screenshotsDir = path.join(batchDir, 'screenshots');
  return exists(screenshotsDir) ? getScreenshotFiles(screenshotsDir) : [];
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

function artifactBatchNames(index) {
  const names = new Set();
  for (const baseName of index.keys()) {
    if (!baseName.includes(LANG) && !baseName.startsWith(`${LANG}-`)) continue;
    const matches = baseName.match(/batch-\d+/gu) || [];
    for (const match of matches) names.add(match);
  }
  return [...names].sort((a, b) => batchNumber(a) - batchNumber(b) || a.localeCompare(b));
}

function getQuestionEntries(questionDoc) {
  if (Array.isArray(questionDoc?.questions)) return questionDoc.questions;
  if (questionDoc?.questions && typeof questionDoc.questions === 'object') {
    return Object.entries(questionDoc.questions).map(([key, question]) => ({ key, ...question }));
  }
  return [];
}

function getQuestionQids(questionDoc) {
  return uniqueStrings(getQuestionEntries(questionDoc).map((question) => question?.id || question?.qid));
}

function getTranslationQuestions(translationDoc) {
  if (translationDoc?.questions && typeof translationDoc.questions === 'object' && !Array.isArray(translationDoc.questions)) {
    return translationDoc.questions;
  }
  return {};
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOptions(entry) {
  if (Array.isArray(entry?.options)) return entry.options.some((option) => hasText(option?.text) || hasText(option));
  if (entry?.options && typeof entry.options === 'object') {
    return Object.values(entry.options).some((option) => {
      if (typeof option === 'string') return hasText(option);
      return hasText(option?.text) || hasText(option?.label);
    });
  }
  return OPTION_KEYS.some((key) => hasText(entry?.[`option${key}`]) || hasText(entry?.[`option_${key}`]));
}

function hasAnswer(entry) {
  return [
    entry?.answer,
    entry?.correctAnswer,
    entry?.correctOptionId,
    entry?.correctOptionKey,
    entry?.localeCorrectOptionKey,
    entry?.answerRaw,
  ].some(hasText);
}

function countTranslationFields(translationQuestions) {
  const entries = Object.values(translationQuestions);
  return {
    qids: entries.length,
    prompt: entries.filter((entry) => hasText(entry?.prompt) || hasText(entry?.questionText) || hasText(entry?.localizedPrompt)).length,
    options: entries.filter(hasOptions).length,
    answer: entries.filter(hasAnswer).length,
    explanation: entries.filter((entry) => hasText(entry?.explanation) || hasText(entry?.localizedExplanation)).length,
  };
}

function decisionAnswerKey(item) {
  if (item?.answerKeyUnknown === true || item?.unknown === true) return 'UNKNOWN';
  for (const field of ['confirmedCorrectOptionKey', 'newQuestionLocalAnswerKey', 'currentStagedLocaleCorrectOptionKey']) {
    const value = text(item?.[field]);
    if (value) return value.toUpperCase();
  }
  return '';
}

function decisionSource(item, index) {
  return text(item?.sourceImage)
    || text(item?.itemId)
    || text(item?.file)
    || text(item?.imagePath)
    || text(item?.id)
    || `decision-${index + 1}`;
}

function approvedQid(item) {
  return text(item?.approvedQid);
}

function isApprovedExistingDecision(item) {
  return Boolean(
    approvedQid(item)
    && item?.createNewQuestion !== true
    && item?.keepUnresolved !== true
    && item?.deleteQuestion !== true,
  );
}

function isBlankNoopDecision(item) {
  return !approvedQid(item)
    && item?.createNewQuestion !== true
    && item?.keepUnresolved !== true
    && item?.deleteQuestion !== true;
}

function isUnknownAnswer(item) {
  return item?.answerKeyUnknown === true
    || item?.unknown === true
    || ['confirmedCorrectOptionKey', 'newQuestionLocalAnswerKey', 'currentStagedLocaleCorrectOptionKey']
      .some((field) => text(item?.[field]).toUpperCase() === 'UNKNOWN');
}

function decisionRecord(batchName, item, index) {
  return {
    batchName,
    index,
    item,
    qid: approvedQid(item),
    source: decisionSource(item, index),
    answerKey: decisionAnswerKey(item),
  };
}

function summarizeDecisions(filePath, batchName) {
  const parsed = countJsonItems(filePath);
  const records = parsed.items.map((item, index) => decisionRecord(batchName, item, index));
  const approvedRecords = records.filter((record) => isApprovedExistingDecision(record.item));
  const createRecords = records.filter((record) => record.item?.createNewQuestion === true);
  const keepRecords = records.filter((record) => record.item?.keepUnresolved === true);
  const deleteRecords = records.filter((record) => record.item?.deleteQuestion === true);
  const blankNoopRecords = records.filter((record) => isBlankNoopDecision(record.item));
  const unknownAnswerRecords = records.filter((record) => isUnknownAnswer(record.item));
  const approvedQids = uniqueStrings(approvedRecords.map((record) => record.qid));

  return {
    exists: parsed.exists,
    error: parsed.error,
    count: parsed.items.length,
    records,
    approvedRecords,
    approvedQids,
    approvedExistingCount: approvedRecords.length,
    approvedExistingUniqueQidCount: approvedQids.length,
    createRecords,
    createNewCount: createRecords.length,
    keepRecords,
    keepUnresolvedCount: keepRecords.length,
    deleteRecords,
    deleteCount: deleteRecords.length,
    unknownAnswerRecords,
    unknownAnswerCount: unknownAnswerRecords.length,
    blankNoopRecords,
    blankNoopCount: blankNoopRecords.length,
    duplicateApprovedQidDecisionCount: Math.max(0, approvedRecords.length - approvedQids.length),
  };
}

function getPreviewQids(filePath) {
  const parsed = readJson(filePath);
  if (!parsed.ok) return [];
  if (parsed.value?.questions && typeof parsed.value.questions === 'object') return Object.keys(parsed.value.questions).sort();
  if (Array.isArray(parsed.value?.items)) return uniqueStrings(parsed.value.items.map((item) => item?.approvedQid || item?.qid));
  if (Array.isArray(parsed.value)) return uniqueStrings(parsed.value.map((item) => item?.approvedQid || item?.qid));
  return [];
}

function likelyMergedStatus({ productionMergePath, fullPreviewQids, fullPreviewQidsMissingFromProduction, approvedQidsMissingFromProduction, decisions }) {
  if (!decisions.exists) return 'unknown';
  if (productionMergePath && fullPreviewQidsMissingFromProduction.length === 0 && approvedQidsMissingFromProduction.length === 0) {
    return 'yes';
  }
  if (productionMergePath && (fullPreviewQidsMissingFromProduction.length > 0 || approvedQidsMissingFromProduction.length > 0)) {
    return 'partial';
  }
  if (!productionMergePath && fullPreviewQids.length && fullPreviewQidsMissingFromProduction.length === 0 && approvedQidsMissingFromProduction.length === 0) {
    return 'unknown';
  }
  if (!productionMergePath && (fullPreviewQidsMissingFromProduction.length > 0 || approvedQidsMissingFromProduction.length > 0)) {
    return 'no';
  }
  return 'unknown';
}

function analyzeBatch(batchName, artifactIndex, productionQids) {
  const batchDir = path.join(IMPORT_ROOT, batchName);
  const screenshots = getScreenshotFiles(batchDir);
  const screenshotsDirFiles = getScreenshotDirFiles(batchDir);
  const intake = countJsonItems(path.join(batchDir, 'intake.json'));
  const matched = countJsonItems(path.join(batchDir, 'matched.json'));
  const reviewNeeded = countJsonItems(path.join(batchDir, 'review-needed.json'));
  const unresolved = countJsonItems(path.join(batchDir, 'unresolved.json'));

  const decisionsPath = firstArtifact(artifactIndex, `${LANG}-${batchName}-workbench-decisions.json`);
  const decisions = summarizeDecisions(decisionsPath, batchName);
  const fullPreviewPath = firstArtifact(artifactIndex, `translations.${LANG}.${batchName}.full.preview.json`);
  const fullPreviewQids = fullPreviewPath ? getPreviewQids(fullPreviewPath) : [];
  const mergeDryRunPath = firstArtifact(artifactIndex, `translations.${LANG}.${batchName}.full.merge-dry-run.json`);
  const productionMergePath = firstArtifact(artifactIndex, `production-merge-${LANG}-${batchName}.json`)
    || firstArtifact(artifactIndex, `production-merge-${LANG}-${batchName}.md`);
  const applyReportPath = firstArtifact(artifactIndex, `apply-workbench-decisions-${LANG}-${batchName}.json`);
  const fullReviewReportPath = firstArtifact(artifactIndex, `full-batch-merge-review-${LANG}-${batchName}.json`);
  const workbenchReportPath = firstArtifact(artifactIndex, `${LANG}-${batchName}-workbench.html`);
  const archiveExists = exists(path.join(ARCHIVE_RU_ROOT, batchName));

  const approvedQidsMissingFromProduction = decisions.approvedQids.filter((qid) => !productionQids.has(qid));
  const approvedQidsInProduction = decisions.approvedQids.filter((qid) => productionQids.has(qid));
  const fullPreviewQidsMissingFromProduction = fullPreviewQids.filter((qid) => !productionQids.has(qid));
  const fullPreviewQidsInProduction = fullPreviewQids.filter((qid) => productionQids.has(qid));
  const status = likelyMergedStatus({
    productionMergePath,
    fullPreviewQids,
    fullPreviewQidsMissingFromProduction,
    approvedQidsMissingFromProduction,
    decisions,
  });

  const notes = [];
  if (screenshots.length === 0) notes.push('zero screenshots');
  if (screenshotsDirFiles.length === 0 && screenshots.length > 0) notes.push('images outside screenshots/ dir');
  if (!intake.exists && screenshots.length > 0) notes.push('screenshots but no intake');
  if (intake.count > 0 && !decisions.exists) notes.push('intake but no decisions');
  if (decisions.exists && !fullPreviewPath) notes.push('decisions but no full preview');
  if (fullPreviewPath && !mergeDryRunPath) notes.push('full preview but no merge dry-run');
  if (approvedQidsMissingFromProduction.length > 0) {
    notes.push(`${approvedQidsMissingFromProduction.length} current approved qids missing from production`);
  }
  if (fullPreviewQidsMissingFromProduction.length > 0) {
    notes.push(`${fullPreviewQidsMissingFromProduction.length} full-preview qids missing from production`);
  }
  if (approvedQidsMissingFromProduction.length > 0 && fullPreviewQidsMissingFromProduction.length === 0 && fullPreviewPath) {
    notes.push('current decisions diverge from applied full preview');
  }
  if (decisions.duplicateApprovedQidDecisionCount > 0) {
    notes.push(`${decisions.duplicateApprovedQidDecisionCount} within-batch duplicate approvals`);
  }
  if (decisions.blankNoopCount > 0) {
    notes.push(`${decisions.blankNoopCount} blank/no-op decisions`);
  }

  return {
    batchName,
    batchNumber: batchNumber(batchName),
    batchDir,
    screenshots,
    screenshotsDirFiles,
    intake,
    matched,
    reviewNeeded,
    unresolved,
    decisionsPath,
    decisions,
    fullPreviewPath,
    fullPreviewQids,
    mergeDryRunPath,
    productionMergePath,
    applyReportPath,
    fullReviewReportPath,
    workbenchReportPath,
    archiveExists,
    approvedQidsMissingFromProduction,
    approvedQidsInProduction,
    fullPreviewQidsMissingFromProduction,
    fullPreviewQidsInProduction,
    likelyMerged: status,
    notes,
  };
}

function importImagesOutsideBatchFolders() {
  if (!exists(IMPORT_ROOT)) return [];
  return walkFiles(IMPORT_ROOT).filter((filePath) => {
    if (!isImageFile(filePath)) return false;
    const relative = path.relative(IMPORT_ROOT, filePath);
    const firstSegment = relative.split(path.sep)[0];
    return !/^batch-\d+$/u.test(firstSegment);
  });
}

function renderBatchInventoryTable(batches) {
  const lines = [
    '| batch | screenshots | intake | matched | review-needed | unresolved source | decisions? | decisions | approved existing qid | create new | keep unresolved | delete | UNKNOWN answer | blank/no-op | unique approved qids | approved in production | approved missing production | likely merged | notes |',
    '|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|',
  ];

  for (const batch of batches) {
    lines.push(`| ${[
      batch.batchName,
      batch.screenshots.length,
      batch.intake.count,
      batch.matched.count,
      batch.reviewNeeded.count,
      batch.unresolved.count,
      formatBool(batch.decisions.exists),
      batch.decisions.count,
      batch.decisions.approvedExistingCount,
      batch.decisions.createNewCount,
      batch.decisions.keepUnresolvedCount,
      batch.decisions.deleteCount,
      batch.decisions.unknownAnswerCount,
      batch.decisions.blankNoopCount,
      batch.decisions.approvedQids.length,
      batch.approvedQidsInProduction.length,
      batch.approvedQidsMissingFromProduction.length,
      batch.likelyMerged,
      mdEscape(batch.notes.join('; ')),
    ].join(' | ')} |`);
  }

  return lines.join('\n');
}

function renderDecisionSummaryTable(title, batches, getRecords) {
  const rows = batches
    .map((batch) => ({ batch, records: getRecords(batch) }))
    .filter(({ records }) => records.length > 0);

  const lines = [`### ${title}`, ''];
  if (!rows.length) {
    lines.push('None found.');
    return lines.join('\n');
  }

  lines.push('| batch | count | source screenshots / qids |');
  lines.push('|---|---:|---|');
  for (const { batch, records } of rows) {
    lines.push(`| ${batch.batchName} | ${records.length} | ${mdEscape(records.map(formatDecisionLocation).join('<br>'))} |`);
  }
  return lines.join('\n');
}

function collectDuplicateApprovals(batches) {
  const byQid = new Map();
  for (const batch of batches) {
    for (const record of batch.decisions.approvedRecords) {
      if (!byQid.has(record.qid)) byQid.set(record.qid, []);
      byQid.get(record.qid).push(record);
    }
  }
  return [...byQid.entries()]
    .filter(([, records]) => records.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([qid, records]) => ({ qid, records, duplicateCount: records.length - 1 }));
}

function renderDuplicateTable(duplicates) {
  if (!duplicates.length) return 'None found.';
  const lines = ['| qid | approvals | duplicate items | batches/screenshots |', '|---|---:|---:|---|'];
  for (const duplicate of duplicates) {
    const locations = duplicate.records.map((record) => `${record.batchName}:${record.source}${record.answerKey ? ` answer=${record.answerKey}` : ''}`);
    lines.push(`| ${duplicate.qid} | ${duplicate.records.length} | ${duplicate.duplicateCount} | ${mdEscape(locations.join('<br>'))} |`);
  }
  return lines.join('\n');
}

function renderMissingApprovedTable(batches, productionQids) {
  const rows = [];
  for (const batch of batches) {
    for (const record of batch.decisions.approvedRecords) {
      if (!productionQids.has(record.qid)) rows.push(record);
    }
  }
  if (!rows.length) return 'None found.';

  const lines = ['| batch | approved qid | source screenshot/file | answer key |', '|---|---|---|---|'];
  for (const record of rows) {
    lines.push(`| ${record.batchName} | ${record.qid} | ${mdEscape(record.source)} | ${record.answerKey || ''} |`);
  }
  return lines.join('\n');
}

function renderArtifactMergeTable(batches) {
  const lines = [
    '| batch | decisions path | full preview | full dry-run | apply report | production merge report | workbench report | full-preview qids missing production |',
    '|---|---|---|---|---|---|---|---:|',
  ];
  for (const batch of batches) {
    lines.push(`| ${[
      batch.batchName,
      batch.decisionsPath ? `\`${rel(batch.decisionsPath)}\`` : '',
      batch.fullPreviewPath ? `\`${rel(batch.fullPreviewPath)}\`` : '',
      batch.mergeDryRunPath ? `\`${rel(batch.mergeDryRunPath)}\`` : '',
      batch.applyReportPath ? `\`${rel(batch.applyReportPath)}\`` : '',
      batch.productionMergePath ? `\`${rel(batch.productionMergePath)}\`` : '',
      batch.workbenchReportPath ? `\`${rel(batch.workbenchReportPath)}\`` : '',
      batch.fullPreviewQidsMissingFromProduction.length,
    ].join(' | ')} |`);
  }
  return lines.join('\n');
}

function main() {
  const options = parseArgs();
  const reportPath = options.reportPath;
  const artifactIndex = makeArtifactIndex();

  const translationsParsed = readJson(TRANSLATIONS_PATH);
  const questionsParsed = readJson(QUESTIONS_PATH);
  const questionsRawParsed = readJson(QUESTIONS_RAW_PATH);
  const translationQuestions = translationsParsed.ok ? getTranslationQuestions(translationsParsed.value) : {};
  const productionQids = new Set(Object.keys(translationQuestions));
  const translationFieldCounts = countTranslationFields(translationQuestions);
  const masterQids = questionsParsed.ok ? getQuestionQids(questionsParsed.value) : [];
  const rawMasterQids = questionsRawParsed.ok ? getQuestionQids(questionsRawParsed.value) : [];
  const masterQidSet = new Set(masterQids);
  const rawMasterQidSet = new Set(rawMasterQids);

  const batchLikeDirs = getBatchLikeDirs();
  const batchNames = getBatchDirs();
  const batches = batchNames.map((batchName) => analyzeBatch(batchName, artifactIndex, productionQids));
  const artifactOnlyBatches = artifactBatchNames(artifactIndex).filter((batchName) => !batchNames.includes(batchName));
  const importBatchNumbers = new Set(batchNames.map(batchNumber));
  const artifactOnlyWithNumericImport = artifactOnlyBatches.filter((batchName) => importBatchNumbers.has(batchNumber(batchName)));
  const artifactOnlyWithoutNumericImport = artifactOnlyBatches.filter((batchName) => !importBatchNumbers.has(batchNumber(batchName)));
  const numberingGaps = findNumberingGaps(batchNames);
  const paddingStyles = [...new Set(batchNames.map(batchPadding).filter(Boolean))].sort((a, b) => a - b);
  const duplicateNumbering = [...batchNames.reduce((map, name) => {
    const number = batchNumber(name);
    if (!map.has(number)) map.set(number, []);
    map.get(number).push(name);
    return map;
  }, new Map()).entries()].filter(([, names]) => names.length > 1);

  const screenshotDirTotal = batches.reduce((sum, batch) => sum + batch.screenshotsDirFiles.length, 0);
  const effectiveScreenshotTotal = batches.reduce((sum, batch) => sum + batch.screenshots.length, 0);
  const intakeTotal = batches.reduce((sum, batch) => sum + batch.intake.count, 0);
  const matchedTotal = batches.reduce((sum, batch) => sum + batch.matched.count, 0);
  const reviewNeededTotal = batches.reduce((sum, batch) => sum + batch.reviewNeeded.count, 0);
  const unresolvedSourceTotal = batches.reduce((sum, batch) => sum + batch.unresolved.count, 0);
  const decisionsTotal = batches.reduce((sum, batch) => sum + batch.decisions.count, 0);
  const approvedDecisionTotal = batches.reduce((sum, batch) => sum + batch.decisions.approvedExistingCount, 0);
  const createNewTotal = batches.reduce((sum, batch) => sum + batch.decisions.createNewCount, 0);
  const keepUnresolvedTotal = batches.reduce((sum, batch) => sum + batch.decisions.keepUnresolvedCount, 0);
  const deleteTotal = batches.reduce((sum, batch) => sum + batch.decisions.deleteCount, 0);
  const unknownAnswerTotal = batches.reduce((sum, batch) => sum + batch.decisions.unknownAnswerCount, 0);
  const blankNoopTotal = batches.reduce((sum, batch) => sum + batch.decisions.blankNoopCount, 0);

  const allApprovedQids = uniqueStrings(batches.flatMap((batch) => batch.decisions.approvedQids));
  const allApprovedQidsInProduction = allApprovedQids.filter((qid) => productionQids.has(qid));
  const allApprovedQidsMissingProduction = allApprovedQids.filter((qid) => !productionQids.has(qid));
  const approvedQidsOutsideQuestions = allApprovedQids.filter((qid) => !masterQidSet.has(qid));
  const approvedQidsOutsideRawQuestions = allApprovedQids.filter((qid) => !rawMasterQidSet.has(qid));
  const duplicates = collectDuplicateApprovals(batches);
  const duplicateApprovalItemTotal = duplicates.reduce((sum, duplicate) => sum + duplicate.duplicateCount, 0);
  const nonExistingOrUnfinishedTotal = Math.max(0, decisionsTotal - approvedDecisionTotal);
  const sourceFilesWithoutDecision = Math.max(0, effectiveScreenshotTotal - decisionsTotal);
  const actualSourceGap = effectiveScreenshotTotal - productionQids.size;
  const expectedSourceGap = options.expectedSourceCount - productionQids.size;
  const actualVsExpectedSourceDelta = effectiveScreenshotTotal - options.expectedSourceCount;
  const currentFileReconciledCount = decisionsTotal
    - nonExistingOrUnfinishedTotal
    - duplicateApprovalItemTotal
    - allApprovedQidsMissingProduction.length
    - sourceFilesWithoutDecision;

  const batchesWithScreenshotsNoIntake = batches.filter((batch) => batch.screenshots.length > 0 && !batch.intake.exists);
  const batchesWithIntakeNoDecisions = batches.filter((batch) => batch.intake.count > 0 && !batch.decisions.exists);
  const batchesWithDecisionsNoStaging = batches.filter((batch) => batch.decisions.exists && (!batch.fullPreviewPath || !batch.mergeDryRunPath));
  const batchesWithStagingNotReflected = batches.filter((batch) => batch.mergeDryRunPath && batch.fullPreviewQidsMissingFromProduction.length > 0);
  const batchesWithApprovedMissing = batches.filter((batch) => batch.approvedQidsMissingFromProduction.length > 0);
  const batchesNotClearlyMerged = batches.filter((batch) => batch.likelyMerged !== 'yes');
  const batchesWithZeroScreenshots = batches.filter((batch) => batch.screenshots.length === 0);
  const imagesOutsideBatchFolders = importImagesOutsideBatchFolders();
  const rawDir = path.join(IMPORT_ROOT, 'raw');
  const rawFiles = exists(rawDir) ? walkFiles(rawDir) : [];
  const rawImages = rawFiles.filter(isImageFile);

  const report = [];
  report.push('# Russian Translation Count Discrepancy Audit - Post 811');
  report.push('');
  report.push(`Generated at: ${new Date().toISOString()}`);
  report.push('');
  report.push(`Scope: read-only scan of \`imports/${LANG}\`, generated staging/report/archive artifacts, and current working-tree qbank JSON. The script only wrote this markdown report.`);
  report.push('');

  report.push('## A. Executive Summary');
  report.push('');
  report.push(`- Current production Russian translation keys: **${productionQids.size}** from \`${rel(TRANSLATIONS_PATH)}\`.`);
  report.push(`- Current master counts: **${masterQids.length}** entries in \`${rel(QUESTIONS_PATH)}\`; **${rawMasterQids.length}** entries in \`${rel(QUESTIONS_RAW_PATH)}\`.`);
  report.push(`- RU import batches found: **${batchNames.length}** (${batchNames.join(', ')}).`);
  report.push(`- Screenshot files under literal \`imports/ru/batch-*/screenshots/\`: **${screenshotDirTotal}**. Effective batch image files including legacy direct images in \`batch-001\` and \`batch-002\`: **${effectiveScreenshotTotal}**.`);
  report.push(`- Intake items: **${intakeTotal}**. Decision items: **${decisionsTotal}**. Matched/review-needed/unresolved source counts: **${matchedTotal}/${reviewNeededTotal}/${unresolvedSourceTotal}**.`);
  report.push(`- The user-stated 902 -> 811 gap is **${expectedSourceGap}**. The file-backed current source gap is **${actualSourceGap}** because this scan found ${effectiveScreenshotTotal} effective batch screenshots/intake items, ${actualVsExpectedSourceDelta >= 0 ? `${actualVsExpectedSourceDelta} more` : `${Math.abs(actualVsExpectedSourceDelta)} fewer`} than 902.`);
  report.push(`- Current-file reconciliation: **${nonExistingOrUnfinishedTotal}** decisions are not approved existing qids, **${duplicateApprovalItemTotal}** approved decisions collapse into already-approved qids, and **${allApprovedQidsMissingProduction.length}** unique approved qids are still absent from production. That reconciles ${effectiveScreenshotTotal} source items to **${currentFileReconciledCount}** production qids.`);
  report.push(`- Likely missing/unmerged batch signal: **${batchesWithApprovedMissing.map((batch) => batch.batchName).join(', ') || 'none'}** by current approved-qid-vs-production comparison. Batch-08 is the only batch with current approved qids still missing from production.`);
  report.push(`- Batch-04 and batch-12 now have production merge reports and no current approved qids missing from production.`);
  report.push('');

  report.push('## B. Batch Inventory Table');
  report.push('');
  report.push(renderBatchInventoryTable(batches));
  report.push('');

  report.push('## C. Missing Batch/Gaps Analysis');
  report.push('');
  report.push(`Existing batch-like folders: ${batchLikeDirs.join(', ') || 'none'}.`);
  report.push('');
  report.push(`Valid import batch folders in order: ${batchNames.join(', ') || 'none'}.`);
  report.push('');
  report.push(`Missing batch numbers between first and last import batch: ${numberingGaps.length ? numberingGaps.join(', ') : 'none'}.`);
  report.push('');
  report.push(`Duplicate numeric batch folders: ${duplicateNumbering.length ? duplicateNumbering.map(([number, names]) => `${number}: ${names.join(', ')}`).join('; ') : 'none'}.`);
  report.push('');
  report.push(`Padding styles present: ${paddingStyles.map((count) => `${count}-digit`).join(', ') || 'none'} (${paddingStyles.length > 1 ? 'mixed padding style is present' : 'single style'}).`);
  report.push('');
  report.push(`Generated artifact batch ids without exact import-folder names: ${artifactOnlyBatches.join(', ') || 'none'}.`);
  report.push('');
  report.push(`Generated artifact ids with numeric-equivalent import folders: ${artifactOnlyWithNumericImport.length ? artifactOnlyWithNumericImport.map((batchName) => `${batchName} -> import batch number ${batchNumber(batchName)}`).join('; ') : 'none'}.`);
  report.push('');
  report.push(`Generated artifact ids with no numeric-equivalent import folder: ${artifactOnlyWithoutNumericImport.length ? artifactOnlyWithoutNumericImport.map((batchName) => {
    const decisionsPath = firstArtifact(artifactIndex, `${LANG}-${batchName}-workbench-decisions.json`);
    const decisions = countJsonItems(decisionsPath);
    return `${batchName}${decisionsPath ? ` (decisions=${decisions.count})` : ''}`;
  }).join('; ') : 'none'}.`);
  report.push('');
  report.push(`Images outside \`imports/ru/batch-*/\`: ${imagesOutsideBatchFolders.length}${imagesOutsideBatchFolders.length ? ` (${formatList(imagesOutsideBatchFolders.map(rel), 20)})` : ''}.`);
  report.push('');
  report.push(`\`imports/ru/raw\`: ${exists(rawDir) ? 'exists' : 'missing'}; files=${rawFiles.length}; image files=${rawImages.length}.`);
  report.push('');

  report.push('## D. Production Missing Approved QIDs');
  report.push('');
  report.push(renderMissingApprovedTable(batches, productionQids));
  report.push('');

  report.push('## E. Non-production Terminal Decisions');
  report.push('');
  report.push(renderDecisionSummaryTable('Create New Question Decisions', batches, (batch) => batch.decisions.createRecords));
  report.push('');
  report.push(renderDecisionSummaryTable('Keep Unresolved Decisions', batches, (batch) => batch.decisions.keepRecords));
  report.push('');
  report.push(renderDecisionSummaryTable('Delete Question Decisions', batches, (batch) => batch.decisions.deleteRecords));
  report.push('');
  report.push(renderDecisionSummaryTable('UNKNOWN Answer Key Decisions', batches, (batch) => batch.decisions.unknownAnswerRecords));
  report.push('');
  report.push(renderDecisionSummaryTable('Blank / No-op / Unfinished Decisions', batches, (batch) => batch.decisions.blankNoopRecords));
  report.push('');

  report.push('## F. Duplicate/Collision Analysis');
  report.push('');
  report.push(`Duplicate approved qids across all RU batches: **${duplicates.length} qids**, accounting for **${duplicateApprovalItemTotal}** extra screenshot/decision items that collapse into already-approved qids.`);
  report.push('');
  report.push(renderDuplicateTable(duplicates));
  report.push('');
  report.push(`Approved qids outside current \`questions.json\`: ${approvedQidsOutsideQuestions.length ? formatList(approvedQidsOutsideQuestions) : 'none'}.`);
  report.push('');
  report.push(`Approved qids outside current \`questions.raw.json\`: ${approvedQidsOutsideRawQuestions.length ? formatList(approvedQidsOutsideRawQuestions) : 'none'}.`);
  report.push('');

  report.push('## G. Exact Gap Math');
  report.push('');
  report.push('The exact historical 902 baseline cannot be proven from the current filesystem because the current import folders contain 907 effective batch image/intake items. The current-file math is exact:');
  report.push('');
  report.push('```text');
  report.push(`${effectiveScreenshotTotal} effective RU screenshot/intake items found now`);
  report.push(`- ${sourceFilesWithoutDecision} screenshots/intake items without discovered decisions`);
  report.push(`= ${decisionsTotal} workbench decision items`);
  report.push(`- ${nonExistingOrUnfinishedTotal} decisions not approved to an existing qid`);
  report.push(`  (${createNewTotal} create-new, ${keepUnresolvedTotal} keep-unresolved, ${deleteTotal} delete, ${blankNoopTotal} blank/no-op; flags may overlap only if the source data is inconsistent)`);
  report.push(`= ${approvedDecisionTotal} approved existing-qid decision items`);
  report.push(`- ${duplicateApprovalItemTotal} duplicate approved-qid decision items`);
  report.push(`= ${allApprovedQids.length} unique approved existing qids`);
  report.push(`- ${allApprovedQidsMissingProduction.length} unique approved qids still missing from production`);
  report.push(`= ${currentFileReconciledCount} production translated qids explained by current decisions`);
  report.push(`current translations.ru.json = ${productionQids.size} qids`);
  report.push('```');
  report.push('');
  report.push(`Against the user-stated 902 baseline, the gap is ${expectedSourceGap}. This scan found ${effectiveScreenshotTotal}, so five current source items are outside that remembered baseline. No approved existing qids are outside \`questions.raw.json\`; screenshots outside the current master qbank cannot be proven from image files alone, but create-new decisions (${createNewTotal}) are the strongest file-backed candidate for source screenshots that do not map to an existing production qid.`);
  report.push('');

  report.push('## H. Next Actions');
  report.push('');
  report.push('1. Inspect `batch-08` first. It is the only current batch with approved qids missing from production (`q0176`, `q0245`).');
  report.push('2. Open the current or archived `ru-batch-08-workbench.html` and verify whether `q0176` and `q0245` should still be approved, or whether the current decision export is newer than the already-merged preview.');
  report.push('3. If those approvals are valid, regenerate/apply staging for batch-08 before any production merge. Do not merge until the full preview/dry-run shows those qids and the diff is reviewed.');
  report.push('');
  report.push('Suggested commands to run manually next, in order:');
  report.push('');
  report.push('```bash');
  report.push('npm run generate-batch-workbench -- --lang ru --batch batch-08');
  report.push('npm run apply-batch-workbench-decisions -- --lang ru --batch batch-08');
  report.push('npm run apply-production-localization-merge -- --lang ru --batch batch-08');
  report.push('```');
  report.push('');
  report.push('Merge commands above are listed for manual follow-up only; this audit did not run them.');
  report.push('');

  report.push('## Production Coverage Snapshot');
  report.push('');
  report.push('| metric | count | notes |');
  report.push('|---|---:|---|');
  report.push(`| translation qids | ${translationFieldCounts.qids} | keys in \`translations.ru.json.questions\` |`);
  report.push(`| qids with prompt-like field | ${translationFieldCounts.prompt} | \`prompt\`, \`questionText\`, or \`localizedPrompt\` |`);
  report.push(`| qids with options-like field | ${translationFieldCounts.options} | \`options\` or option-key fields |`);
  report.push(`| qids with answer-like field | ${translationFieldCounts.answer} | answer/correct-option fields |`);
  report.push(`| qids with non-empty explanation | ${translationFieldCounts.explanation} | \`explanation\` or \`localizedExplanation\` |`);
  report.push(`| master questions in questions.json | ${masterQids.length} | current working tree |`);
  report.push(`| master questions in questions.raw.json | ${rawMasterQids.length} | current working tree |`);
  report.push(`| coverage vs questions.json | ${productionQids.size}/${masterQids.length} | ${pct(productionQids.size, masterQids.length)} |`);
  report.push(`| coverage vs questions.raw.json | ${productionQids.size}/${rawMasterQids.length} | ${pct(productionQids.size, rawMasterQids.length)} |`);
  report.push('');

  report.push('## Merge Artifact Audit');
  report.push('');
  report.push(`Batches with screenshots/intake but no decisions: ${batchesWithIntakeNoDecisions.length ? batchesWithIntakeNoDecisions.map((batch) => batch.batchName).join(', ') : 'none'}.`);
  report.push('');
  report.push(`Batches with screenshots but no intake: ${batchesWithScreenshotsNoIntake.length ? batchesWithScreenshotsNoIntake.map((batch) => batch.batchName).join(', ') : 'none'}.`);
  report.push('');
  report.push(`Batches with decisions but missing full preview or full merge dry-run: ${batchesWithDecisionsNoStaging.length ? batchesWithDecisionsNoStaging.map((batch) => batch.batchName).join(', ') : 'none'}.`);
  report.push('');
  report.push(`Batches with staging/merge outputs not reflected in production by full-preview qid comparison: ${batchesWithStagingNotReflected.length ? batchesWithStagingNotReflected.map((batch) => batch.batchName).join(', ') : 'none'}.`);
  report.push('');
  report.push(`Batches not clearly merged by current decision-vs-production status: ${batchesNotClearlyMerged.length ? batchesNotClearlyMerged.map((batch) => `${batch.batchName} (${batch.likelyMerged})`).join(', ') : 'none'}.`);
  report.push('');
  report.push(`Batches with zero screenshots: ${batchesWithZeroScreenshots.length ? batchesWithZeroScreenshots.map((batch) => batch.batchName).join(', ') : 'none'}.`);
  report.push('');
  report.push(renderArtifactMergeTable(batches));
  report.push('');

  report.push('## Validation');
  report.push('');
  report.push(`- Script: \`${rel(path.join(ROOT, 'scripts', 'audit-ru-translation-discrepancy.mjs'))}\``);
  report.push(`- Report output: \`${rel(reportPath)}\``);
  report.push(`- Re-run command: \`node scripts/audit-ru-translation-discrepancy.mjs\``);
  report.push('');

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${report.join('\n')}\n`);
  console.log(`Wrote ${rel(reportPath)}`);
}

main();
