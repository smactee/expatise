#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_ARGS = ["reviewed", "staging", "out"];
const MATCH_KEY_CANDIDATES = ["qid", "itemId", "sourceImage", "id"];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const name of REQUIRED_ARGS) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument --${name}. Expected: node scripts/merge-workbench-decisions.mjs --reviewed <path> --staging <path> --out <path>`,
      );
    }
  }

  const reviewedPath = path.resolve(args.reviewed);
  const stagingPath = path.resolve(args.staging);
  const outPath = path.resolve(args.out);

  const reviewedDoc = await readJsonFile(reviewedPath);
  const stagingDoc = await readJsonFile(stagingPath);
  const reviewedItems = getItems(reviewedDoc, reviewedPath);
  const stagingItems = getItems(stagingDoc, stagingPath);

  const matchKey = selectMatchKey(reviewedItems, stagingItems);
  if (!matchKey) {
    throw new Error(
      `No safe unique match key found. Checked: ${MATCH_KEY_CANDIDATES.map((key) => `"${key}"`).join(", ")}.`,
    );
  }

  const reviewedByKey = buildUniqueItemMap(reviewedItems, matchKey, reviewedPath);
  const stagingKeys = new Set(stagingItems.map((item) => normalizeScalar(item[matchKey])));

  let matchedCount = 0;
  let restoredCount = 0;

  // Start from the staging array so the current file order and untouched entries stay intact.
  const mergedItems = stagingItems.map((stagingItem) => {
    const key = normalizeScalar(stagingItem[matchKey]);
    const reviewedItem = reviewedByKey.get(key);

    if (!reviewedItem) {
      return stagingItem;
    }

    matchedCount += 1;

    // Only restore entries that contain an explicit review decision or manual annotation.
    if (!hasReviewedDecision(reviewedItem)) {
      return stagingItem;
    }

    restoredCount += 1;
    return { ...stagingItem, ...reviewedItem };
  });

  const unmatchedReviewedCount = reviewedItems.filter((item) => !stagingKeys.has(normalizeScalar(item[matchKey]))).length;
  const mergedDoc = { ...stagingDoc, items: mergedItems };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(mergedDoc, null, 2)}\n`, "utf8");

  console.log(`reviewed entry count: ${reviewedItems.length}`);
  console.log(`staging entry count: ${stagingItems.length}`);
  console.log(`matched entry count: ${matchedCount}`);
  console.log(`restored reviewed entry count: ${restoredCount}`);
  console.log(`unmatched reviewed entry count: ${unmatchedReviewedCount}`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags such as --reviewed <path>.`);
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
    if (error && error.code === "ENOENT") {
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

function selectMatchKey(reviewedItems, stagingItems) {
  for (const key of MATCH_KEY_CANDIDATES) {
    if (isSafeUniqueKey(reviewedItems, key) && isSafeUniqueKey(stagingItems, key)) {
      return key;
    }
  }

  return null;
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

function hasReviewedDecision(item) {
  return (
    hasText(item?.approvedQid) ||
    item?.createNewQuestion === true ||
    item?.keepUnresolved === true ||
    item?.deleteQuestion === true ||
    hasText(item?.confirmedCorrectOptionKey) ||
    hasText(item?.newQuestionLocalAnswerKey) ||
    item?.answerKeyUnknown === true ||
    item?.useCurrentStagedAnswerKey === true ||
    hasText(item?.reviewerNotes) ||
    hasContent(item?.sourceExplanation)
  );
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasContent(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return hasText(value);
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
