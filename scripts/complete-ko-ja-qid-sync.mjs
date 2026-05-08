#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const QUESTIONS_PATH = path.join(DATASET_DIR, "questions.json");
const RAW_QUESTIONS_PATH = path.join(DATASET_DIR, "questions.raw.json");
const KO_PATH = path.join(DATASET_DIR, "translations.ko.json");
const JA_PATH = path.join(DATASET_DIR, "translations.ja.json");
const MEMORY_PATH = path.join(ROOT, "qbank-tools", "history", "decision-memory.json");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const PLAN_JSON = path.join(REPORTS_DIR, "ko-ja-qid-sync-plan.json");
const PLAN_MD = path.join(REPORTS_DIR, "ko-ja-qid-sync-plan.md");
const APPLY_JSON = path.join(REPORTS_DIR, "ko-ja-qid-sync-apply-report.json");
const APPLY_MD = path.join(REPORTS_DIR, "ko-ja-qid-sync-apply-report.md");

const LANGS = [
  { lang: "ko", path: KO_PATH },
  { lang: "ja", path: JA_PATH },
];

const JA_BACKFILLS = {
  q0941: "この標識は、この先の道路が対面通行区間になることを警告している。",
  q0948: "この標識は、この先の道路脇に急な落差のある盛土区間があることを警告している。",
  q0950: "この標識は、この先にトンネルがあることを警告している。",
  q0957: "この標識は、この先に非動力車（自転車）専用レーンがあることを示している。",
};

const args = parseArgs();
const apply = booleanArg(args, "apply", false);
const generatedAt = new Date().toISOString();

const masterDoc = readJson(QUESTIONS_PATH);
const rawDoc = readJson(RAW_QUESTIONS_PATH);
const masterQuestions = questionArray(masterDoc);
const rawByQid = new Map(questionArray(rawDoc).map((question) => [normalizeQid(question.id ?? question.qid), question]));
const masterQids = masterQuestions.map((question) => normalizeQid(question.id ?? question.qid)).filter(Boolean).sort(compareQid);
const masterSet = new Set(masterQids);
const masterByQid = new Map(masterQuestions.map((question) => [normalizeQid(question.id ?? question.qid), question]).filter(([qid]) => qid));
const memoryDoc = readJsonIfExists(MEMORY_PATH, { meta: {}, records: [] });

const languagePlans = {};
const nextDocs = {};
const memoryRecordsToAdd = [];

for (const { lang, path: translationPath } of LANGS) {
  const doc = readJson(translationPath);
  const auditBefore = auditLanguage(doc);
  const plan = buildLanguagePlan({ lang, translationPath, doc, auditBefore });
  const nextDoc = applyPlanToDoc({ lang, doc, plan });
  const auditAfter = auditLanguage(nextDoc);
  languagePlans[lang] = {
    lang,
    path: rel(translationPath),
    before: auditBefore,
    after: auditAfter,
    actions: plan,
  };
  nextDocs[lang] = { translationPath, doc: nextDoc };
  memoryRecordsToAdd.push(...recordsForPlan({ lang, plan }));
}

