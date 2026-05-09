#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");

const args = parseArgs(process.argv.slice(2));
const lang = requiredArg("lang");
const batchId = requiredArg("batch");

const codexPath = args["codex-path"]
  ? path.resolve(String(args["codex-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-codex-recommendations.json`);
const humanPath = args["human-path"]
  ? path.resolve(String(args["human-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);
const outJsonPath = args["out-json"]
  ? path.resolve(String(args["out-json"]))
  : path.join(REPORTS_DIR, `${lang}-${batchId}-codex-vs-human-review.json`);
const outMdPath = args["out-md"]
  ? path.resolve(String(args["out-md"]))
  : path.join(REPORTS_DIR, `${lang}-${batchId}-codex-vs-human-review.md`);

if (!fs.existsSync(codexPath)) {
  throw new Error(`Missing Codex recommendation snapshot: ${rel(codexPath)}. Run snapshot-codex-recommendations first, or create an unavailable snapshot with --mark-unavailable true.`);
}
if (!fs.existsSync(humanPath)) {
  throw new Error(`Missing human workbench decisions file: ${rel(humanPath)}`);
}

const codexDoc = readJson(codexPath);
const humanDoc = readJson(humanPath);
const codexItems = array(codexDoc.items);
const humanItems = array(humanDoc.items);
const humanById = new Map(humanItems.map((item) => [String(item.id ?? ""), item]));
const humanByItemId = buildUniqueMap(humanItems, "itemId");

const generatedAt = new Date().toISOString();
const rows = codexItems.map((codexItem) => {
  const humanItem = resolveHumanItem(codexItem);
  const codex = normalizeCodex(codexItem);
  const human = normalizeHuman(humanItem);
  const comparable = codex.available && Boolean(humanItem);
  const same = comparable ? decisionsSame(codex, human) : false;
  const changedAnswerKey = comparable && keyChanged(codex, human);
  const qidChanged = comparable && codex.action === "approveExistingQid" && human.action === "approveExistingQid" && codex.qid !== human.qid;

  return {
    id: String(codexItem.id ?? codexItem.rowId ?? codexItem.itemId ?? ""),
    itemId: codexItem.itemId ?? humanItem?.itemId ?? null,
    section: codexItem.section ?? humanItem?.section ?? null,
    sourceImage: codexItem.sourceImage ?? humanItem?.sourceImage ?? null,
    sourcePromptRaw: codexItem.sourcePromptRaw ?? null,
    sourcePromptGloss: codexItem.sourcePromptGloss ?? null,
    codexAvailable: codex.available,
    unavailableReason: codexItem.unavailableReason ?? null,
    comparable,
    same,
    codex,
    human,
    topMatcherQid: normalizeQid(codexItem.topMatcherQid),
    codexDisagreedWithTopMatcher: codexItem.codexDisagreedWithTopMatcher === true,
    qidChanged,
    changedAnswerKey,
    riskTags: riskTagsFor({ codex, human, qidChanged, changedAnswerKey, codexItem }),
    reviewerNote: humanItem?.reviewerNotes ?? null,
    codexRationale: codexItem.rationale ?? codexItem.reviewerNote ?? null,
  };
});

const comparableRows = rows.filter((row) => row.comparable);
const sameRows = comparableRows.filter((row) => row.same);
const differentRows = comparableRows.filter((row) => !row.same);
const codexApproveRows = comparableRows.filter((row) => row.codex.action === "approveExistingQid");
const codexApproveCorrectRows = codexApproveRows.filter((row) =>
  row.human.action === "approveExistingQid" && row.codex.qid && row.codex.qid === row.human.qid,
);

const cases = {
  qidDiffered: differentRows.filter((row) => row.qidChanged),
  codexCreateHumanApproved: differentRows.filter((row) => row.codex.action === "createNewQuestion" && row.human.action === "approveExistingQid"),
  codexApprovedHumanUnresolved: differentRows.filter((row) => row.codex.action === "approveExistingQid" && row.human.action === "keepUnresolved"),
  unknownAnswerKeyCases: comparableRows.filter((row) => row.codex.answerKey === "UNKNOWN" || row.human.answerKey === "UNKNOWN"),
  changedAnswerKeyCases: comparableRows.filter((row) => row.changedAnswerKey),
  actionDifferences: differentRows.filter((row) => row.codex.action !== row.human.action),
  topMatcherDisagreements: comparableRows.filter((row) => row.codexDisagreedWithTopMatcher),
};

const summary = {
  generatedAt,
  lang,
  batchId,
  totalCodexItems: codexItems.length,
  totalHumanItems: humanItems.length,
  totalCompared: comparableRows.length,
  codexUnavailableCount: rows.filter((row) => !row.codexAvailable).length,
  missingHumanDecisionCount: rows.filter((row) => row.codexAvailable && !row.comparable).length,
  codexHumanSameCount: sameRows.length,
  codexHumanDifferentCount: differentRows.length,
  codexHumanSameRate: ratio(sameRows.length, comparableRows.length),
  codexApproveExistingQidCount: codexApproveRows.length,
  codexApproveExistingQidCorrectCount: codexApproveCorrectRows.length,
  codexApproveExistingQidAccuracyRate: ratio(codexApproveCorrectRows.length, codexApproveRows.length),
  unknownAnswerKeyCount: cases.unknownAnswerKeyCases.length,
  changedAnswerKeyCount: cases.changedAnswerKeyCases.length,
  byCodexAction: countBy(comparableRows, (row) => row.codex.action ?? "unknown"),
  byHumanAction: countBy(comparableRows, (row) => row.human.action ?? "unknown"),
  byActionTransition: countBy(differentRows, (row) => `${row.codex.action ?? "unknown"} -> ${row.human.action ?? "unknown"}`),
};

const highestRiskCorrectionPatterns = buildRiskPatterns({ differentRows, cases });
const output = {
  generatedAt,
  lang,
  batchId,
  schemaVersion: 1,
  sourcePaths: {
    codexRecommendations: rel(codexPath),
    humanDecisions: rel(humanPath),
  },
  summary,
  cases: mapCaseRows(cases),
  highestRiskCorrectionPatterns,
  rows,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(outJsonPath, `${JSON.stringify(output, null, 2)}\n`);
await fsp.writeFile(outMdPath, renderMarkdown(output));

console.log(`Wrote ${rel(outJsonPath)}`);
console.log(`Wrote ${rel(outMdPath)}`);
console.log(`Compared ${summary.totalCompared} item(s); ${summary.codexHumanDifferentCount} differed.`);

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

function resolveHumanItem(codexItem) {
  const byId = humanById.get(String(codexItem.id ?? codexItem.rowId ?? ""));
  if (byId) return byId;
  const itemId = String(codexItem.itemId ?? codexItem.sourceImage ?? "").trim();
  return itemId ? humanByItemId.get(itemId) ?? null : null;
}

function normalizeCodex(item) {
  const action = normalizeAction(item.recommendedAction);
  return {
    available: item.codexRecommendationAvailable !== false && Boolean(action),
    action,
    qid: normalizeQid(item.recommendedQid),
    answerKey: normalizeAnswerKey(item.recommendedLocaleAnswerKey ?? (item.answerKeyUnknown ? "UNKNOWN" : null)),
    confidence: numberOrNull(item.confidence),
    note: item.reviewerNote ?? item.rationale ?? null,
  };
}

function normalizeHuman(item) {
  const action = actionFromDecision(item);
  return {
    action,
    qid: action === "approveExistingQid" ? normalizeQid(item?.approvedQid) : null,
    answerKey: answerKeyFromDecision(item, action),
    note: item?.reviewerNotes ?? null,
  };
}

function actionFromDecision(item) {
  if (!item || typeof item !== "object") return null;
  if (item.deleteQuestion === true) return "deleteQuestion";
  if (item.createNewQuestion === true) return "createNewQuestion";
  if (normalizeQid(item.approvedQid)) return "approveExistingQid";
  if (item.keepUnresolved === true) return "keepUnresolved";
  return null;
}

function answerKeyFromDecision(item, action) {
  if (!item || typeof item !== "object") return null;
  if (item.answerKeyUnknown === true) return "UNKNOWN";
  if (action === "createNewQuestion") {
    return normalizeAnswerKey(item.newQuestionLocalAnswerKey ?? item.confirmedCorrectOptionKey);
  }
  if (action === "approveExistingQid") {
    return normalizeAnswerKey(item.useCurrentStagedAnswerKey === true ? item.currentStagedLocaleCorrectOptionKey : item.confirmedCorrectOptionKey);
  }
  return null;
}

function decisionsSame(codex, human) {
  if (codex.action !== human.action) return false;
  if (codex.action === "approveExistingQid" && codex.qid !== human.qid) return false;
  if (["approveExistingQid", "createNewQuestion"].includes(codex.action) && keyChanged(codex, human)) return false;
  return true;
}

function keyChanged(codex, human) {
  if (!codex.answerKey && !human.answerKey) return false;
  return codex.answerKey !== human.answerKey;
}

function riskTagsFor({ codex, human, qidChanged, changedAnswerKey, codexItem }) {
  const haystack = [
    codexItem.sourcePromptRaw,
    codexItem.sourcePromptGloss,
    codexItem.sourceOptionsRaw?.join(" "),
    codexItem.sourceOptionsGloss?.join(" "),
    codexItem.reviewerNote,
    codexItem.rationale,
  ].filter(Boolean).join(" ").toLowerCase();
  const tags = [];
  if (qidChanged) tags.push("qid-diff");
  if (changedAnswerKey) tags.push("answer-key-diff");
  if (codex.action !== human.action) tags.push("action-diff");
  if (codexItem.sourceImage) tags.push("image-based");
  if (/\b(sign|signal|marking|lane|traffic light|arrow|speed|km|indicator|dashboard|wiper|washer|defog|fog|penalty|points?)\b/.test(haystack)) {
    tags.push("known-risk-domain");
  }
  if (codex.answerKey === "UNKNOWN" || human.answerKey === "UNKNOWN") tags.push("unknown-answer-key");
  return tags;
}

function buildRiskPatterns({ differentRows, cases }) {
  const qidPairs = countBy(cases.qidDiffered, (row) => `${row.codex.qid ?? "none"} -> ${row.human.qid ?? "none"}`);
  const actionTransitions = countBy(differentRows, (row) => `${row.codex.action ?? "unknown"} -> ${row.human.action ?? "unknown"}`);
  const answerKeyTransitions = countBy(cases.changedAnswerKeyCases, (row) => `${row.codex.answerKey ?? "none"} -> ${row.human.answerKey ?? "none"}`);
  const imageRiskExamples = differentRows.filter((row) => row.sourceImage).slice(0, 12).map(exampleForRow);
  const knownRiskDomainExamples = differentRows.filter((row) => row.riskTags.includes("known-risk-domain")).slice(0, 12).map(exampleForRow);

  return {
    repeatedQidConfusionPairs: topEntries(qidPairs, 20),
    actionCorrectionPatterns: topEntries(actionTransitions, 20),
    answerKeyReorderWarnings: topEntries(answerKeyTransitions, 20),
    imageBasedCorrectionExamples: imageRiskExamples,
    trafficSignDashboardIndicatorExamples: knownRiskDomainExamples,
  };
}

function mapCaseRows(caseMap) {
  return Object.fromEntries(
    Object.entries(caseMap).map(([key, rows]) => [
      key,
      rows.map(exampleForRow),
    ]),
  );
}

function exampleForRow(row) {
  return {
    id: row.id,
    itemId: row.itemId,
    sourceImage: row.sourceImage,
    sourcePromptGloss: row.sourcePromptGloss,
    codexAction: row.codex.action,
    codexQid: row.codex.qid,
    codexAnswerKey: row.codex.answerKey,
    humanAction: row.human.action,
    humanQid: row.human.qid,
    humanAnswerKey: row.human.answerKey,
    riskTags: row.riskTags,
    reviewerNote: row.reviewerNote,
    codexRationale: row.codexRationale,
  };
}

function renderMarkdown(output) {
  const { summary } = output;
  const lines = [];
  lines.push(`# Codex vs Human Review - ${output.lang} ${output.batchId}`, "");
  lines.push(`Generated: ${output.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Total compared: ${summary.totalCompared}`);
  lines.push(`- Same: ${summary.codexHumanSameCount}`);
  lines.push(`- Different: ${summary.codexHumanDifferentCount}`);
  lines.push(`- Codex unavailable: ${summary.codexUnavailableCount}`);
  lines.push(`- Approve-existing-qid accuracy: ${formatRate(summary.codexApproveExistingQidAccuracyRate)} (${summary.codexApproveExistingQidCorrectCount}/${summary.codexApproveExistingQidCount})`);
  lines.push(`- UNKNOWN answer key cases: ${summary.unknownAnswerKeyCount}`);
  lines.push(`- Changed answer key cases: ${summary.changedAnswerKeyCount}`);
  lines.push("");
  lines.push("## Action Transitions", "");
  lines.push(...markdownTable(Object.entries(summary.byActionTransition).map(([transition, count]) => ({ transition, count })), ["transition", "count"]));
  lines.push("");
  lines.push("## Qid Differences", "");
  lines.push(...markdownTable(output.cases.qidDiffered.slice(0, 25), ["itemId", "codexQid", "humanQid", "sourcePromptGloss", "reviewerNote"]));
  lines.push("");
  lines.push("## Changed Answer Keys", "");
  lines.push(...markdownTable(output.cases.changedAnswerKeyCases.slice(0, 25), ["itemId", "codexQid", "humanQid", "codexAnswerKey", "humanAnswerKey", "sourcePromptGloss"]));
  lines.push("");
  lines.push("## Highest-Risk Correction Patterns", "");
  lines.push("### Qid Confusion Pairs", "");
  lines.push(...markdownTable(output.highestRiskCorrectionPatterns.repeatedQidConfusionPairs, ["key", "count"]));
  lines.push("");
  lines.push("### Action Corrections", "");
  lines.push(...markdownTable(output.highestRiskCorrectionPatterns.actionCorrectionPatterns, ["key", "count"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function markdownTable(rows, columns) {
  if (!rows.length) return ["None."];
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escape(row[column])).join(" | ")} |`),
  ];
}

function normalizeAction(value) {
  const raw = String(value ?? "").trim();
  if (["approveExistingQid", "createNewQuestion", "keepUnresolved", "deleteQuestion"].includes(raw)) return raw;
  const lowered = raw.toLowerCase();
  if (["approve", "approved", "existing", "approve-existing-qid"].includes(lowered)) return "approveExistingQid";
  if (["new", "create", "create-new-question"].includes(lowered)) return "createNewQuestion";
  if (["unresolved", "keep-unresolved"].includes(lowered)) return "keepUnresolved";
  if (["delete", "deleted", "delete-question"].includes(lowered)) return "deleteQuestion";
  return null;
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

function buildUniqueMap(items, field) {
  const map = new Map();
  const duplicates = new Set();
  for (const item of items) {
    const key = String(item?.[field] ?? "").trim();
    if (!key) continue;
    if (map.has(key)) {
      duplicates.add(key);
      continue;
    }
    map.set(key, item);
  }
  for (const key of duplicates) map.delete(key);
  return map;
}

function topEntries(counts, limit) {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, limit);
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item) ?? "unknown";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([left], [right]) => left.localeCompare(right)));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function formatRate(value) {
  return value == null ? "n/a" : `${Math.round(value * 1000) / 10}%`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
