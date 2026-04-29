#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_ARGS = ["input", "out", "lang", "batch"];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const name of REQUIRED_ARGS) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument --${name}. Expected: node scripts/export-match-history.mjs --input <workbench-decisions.json> --out <match-history.jsonl> --lang <lang> --batch <batch>`,
      );
    }
  }

  const inputPath = path.resolve(args.input);
  const outPath = path.resolve(args.out);
  const lang = String(args.lang).trim();
  const batch = String(args.batch).trim();
  const inputDoc = await readJsonFile(inputPath);
  const inputItems = getItems(inputDoc, inputPath);

  const records = [];
  const counts = {
    exported: 0,
    approvedExistingQid: 0,
    matcherCorrect: 0,
    reviewerChangedQid: 0,
    reviewerChangedAnswer: 0,
    unresolved: 0,
    deleted: 0,
    createNew: 0,
  };

  for (const item of inputItems) {
    if (!hasReviewedOutcome(item)) {
      continue;
    }

    const approvedQid = normalizeQid(item?.approvedQid);
    const initialSuggestedQid = normalizeQid(item?.initialSuggestedQid);
    const matcherMatchedApprovedQid =
      approvedQid && initialSuggestedQid
        ? approvedQid === initialSuggestedQid
        : null;
    const currentStagedLocaleCorrectOptionKey = normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey);
    const confirmedCorrectOptionKey = normalizeChoiceKey(item?.confirmedCorrectOptionKey);
    const useCurrentStagedAnswerKey = item?.useCurrentStagedAnswerKey === true;
    const createNewQuestion = item?.createNewQuestion === true;
    const keepUnresolved = item?.keepUnresolved === true;
    const deleteQuestion = item?.deleteQuestion === true;
    const finalAnswerKey = useCurrentStagedAnswerKey
      ? currentStagedLocaleCorrectOptionKey
      : confirmedCorrectOptionKey;
    const answerKeyChangedByReviewer =
      Boolean(currentStagedLocaleCorrectOptionKey) &&
      Boolean(finalAnswerKey) &&
      currentStagedLocaleCorrectOptionKey !== finalAnswerKey;

    const record = {
      lang,
      batch,
      itemId: normalizeRequiredText(item?.itemId, "itemId"),
      section: normalizeText(item?.section) ?? null,
      sourceImage: normalizeText(item?.sourceImage) ?? null,
      qid: normalizeQid(item?.qid),
      approvedQid,
      initialSuggestedQid,
      confirmedCorrectOptionKey,
      currentStagedLocaleCorrectOptionKey,
      useCurrentStagedAnswerKey,
      createNewQuestion,
      keepUnresolved,
      deleteQuestion,
      answerKeyUnknown: item?.answerKeyUnknown === true,
      reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
      sourceExplanation: normalizeNullableText(item?.sourceExplanation),
      matcherTopSuggestionMatchedApprovedQid: matcherMatchedApprovedQid,
      answerKeyChangedByReviewer,
      remainedUnresolved: keepUnresolved,
      wasDeleted: deleteQuestion,
      newQuestionCreated: createNewQuestion,
    };

    records.push(record);
    counts.exported += 1;

    if (approvedQid) {
      counts.approvedExistingQid += 1;
      if (matcherMatchedApprovedQid === true) {
        counts.matcherCorrect += 1;
      }
      if (initialSuggestedQid && approvedQid !== initialSuggestedQid) {
        counts.reviewerChangedQid += 1;
      }
    }
    if (answerKeyChangedByReviewer) {
      counts.reviewerChangedAnswer += 1;
    }
    if (keepUnresolved) {
      counts.unresolved += 1;
    }
    if (deleteQuestion) {
      counts.deleted += 1;
    }
    if (createNewQuestion) {
      counts.createNew += 1;
    }
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(outPath, `${jsonl}${jsonl ? "\n" : ""}`, "utf8");

  const matcherCorrectRate = counts.approvedExistingQid > 0
    ? (counts.matcherCorrect / counts.approvedExistingQid) * 100
    : 0;

  console.log(`total exported: ${counts.exported}`);
  console.log(`approved existing qid count: ${counts.approvedExistingQid}`);
  console.log(`matcher-correct count: ${counts.matcherCorrect}`);
  console.log(`matcher-correct rate: ${matcherCorrectRate.toFixed(1)}%`);
  console.log(`reviewer-changed-qid count: ${counts.reviewerChangedQid}`);
  console.log(`reviewer-changed-answer count: ${counts.reviewerChangedAnswer}`);
  console.log(`unresolved count: ${counts.unresolved}`);
  console.log(`deleted count: ${counts.deleted}`);
  console.log(`create-new count: ${counts.createNew}`);
}

function hasReviewedOutcome(item) {
  return (
    Boolean(normalizeQid(item?.approvedQid)) ||
    item?.createNewQuestion === true ||
    item?.keepUnresolved === true ||
    item?.deleteQuestion === true ||
    Boolean(normalizeChoiceKey(item?.confirmedCorrectOptionKey)) ||
    item?.answerKeyUnknown === true ||
    item?.useCurrentStagedAnswerKey === true ||
    Boolean(normalizeText(item?.reviewerNotes)) ||
    normalizeNullableText(item?.sourceExplanation) !== null
  );
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags like --input <path>.`);
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

function normalizeRequiredText(value, fieldName) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(`Missing required ${fieldName} on a reviewed item.`);
  }
  return text;
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
