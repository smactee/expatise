#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_ARGS = ["manual", "staging", "out"];
const MATCH_KEY_CANDIDATES = ["itemId", "sourceImage"];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const name of REQUIRED_ARGS) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument --${name}. Expected: node scripts/apply-manual-decisions.mjs --manual <manual-decisions.json> --staging <workbench-decisions.json> --out <merged-workbench-decisions.json>`,
      );
    }
  }

  const manualPath = path.resolve(args.manual);
  const stagingPath = path.resolve(args.staging);
  const outPath = path.resolve(args.out);

  const manualDoc = await readJsonFile(manualPath);
  const stagingDoc = await readJsonFile(stagingPath);
  const manualItems = getItems(manualDoc, manualPath);
  const stagingItems = getItems(stagingDoc, stagingPath);
  const matchKey = resolveMatchKey(manualDoc, manualItems, stagingItems, manualPath, stagingPath);
  const manualByKey = buildUniqueItemMap(manualItems, matchKey, manualPath);
  const stagingKeys = new Set(stagingItems.map((item) => normalizeScalar(item?.[matchKey])));

  let matchedCount = 0;
  let appliedCount = 0;

  const mergedItems = stagingItems.map((stagingItem) => {
    const key = normalizeScalar(stagingItem?.[matchKey]);
    const manualDecision = manualByKey.get(key);
    if (!manualDecision) {
      return stagingItem;
    }

    matchedCount += 1;
    appliedCount += 1;
    return applyManualDecision(stagingItem, manualDecision);
  });

  const unmatchedManualCount = manualItems.filter((item) => !stagingKeys.has(normalizeScalar(item?.[matchKey]))).length;
  const outputDoc = { ...stagingDoc, items: mergedItems };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(outputDoc, null, 2)}\n`, "utf8");

  console.log(`manual decision count: ${manualItems.length}`);
  console.log(`staging item count: ${stagingItems.length}`);
  console.log(`chosen match key: ${matchKey}`);
  console.log(`matched staging item count: ${matchedCount}`);
  console.log(`applied manual decision count: ${appliedCount}`);
  console.log(`unmatched manual decision count: ${unmatchedManualCount}`);
}

function applyManualDecision(stagingItem, manualDecision) {
  const result = { ...stagingItem };
  const deleteQuestion = manualDecision?.deleteQuestion === true;
  const createNewQuestion = deleteQuestion ? false : manualDecision?.createNewQuestion === true;
  const keepUnresolved = !deleteQuestion && !createNewQuestion && manualDecision?.keepUnresolved === true;
  const approvedQid =
    deleteQuestion || createNewQuestion || keepUnresolved
      ? null
      : normalizeQid(manualDecision?.approvedQid);

  if (deleteQuestion) {
    result.deleteQuestion = true;
    result.createNewQuestion = false;
    result.keepUnresolved = false;
    result.approvedQid = null;
  } else if (createNewQuestion) {
    result.deleteQuestion = false;
    result.createNewQuestion = true;
    result.keepUnresolved = false;
    result.approvedQid = null;
  } else if (keepUnresolved) {
    result.deleteQuestion = false;
    result.createNewQuestion = false;
    result.keepUnresolved = true;
    result.approvedQid = null;
  } else if (approvedQid) {
    result.deleteQuestion = false;
    result.createNewQuestion = false;
    result.keepUnresolved = false;
    result.approvedQid = approvedQid;
  }

  if (createNewQuestion) {
    result.useCurrentStagedAnswerKey = false;
    result.confirmedCorrectOptionKey = null;
    result.answerKeyUnknown = false;
    result.newQuestionLocalAnswerKey =
      normalizeChoiceKey(
        manualDecision?.newQuestionLocalAnswerKey ?? manualDecision?.confirmedCorrectOptionKey,
      ) ?? result.newQuestionLocalAnswerKey ?? null;
  } else {
    if (manualDecision?.useCurrentStagedAnswerKey === true) {
      result.useCurrentStagedAnswerKey = true;
      result.confirmedCorrectOptionKey = null;
      result.answerKeyUnknown = false;
    } else if (hasOwn(manualDecision, "confirmedCorrectOptionKey")) {
      result.useCurrentStagedAnswerKey = false;
      result.confirmedCorrectOptionKey = normalizeChoiceKey(manualDecision?.confirmedCorrectOptionKey);
      result.answerKeyUnknown = false;
    }

    if (manualDecision?.answerKeyUnknown === true) {
      result.answerKeyUnknown = true;
      result.useCurrentStagedAnswerKey = false;
      result.confirmedCorrectOptionKey = null;
    }
  }

  if (hasOwn(manualDecision, "reviewerNotes")) {
    result.reviewerNotes = normalizeText(manualDecision?.reviewerNotes) ?? "";
  }
  if (hasOwn(manualDecision, "sourceExplanation")) {
    result.sourceExplanation = normalizeNullableText(manualDecision?.sourceExplanation);
  }

  return result;
}

function resolveMatchKey(manualDoc, manualItems, stagingItems, manualPath, stagingPath) {
  const preferredKey = normalizeText(manualDoc?.matchKey);
  if (preferredKey) {
    if (!MATCH_KEY_CANDIDATES.includes(preferredKey)) {
      throw new Error(
        `Unsupported manual match key "${preferredKey}". Supported keys: ${MATCH_KEY_CANDIDATES.join(", ")}.`,
      );
    }
    if (!isSafeUniqueKey(manualItems, preferredKey)) {
      throw new Error(`Manual decisions in ${manualPath} do not have unique "${preferredKey}" values.`);
    }
    if (!isSafeUniqueKey(stagingItems, preferredKey)) {
      throw new Error(`Staging decisions in ${stagingPath} do not have unique "${preferredKey}" values.`);
    }
    return preferredKey;
  }

  for (const key of MATCH_KEY_CANDIDATES) {
    if (isSafeUniqueKey(manualItems, key) && isSafeUniqueKey(stagingItems, key)) {
      return key;
    }
  }

  throw new Error(
    `No safe stable match key found. Checked: ${MATCH_KEY_CANDIDATES.map((key) => `"${key}"`).join(", ")}.`,
  );
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags like --manual <path>.`);
    }

    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }

    args[name] = value;
    index += 1;
  }

  return args;
}

async function readJsonFile(filePath) {
  let rawText;

  try {
    rawText = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function getItems(doc, filePath) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.items)) {
    throw new Error(`Expected an object with an "items" array in ${filePath}.`);
  }

  return doc.items;
}

function isSafeUniqueKey(items, key) {
  const values = items.map((item) => normalizeScalar(item?.[key]));
  return values.every(Boolean) && new Set(values).size === values.length;
}

function buildUniqueItemMap(items, key, label) {
  const map = new Map();

  for (const item of items) {
    const value = normalizeScalar(item?.[key]);
    if (!value) {
      throw new Error(`Missing "${key}" on an item in ${label}.`);
    }
    if (map.has(value)) {
      throw new Error(`Duplicate "${key}" value "${value}" in ${label}.`);
    }
    map.set(value, item);
  }

  return map;
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeScalar(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableText(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return String(value);
  }

  return value.trim().length > 0 ? value.trim() : null;
}

function normalizeChoiceKey(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const upper = text.toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : null;
}

function normalizeQid(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  if (/^q\d{4}$/i.test(text)) {
    return text.toLowerCase();
  }

  if (/^\d+$/.test(text)) {
    return `q${text.padStart(4, "0")}`;
  }

  return null;
}
