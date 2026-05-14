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
const STORAGE_KEY = "expatise:fr-wrapup-workbench:v1";
const SOURCE_AUDIT_REL = "qbank-tools/generated/reports/fr-final-fast-audit.json";
const SOURCE_AUDIT_PATH = path.join(process.cwd(), SOURCE_AUDIT_REL);
const OUTPUT_HTML_PATH = path.join(REPORTS_DIR, "fr-wrapup-workbench.html");
const OUTPUT_JSON_PATH = path.join(REPORTS_DIR, "fr-wrapup-workbench.json");
const OUTPUT_DECISIONS_PATH = path.join(STAGING_DIR, "fr-wrapup-workbench-decisions.json");

const DECISION_OPTIONS = ["approveExistingQid", "createNewQuestion", "keepUnresolved", "deleteQuestion"];
const ANSWER_KEY_OPTIONS = ["", "A", "B", "C", "D", "UNKNOWN"];

function toPosix(value) {
  return String(value ?? "").split(path.sep).join("/");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function asList(doc) {
  if (Array.isArray(doc)) return doc;
  for (const key of ["items", "questions", "reviewNeeded", "review_needed", "unresolved", "matched", "matches"]) {
    if (Array.isArray(doc?.[key])) return doc[key];
  }
  return [];
}

function listFiles(dir, predicate) {
  if (!fileExists(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function listBatchDirs() {
  const frDir = path.join(IMPORTS_DIR, LANG);
  if (!fileExists(frDir)) return [];
  return fs
    .readdirSync(frDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^batch-\d+$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function cleanItemId(value) {
  return String(value ?? "")
    .trim()
    .replace(/^(auto-matched|review-needed|answer-key|unresolved|preserved):/, "");
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^q\d{4}$/i.test(text)) return text.toLowerCase();
  const digits = text.match(/\d{1,4}/)?.[0];
  return digits ? `q${digits.padStart(4, "0")}` : text;
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return ANSWER_KEY_OPTIONS.includes(text) ? text || null : text || null;
}

function decisionAction(decision) {
  const explicit = String(decision?.decision ?? decision?.action ?? "").trim();
  if (DECISION_OPTIONS.includes(explicit)) return explicit;
  if (decision?.deleteQuestion === true) return "deleteQuestion";
  if (decision?.createNewQuestion === true) return "createNewQuestion";
  if (decision?.keepUnresolved === true) return "keepUnresolved";
  if (decision?.approvedQid) return "approveExistingQid";
  return null;
}

function localAnswerKey(decision) {
  return normalizeAnswerKey(
    decision?.localAnswerKey ??
      decision?.confirmedCorrectOptionKey ??
      decision?.newQuestionLocalAnswerKey ??
      decision?.currentStagedLocaleCorrectOptionKey ??
      null,
  );
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
    record?.correctKeyRaw,
    record?.correctAnswerRaw,
  ].filter(Boolean).length;
}

function relFromReports(absPath) {
  return absPath ? toPosix(path.relative(REPORTS_DIR, absPath)) : null;
}

function sourceScreenshotAbs(batch, sourceImage) {
  if (!batch || !sourceImage) return null;
  return path.isAbsolute(sourceImage) ? sourceImage : path.join(IMPORTS_DIR, LANG, batch, sourceImage);
}

function sourceScreenshotPath(batch, sourceImage) {
  return relFromReports(sourceScreenshotAbs(batch, sourceImage));
}

function qbankAssetAbs(assetSrc) {
  if (!assetSrc) return null;
  if (path.isAbsolute(assetSrc) && !String(assetSrc).startsWith("/qbank/")) return assetSrc;
  const clean = String(assetSrc).replace(/^\//, "");
  return clean.startsWith("qbank/")
    ? path.join(process.cwd(), "public", clean)
    : path.join(process.cwd(), clean);
}

function qbankAssetPath(assetSrc) {
  return relFromReports(qbankAssetAbs(assetSrc));
}

function indexSources() {
  const sourceByKey = new Map();
  for (const batch of listBatchDirs()) {
    const batchDir = path.join(IMPORTS_DIR, LANG, batch);
    for (const fileName of ["intake.json", "matched.json", "review-needed.json", "unresolved.json"]) {
      const filePath = path.join(batchDir, fileName);
      if (!fileExists(filePath)) continue;
      for (const record of asList(readJson(filePath))) {
        const id = cleanItemId(record.itemId ?? record.id ?? record.sourceImage);
        if (!id) continue;
        const key = `${batch}::${id}`;
        const prior = sourceByKey.get(key);
        if (!prior || richScore(record) > richScore(prior.record)) {
          sourceByKey.set(key, { batch, fileName, record });
        }
      }
    }
  }
  return sourceByKey;
}

function indexDecisions() {
  const decisionByKey = new Map();
  const decisionRows = [];
  const files = listFiles(STAGING_DIR, (name) => /^fr-batch-\d+-workbench-decisions\.json$/.test(name));
  for (const filePath of files) {
    const batch = path.basename(filePath).match(/^fr-(batch-\d+)-/)?.[1];
    if (!batch) continue;
    for (const item of asList(readJson(filePath))) {
      const sourceId = cleanItemId(item.itemId ?? item.id ?? item.sourceImage ?? item.sourceId);
      if (!sourceId) continue;
      const row = { batch, filePath, sourceId, item };
      decisionByKey.set(`${batch}::${sourceId}`, row);
      decisionRows.push(row);
    }
  }
  return { decisionByKey, decisionRows, files };
}

function extractCandidateQids(...records) {
  const qids = [];
  for (const record of records) {
    if (!record) continue;
    const direct = record.topCandidateQids ?? record.candidateQids;
    if (Array.isArray(direct)) qids.push(...direct.map(normalizeQid));
    for (const key of ["topCandidates", "candidates", "matches"]) {
      if (Array.isArray(record[key])) {
        qids.push(...record[key].map((candidate) => normalizeQid(candidate?.qid ?? candidate?.id ?? candidate?.approvedQid)));
      }
    }
    qids.push(normalizeQid(record.initialSuggestedQid));
    qids.push(normalizeQid(record.approvedQid));
    qids.push(normalizeQid(record.qid));
  }
  return uniq(qids).slice(0, 8);
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

function answerKeyForQuestion(question) {
  if (question?.correctAnswer?.correctOptionKey) {
    return question.correctAnswer.correctOptionKey;
  }
  if (question?.correctAnswer?.correctRow) {
    return question.correctAnswer.correctRow === "R" ? "Right" : question.correctAnswer.correctRow === "W" ? "Wrong" : question.correctAnswer.correctRow;
  }
  if (question?.correctAnswer?.answerRaw) {
    return question.correctAnswer.answerRaw;
  }
  const options = Array.isArray(question?.options) ? question.options : [];
  if (question?.correctOptionId) {
    const option = options.find((candidate) => candidate.id === question.correctOptionId);
    if (option?.originalKey) return option.originalKey;
  }
  const raw = String(question?.answerRaw ?? "").trim();
  if (/^[A-D]$/i.test(raw)) return raw.toUpperCase();
  if (/right/i.test(raw)) return "Right";
  if (/wrong/i.test(raw)) return "Wrong";
  return question?.correctRow ?? null;
}

function buildQuestionMaps() {
  const context = loadQbankContext({ dataset: DEFAULT_DATASET, referenceLang: "ko" });
  const byQid = {};
  for (const question of context.questions ?? []) {
    const qid = normalizeQid(question.qid ?? question.id);
    if (!qid) continue;
    const tagRecord = context.imageTags?.[qid] ?? null;
    const imageSrc = question.image?.currentAssetSrc ??
      question.image?.assetSrcs?.[0] ??
      question.image?.assets?.find?.((asset) => asset?.src)?.src ??
      question.image?.src ??
      question.assets?.find?.((asset) => asset?.src)?.src ??
      tagRecord?.assetSrcs?.[0] ??
      null;
    byQid[qid] = {
      qid,
      number: question.number ?? null,
      type: question.type ?? null,
      prompt: question.prompt ?? null,
      options: (question.options ?? []).map((option) => ({
        key: option.originalKey ?? option.key ?? null,
        text: option.text ?? null,
      })),
      answerKey: answerKeyForQuestion(question),
      imagePath: qbankAssetPath(imageSrc),
      imageTags: tagRecord
        ? {
            colors: tagRecord.colorTags ?? [],
            objects: tagRecord.objectTags ?? [],
          }
        : null,
    };
  }
  return byQid;
}

function isAnswerKeyIssue(action, key, item) {
  if (action === "deleteQuestion" || action === "keepUnresolved") return false;
  if (item?.answerKeyUnknown === true) return true;
  if (String(key ?? "").toUpperCase() === "UNKNOWN") return true;
  return (action === "approveExistingQid" || action === "createNewQuestion") && !key;
}

function isHighRiskManual(action, note) {
  if (action === "deleteQuestion") return false;
  const text = String(note ?? "");
  if (!/high-risk/i.test(text)) return false;
  if (/duplicate|reuse|hard-locked|already used|manual-reviewed/i.test(text)) return false;
  return true;
}

function qidsFromText(value) {
  return [...String(value ?? "").matchAll(/\bq\d{4}\b/gi)].map((match) => normalizeQid(match[0]));
}

function confidenceFromRisk(value) {
  const risk = String(value ?? "").toLowerCase();
  if (risk === "low") return "high";
  if (risk === "medium") return "medium";
  if (risk === "high") return "low";
  return "medium";
}

function normalizeActionToken(value) {
  const lower = String(value ?? "").toLowerCase();
  if (lower === "approveexistingqid") return "approveExistingQid";
  if (lower === "createnewquestion") return "createNewQuestion";
  if (lower === "keepunresolved") return "keepUnresolved";
  if (lower === "deletequestion") return "deleteQuestion";
  return null;
}

function parseCodexNote(note) {
  const text = String(note ?? "");
  const direct = text.match(/Codex\s+(low|medium|high)-risk\s+(approveExistingQid|createNewQuestion|keepUnresolved|deleteQuestion)\s*:/i);
  if (direct) {
    return {
      action: normalizeActionToken(direct[2]),
      confidence: confidenceFromRisk(direct[1]),
      risk: direct[1].toLowerCase(),
      qid: qidsFromText(text)[0] ?? null,
      reason: text,
    };
  }

  if (/delete question|deleteQuestion|junk|duplicate screenshot|ui artifact|not a real question/i.test(text)) {
    return { action: "deleteQuestion", confidence: "medium", risk: "medium", qid: null, reason: text };
  }
  if (/create new|createNewQuestion|no exact master|no existing master|no safe existing|not matched by top|not represented/i.test(text)) {
    return { action: "createNewQuestion", confidence: /high-risk/i.test(text) ? "low" : "medium", risk: /high-risk/i.test(text) ? "high" : "medium", qid: null, reason: text };
  }
  if (/keep unresolved|keepUnresolved|unresolved|manual|human verification|ambiguous|unclear|conflict|cannot confidently|insufficient confidence|do not approve/i.test(text)) {
    return { action: "keepUnresolved", confidence: /high-risk/i.test(text) ? "low" : "medium", risk: /high-risk/i.test(text) ? "high" : "medium", qid: qidsFromText(text)[0] ?? null, reason: text };
  }
  if (/approveExistingQid|matches?\s+q\d{4}|match(?:es|ed)?\s+q\d{4}/i.test(text)) {
    return { action: "approveExistingQid", confidence: /high-risk/i.test(text) ? "low" : "medium", risk: /high-risk/i.test(text) ? "high" : "medium", qid: qidsFromText(text)[0] ?? null, reason: text };
  }
  return { action: null, confidence: "medium", risk: null, qid: qidsFromText(text)[0] ?? null, reason: text };
}

function recommendationLabel(action) {
  if (action === "approveExistingQid") return "Approve";
  if (action === "createNewQuestion") return "Create new question";
  if (action === "keepUnresolved") return "Keep unresolved";
  if (action === "deleteQuestion") return "Delete question";
  return "Review needed";
}

function deriveRecommendation(item) {
  const noteSignal = parseCodexNote(item.reviewerNotes);
  const noteQid = noteSignal.qid;
  const stagedQid = normalizeQid(item.approvedQid);
  const candidateQid = normalizeQid(noteQid ?? stagedQid ?? item.candidateQids?.[0]);
  const currentKey = normalizeAnswerKey(item.localAnswerKey);
  const inferredKey = currentKey ?? "UNKNOWN";
  const hasSafeKey = inferredKey !== "UNKNOWN";
  const note = String(item.reviewerNotes ?? "");

  let action = noteSignal.action;
  if (!action) {
    if (item.itemType === "createNewQuestion") action = "createNewQuestion";
    else if (item.itemType === "keepUnresolved") action = "keepUnresolved";
    else if (item.currentDecision === "approveExistingQid" && candidateQid) action = "approveExistingQid";
    else if (item.currentDecision === "createNewQuestion") action = "createNewQuestion";
    else if (item.currentDecision === "deleteQuestion") action = "deleteQuestion";
    else action = "keepUnresolved";
  }

  if (action === "approveExistingQid" && !candidateQid) {
    action = "keepUnresolved";
  }

  if (action === "approveExistingQid" && /no exact master|no existing master|no safe existing|not represented/i.test(note)) {
    action = hasSafeKey ? "createNewQuestion" : "keepUnresolved";
  }

  const approvedQid = action === "approveExistingQid" ? candidateQid : null;
  const localAnswerKey = action === "deleteQuestion" ? null : inferredKey;
  const warnings = [];
  if (item.highRisk || noteSignal.risk === "high") warnings.push("high-risk");
  if (action === "approveExistingQid" && stagedQid && approvedQid && stagedQid !== approvedQid) warnings.push("candidate-differs-from-staged");
  if (localAnswerKey === "UNKNOWN") warnings.push("local-key-unknown");
  if (action === "keepUnresolved") warnings.push("no-safe-candidate");
  if (item.itemType === "answerKeyIssue") warnings.push("answer-key-mismatch");

  const keyReason = localAnswerKey === "UNKNOWN"
    ? "Local answer key could not be inferred safely from the staged/source data."
    : `Local key ${localAnswerKey} is taken from the current staged/source key.`;
  const qidReason = approvedQid
    ? `Recommended qid ${approvedQid}${stagedQid && stagedQid !== approvedQid ? ` differs from staged ${stagedQid}` : ""}.`
    : "No existing qid is recommended as a safe approval.";

  return {
    action,
    approvedQid,
    localAnswerKey,
    confidence: noteSignal.confidence,
    reason: [qidReason, keyReason, noteSignal.reason].filter(Boolean).join(" "),
    reviewerNotes: note || `${recommendationLabel(action)} based on available wrap-up evidence.`,
    warnings: uniq(warnings),
  };
}

function makeItem({ itemType, batch, auditItem = {}, decisionRow, sourceByKey, decisionByKey, candidatesByQid }) {
  const sourceId = cleanItemId(auditItem.itemId ?? auditItem.id ?? auditItem.sourceImage ?? decisionRow?.sourceId);
  const decision = decisionRow?.item ?? decisionByKey.get(`${batch}::${sourceId}`)?.item ?? {};
  const source = sourceByKey.get(`${batch}::${sourceId}`)?.record ?? {};
  const sourceImage = auditItem.sourceImage ?? decision.sourceImage ?? source.sourceImage ?? sourceId;
  const screenshotAbs = sourceScreenshotAbs(batch, sourceImage);
  const action = decisionAction(decision) ??
    (itemType === "createNewQuestion" ? "createNewQuestion" : itemType === "keepUnresolved" ? "keepUnresolved" : "keepUnresolved");
  const currentKey = localAnswerKey(decision) ?? normalizeAnswerKey(auditItem.localAnswerKey ?? source.correctKeyRaw);
  const note = decision.reviewerNotes ?? auditItem.reviewerNote ?? "";
  const noteQids = qidsFromText(note);
  const qids = uniq([...noteQids, ...extractCandidateQids(auditItem, decision, source)]).slice(0, 8);

  const item = {
    id: `${itemType}:${batch}:${sourceId}`,
    itemType,
    sourceBatch: batch,
    sourceId,
    sourceScreenshot: sourceImage,
    sourceScreenshotPath: sourceScreenshotPath(batch, sourceImage),
    sourceScreenshotExists: screenshotAbs ? fileExists(screenshotAbs) : false,
    sourcePrompt: auditItem.sourcePrompt ?? source.promptRawJa ?? decision.sourcePrompt ?? null,
    sourcePromptGloss: auditItem.sourcePromptGloss ?? source.promptGlossEn ?? decision.sourcePromptGloss ?? null,
    sourceOptions: sourceOptions(source, auditItem),
    currentDecision: action,
    approvedQid: normalizeQid(decision.approvedQid ?? auditItem.approvedQid ?? qids[0]),
    localAnswerKey: currentKey,
    currentStagedKey: currentKey,
    answerKeyUnknown: decision.answerKeyUnknown === true || String(currentKey ?? "").toUpperCase() === "UNKNOWN",
    candidateQids: qids,
    candidates: qids.map((qid) => candidatesByQid[qid] ?? { qid, missing: true }),
    topic: decision.newQuestionProvisionalTopic ?? auditItem.topic ?? source.provisionalTopic ?? null,
    subtopics: decision.newQuestionProvisionalSubtopics ?? auditItem.subtopics ?? source.provisionalSubtopics ?? [],
    reviewerNotes: note,
    highRisk: /high-risk/i.test(note),
  };
  item.recommendation = deriveRecommendation(item);
  return item;
}

function itemToDecision(item) {
  const recommendation = item.recommendation ?? {};
  return {
    itemId: item.id,
    itemType: item.itemType,
    sourceBatch: item.sourceBatch,
    sourceId: item.sourceId,
    sourceScreenshot: item.sourceScreenshot,
    decision: recommendation.action ?? "keepUnresolved",
    approvedQid: recommendation.action === "approveExistingQid" ? recommendation.approvedQid ?? null : null,
    localAnswerKey: recommendation.localAnswerKey ?? null,
    topic: item.topic ?? null,
    subtopics: item.subtopics ?? [],
    reviewerNotes: recommendation.reviewerNotes ?? item.reviewerNotes ?? "",
    explanation: recommendation.reason ?? "",
    reviewed: false,
    reviewedAt: null,
  };
}

function mergeExistingDecisions(base) {
  if (!fileExists(OUTPUT_DECISIONS_PATH)) return base;
  const existing = readJson(OUTPUT_DECISIONS_PATH);
  const byId = new Map(asList(existing).map((item) => [item.itemId, item]));
  const fields = ["decision", "approvedQid", "localAnswerKey", "topic", "subtopics", "reviewerNotes", "explanation", "reviewed", "reviewedAt"];
  return {
    ...base,
    generatedAt: stableNow(),
    items: base.items.map((item) => {
      const prior = byId.get(item.itemId);
      if (!prior || prior.reviewed !== true) return item;
      const merged = { ...item };
      for (const field of fields) {
        if (Object.hasOwn(prior, field)) merged[field] = prior[field];
      }
      return merged;
    }),
  };
}

function buildWorkbench() {
  if (!fileExists(SOURCE_AUDIT_PATH)) {
    throw new Error(`Missing input audit: ${SOURCE_AUDIT_REL}`);
  }
  const audit = readJson(SOURCE_AUDIT_PATH);
  const sourceByKey = indexSources();
  const { decisionByKey, decisionRows, files } = indexDecisions();
  const candidatesByQid = buildQuestionMaps();
  const items = [];
  const seen = new Set();
  const add = (item) => {
    const key = `${item.sourceBatch}::${item.sourceId}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const auditItem of audit.keepUnresolvedItems ?? []) {
    add(makeItem({
      itemType: "keepUnresolved",
      batch: auditItem.batch,
      auditItem,
      sourceByKey,
      decisionByKey,
      candidatesByQid,
    }));
  }

  for (const auditItem of audit.createNewQuestionItems ?? []) {
    add(makeItem({
      itemType: "createNewQuestion",
      batch: auditItem.batch,
      auditItem,
      sourceByKey,
      decisionByKey,
      candidatesByQid,
    }));
  }

  for (const decisionRow of decisionRows) {
    const action = decisionAction(decisionRow.item);
    const key = localAnswerKey(decisionRow.item);
    if (!isAnswerKeyIssue(action, key, decisionRow.item)) continue;
    add(makeItem({
      itemType: "answerKeyIssue",
      batch: decisionRow.batch,
      decisionRow,
      sourceByKey,
      decisionByKey,
      candidatesByQid,
    }));
  }

  for (const decisionRow of decisionRows) {
    const action = decisionAction(decisionRow.item);
    const note = decisionRow.item.reviewerNotes ?? decisionRow.item.reviewerNote ?? "";
    if (!isHighRiskManual(action, note)) continue;
    add(makeItem({
      itemType: "highRiskManual",
      batch: decisionRow.batch,
      decisionRow,
      sourceByKey,
      decisionByKey,
      candidatesByQid,
    }));
  }

  const counts = {
    total: items.length,
    keepUnresolved: items.filter((item) => item.itemType === "keepUnresolved").length,
    createNewQuestion: items.filter((item) => item.itemType === "createNewQuestion").length,
    answerKeyIssue: items.filter((item) => item.itemType === "answerKeyIssue").length,
    highRiskManual: items.filter((item) => item.itemType === "highRiskManual").length,
    duplicateGroups: 0,
    deleteOnly: 0,
    recommendations: {
      approveExistingQid: items.filter((item) => item.recommendation?.action === "approveExistingQid").length,
      createNewQuestion: items.filter((item) => item.recommendation?.action === "createNewQuestion").length,
      keepUnresolved: items.filter((item) => item.recommendation?.action === "keepUnresolved").length,
      deleteQuestion: items.filter((item) => item.recommendation?.action === "deleteQuestion").length,
      unknownLocalAnswerKey: items.filter((item) => item.recommendation?.localAnswerKey === "UNKNOWN").length,
    },
  };
  const screenshots = {
    referenced: items.filter((item) => item.sourceScreenshotPath).length,
    existing: items.filter((item) => item.sourceScreenshotExists).length,
  };
  screenshots.missing = screenshots.referenced - screenshots.existing;

  const decisions = mergeExistingDecisions({
    schemaVersion: 1,
    lang: LANG,
    workbenchType: "fr-wrapup",
    generatedAt: stableNow(),
    sourceAudit: SOURCE_AUDIT_REL,
    items: items.map(itemToDecision),
  });

  return {
    schemaVersion: 1,
    lang: LANG,
    workbenchType: "fr-wrapup",
    generatedAt: stableNow(),
    sourceAudit: SOURCE_AUDIT_REL,
    storageKey: STORAGE_KEY,
    outputs: {
      html: toPosix(path.relative(process.cwd(), OUTPUT_HTML_PATH)),
      json: toPosix(path.relative(process.cwd(), OUTPUT_JSON_PATH)),
      decisions: toPosix(path.relative(process.cwd(), OUTPUT_DECISIONS_PATH)),
    },
    inputs: {
      decisionFiles: files.map((filePath) => toPosix(path.relative(process.cwd(), filePath))),
    },
    counts,
    screenshots,
    items,
    decisions,
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
  <title>French Wrap-up Workbench</title>
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
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--serif); }
    .page { width: min(1580px, calc(100vw - 28px)); margin: 22px auto 44px; }
    .hero, .panel, .item { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
    .hero { padding: 24px 28px; margin-bottom: 16px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 3.6vw, 42px); line-height: 1.04; }
    h2 { margin: 0; }
    .muted { color: var(--muted); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 18px; }
    .stat { border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; background: #fcf8f1; }
    .stat strong { display: block; margin-top: 4px; font-size: 24px; }
    .toolbar, .filters, .badges, .tags { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .toolbar { margin-top: 18px; gap: 10px; }
    button, .file-button { border: 0; border-radius: 999px; padding: 10px 14px; font: inherit; cursor: pointer; background: var(--accent); color: #fff; }
    button.secondary, .file-button.secondary, .filter { background: #e8dfd2; color: var(--ink); }
    .filter.active { background: var(--accent); color: #fff; }
    input[type="file"] { display: none; }
    input[type="search"], input[type="text"], select, textarea { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; background: #fffaf2; color: var(--ink); font: inherit; }
    textarea { min-height: 82px; resize: vertical; }
    .panel { padding: 16px; margin-bottom: 16px; }
    .filters { margin-top: 12px; }
    .items { display: grid; gap: 16px; }
    .item { padding: 18px; }
    .item-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
    .pill { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px; background: #f3ede4; color: var(--muted); font-size: 12px; }
    .pill.note { color: var(--note); background: var(--note-soft); border-color: rgba(79, 59, 150, 0.18); }
    .pill.warn { color: var(--warn); background: var(--warn-soft); border-color: rgba(140, 79, 22, 0.18); }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr); gap: 14px; }
    .stack { display: grid; gap: 12px; }
    .box, .candidate { border: 1px solid var(--line); border-radius: 14px; background: #fcf8f1; padding: 12px; }
    .label { margin-bottom: 6px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
    .prompt { font-size: 18px; line-height: 1.35; }
    .gloss { color: var(--muted); margin-top: 6px; line-height: 1.35; }
    .image-frame { border: 1px solid var(--line); border-radius: 14px; background: #eee7dc; min-height: 120px; display: grid; place-items: center; overflow: hidden; margin-bottom: 10px; }
    .image-frame img { display: block; width: 100%; max-height: 330px; object-fit: contain; background: #eee7dc; }
    .options { display: grid; gap: 8px; margin-top: 10px; }
    .option { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; background: #fffdf8; }
    .option .key { color: var(--accent); font-family: var(--mono); font-weight: 700; }
    .candidate-list { display: grid; gap: 10px; }
    .candidate-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 8px; }
    .candidate .prompt { font-size: 16px; }
    .decision-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .decision-grid .wide { grid-column: 1 / -1; }
    .key-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; }
    .status { min-height: 22px; color: var(--muted); font-size: 13px; }
    @media (max-width: 980px) { .grid, .decision-grid, .key-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>French Wrap-up Workbench</h1>
      <p class="muted">Focused finalization pass: unresolved, create-new, answer-key issues, and non-duplicate high-risk manual rows only. Duplicate/reused-qid groups are intentionally excluded.</p>
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
      <input id="search" type="search" placeholder="Search qid, batch, screenshot, prompt, options, or notes">
      <div class="filters" id="filters"></div>
    </section>
    <section class="items" id="items"></section>
  </main>
  <script>
    const WORKBENCH = ${jsonScript(workbench)};
    const INITIAL_DECISIONS = ${jsonScript(workbench.decisions)};
    const STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
    const DECISION_OPTIONS = ${jsonScript(DECISION_OPTIONS)};
    const ANSWER_KEY_OPTIONS = ${jsonScript(ANSWER_KEY_OPTIONS)};
    let activeFilter = "all";
    let query = "";

    function escapeHtml(value) {
      return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function optionTags(values, selected) {
      return values.map((value) => '<option value="' + escapeHtml(value) + '"' + (value === (selected ?? "") ? " selected" : "") + '>' + escapeHtml(value || "blank") + '</option>').join("");
    }
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(INITIAL_DECISIONS);
        const parsed = JSON.parse(raw);
        const incoming = Array.isArray(parsed) ? { items: parsed } : parsed;
        const byId = new Map((incoming.items || []).map((item) => [item.itemId, item]));
        return { ...INITIAL_DECISIONS, items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(byId.get(item.itemId) || {}) })) };
      } catch {
        return structuredClone(INITIAL_DECISIONS);
      }
    }
    let state = loadState();
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function setStatus(text) { document.getElementById("status").textContent = text || ""; }
    function decisionFor(itemId) { return state.items.find((item) => item.itemId === itemId); }
    function imageHtml(path, alt) {
      if (!path) return '<div class="image-frame"><span class="muted">No image</span></div>';
      return '<div class="image-frame"><img src="' + encodeURI(path) + '" alt="' + escapeHtml(alt || "image") + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\\'span\\'),{className:\\'muted\\',textContent:\\'Image unavailable\\'}))"></div>';
    }
    function optionsHtml(options) {
      if (!options || !options.length) return "";
      return '<div class="options">' + options.map((option) => '<div class="option"><div class="key">' + escapeHtml(option.key || "") + '</div><div><div>' + escapeHtml(option.text || "") + '</div>' + (option.gloss ? '<div class="gloss">' + escapeHtml(option.gloss) + '</div>' : '') + '</div></div>').join("") + '</div>';
    }
    function candidateHtml(candidate) {
      if (!candidate || candidate.missing) return '<article class="candidate"><span class="pill warn">' + escapeHtml(candidate?.qid || "missing qid") + '</span><div class="gloss">Candidate not found in master qbank.</div></article>';
      const opts = candidate.options?.length ? optionsHtml(candidate.options) : "";
      const tags = candidate.imageTags ? '<div class="tags">' + [...(candidate.imageTags.colors || []), ...(candidate.imageTags.objects || [])].slice(0, 12).map((tag) => '<span class="pill">' + escapeHtml(tag) + '</span>').join("") + '</div>' : "";
      return '<article class="candidate"><div class="candidate-head"><div class="badges"><span class="pill note">' + escapeHtml(candidate.qid) + '</span><span class="pill">#' + escapeHtml(candidate.number || "") + '</span><span class="pill">' + escapeHtml(candidate.type || "") + '</span><span class="pill">correct ' + escapeHtml(candidate.answerKey || "unknown") + '</span></div><button class="secondary use-qid" data-qid="' + escapeHtml(candidate.qid) + '">Use qid</button></div><div class="prompt">' + escapeHtml(candidate.prompt || "") + '</div>' + imageHtml(candidate.imagePath, candidate.qid) + opts + tags + '</article>';
    }
    function searchText(item) {
      const parts = [item.id, item.itemType, item.sourceBatch, item.sourceId, item.sourcePrompt, item.sourcePromptGloss, item.reviewerNotes, item.approvedQid, item.localAnswerKey];
      for (const option of item.sourceOptions || []) parts.push(option.text, option.gloss);
      for (const candidate of item.candidates || []) parts.push(candidate.qid, candidate.prompt);
      return parts.filter(Boolean).join(" ").toLowerCase();
    }
    function decisionControls(item, decision) {
      return '<div class="decision-grid">' +
        '<label><div class="label">Decision</div><select data-field="decision">' + optionTags(DECISION_OPTIONS, decision.decision) + '</select></label>' +
        '<label><div class="label">Approved qid</div><input data-field="approvedQid" type="text" value="' + escapeHtml(decision.approvedQid || "") + '"></label>' +
        '<div class="wide key-row"><label><div class="label">Local answer key</div><select data-field="localAnswerKey">' + optionTags(ANSWER_KEY_OPTIONS, decision.localAnswerKey || "") + '</select></label>' +
        (item.currentStagedKey ? '<button class="secondary use-current-key" data-key="' + escapeHtml(item.currentStagedKey) + '">Use current staged key ' + escapeHtml(item.currentStagedKey) + '</button>' : '<button class="secondary use-current-key" disabled>No staged key</button>') + '</div>' +
        '<label><div class="label">Topic</div><input data-field="topic" type="text" value="' + escapeHtml(decision.topic || "") + '"></label>' +
        '<label><div class="label">Subtopics</div><input data-field="subtopics" type="text" value="' + escapeHtml((decision.subtopics || []).join(", ")) + '"></label>' +
        '<label class="wide"><div class="label">Reviewer notes</div><textarea data-field="reviewerNotes">' + escapeHtml(decision.reviewerNotes || "") + '</textarea></label>' +
        '<label class="wide"><div class="label">Explanation</div><textarea data-field="explanation">' + escapeHtml(decision.explanation || "") + '</textarea></label>' +
        '<div class="wide"><button class="secondary mark-reviewed">' + (decision.reviewed ? "Update reviewed timestamp" : "Mark reviewed") + '</button> <span class="muted">' + (decision.reviewedAt ? "Reviewed " + escapeHtml(decision.reviewedAt) : "Unreviewed") + '</span></div>' +
        '</div>';
    }
    function itemCard(item) {
      const decision = decisionFor(item.id);
      return '<article class="item" data-item-id="' + escapeHtml(item.id) + '">' +
        '<div class="item-head"><div><h2>' + escapeHtml(item.sourceBatch) + ' / ' + escapeHtml(item.sourceId) + '</h2><div class="muted">' + escapeHtml(item.itemType) + '</div></div>' +
        '<div class="badges"><span class="pill note">' + escapeHtml(item.currentDecision || "no decision") + '</span><span class="pill">key ' + escapeHtml(item.localAnswerKey || "missing") + '</span>' + (item.highRisk ? '<span class="pill warn">high risk</span>' : '') + '</div></div>' +
        '<div class="grid"><div class="stack">' +
        '<div class="box"><div class="label">Source</div>' + imageHtml(item.sourceScreenshotPath, item.sourceId) + '<div class="prompt">' + escapeHtml(item.sourcePrompt || "") + '</div>' + (item.sourcePromptGloss ? '<div class="gloss">' + escapeHtml(item.sourcePromptGloss) + '</div>' : '') + optionsHtml(item.sourceOptions) + '</div>' +
        '<div class="box"><div class="label">Current note</div><div class="gloss">' + escapeHtml(item.reviewerNotes || "") + '</div></div>' +
        '</div><div class="stack">' +
        '<div class="box"><div class="label">Decision</div>' + decisionControls(item, decision) + '</div>' +
        '<div class="box"><div class="label">Recommended qid candidates</div><div class="candidate-list">' + (item.candidates || []).map(candidateHtml).join("") + '</div></div>' +
        '</div></div></article>';
    }
    function itemMatches(item) {
      const decision = decisionFor(item.id);
      if (activeFilter === "reviewed" && !decision?.reviewed) return false;
      if (activeFilter === "unreviewed" && decision?.reviewed) return false;
      if (activeFilter === "unresolved" && item.itemType !== "keepUnresolved") return false;
      if (activeFilter === "create" && item.itemType !== "createNewQuestion") return false;
      if (activeFilter === "answer" && item.itemType !== "answerKeyIssue") return false;
      if (activeFilter === "high" && item.itemType !== "highRiskManual") return false;
      return !query || searchText(item).includes(query);
    }
    function renderStats() {
      const rows = [
        ["Actionable items", WORKBENCH.counts.total],
        ["Unresolved", WORKBENCH.counts.keepUnresolved],
        ["Create new", WORKBENCH.counts.createNewQuestion],
        ["Answer-key issues", WORKBENCH.counts.answerKeyIssue],
        ["High-risk manual", WORKBENCH.counts.highRiskManual],
        ["Screenshots", WORKBENCH.screenshots.existing + " / " + WORKBENCH.screenshots.referenced],
      ];
      document.getElementById("stats").innerHTML = rows.map(([label, value]) => '<div class="stat"><span class="muted">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join("");
    }
    function renderFilters() {
      const reviewed = state.items.filter((item) => item.reviewed).length;
      const filters = [
        ["all", "All", WORKBENCH.counts.total],
        ["unresolved", "Unresolved", WORKBENCH.counts.keepUnresolved],
        ["create", "Create new", WORKBENCH.counts.createNewQuestion],
        ["answer", "Local answer unknown", WORKBENCH.counts.answerKeyIssue],
        ["high", "High-risk", WORKBENCH.counts.highRiskManual],
        ["reviewed", "Reviewed", reviewed],
        ["unreviewed", "Unreviewed", state.items.length - reviewed],
      ];
      document.getElementById("filters").innerHTML = filters.map(([id, label, count]) => '<button class="filter ' + (activeFilter === id ? "active" : "") + '" data-filter="' + id + '">' + escapeHtml(label) + " · " + escapeHtml(count) + '</button>').join("");
    }
    function renderItems() {
      const visible = WORKBENCH.items.filter(itemMatches);
      document.getElementById("items").innerHTML = visible.map(itemCard).join("") || '<section class="panel muted">No matching actionable items.</section>';
    }
    function render() { renderStats(); renderFilters(); renderItems(); }
    document.addEventListener("input", (event) => {
      if (event.target.id === "search") { query = event.target.value.toLowerCase().trim(); renderItems(); return; }
      const field = event.target.dataset.field;
      if (!field) return;
      const decision = decisionFor(event.target.closest(".item")?.dataset.itemId);
      if (!decision) return;
      decision[field] = field === "subtopics" ? event.target.value.split(",").map((v) => v.trim()).filter(Boolean) : event.target.value || null;
      saveState();
      setStatus("Autosaved locally");
    });
    document.addEventListener("click", (event) => {
      const filter = event.target.closest("[data-filter]");
      if (filter) { activeFilter = filter.dataset.filter; render(); return; }
      const useQid = event.target.closest(".use-qid");
      if (useQid) {
        const decision = decisionFor(event.target.closest(".item")?.dataset.itemId);
        if (decision) { decision.decision = "approveExistingQid"; decision.approvedQid = useQid.dataset.qid; saveState(); renderItems(); setStatus("Qid selected"); }
        return;
      }
      const useKey = event.target.closest(".use-current-key");
      if (useKey && !useKey.disabled) {
        const decision = decisionFor(event.target.closest(".item")?.dataset.itemId);
        if (decision) { decision.localAnswerKey = useKey.dataset.key; saveState(); renderItems(); setStatus("Current staged key applied"); }
        return;
      }
      if (event.target.closest(".mark-reviewed")) {
        const decision = decisionFor(event.target.closest(".item")?.dataset.itemId);
        if (decision) { decision.reviewed = true; decision.reviewedAt = new Date().toISOString(); saveState(); render(); setStatus("Marked reviewed"); }
      }
    });
    document.getElementById("export-json").addEventListener("click", () => {
      const payload = { ...state, generatedAt: new Date().toISOString(), workbenchType: "fr-wrapup" };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fr-wrapup-workbench-decisions.json";
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
        state = { ...INITIAL_DECISIONS, items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(byId.get(item.itemId) || {}) })) };
        saveState();
        render();
        setStatus("Imported decisions");
      } catch (error) {
        setStatus("Import failed: " + error.message);
      } finally {
        event.target.value = "";
      }
    });
    document.getElementById("clear-local").addEventListener("click", () => {
      if (!confirm("Clear locally autosaved French wrap-up decisions?")) return;
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

function buildCompactHtml(workbench) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>French Wrap-up Workbench</title>
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
      --bad: #9f2f2f;
      --good: #e5f3eb;
      --shadow: 0 10px 24px rgba(38, 25, 10, 0.07);
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--serif); }
    .page { width: min(1740px, calc(100vw - 24px)); margin: 14px auto 36px; }
    .hero, .toolbar, .item { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
    .hero { padding: 16px 18px; margin-bottom: 10px; display: grid; gap: 10px; }
    h1 { margin: 0; font-size: clamp(25px, 3vw, 36px); line-height: 1.05; }
    h2, h3 { margin: 0; }
    .muted { color: var(--muted); }
    .mono { font-family: var(--mono); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(142px, 1fr)); gap: 8px; }
    .stat { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; background: #fcf8f1; }
    .stat span { color: var(--muted); font-size: 12px; }
    .stat strong { display: block; margin-top: 2px; font-size: 22px; }
    .toolbar { padding: 10px; margin-bottom: 12px; display: grid; gap: 10px; }
    .toolbar-row, .filters, .badges, .key-buttons, .action-buttons { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
    button, .file-button {
      border: 0; border-radius: 999px; padding: 8px 11px; font: inherit; cursor: pointer;
      background: var(--accent); color: #fff;
    }
    button.secondary, .file-button.secondary, .filter, .choice { background: #e8dfd2; color: var(--ink); }
    button.active, .filter.active, .choice.active { background: var(--accent); color: #fff; }
    button.warn.active, .choice.warn.active { background: var(--bad); color: #fff; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    input[type="file"] { display: none; }
    input[type="search"], input[type="text"], select, textarea {
      width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 8px 9px;
      background: #fffaf2; color: var(--ink); font: inherit;
    }
    textarea { min-height: 70px; resize: vertical; }
    .items { display: grid; gap: 10px; }
    .item { padding: 10px; outline: 0; }
    .item.active { box-shadow: 0 0 0 2px rgba(22, 93, 82, 0.28), var(--shadow); }
    .item-head {
      display: flex; justify-content: space-between; gap: 10px; align-items: center;
      margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(216, 206, 193, 0.7);
    }
    .item-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
    .item-title h2 { font-size: 18px; }
    .pill {
      display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px;
      padding: 3px 8px; background: #f3ede4; color: var(--muted); font-size: 12px; line-height: 1.25;
    }
    .pill.note { color: var(--note); background: var(--note-soft); border-color: rgba(79, 59, 150, 0.18); }
    .pill.warn { color: var(--warn); background: var(--warn-soft); border-color: rgba(140, 79, 22, 0.18); }
    .pill.bad { color: #fff; background: var(--bad); border-color: var(--bad); }
    .review-grid { display: grid; grid-template-columns: 250px minmax(0, 1fr) 335px; gap: 10px; align-items: start; }
    .box, .candidate, .decision-panel {
      border: 1px solid var(--line); border-radius: 14px; background: #fcf8f1; padding: 10px;
    }
    .decision-panel { position: sticky; top: 10px; background: #fffaf2; }
    .label { margin-bottom: 5px; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
    .prompt { font-size: 17px; line-height: 1.3; }
    .gloss { color: var(--muted); margin-top: 4px; line-height: 1.3; font-size: 14px; }
    .image-frame {
      border: 1px solid var(--line); border-radius: 12px; background: #eee7dc;
      min-height: 110px; display: grid; place-items: center; overflow: hidden;
    }
    .image-frame img { display: block; width: 100%; max-height: 250px; object-fit: contain; background: #eee7dc; }
    .source-image img { max-height: 310px; }
    .options { display: grid; gap: 6px; margin-top: 8px; }
    .option {
      display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; border: 1px solid var(--line);
      border-radius: 10px; padding: 6px 8px; background: #fffdf8;
    }
    .option.correct, .option.recommended-key { background: var(--good); border-color: rgba(22, 93, 82, 0.28); }
    .option .key { color: var(--accent); font-family: var(--mono); font-weight: 700; }
    .source-candidate { display: grid; gap: 8px; }
    .candidate-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 7px; }
    .candidate .prompt { font-size: 15px; }
    .candidate .image-frame { margin: 7px 0; min-height: 82px; }
    .recommendation {
      border: 1px solid rgba(22, 93, 82, 0.24); border-radius: 12px; background: var(--accent-soft);
      padding: 9px; margin-bottom: 9px;
    }
    .recommendation strong { display: block; margin-bottom: 2px; font-size: 15px; }
    .decision-stack { display: grid; gap: 9px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    details { border-top: 1px solid var(--line); margin-top: 9px; padding-top: 8px; }
    summary { cursor: pointer; color: var(--muted); }
    .details-grid { display: grid; gap: 8px; margin-top: 8px; }
    .status { min-height: 20px; color: var(--muted); font-size: 13px; }
    .shortcuts { color: var(--muted); font-size: 12px; }
    @media (max-width: 1180px) { .review-grid { grid-template-columns: 220px minmax(0, 1fr); } .decision-panel { grid-column: 1 / -1; position: static; } }
    @media (max-width: 760px) { .review-grid, .field-grid { grid-template-columns: 1fr; } .item-head { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1>French Wrap-up Workbench</h1>
        <div class="muted">Decision-first finalization pass. Duplicate/reused-qid groups are excluded.</div>
      </div>
      <div class="stats" id="stats"></div>
    </section>
    <section class="toolbar">
      <div class="toolbar-row">
        <button id="export-json">Export decisions JSON</button>
        <label class="file-button secondary" for="import-json">Import decisions JSON</label>
        <input id="import-json" type="file" accept="application/json,.json">
        <button class="secondary" id="clear-local">Clear local decisions</button>
        <span class="status" id="status"></span>
      </div>
      <input id="search" type="search" placeholder="Search qid, batch, screenshot, prompt, options, or notes">
      <div class="filters" id="filters"></div>
      <div class="shortcuts">Shortcuts apply to the selected card: 1 approve, 2 create, 3 unresolved, 4 delete, A/B/C/D/U key, R reviewed.</div>
    </section>
    <section class="items" id="items"></section>
  </main>
  <script>
    const WORKBENCH = ${jsonScript(workbench)};
    const INITIAL_DECISIONS = ${jsonScript(workbench.decisions)};
    const STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
    const ACTIONS = ${jsonScript(DECISION_OPTIONS)};
    const KEYS = ${jsonScript(ANSWER_KEY_OPTIONS.filter(Boolean))};
    let activeFilter = "all";
    let query = "";
    let activeItemId = null;

    function escapeHtml(value) {
      return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return clone(INITIAL_DECISIONS);
        const parsed = JSON.parse(raw);
        const incoming = Array.isArray(parsed) ? { items: parsed } : parsed;
        const byId = new Map((incoming.items || []).map((item) => [item.itemId, item]));
        return { ...INITIAL_DECISIONS, items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(byId.get(item.itemId) || {}) })) };
      } catch {
        return clone(INITIAL_DECISIONS);
      }
    }
    let state = loadState();
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function decisionFor(itemId) { return state.items.find((item) => item.itemId === itemId); }
    function sourceFor(itemId) { return WORKBENCH.items.find((item) => item.id === itemId); }
    function setStatus(text) { document.getElementById("status").textContent = text || ""; }
    function actionLabel(action) {
      return ({ approveExistingQid: "Approve existing qid", createNewQuestion: "Create new question", keepUnresolved: "Keep unresolved", deleteQuestion: "Delete question" })[action] || "Review";
    }
    function compactAction(action) {
      return ({ approveExistingQid: "Approve", createNewQuestion: "Create", keepUnresolved: "Unresolved", deleteQuestion: "Delete" })[action] || "Review";
    }
    function confidenceLabel(value) { return value || "medium"; }
    function imageHtml(path, alt, className = "") {
      if (!path) return '<div class="image-frame ' + className + '"><span class="muted">No image</span></div>';
      return '<div class="image-frame ' + className + '"><img src="' + encodeURI(path) + '" alt="' + escapeHtml(alt || "image") + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\\'span\\'),{className:\\'muted\\',textContent:\\'Image unavailable\\'}))"></div>';
    }
    function optionsHtml(options, highlightKey, correctKey) {
      if (!options || !options.length) return "";
      return '<div class="options">' + options.map((option) => {
        const isRecommended = highlightKey && option.key === highlightKey;
        const isCorrect = correctKey && option.key === correctKey;
        return '<div class="option ' + (isCorrect ? 'correct ' : '') + (isRecommended ? 'recommended-key' : '') + '"><div class="key">' + escapeHtml(option.key || "") + '</div><div><div>' + escapeHtml(option.text || "") + '</div>' + (option.gloss ? '<div class="gloss">' + escapeHtml(option.gloss) + '</div>' : '') + '</div></div>';
      }).join("") + '</div>';
    }
    function mainCandidate(item) {
      const qid = item.recommendation?.approvedQid || item.approvedQid || item.candidateQids?.[0];
      return item.candidates?.find((candidate) => candidate.qid === qid) || item.candidates?.[0] || null;
    }
    function candidateCard(candidate) {
      if (!candidate || candidate.missing) {
        return '<article class="candidate"><div class="badges"><span class="pill warn">' + escapeHtml(candidate?.qid || "no candidate") + '</span></div><div class="gloss">No safe candidate card available.</div></article>';
      }
      const tags = candidate.imageTags ? [...(candidate.imageTags.colors || []), ...(candidate.imageTags.objects || [])].slice(0, 8).map((tag) => '<span class="pill">' + escapeHtml(tag) + '</span>').join("") : "";
      return '<article class="candidate"><div class="candidate-head"><div class="badges"><span class="pill note">' + escapeHtml(candidate.qid) + '</span><span class="pill">#' + escapeHtml(candidate.number || "") + '</span><span class="pill">' + escapeHtml(candidate.type || "") + '</span><span class="pill">correct ' + escapeHtml(candidate.answerKey || "unknown") + '</span></div><button class="secondary use-qid" data-qid="' + escapeHtml(candidate.qid) + '">Use qid</button></div><div class="prompt">' + escapeHtml(candidate.prompt || "") + '</div>' + imageHtml(candidate.imagePath, candidate.qid) + optionsHtml(candidate.options, null, candidate.answerKey) + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</article>';
    }
    function warningChips(item) {
      return (item.recommendation?.warnings || []).map((warning) => '<span class="pill warn">' + escapeHtml(warning) + '</span>').join("");
    }
    function recommendationText(item) {
      const rec = item.recommendation || {};
      const bits = [actionLabel(rec.action)];
      if (rec.approvedQid) bits.push(rec.approvedQid);
      if (rec.localAnswerKey) bits.push('local key ' + rec.localAnswerKey);
      bits.push('confidence ' + confidenceLabel(rec.confidence));
      return bits.join(' · ');
    }
    function decisionPanel(item, decision) {
      const rec = item.recommendation || {};
      const recKeyDiffers = rec.localAnswerKey && rec.localAnswerKey !== decision.localAnswerKey;
      return '<aside class="decision-panel"><div class="recommendation"><strong>Codex recommendation</strong><div>' + escapeHtml(recommendationText(item)) + '</div><div class="gloss">' + escapeHtml((rec.reason || "").split(". ").slice(0, 2).join(". ")) + '</div></div>' +
        '<div class="decision-stack">' +
        '<div><div class="label">Decision</div><div class="action-buttons">' + ACTIONS.map((action) => '<button class="choice ' + (action === 'deleteQuestion' ? 'warn ' : '') + (decision.decision === action ? 'active' : '') + '" data-action="' + action + '">' + escapeHtml(compactAction(action)) + '</button>').join("") + '</div></div>' +
        '<label><div class="label">Approved qid</div><input data-field="approvedQid" type="text" value="' + escapeHtml(decision.approvedQid || "") + '"></label>' +
        '<div><div class="label">Local answer key</div><div class="key-buttons">' + KEYS.map((key) => '<button class="choice ' + (decision.localAnswerKey === key ? 'active' : '') + (rec.localAnswerKey === key ? ' recommended-key-button' : '') + '" data-key="' + key + '">' + escapeHtml(key) + '</button>').join("") + '</div></div>' +
        (recKeyDiffers ? '<button class="secondary use-recommended-key" data-key="' + escapeHtml(rec.localAnswerKey) + '">Use Codex recommended key ' + escapeHtml(rec.localAnswerKey) + '</button>' : '') +
        (item.currentStagedKey && item.currentStagedKey !== rec.localAnswerKey ? '<button class="secondary use-current-key" data-key="' + escapeHtml(item.currentStagedKey) + '">Use current staged key ' + escapeHtml(item.currentStagedKey) + '</button>' : '') +
        '<button class="mark-reviewed">' + (decision.reviewed ? "Update reviewed" : "Mark reviewed") + '</button>' +
        '<details><summary>More details</summary><div class="details-grid">' +
        '<div class="field-grid"><label><div class="label">Topic</div><input data-field="topic" type="text" value="' + escapeHtml(decision.topic || "") + '"></label><label><div class="label">Subtopics</div><input data-field="subtopics" type="text" value="' + escapeHtml((decision.subtopics || []).join(", ")) + '"></label></div>' +
        '<label><div class="label">Reviewer notes</div><textarea data-field="reviewerNotes">' + escapeHtml(decision.reviewerNotes || "") + '</textarea></label>' +
        '<label><div class="label">Explanation</div><textarea data-field="explanation">' + escapeHtml(decision.explanation || "") + '</textarea></label>' +
        '<div class="gloss">Current staged: ' + escapeHtml(item.currentDecision || "none") + ' · staged qid ' + escapeHtml(item.approvedQid || "none") + ' · staged key ' + escapeHtml(item.currentStagedKey || "none") + '</div>' +
        '</div></details></div></aside>';
    }
    function searchText(item) {
      const parts = [item.id, item.itemType, item.sourceBatch, item.sourceId, item.sourcePrompt, item.sourcePromptGloss, item.reviewerNotes, item.approvedQid, item.localAnswerKey, item.recommendation?.action, item.recommendation?.approvedQid, item.recommendation?.localAnswerKey];
      for (const option of item.sourceOptions || []) parts.push(option.text, option.gloss);
      for (const candidate of item.candidates || []) parts.push(candidate.qid, candidate.prompt);
      return parts.filter(Boolean).join(" ").toLowerCase();
    }
    function itemCard(item) {
      const decision = decisionFor(item.id);
      const candidate = mainCandidate(item);
      return '<article class="item ' + (item.id === activeItemId ? 'active' : '') + '" tabindex="0" data-item-id="' + escapeHtml(item.id) + '">' +
        '<div class="item-head"><div class="item-title"><h2>' + escapeHtml(item.sourceBatch) + '</h2><span class="muted">' + escapeHtml(item.sourceId) + '</span></div><div class="badges"><span class="pill note">' + escapeHtml(item.itemType) + '</span>' + warningChips(item) + '</div></div>' +
        '<div class="review-grid">' +
        '<div class="box"><div class="label">Source screenshot</div>' + imageHtml(item.sourceScreenshotPath, item.sourceId, 'source-image') + '</div>' +
        '<div class="source-candidate"><section class="box"><div class="label">Source prompt/options</div><div class="prompt">' + escapeHtml(item.sourcePrompt || "") + '</div>' + (item.sourcePromptGloss ? '<div class="gloss">' + escapeHtml(item.sourcePromptGloss) + '</div>' : '') + optionsHtml(item.sourceOptions, item.recommendation?.localAnswerKey, null) + '</section>' +
        '<section><div class="label">Recommended qid candidate</div>' + candidateCard(candidate) + (item.candidates?.length > 1 ? '<details><summary>Other candidates</summary><div class="source-candidate">' + item.candidates.filter((entry) => entry !== candidate).slice(0, 4).map(candidateCard).join("") + '</div></details>' : '') + '</section></div>' +
        decisionPanel(item, decision) + '</div></article>';
    }
    function itemMatches(item) {
      const decision = decisionFor(item.id);
      if (activeFilter === "reviewed" && !decision?.reviewed) return false;
      if (activeFilter === "unreviewed" && decision?.reviewed) return false;
      if (activeFilter === "unresolved" && item.itemType !== "keepUnresolved") return false;
      if (activeFilter === "create" && item.itemType !== "createNewQuestion") return false;
      if (activeFilter === "answer" && item.recommendation?.localAnswerKey !== "UNKNOWN") return false;
      if (activeFilter === "high" && item.itemType !== "highRiskManual" && !item.highRisk) return false;
      return !query || searchText(item).includes(query);
    }
    function renderStats() {
      const reviewed = state.items.filter((item) => item.reviewed).length;
      const rows = [
        ["Items", WORKBENCH.counts.total],
        ["Recommend approve", WORKBENCH.counts.recommendations.approveExistingQid],
        ["Create", WORKBENCH.counts.recommendations.createNewQuestion],
        ["Unresolved", WORKBENCH.counts.recommendations.keepUnresolved],
        ["UNKNOWN key", WORKBENCH.counts.recommendations.unknownLocalAnswerKey],
        ["Reviewed", reviewed + " / " + state.items.length],
      ];
      document.getElementById("stats").innerHTML = rows.map(([label, value]) => '<div class="stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join("");
    }
    function renderFilters() {
      const reviewed = state.items.filter((item) => item.reviewed).length;
      const filters = [
        ["all", "All", WORKBENCH.counts.total],
        ["unresolved", "Unresolved", WORKBENCH.counts.keepUnresolved],
        ["create", "Create new", WORKBENCH.counts.createNewQuestion],
        ["answer", "Local answer unknown", WORKBENCH.counts.recommendations.unknownLocalAnswerKey],
        ["high", "High-risk", WORKBENCH.counts.highRiskManual],
        ["reviewed", "Reviewed", reviewed],
        ["unreviewed", "Unreviewed", state.items.length - reviewed],
      ];
      document.getElementById("filters").innerHTML = filters.map(([id, label, count]) => '<button class="filter ' + (activeFilter === id ? "active" : "") + '" data-filter="' + id + '">' + escapeHtml(label) + ' · ' + escapeHtml(count) + '</button>').join("");
    }
    function renderItems() {
      const visible = WORKBENCH.items.filter(itemMatches);
      document.getElementById("items").innerHTML = visible.map(itemCard).join("") || '<section class="item muted">No matching actionable items.</section>';
    }
    function render() { renderStats(); renderFilters(); renderItems(); }
    function setActive(card) { activeItemId = card?.dataset?.itemId || activeItemId; document.querySelectorAll('.item.active').forEach((el) => el.classList.remove('active')); if (card) card.classList.add('active'); }
    function updateDecision(itemId, patch) {
      const decision = decisionFor(itemId);
      if (!decision) return;
      Object.assign(decision, patch);
      saveState();
      render();
      setStatus("Autosaved locally");
    }
    document.addEventListener("focusin", (event) => { const card = event.target.closest(".item"); if (card) setActive(card); });
    document.addEventListener("click", (event) => {
      const card = event.target.closest(".item");
      if (card) setActive(card);
      const filter = event.target.closest("[data-filter]");
      if (filter) { activeFilter = filter.dataset.filter; render(); return; }
      const action = event.target.closest("[data-action]");
      if (action) { updateDecision(card.dataset.itemId, { decision: action.dataset.action }); return; }
      const key = event.target.closest("[data-key]");
      if (key) { updateDecision(card.dataset.itemId, { localAnswerKey: key.dataset.key }); return; }
      const useQid = event.target.closest(".use-qid");
      if (useQid) { updateDecision(card.dataset.itemId, { decision: "approveExistingQid", approvedQid: useQid.dataset.qid }); return; }
      const mark = event.target.closest(".mark-reviewed");
      if (mark) { updateDecision(card.dataset.itemId, { reviewed: true, reviewedAt: new Date().toISOString() }); return; }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "search") { query = event.target.value.toLowerCase().trim(); renderItems(); return; }
      const field = event.target.dataset.field;
      if (!field) return;
      const card = event.target.closest(".item");
      const decision = decisionFor(card?.dataset.itemId);
      if (!decision) return;
      decision[field] = field === "subtopics" ? event.target.value.split(",").map((value) => value.trim()).filter(Boolean) : event.target.value || null;
      saveState();
      setStatus("Autosaved locally");
    });
    document.addEventListener("keydown", (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (!activeItemId) return;
      const key = event.key.toUpperCase();
      const actionByKey = { "1": "approveExistingQid", "2": "createNewQuestion", "3": "keepUnresolved", "4": "deleteQuestion" };
      if (actionByKey[event.key]) { event.preventDefault(); updateDecision(activeItemId, { decision: actionByKey[event.key] }); return; }
      if (["A", "B", "C", "D"].includes(key)) { event.preventDefault(); updateDecision(activeItemId, { localAnswerKey: key }); return; }
      if (key === "U") { event.preventDefault(); updateDecision(activeItemId, { localAnswerKey: "UNKNOWN" }); return; }
      if (key === "R") { event.preventDefault(); updateDecision(activeItemId, { reviewed: true, reviewedAt: new Date().toISOString() }); }
    });
    document.getElementById("export-json").addEventListener("click", () => {
      const payload = { ...state, generatedAt: new Date().toISOString(), workbenchType: "fr-wrapup" };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fr-wrapup-workbench-decisions.json";
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
        state = { ...INITIAL_DECISIONS, items: INITIAL_DECISIONS.items.map((item) => ({ ...item, ...(byId.get(item.itemId) || {}) })) };
        saveState();
        render();
        setStatus("Imported decisions");
      } catch (error) {
        setStatus("Import failed: " + error.message);
      } finally {
        event.target.value = "";
      }
    });
    document.getElementById("clear-local").addEventListener("click", () => {
      if (!confirm("Clear locally autosaved French wrap-up decisions?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = clone(INITIAL_DECISIONS);
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
  decisions: undefined,
});
await writeJson(OUTPUT_DECISIONS_PATH, workbench.decisions);
await writeText(OUTPUT_HTML_PATH, buildCompactHtml(workbench));

console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_HTML_PATH))}`);
console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_JSON_PATH))}`);
console.log(`Wrote ${toPosix(path.relative(process.cwd(), OUTPUT_DECISIONS_PATH))}`);
console.log(`Rendered ${workbench.counts.total} actionable items.`);
console.log(`Unresolved: ${workbench.counts.keepUnresolved}`);
console.log(`Create new: ${workbench.counts.createNewQuestion}`);
console.log(`Answer-key issues: ${workbench.counts.answerKeyIssue}`);
console.log(`High-risk manual: ${workbench.counts.highRiskManual}`);
console.log(`Recommended approveExistingQid: ${workbench.counts.recommendations.approveExistingQid}`);
console.log(`Recommended createNewQuestion: ${workbench.counts.recommendations.createNewQuestion}`);
console.log(`Recommended keepUnresolved: ${workbench.counts.recommendations.keepUnresolved}`);
console.log(`Recommended deleteQuestion: ${workbench.counts.recommendations.deleteQuestion}`);
console.log(`Recommended UNKNOWN local keys: ${workbench.counts.recommendations.unknownLocalAnswerKey}`);
console.log(`Screenshots found: ${workbench.screenshots.existing}/${workbench.screenshots.referenced}`);