const planReport = {
  generatedAt,
  dataset: DATASET,
  apply,
  sources: {
    questions: rel(QUESTIONS_PATH),
    rawQuestions: rel(RAW_QUESTIONS_PATH),
    koTranslations: rel(KO_PATH),
    jaTranslations: rel(JA_PATH),
    decisionMemory: rel(MEMORY_PATH),
  },
  summary: {
    koExtraQidsToArchive: languagePlans.ko.actions.extraQidCleanups.length,
    jaExtraQidsToArchive: languagePlans.ja.actions.extraQidCleanups.length,
    jaMissingQidsToBackfill: languagePlans.ja.actions.missingBackfills.length,
    memoryRecordsToAdd: memoryRecordsToAdd.length,
    blockedActions: Object.values(languagePlans).flatMap((entry) => entry.actions.blocked).length,
  },
  languages: languagePlans,
  decisionMemoryRecordsToAdd: memoryRecordsToAdd,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await writeJson(PLAN_JSON, planReport);
await fsp.writeFile(PLAN_MD, renderMarkdown(planReport, { title: "KO/JA QID Sync Plan" }), "utf8");

if (apply) {
  const blockers = Object.values(languagePlans).flatMap((entry) => entry.actions.blocked);
  if (blockers.length > 0) {
    throw new Error(`Refusing to apply with ${blockers.length} blocked action(s). See ${rel(PLAN_JSON)}.`);
  }
  for (const { translationPath, doc } of Object.values(nextDocs)) {
    await writeJson(translationPath, doc);
  }
  const nextMemory = addMemoryRecords(memoryDoc, memoryRecordsToAdd);
  const memoryRecordsAdded = nextMemory.__addedCount;
  delete nextMemory.__addedCount;
  await writeJson(MEMORY_PATH, nextMemory);
  const applyReport = {
    ...planReport,
    appliedAt: new Date().toISOString(),
    summary: {
      ...planReport.summary,
      memoryRecordsAdded,
    },
  };
  await writeJson(APPLY_JSON, applyReport);
  await fsp.writeFile(APPLY_MD, renderMarkdown(applyReport, { title: "KO/JA QID Sync Apply Report" }), "utf8");
}

console.log(`Wrote ${rel(PLAN_JSON)}`);
console.log(`Wrote ${rel(PLAN_MD)}`);
if (apply) {
  console.log(`Wrote ${rel(APPLY_JSON)}`);
  console.log(`Wrote ${rel(APPLY_MD)}`);
}
for (const lang of ["ko", "ja"]) {
  const entry = languagePlans[lang];
  console.log(`${lang} before: ${entry.before.productionPresentQids}/${entry.before.masterQids}, missing ${entry.before.missingQids.length}, placeholders ${entry.before.placeholderQids.length}, extra ${entry.before.extraQids.length}`);
  console.log(`${lang} after: ${entry.after.productionPresentQids}/${entry.after.masterQids}, missing ${entry.after.missingQids.length}, placeholders ${entry.after.placeholderQids.length}, extra ${entry.after.extraQids.length}`);
}

function buildLanguagePlan({ lang, translationPath, doc, auditBefore }) {
  const translations = translationQuestions(doc);
  const extraQidCleanups = auditBefore.extraQids.map((qid) => ({
    qid,
    action: "archive-and-remove-extra-qid",
    reason: `${qid} is not present in English master questions.json.`,
    archivedEntry: translations[qid],
  }));
  const missingBackfills = [];
  const blocked = [];

  for (const qid of auditBefore.missingQids) {
    const master = masterByQid.get(qid);
    if (!master) {
      blocked.push({ lang, qid, reason: "missing qid was not found in master question map" });
      continue;
    }
    if (lang !== "ja") {
      blocked.push({ lang, qid, reason: "automatic backfill is currently implemented only for Japanese in this KO/JA sync script" });
      continue;
    }
    const generated = buildJapaneseBackfill(qid, master);
    if (!generated) {
      blocked.push({ lang, qid, reason: "no conservative Japanese backfill rule available" });
      continue;
    }
    missingBackfills.push({
      qid,
      action: isAutoPropagationPlaceholder(translations[qid]) ? "replace-placeholder" : "add-missing-translation",
      reason: isAutoPropagationPlaceholder(translations[qid])
        ? "Existing Japanese entry is an auto-propagation placeholder."
        : "Japanese production translation is missing.",
      masterPrompt: master.prompt ?? rawByQid.get(qid)?.prompt ?? "",
      existingEntry: translations[qid] ?? null,
      generatedEntry: generated,
    });
  }

  return {
    translationPath: rel(translationPath),
    extraQidCleanups,
    missingBackfills,
    invalidOrEmptyEntries: auditBefore.invalidOrEmptyEntries,
    blocked,
  };
}

function applyPlanToDoc({ lang, doc, plan }) {
  const nextQuestions = { ...translationQuestions(doc) };
  for (const cleanup of plan.extraQidCleanups) {
    delete nextQuestions[cleanup.qid];
  }
  for (const backfill of plan.missingBackfills) {
    nextQuestions[backfill.qid] = backfill.generatedEntry;
  }
  const productionCount = masterQids.filter((qid) => nextQuestions[qid] && !isAutoPropagationPlaceholder(nextQuestions[qid])).length;
  const meta = {
    ...(doc.meta ?? {}),
    locale: doc.meta?.locale ?? lang,
    translatedQuestions: productionCount,
    generatedAt,
  };
  if (plan.missingBackfills.length > 0 || plan.extraQidCleanups.length > 0) {
    meta.qidSyncRuns = [
      ...new Set([
        ...(Array.isArray(doc.meta?.qidSyncRuns) ? doc.meta.qidSyncRuns : []),
        `ko-ja-qid-sync-${generatedAt}`,
      ]),
    ];
  }
  return {
    ...doc,
    meta,
    questions: sortObject(nextQuestions),
  };
}

function buildJapaneseBackfill(qid, master) {
  const prompt = JA_BACKFILLS[qid];
  if (!prompt) return null;
  const entry = {
    prompt,
    explanation: "",
    sourceMode: "english_master_backfill",
    confidence: "medium",
    reviewStatus: "ready",
  };
  const type = String(master.type ?? "").toLowerCase();
  if (type !== "row") {
    const options = Array.isArray(master.options) ? master.options : [];
    entry.options = Object.fromEntries(options.map((option) => [option.id, option.text]));
  }
  return entry;
}

function recordsForPlan({ lang, plan }) {
  const records = [];
  for (const cleanup of plan.extraQidCleanups) {
    records.push({
      id: stableId(["translation-extra-qid-cleanup", DATASET, lang, cleanup.qid]),
      type: "translation-extra-qid-cleanup",
      dataset: DATASET,
      qid: cleanup.qid,
      language: lang,
      source: "script-apply",
      decision: "archive-and-remove-extra-qid",
      operation: "remove-extra-translation-not-in-master",
      outcome: "applied",
      reason: cleanup.reason,
      evidence: {
        archivedEntry: cleanup.archivedEntry,
      },
      validationStatus: "passed",
      warnings: [],
      errors: [],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      sourceFiles: [rel(PLAN_JSON)],
    });
  }
  for (const backfill of plan.missingBackfills) {
    records.push({
      id: stableId(["missing-qid-backfill", DATASET, lang, backfill.qid]),
      type: "missing-qid-backfill",
      dataset: DATASET,
      qid: backfill.qid,
      language: lang,
      source: "script-apply",
      decision: "backfill-production-translation",
      operation: backfill.action,
      outcome: "applied",
      reason: backfill.reason,
      evidence: {
        masterPrompt: backfill.masterPrompt,
        generatedEntry: backfill.generatedEntry,
        previousEntry: backfill.existingEntry,
      },
      validationStatus: "passed",
      warnings: [],
      errors: [],
      createdAt: generatedAt,
      updatedAt: generatedAt,
      sourceFiles: [rel(PLAN_JSON)],
    });
  }
  return records;
}

function addMemoryRecords(memoryDoc, records) {
  const next = {
    ...memoryDoc,
    meta: {
      ...(memoryDoc.meta ?? {}),
      updatedAt: generatedAt,
    },
    records: Array.isArray(memoryDoc.records) ? [...memoryDoc.records] : [],
  };
  const existingIds = new Set(next.records.map((record) => record.id));
  let added = 0;
  for (const record of records) {
    if (existingIds.has(record.id)) continue;
    next.records.push(record);
    existingIds.add(record.id);
    added += 1;
  }
  next.summary = {
    ...(next.summary ?? {}),
    totalRecords: next.records.length,
    updatedAt: generatedAt,
  };
  next.__addedCount = added;
  return next;
}

function auditLanguage(doc) {
  const translations = translationQuestions(doc);
  const fileQids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
  const placeholderQids = new Set(Object.entries(translations)
    .filter(([, entry]) => isAutoPropagationPlaceholder(entry))
    .map(([qid]) => normalizeQid(qid))
    .filter(Boolean));
  const productionQids = new Set([...fileQids].filter((qid) => !placeholderQids.has(qid)));
  const missingQids = masterQids.filter((qid) => !productionQids.has(qid)).sort(compareQid);
  const extraQids = [...fileQids].filter((qid) => !masterSet.has(qid)).sort(compareQid);
  return {
    masterQids: masterQids.length,
    fileEntries: Object.keys(translations).length,
    productionPresentQids: masterQids.filter((qid) => productionQids.has(qid)).length,
    missingQids,
    placeholderQids: [...placeholderQids].filter((qid) => masterSet.has(qid)).sort(compareQid),
    extraQids,
    invalidOrEmptyEntries: invalidOrEmptyEntries(translations),
  };
}

function invalidOrEmptyEntries(translations) {
  return Object.entries(translations)
    .filter(([qid, entry]) => masterSet.has(normalizeQid(qid)) && !isAutoPropagationPlaceholder(entry) && isInvalidOrEmptyTranslation(entry))
    .map(([qid, entry]) => ({ qid: normalizeQid(qid), reason: invalidReason(entry) }))
    .sort((left, right) => compareQid(left.qid, right.qid));
}

function isInvalidOrEmptyTranslation(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
  const prompt = String(entry.prompt ?? entry.statement ?? "").trim();
  return !prompt;
}

function invalidReason(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "malformed translation entry";
  return "missing prompt/statement text";
}

function renderMarkdown(report, { title }) {
  const lines = [];
  lines.push(`# ${title}`, "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Apply: ${report.apply}`);
  lines.push(`- KO extra qids to archive: ${report.summary.koExtraQidsToArchive}`);
  lines.push(`- JA extra qids to archive: ${report.summary.jaExtraQidsToArchive}`);
  lines.push(`- JA missing qids to backfill: ${report.summary.jaMissingQidsToBackfill}`);
  lines.push(`- Decision memory records to add: ${report.summary.memoryRecordsToAdd}`);
  lines.push(`- Blocked actions: ${report.summary.blockedActions}`);
  for (const lang of ["ko", "ja"]) {
    const entry = report.languages[lang];
    lines.push("", `## ${lang.toUpperCase()}`, "");
    lines.push(`- Before: ${entry.before.productionPresentQids}/${entry.before.masterQids}; missing ${entry.before.missingQids.length}; placeholders ${entry.before.placeholderQids.length}; extra ${entry.before.extraQids.length}`);
    lines.push(`- After: ${entry.after.productionPresentQids}/${entry.after.masterQids}; missing ${entry.after.missingQids.length}; placeholders ${entry.after.placeholderQids.length}; extra ${entry.after.extraQids.length}`);
    lines.push("", "### Extra QID Cleanups", "");
    lines.push(...table(entry.actions.extraQidCleanups.map((item) => ({
      qid: item.qid,
      action: item.action,
      reason: item.reason,
    })), ["qid", "action", "reason"]));
    lines.push("", "### Missing QID Backfills", "");
    lines.push(...table(entry.actions.missingBackfills.map((item) => ({
      qid: item.qid,
      action: item.action,
      prompt: item.generatedEntry.prompt,
    })), ["qid", "action", "prompt"]));
    lines.push("", "### Blocked", "");
    lines.push(...table(entry.actions.blocked, ["lang", "qid", "reason"]));
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions) ? doc.questions : {};
}

function isAutoPropagationPlaceholder(entry) {
  return !!entry
    && typeof entry === "object"
    && !Array.isArray(entry)
    && String(entry.translationStatus ?? "").trim().toLowerCase() === "missing"
    && String(entry.source ?? "").trim().toLowerCase() === "auto-propagation";
}

function parseArgs() {
  const parsed = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function booleanArg(source, key, fallback = false) {
  const value = source[key];
  if (value === undefined) return fallback;
  if (value === true) return true;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function normalizeQid(value) {
  const match = String(value ?? "").trim().toLowerCase().match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : String(value ?? "").trim().toLowerCase();
}

function compareQid(left, right) {
  const leftNumber = Number(String(left).replace(/^q/i, ""));
  const rightNumber = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right));
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareQid(left, right)));
}

function stableId(parts) {
  return crypto.createHash("sha1").update(parts.join(":")).digest("hex");
}

function table(rows, columns) {
  if (!rows.length) return ["None."];
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => markdownCell(row[column])).join(" | ")} |`),
  ];
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  try {
    return readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
