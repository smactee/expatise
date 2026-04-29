#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_ARGS = ["history", "out"];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const name of REQUIRED_ARGS) {
    if (!args[name]) {
      throw new Error(
        `Missing required argument --${name}. Expected: node scripts/derive-correction-rules.mjs --history <match-history.jsonl> --out <correction-rules.json>`,
      );
    }
  }

  const historyPath = path.resolve(args.history);
  const outPath = path.resolve(args.out);
  const records = await readJsonLines(historyPath);

  const confusionPairRules = deriveConfusionPairRules(records);
  const answerKeyRules = deriveAnswerKeyRules(records);
  const reviewBiasRules = deriveTopCandidateRequiresReviewRules(records);
  const precisionRules = deriveTopCandidateHighPrecisionRules(records);

  const rules = [
    ...confusionPairRules,
    ...answerKeyRules,
    ...reviewBiasRules,
    ...precisionRules,
  ].sort((left, right) => {
    if ((right.evidenceCount ?? 0) !== (left.evidenceCount ?? 0)) {
      return (right.evidenceCount ?? 0) - (left.evidenceCount ?? 0);
    }
    return String(left.type).localeCompare(String(right.type));
  });

  const outputDoc = {
    generatedAt: new Date().toISOString(),
    sourceHistoryPath: path.relative(process.cwd(), historyPath),
    historyRecordCount: records.length,
    ruleCounts: {
      candidateConfusionPair: confusionPairRules.length,
      approvedQidAnswerKeyOverride: answerKeyRules.length,
      topCandidateRequiresReview: reviewBiasRules.length,
      topCandidateHighPrecision: precisionRules.length,
      total: rules.length,
    },
    rules,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(outputDoc, null, 2)}\n`, "utf8");

  console.log(`history record count: ${records.length}`);
  console.log(`candidate confusion-pair rule count: ${confusionPairRules.length}`);
  console.log(`approved-qid answer-key override rule count: ${answerKeyRules.length}`);
  console.log(`top-candidate requires-review rule count: ${reviewBiasRules.length}`);
  console.log(`top-candidate high-precision rule count: ${precisionRules.length}`);
  console.log(`total rule count: ${rules.length}`);
}

function deriveConfusionPairRules(records) {
  const pairCounts = new Map();
  const correctedByTopCandidate = new Map();

  for (const record of records) {
    const topCandidate = normalizeQid(record?.initialSuggestedQid);
    const reviewedChoice = normalizeQid(record?.approvedQid);
    if (!topCandidate || !reviewedChoice || topCandidate === reviewedChoice) {
      continue;
    }
    if (record?.newQuestionCreated === true || record?.wasDeleted === true || record?.remainedUnresolved === true) {
      continue;
    }

    const pairKey = `${topCandidate}->${reviewedChoice}`;
    pushAggregate(pairCounts, pairKey, record);
    incrementCounter(correctedByTopCandidate, topCandidate);
  }

  const rules = [];
  for (const [pairKey, aggregate] of pairCounts) {
    const [topCandidate, reviewedChoice] = pairKey.split("->");
    const totalCorrectionsFromTop = correctedByTopCandidate.get(topCandidate) ?? 0;
    const dominance = totalCorrectionsFromTop > 0 ? aggregate.count / totalCorrectionsFromTop : 0;
    if (aggregate.count < 2 || dominance < 0.6) {
      continue;
    }

    const scoreDelta = round(Math.min(3.5, 1 + (aggregate.count * 0.4)));
    rules.push({
      id: `candidate_confusion_pair:${topCandidate}:${reviewedChoice}`,
      type: "candidate_confusion_pair",
      when: {
        topCandidate,
        reviewedChoice,
      },
      evidenceCount: aggregate.count,
      evidenceSampleItemIds: aggregate.itemIds.slice(0, 5),
      stats: {
        dominance: round(dominance),
      },
      action: {
        penalizeTopCandidate: topCandidate,
        boostReviewedChoice: reviewedChoice,
        scoreDelta,
      },
      notes: `Human reviewers repeatedly preferred ${reviewedChoice} over ${topCandidate}.`,
    });
  }

  return rules;
}

function deriveAnswerKeyRules(records) {
  const grouped = new Map();

  for (const record of records) {
    const approvedQid = normalizeQid(record?.approvedQid);
    const stagedKey = normalizeChoiceKey(record?.currentStagedLocaleCorrectOptionKey);
    const reviewedKey = finalAnswerKey(record);
    if (!approvedQid || !stagedKey || !reviewedKey || stagedKey === reviewedKey) {
      continue;
    }
    if (record?.newQuestionCreated === true || record?.wasDeleted === true || record?.remainedUnresolved === true) {
      continue;
    }

    const groupKey = `${approvedQid}:${stagedKey}->${reviewedKey}`;
    pushAggregate(grouped, groupKey, record);
  }

  const rules = [];
  for (const [groupKey, aggregate] of grouped) {
    if (aggregate.count < 2) {
      continue;
    }

    const [approvedQid, keys] = groupKey.split(":");
    const [stagedKey, reviewedKey] = keys.split("->");
    rules.push({
      id: `approved_qid_answer_key_override:${approvedQid}:${stagedKey}:${reviewedKey}`,
      type: "approved_qid_answer_key_override",
      when: {
        approvedQid,
        stagedAnswerKey: stagedKey,
        reviewedAnswerKey: reviewedKey,
      },
      evidenceCount: aggregate.count,
      evidenceSampleItemIds: aggregate.itemIds.slice(0, 5),
      action: {
        discourageAnswerKey: stagedKey,
        preferAnswerKey: reviewedKey,
      },
      notes: `Reviewers repeatedly changed ${approvedQid} from ${stagedKey} to ${reviewedKey}.`,
    });
  }

  return rules;
}

function deriveTopCandidateRequiresReviewRules(records) {
  const statsByTopCandidate = buildTopCandidateStats(records);
  const rules = [];

  for (const [topCandidate, stats] of statsByTopCandidate) {
    const correctionRate = stats.total > 0 ? stats.corrected / stats.total : 0;
    if (stats.total < 3 || stats.corrected < 3 || correctionRate < 0.75) {
      continue;
    }

    rules.push({
      id: `top_candidate_requires_review:${topCandidate}`,
      type: "top_candidate_requires_review",
      when: {
        topCandidate,
      },
      evidenceCount: stats.total,
      evidenceSampleItemIds: stats.itemIds.slice(0, 5),
      stats: {
        correctionRate: round(correctionRate),
        correctedCount: stats.corrected,
      },
      action: {
        raiseAutoMatchThresholdBy: 4,
        raiseAutoGapThresholdBy: 2,
        routeToReview: true,
      },
      notes: `This top candidate was frequently corrected by reviewers and should stay review-first.`,
    });
  }

  return rules;
}

function deriveTopCandidateHighPrecisionRules(records) {
  const statsByTopCandidate = buildTopCandidateStats(records);
  const rules = [];

  for (const [topCandidate, stats] of statsByTopCandidate) {
    const precision = stats.total > 0 ? stats.correct / stats.total : 0;
    if (stats.total < 3 || stats.correct < 3 || precision < 0.95) {
      continue;
    }

    rules.push({
      id: `top_candidate_high_precision:${topCandidate}`,
      type: "top_candidate_high_precision",
      when: {
        topCandidate,
      },
      evidenceCount: stats.total,
      evidenceSampleItemIds: stats.itemIds.slice(0, 5),
      stats: {
        precision: round(precision),
        correctCount: stats.correct,
      },
      action: {
        lowerAutoMatchThresholdBy: 2,
      },
      notes: `This top candidate has been consistently confirmed by reviewers.`,
    });
  }

  return rules;
}

function buildTopCandidateStats(records) {
  const statsByTopCandidate = new Map();

  for (const record of records) {
    const topCandidate = normalizeQid(record?.initialSuggestedQid);
    const approvedQid = normalizeQid(record?.approvedQid);
    if (!topCandidate || !approvedQid) {
      continue;
    }
    if (record?.newQuestionCreated === true || record?.wasDeleted === true || record?.remainedUnresolved === true) {
      continue;
    }

    const stats = statsByTopCandidate.get(topCandidate) ?? {
      total: 0,
      correct: 0,
      corrected: 0,
      itemIds: [],
    };
    stats.total += 1;
    if (approvedQid === topCandidate) {
      stats.correct += 1;
    } else {
      stats.corrected += 1;
    }
    if (typeof record?.itemId === "string" && record.itemId.trim()) {
      stats.itemIds.push(record.itemId.trim());
    }
    statsByTopCandidate.set(topCandidate, stats);
  }

  return statsByTopCandidate;
}

function pushAggregate(map, key, record) {
  const current = map.get(key) ?? { count: 0, itemIds: [] };
  current.count += 1;
  if (typeof record?.itemId === "string" && record.itemId.trim()) {
    current.itemIds.push(record.itemId.trim());
  }
  map.set(key, current);
}

function incrementCounter(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function readJsonLines(filePath) {
  let rawText;

  try {
    rawText = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }

  const records = [];
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const [index, line] of lines.entries()) {
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid JSONL line ${index + 1} in ${filePath}: ${error.message}`);
    }
  }

  return records;
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags like --history <path>.`);
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

function finalAnswerKey(record) {
  if (record?.useCurrentStagedAnswerKey === true) {
    return normalizeChoiceKey(record?.currentStagedLocaleCorrectOptionKey);
  }
  return normalizeChoiceKey(record?.confirmedCorrectOptionKey);
}

function normalizeChoiceKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]$/.test(trimmed) ? trimmed : null;
}

function normalizeQid(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (/^q\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `q${trimmed.padStart(4, "0")}`;
  }

  return null;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
