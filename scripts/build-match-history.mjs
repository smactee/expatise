#!/usr/bin/env node

// Aggregate every reviewed workbench-decisions file across all languages/batches
// into a single match-history.jsonl that derive-correction-rules.mjs can consume.
//
// Each `<lang>-<batch>-workbench-decisions.json` carries the matcher's original
// suggestion (`initialSuggestedQid`) alongside the human's final decision
// (`approvedQid`, answer-key fields). Collapsing all of them into one history is
// what lets the matcher actually learn from accumulated rectifications instead of
// re-deriving from a single batch.
//
// Source selection: workbench-decisions files carry `lang` and `batchId` fields
// internally. We key off those (not fragile filenames) and keep exactly one
// winning file per (lang, batchId) — the latest export — so the same batch that
// exists as base + `.merged` + a `manual-reviews/` copy is never double-counted.
//
// Usage:
//   node scripts/build-match-history.mjs [--out <path>] [--root <dir> ...] [--dry-run] [--quiet]

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUT = "qbank-tools/history/match-history.jsonl";
const DEFAULT_ROOTS = [
  "qbank-tools/history/decisions",
  "qbank-tools/manual-reviews",
  "qbank-tools/generated/staging",
];
const EXCLUDED_PATH_SEGMENTS = ["/archive/", "fr-decision-bundle", "/node_modules/"];
const WORKBENCH_FILE_PATTERN = /-workbench-decisions(\.[\w.-]+)?\.json$/i;

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(args.out ?? DEFAULT_OUT);
  const roots = (args.roots.length > 0 ? args.roots : DEFAULT_ROOTS).map((root) => path.resolve(root));
  const dryRun = args.flags.has("dry-run");
  const quiet = args.flags.has("quiet");

  const candidatePaths = [];
  for (const root of roots) {
    candidatePaths.push(...(await findWorkbenchFiles(root)));
  }

  // Load every candidate file, keeping only those with a real items[] array.
  const loaded = [];
  const skipped = { noItems: 0, parseError: 0, empty: 0 };
  for (const filePath of candidatePaths) {
    const doc = await readJsonFile(filePath);
    if (!doc) {
      skipped.parseError += 1;
      continue;
    }
    if (!Array.isArray(doc.items)) {
      skipped.noItems += 1;
      continue;
    }
    if (doc.items.length === 0) {
      skipped.empty += 1;
      continue;
    }

    const lang = normalizeText(doc.lang) ?? langFromFilename(filePath);
    const batchId = normalizeText(doc.batchId) ?? batchFromFilename(filePath);
    if (!lang || !batchId) {
      skipped.noItems += 1;
      continue;
    }

    const fileStat = await stat(filePath);
    loaded.push({
      filePath,
      lang,
      batchId,
      items: doc.items,
      exportedAt: parseTimestamp(doc.exportedAt ?? doc.generatedAt),
      mtimeMs: fileStat.mtimeMs,
    });
  }

  // One winner per (lang, batchId): latest export, tie-break on item count then mtime.
  const winners = new Map();
  const supersededFiles = [];
  for (const entry of loaded) {
    const key = `${entry.lang}::${entry.batchId}`;
    const current = winners.get(key);
    if (!current || isBetterCandidate(entry, current)) {
      if (current) supersededFiles.push(current.filePath);
      winners.set(key, entry);
    } else {
      supersededFiles.push(entry.filePath);
    }
  }

  // Build the history rows from the winning files only.
  const records = [];
  const totals = { exported: 0, approvedExistingQid: 0, matcherCorrect: 0, reviewerChangedQid: 0 };
  for (const winner of winners.values()) {
    const seenItemIds = new Set();
    for (const item of winner.items) {
      if (!hasReviewedOutcome(item)) continue;

      const itemId = normalizeText(item?.itemId);
      if (!itemId) continue;
      if (seenItemIds.has(itemId)) continue; // defensive intra-file dedup
      seenItemIds.add(itemId);

      const record = buildRecord(item, winner.lang, winner.batchId);
      records.push(record);
      totals.exported += 1;
      if (record.approvedQid) {
        totals.approvedExistingQid += 1;
        if (record.matcherTopSuggestionMatchedApprovedQid === true) totals.matcherCorrect += 1;
        if (record.initialSuggestedQid && record.approvedQid !== record.initialSuggestedQid) {
          totals.reviewerChangedQid += 1;
        }
      }
    }
  }

  // Stable ordering so the committed history produces clean diffs run-to-run.
  records.sort((a, b) =>
    a.lang.localeCompare(b.lang) ||
    a.batch.localeCompare(b.batch) ||
    a.itemId.localeCompare(b.itemId),
  );

  const jsonl = records.map((record) => JSON.stringify(record)).join("\n");

  if (!dryRun) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${jsonl}${jsonl ? "\n" : ""}`, "utf8");
  }

  if (!quiet) {
    const matcherRate = totals.approvedExistingQid > 0
      ? ((totals.matcherCorrect / totals.approvedExistingQid) * 100).toFixed(1)
      : "0.0";
    console.log(`candidate files scanned: ${candidatePaths.length}`);
    console.log(`files skipped (no items / parse error / empty): ${skipped.noItems} / ${skipped.parseError} / ${skipped.empty}`);
    console.log(`winning files selected: ${winners.size} (superseded duplicates: ${supersededFiles.length})`);
    console.log(`history rows written: ${records.length}${dryRun ? " (dry run, nothing written)" : ""}`);
    console.log(`approved existing-qid rows: ${totals.approvedExistingQid}`);
    console.log(`matcher-correct rate: ${matcherRate}%`);
    console.log(`reviewer-changed-qid rows: ${totals.reviewerChangedQid}`);
    if (!dryRun) console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
  }
}

function buildRecord(item, lang, batch) {
  const approvedQid = normalizeQid(item?.approvedQid);
  const initialSuggestedQid = normalizeQid(item?.initialSuggestedQid);
  const matcherMatchedApprovedQid =
    approvedQid && initialSuggestedQid ? approvedQid === initialSuggestedQid : null;
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

  return {
    lang,
    batch,
    itemId: normalizeText(item?.itemId),
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

function isBetterCandidate(candidate, current) {
  if (candidate.exportedAt !== current.exportedAt) {
    return candidate.exportedAt > current.exportedAt;
  }
  if (candidate.items.length !== current.items.length) {
    return candidate.items.length > current.items.length;
  }
  return candidate.mtimeMs > current.mtimeMs;
}

async function findWorkbenchFiles(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (EXCLUDED_PATH_SEGMENTS.some((segment) => fullPath.includes(segment))) continue;
    if (entry.isDirectory()) {
      found.push(...(await findWorkbenchFiles(fullPath)));
    } else if (entry.isFile() && WORKBENCH_FILE_PATTERN.test(entry.name)) {
      found.push(fullPath);
    }
  }
  return found;
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function parseTimestamp(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? 0 : ms;
}

function langFromFilename(filePath) {
  const match = path.basename(filePath).match(/\b([a-z]{2})-batch-/i);
  return match ? match[1].toLowerCase() : null;
}

function batchFromFilename(filePath) {
  const match = path.basename(filePath).match(/\b[a-z]{2}-(batch-\d+)/i);
  return match ? match[1].toLowerCase() : null;
}

function parseArgs(argv) {
  const args = { roots: [], flags: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags like --out <path>.`);
    }
    const name = token.slice(2);
    if (name === "dry-run" || name === "quiet") {
      args.flags.add(name);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }
    if (name === "root") {
      args.roots.push(value);
    } else {
      args[name] = value;
    }
    index += 1;
  }
  return args;
}

function normalizeText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableText(value) {
  if (value == null) return null;
  if (typeof value !== "string") return String(value);
  return value.trim().length > 0 ? value.trim() : null;
}

function normalizeChoiceKey(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const upper = text.toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : null;
}

function normalizeQid(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^q\d{4}$/i.test(text)) return text.toLowerCase();
  if (/^\d+$/.test(text)) return `q${text.padStart(4, "0")}`;
  return null;
}
