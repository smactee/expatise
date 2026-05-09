#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const IMPORTS_DIR = path.join(ROOT, "imports");
const DEFAULT_DATASET = "2023-test1";

const args = parseArgs(process.argv.slice(2));
const lang = requiredArg("lang");
const batchId = requiredArg("batch");
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const modelToolLabel = String(args["model-tool-label"] ?? "codex-review");
const markUnavailable = parseBoolean(args["mark-unavailable"], false);
const force = parseBoolean(args.force, false);
const unavailableReason = String(
  args["unavailable-reason"] ??
    "Original Codex recommendation snapshot is unavailable for this batch; no historical recommendation was inferred.",
);

const decisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);
const outPath = args.out
  ? path.resolve(String(args.out))
  : path.join(STAGING_DIR, `${lang}-${batchId}-codex-recommendations.json`);

if (!force && fs.existsSync(outPath)) {
  throw new Error(`Refusing to overwrite existing recommendation snapshot: ${rel(outPath)}. Pass --force true to replace it.`);
}

const sourceMaps = loadSourceMaps({ lang, batchId });
const workbenchDoc = readJson(decisionsPath);
const decisions = Array.isArray(workbenchDoc.items) ? workbenchDoc.items : [];
if (!decisions.length) {
  throw new Error(`No workbench decision items found in ${rel(decisionsPath)}`);
}

const generatedAt = new Date().toISOString();
const items = decisions.map((decision) => {
  const source = resolveSourceForDecision(decision, sourceMaps);
  const topMatcher = topMatcherFor(source, decision);
  const sourcePromptRaw = firstText(source?.promptRawJa, source?.promptRaw, source?.localizedText?.prompt, source?.localizedPrompt);
  const sourcePromptGloss = firstText(
    source?.promptGlossEn,
    source?.promptTranslated,
    source?.translatedPrompt,
    source?.translatedText?.prompt,
  );
  const action = markUnavailable ? null : actionFromDecision(decision);
  const recommendedQid = action === "approveExistingQid" ? normalizeQid(decision.approvedQid) : null;
  const recommendedLocaleAnswerKey = markUnavailable ? null : answerKeyFromDecision(decision, action);

  return {
    id: String(decision.id ?? source?.id ?? decision.itemId ?? ""),
    rowId: String(decision.id ?? source?.id ?? decision.itemId ?? ""),
    itemId: firstText(decision.itemId, source?.itemId),
    section: firstText(decision.section, source?.section),
    sourceImage: firstText(decision.sourceImage, source?.sourceImage),
    screenshotPath: source?.screenshotPath ?? null,
    sourcePromptRaw,
    sourcePromptGloss,
    sourceOptionsRaw: array(firstArray(source?.optionsRawJa, source?.optionsRaw, source?.localizedOptions, source?.localizedText?.options)),
    sourceOptionsGloss: array(firstArray(source?.optionsGlossEn, source?.optionsTranslated, source?.translatedOptions, source?.translatedText?.options)),
    codexRecommendationAvailable: !markUnavailable,
    unavailableReason: markUnavailable ? unavailableReason : null,
    recommendedAction: action,
    recommendedQid,
    recommendedLocaleAnswerKey,
    answerKeyUnknown: markUnavailable ? false : decision.answerKeyUnknown === true,
    confidence: numberOrNull(
      decision.codexConfidence ??
      decision.reviewConfidence ??
      decision.confidence ??
      decision.aiReview?.confidence,
    ),
    reviewerNote: textOrNull(decision.reviewerNotes),
    rationale: textOrNull(decision.reviewerNotes ?? decision.rationale ?? decision.aiReview?.justification),
    topMatcherQid: topMatcher.qid,
    topMatcherScore: topMatcher.score,
    codexDisagreedWithTopMatcher: codexDisagreedWithTopMatcher({ action, recommendedQid, topMatcherQid: topMatcher.qid }),
    timestamp: generatedAt,
    modelToolLabel,
    sourceDecision: {
      approvedQid: normalizeQid(decision.approvedQid),
      createNewQuestion: decision.createNewQuestion === true,
      keepUnresolved: decision.keepUnresolved === true,
      deleteQuestion: decision.deleteQuestion === true,
      confirmedCorrectOptionKey: normalizeAnswerKey(decision.confirmedCorrectOptionKey),
      newQuestionLocalAnswerKey: normalizeAnswerKey(decision.newQuestionLocalAnswerKey),
      answerKeyUnknown: decision.answerKeyUnknown === true,
    },
  };
});

