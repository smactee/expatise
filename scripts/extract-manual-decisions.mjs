#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_ARGS = ["input", "out"];
const MATCH_KEY_CANDIDATES = ["itemId", "sourceImage"];
const STABLE_FIELD_NAMES = [
  "approvedQid",
  "createNewQuestion",
  "keepUnresolved",
  "deleteQuestion",
  "confirmedCorrectOptionKey",
  "newQuestionLocalAnswerKey",
  "answerKeyUnknown",
  "useCurrentStagedAnswerKey",
  "reviewerNotes",
  "sourceExplanation",
];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const name of REQUIRED_ARGS) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument --${name}. Expected: node scripts/extract-manual-decisions.mjs --input <workbench-decisions.json> --out <manual-decisions.json>`,
      );
    }
  }

  const inputPath = path.resolve(args.input);
  const outPath = path.resolve(args.out);
  const inputDoc = await readJsonFile(inputPath);
  const inputItems = getItems(inputDoc, inputPath);
  const matchKey = selectMatchKey(inputItems, inputPath);

  const extractedItems = [];
  const counts = {
    decided: 0,
    approvedExistingQid: 0,
    createNewQuestion: 0,
    keepUnresolved: 0,
    deleteQuestion: 0,
    manualAnswerKeyOverride: 0,
    useCurrentStagedAnswerKey: 0,
    answerKeyUnknown: 0,
    reviewerNotes: 0,
    sourceExplanation: 0,
    skippedIncomplete: 0,
  };

  for (const item of inputItems) {
    if (!hasStableManualDecision(item)) {
      counts.skippedIncomplete += 1;
      continue;
    }

    const record = buildManualDecisionRecord(item, matchKey);
    extractedItems.push(record);
    counts.decided += 1;

    if (record.approvedQid) {
      counts.approvedExistingQid += 1;
    }
    if (record.createNewQuestion) {
      counts.createNewQuestion += 1;
    }
    if (record.keepUnresolved) {
      counts.keepUnresolved += 1;
    }
    if (record.deleteQuestion) {
      counts.deleteQuestion += 1;
    }
    if (record.confirmedCorrectOptionKey) {
      counts.manualAnswerKeyOverride += 1;
    }
    if (record.useCurrentStagedAnswerKey) {
      counts.useCurrentStagedAnswerKey += 1;
    }
    if (record.answerKeyUnknown) {
      counts.answerKeyUnknown += 1;
    }
    if (record.reviewerNotes) {
      counts.reviewerNotes += 1;
    }
    if (record.sourceExplanation) {
      counts.sourceExplanation += 1;
    }
  }

  const outputDoc = {
    generatedAt: new Date().toISOString(),
    sourceWorkbenchDecisionsPath: path.relative(process.cwd(), inputPath),
    sourceExportedAt:
      normalizeText(inputDoc?.exportedAt) ??
      normalizeText(inputDoc?.generatedAt) ??
      null,
    lang: normalizeText(inputDoc?.lang) ?? null,
    batchId: normalizeText(inputDoc?.batchId) ?? null,
    dataset: normalizeText(inputDoc?.dataset) ?? null,
    matchKey,
    stableFields: [...STABLE_FIELD_NAMES],
    items: extractedItems,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(outputDoc, null, 2)}\n`, "utf8");

  console.log(`input item count: ${inputItems.length}`);
  console.log(`chosen match key: ${matchKey}`);
  console.log(`extracted manual decision count: ${counts.decided}`);
  console.log(`approved existing qid count: ${counts.approvedExistingQid}`);
  console.log(`create new question count: ${counts.createNewQuestion}`);
  console.log(`keep unresolved count: ${counts.keepUnresolved}`);
  console.log(`delete question count: ${counts.deleteQuestion}`);
  console.log(`manual answer-key override count: ${counts.manualAnswerKeyOverride}`);
  console.log(`use current staged answer key count: ${counts.useCurrentStagedAnswerKey}`);
  console.log(`answer key unknown count: ${counts.answerKeyUnknown}`);
  console.log(`reviewer notes count: ${counts.reviewerNotes}`);
  console.log(`source explanation count: ${counts.sourceExplanation}`);
  console.log(`skipped incomplete item count: ${counts.skippedIncomplete}`);
}

function buildManualDecisionRecord(item, matchKey) {
  const deleteQuestion = item?.deleteQuestion === true;
  const createNewQuestion = deleteQuestion ? false : item?.createNewQuestion === true;
  const approvedQid =
    deleteQuestion || createNewQuestion
      ? null
      : normalizeQid(item?.approvedQid);
  const keepUnresolved =
    deleteQuestion || createNewQuestion || approvedQid
      ? false
      : item?.keepUnresolved === true;
  const useCurrentStagedAnswerKey = createNewQuestion ? false : item?.useCurrentStagedAnswerKey === true;
  const reviewerNotes = normalizeText(item?.reviewerNotes);
  const sourceExplanation = normalizeNullableText(item?.sourceExplanation);

  const record = {
    [matchKey]: normalizeRequiredText(item?.[matchKey], matchKey),
  };

  if (approvedQid && !keepUnresolved) {
    record.approvedQid = approvedQid;
  }
  if (createNewQuestion) {
    record.createNewQuestion = true;
  }
  if (keepUnresolved) {
    record.keepUnresolved = true;
  }
  if (deleteQuestion) {
    record.deleteQuestion = true;
  }

  if (createNewQuestion) {
    const newQuestionLocalAnswerKey = normalizeChoiceKey(
      item?.newQuestionLocalAnswerKey ?? item?.confirmedCorrectOptionKey,
    );
    if (newQuestionLocalAnswerKey) {
      record.newQuestionLocalAnswerKey = newQuestionLocalAnswerKey;
    }
  } else if (useCurrentStagedAnswerKey) {
    record.useCurrentStagedAnswerKey = true;
  } else {
    const confirmedCorrectOptionKey = normalizeChoiceKey(item?.confirmedCorrectOptionKey);
    if (confirmedCorrectOptionKey) {
      record.confirmedCorrectOptionKey = confirmedCorrectOptionKey;
    }
  }

  if (!createNewQuestion && item?.answerKeyUnknown === true) {
    record.answerKeyUnknown = true;
  }
  if (reviewerNotes) {
    record.reviewerNotes = reviewerNotes;
  }
  if (sourceExplanation !== null) {
    record.sourceExplanation = sourceExplanation;
  }

  return record;
}

function hasStableManualDecision(item) {
  return (
    Boolean(normalizeQid(item?.approvedQid)) ||
    item?.createNewQuestion === true ||
    item?.keepUnresolved === true ||
    item?.deleteQuestion === true ||
    Boolean(normalizeChoiceKey(item?.confirmedCorrectOptionKey)) ||
    Boolean(normalizeChoiceKey(item?.newQuestionLocalAnswerKey)) ||
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

function selectMatchKey(items, label) {
  for (const key of MATCH_KEY_CANDIDATES) {
    if (isSafeUniqueKey(items, key)) {
      return key;
    }
  }

  throw new Error(
    `No safe stable match key found in ${label}. Checked: ${MATCH_KEY_CANDIDATES.map((key) => `"${key}"`).join(", ")}.`,
  );
}

function isSafeUniqueKey(items, key) {
  const values = items.map((item) => normalizeText(item?.[key]));
  return values.every(Boolean) && new Set(values).size === values.length;
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