const output = {
  generatedAt,
  lang,
  batchId,
  dataset,
  schemaVersion: 1,
  source: "codex-review",
  modelToolLabel,
  recommendationSource: {
    type: markUnavailable ? "unavailable" : "workbench-decisions-snapshot",
    note: markUnavailable
      ? unavailableReason
      : "Snapshot generated from the current workbench decisions file. Use this command immediately after the Codex review pass and before human QC/export.",
  },
  sourcePaths: {
    workbenchDecisions: rel(decisionsPath),
    intake: relIfExists(path.join(IMPORTS_DIR, lang, batchId, "intake.json")),
    matched: relIfExists(path.join(IMPORTS_DIR, lang, batchId, "matched.json")),
    reviewNeeded: relIfExists(path.join(IMPORTS_DIR, lang, batchId, "review-needed.json")),
    unresolved: relIfExists(path.join(IMPORTS_DIR, lang, batchId, "unresolved.json")),
  },
  counts: {
    totalItems: items.length,
    availableRecommendations: items.filter((item) => item.codexRecommendationAvailable).length,
    unavailableRecommendations: items.filter((item) => !item.codexRecommendationAvailable).length,
    byRecommendedAction: countBy(items, (item) => item.recommendedAction ?? "unavailable"),
    disagreedWithTopMatcher: items.filter((item) => item.codexDisagreedWithTopMatcher).length,
  },
  items,
};

await fsp.mkdir(path.dirname(outPath), { recursive: true });
await fsp.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${rel(outPath)}`);
console.log(`Recommendation items: ${items.length}`);
if (markUnavailable) {
  console.log("Marked Codex recommendations unavailable; no recommendations were inferred.");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function requiredArg(name) {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value.trim();
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function loadSourceMaps({ lang, batchId }) {
  const batchDir = path.join(IMPORTS_DIR, lang, batchId);
  const maps = {
    byWorkbenchId: new Map(),
    byItemId: new Map(),
  };

  for (const [section, filename] of [
    ["auto-matched", "matched.json"],
    ["review-needed", "review-needed.json"],
    ["unresolved", "unresolved.json"],
  ]) {
    const doc = readJsonIfExists(path.join(batchDir, filename));
    for (const item of array(doc?.items)) {
      const normalized = { ...item, section, id: `${section}:${item.itemId}` };
      maps.byWorkbenchId.set(normalized.id, normalized);
      addUnique(maps.byItemId, normalized.itemId, normalized);
    }
  }

  const intakeDoc = readJsonIfExists(path.join(batchDir, "intake.json"));
  for (const item of array(intakeDoc?.items)) {
    addUnique(maps.byItemId, item.itemId ?? item.sourceImage ?? item.file, item);
  }

  return maps;
}

function resolveSourceForDecision(decision, sourceMaps) {
  const byId = sourceMaps.byWorkbenchId.get(String(decision.id ?? ""));
  if (byId) return byId;
  const itemId = firstText(decision.itemId, decision.sourceImage);
  return itemId ? sourceMaps.byItemId.get(itemId) ?? null : null;
}

function topMatcherFor(source, decision) {
  const direct = source?.match ?? null;
  const top = Array.isArray(source?.topCandidates) ? source.topCandidates[0] : null;
  return {
    qid: normalizeQid(direct?.qid ?? top?.qid ?? decision.initialSuggestedQid),
    score: numberOrNull(direct?.score ?? top?.score),
  };
}

function actionFromDecision(decision) {
  if (decision.deleteQuestion === true) return "deleteQuestion";
  if (decision.createNewQuestion === true) return "createNewQuestion";
  if (normalizeQid(decision.approvedQid)) return "approveExistingQid";
  if (decision.keepUnresolved === true) return "keepUnresolved";
  return null;
}

function answerKeyFromDecision(decision, action) {
  if (decision.answerKeyUnknown === true) return "UNKNOWN";
  if (action === "createNewQuestion") {
    return normalizeAnswerKey(decision.newQuestionLocalAnswerKey ?? decision.confirmedCorrectOptionKey);
  }
  if (action === "approveExistingQid") {
    return normalizeAnswerKey(
      decision.useCurrentStagedAnswerKey === true
        ? decision.currentStagedLocaleCorrectOptionKey
        : decision.confirmedCorrectOptionKey,
    );
  }
  return null;
}

function codexDisagreedWithTopMatcher({ action, recommendedQid, topMatcherQid }) {
  if (!topMatcherQid) return false;
  if (action !== "approveExistingQid") return action !== null;
  return Boolean(recommendedQid && recommendedQid !== topMatcherQid);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function relIfExists(filePath) {
  return fs.existsSync(filePath) ? rel(filePath) : null;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function addUnique(map, key, value) {
  const normalized = textOrNull(key);
  if (!normalized) return;
  if (map.has(normalized)) {
    map.set(normalized, null);
    return;
  }
  map.set(normalized, value);
}

function firstText(...values) {
  for (const value of values) {
    const text = textOrNull(value);
    if (text) return text;
  }
  return null;
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function textOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^q?(\d+)$/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "UNKNOWN") return "UNKNOWN";
  return /^[A-D]$/.test(text) ? text : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([left], [right]) => left.localeCompare(right)));
}
