import fs from "node:fs";
import path from "node:path";

const DEFAULT_DATASET = "2023-test1";
const REPORT_JSON = "qbank-tools/generated/reports/tag-intelligence-report.json";
const REPORT_MD = "qbank-tools/generated/reports/tag-intelligence-report.md";
const LOW_CONFIDENCE_TAG = "needs-tag-review";
const LOW_CONFIDENCE_SCORE_CAP = 0.08;

const TAG_FAMILIES = {
  "traffic-light": ["traffic-light", "red-light", "yellow-light", "green-light", "signal-light", "traffic-signal"],
  "prohibition-sign": [
    "red-circle",
    "prohibition",
    "prohibited",
    "no-entry",
    "no-u-turn",
    "no-left-turn",
    "no-right-turn",
    "no-parking",
    "no-stopping",
    "no-overtaking",
    "do-not-enter",
  ],
  "warning-sign": ["yellow-triangle", "warning", "warning-sign", "triangle", "danger", "caution"],
  "mandatory-sign": ["blue-circle", "mandatory", "mandatory-sign", "blue-sign"],
  "direction": ["arrow", "left-turn", "right-turn", "u-turn", "straight", "straight-ahead", "turn"],
};

const OPPOSITE_TAG_PAIRS = [
  ["left-turn", "no-left-turn"],
  ["right-turn", "no-right-turn"],
  ["u-turn", "no-u-turn"],
  ["entry", "no-entry"],
  ["parking", "no-parking"],
  ["stopping", "no-stopping"],
  ["overtaking", "no-overtaking"],
  ["red-light", "green-light"],
  ["green-light", "red-light"],
  ["allowed", "prohibited"],
  ["mandatory", "prohibition"],
];

const SYMBOL_TAGS = new Map([
  ["!", "exclamation"],
  ["+", "plus"],
  ["-", "minus"],
  ["^", "up-arrow"],
  ["<", "left-arrow"],
  [">", "right-arrow"],
]);

let defaultContext = null;

const familyByTag = new Map(
  Object.entries(TAG_FAMILIES).flatMap(([family, tags]) => tags.map((tag) => [normalizeTag(tag), family])),
);

export function normalizeTag(tag) {
  const raw = String(tag ?? "").trim();
  if (SYMBOL_TAGS.has(raw)) return SYMBOL_TAGS.get(raw);
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[_\s/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function loadTagIntelligence({ root = process.cwd(), dataset = DEFAULT_DATASET } = {}) {
  return createTagIntelligence({ root, dataset });
}

export function createTagIntelligence({
  root = process.cwd(),
  dataset = DEFAULT_DATASET,
  imageTagsDoc = null,
  decisionMemoryDoc = null,
  questionsDoc = null,
} = {}) {
  const datasetDir = path.join(root, "public", "qbank", dataset);
  const imageTagsPath = path.join(datasetDir, "image-color-tags.json");
  const questionsPath = path.join(datasetDir, "questions.json");
  const decisionMemoryPath = path.join(root, "qbank-tools", "history", "decision-memory.json");
  const tagDoc = imageTagsDoc ?? readJsonIfExists(imageTagsPath, { meta: {}, questions: {} });
  const qDoc = questionsDoc ?? readJsonIfExists(questionsPath, { questions: [] });
  const memoryDoc = decisionMemoryDoc ?? readJsonIfExists(decisionMemoryPath, { records: [] });
  const tagMap = buildTagMap(tagDoc);
  const masterQids = questionArray(qDoc).map((question) => normalizeQid(question.id ?? question.qid)).filter(Boolean);
  return {
    root,
    dataset,
    imageTagsPath,
    questionsPath,
    decisionMemoryPath,
    tagDoc,
    questionsDoc: qDoc,
    decisionMemoryDoc: memoryDoc,
    masterQids,
    tagMap,
    objectVocabulary: new Set((tagDoc.meta?.objectVocabulary ?? []).map(normalizeTag).filter(Boolean)),
    colorVocabulary: new Set((tagDoc.meta?.colorVocabulary ?? []).map(normalizeTag).filter(Boolean)),
  };
}

export function getQidTags(qid, context = getDefaultContext()) {
  const entry = context.tagMap.get(normalizeQid(qid));
  return entry ? cloneTagEntry(entry) : emptyTagEntry();
}

export function tagSimilarity(qidA, qidB, context = getDefaultContext()) {
  return explainTagOverlap(qidA, qidB, context).score;
}

export function candidateTagScore(targetQid, candidateQidOrTags, context = getDefaultContext()) {
  const target = getQidTags(targetQid, context);
  const candidate = tagsFromCandidate(candidateQidOrTags, context);
  return scoreTagEntries(target, candidate);
}

export function explainTagOverlap(qidA, qidB, context = getDefaultContext()) {
  const left = getQidTags(qidA, context);
  const right = getQidTags(qidB, context);
  return {
    qidA: normalizeQid(qidA),
    qidB: normalizeQid(qidB),
    ...scoreTagEntries(left, right),
  };
}

export async function writeTagIntelligenceReport({
  root = process.cwd(),
  dataset = DEFAULT_DATASET,
  context = null,
  usage = {},
} = {}) {
  const active = context ?? createTagIntelligence({ root, dataset });
  const report = buildTagIntelligenceReport({ context: active, usage });
  const jsonPath = path.join(root, REPORT_JSON);
  const mdPath = path.join(root, REPORT_MD);
  await fs.promises.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.promises.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(mdPath, renderTagIntelligenceMarkdown(report), "utf8");
  return { jsonPath, mdPath, report };
}

export function buildTagIntelligenceReport({ context = getDefaultContext(), usage = {} } = {}) {
  const rows = context.masterQids.map((qid) => ({ qid, tags: getQidTags(qid, context) }));
  const qidsWithObjectTags = rows.filter((row) => row.tags.objectTags.length > 0).length;
  const qidsMissingObjectTags = rows.length - qidsWithObjectTags;
  const trustedTagQids = rows.filter((row) => row.tags.objectTags.length > 0 && !row.tags.lowConfidence).length;
  const lowConfidenceTagQids = rows.filter((row) => row.tags.lowConfidence).length;
  const missingTagQids = rows.filter((row) => row.tags.objectTags.length === 0).length;
  const imageQidsMissingObjectTags = rows.filter((row) => row.tags.assetSrcs.length > 0 && row.tags.objectTags.length === 0).length;
  const topTags = topCounts(rows.flatMap((row) => row.tags.trustedObjectTags), 40);
  const vocabulary = context.objectVocabulary;
  const tagsNotInObjectVocabulary = [...new Set(rows.flatMap((row) => row.tags.objectTags).filter((tag) => !vocabulary.has(tag)))].sort();
  const possibleTagFamilies = Object.fromEntries(
    Object.entries(TAG_FAMILIES).map(([family, tags]) => [
      family,
      tags.map(normalizeTag).filter((tag) => rows.some((row) => row.tags.allTags.includes(tag))),
    ]),
  );
  const oppositeTagPairsDetected = detectOppositeTagPairs(rows);
  return {
    generatedAt: new Date().toISOString(),
    dataset: context.dataset,
    sources: {
      imageColorTags: relative(context.root, context.imageTagsPath),
      decisionMemory: relative(context.root, context.decisionMemoryPath),
    },
    summary: {
      totalMasterQids: rows.length,
      totalQidsWithObjectTags: qidsWithObjectTags,
      totalQidsMissingObjectTags: qidsMissingObjectTags,
      trustedTagQids,
      lowConfidenceTagQids,
      missingTagQids,
      imageQidsMissingObjectTags,
      topTagCount: topTags.length,
      tagsOutsideVocabulary: tagsNotInObjectVocabulary.length,
      oppositeTagPairsDetected: oppositeTagPairsDetected.length,
    },
    topTags,
    tagsNotInObjectVocabulary,
    possibleTagFamilies,
    oppositeTagPairsDetected,
    usage: {
      duplicateAuditTagScoreUsage: usage.duplicateAuditTagScoreUsage ?? 0,
      newQuestionGateTagScoreUsage: usage.newQuestionGateTagScoreUsage ?? "enabled",
      imageReplacementTagScoreUsage: usage.imageReplacementTagScoreUsage ?? "enabled",
    },
  };
}

export function renderTagIntelligenceMarkdown(report) {
  const lines = [];
  lines.push("# Tag Intelligence Report", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Total master qids: ${report.summary.totalMasterQids}`);
  lines.push(`- Qids with objectTags: ${report.summary.totalQidsWithObjectTags}`);
  lines.push(`- Qids missing objectTags: ${report.summary.totalQidsMissingObjectTags}`);
  lines.push(`- Trusted-tag qids: ${report.summary.trustedTagQids}`);
  lines.push(`- Low-confidence-tag qids: ${report.summary.lowConfidenceTagQids}`);
  lines.push(`- Missing-tag qids: ${report.summary.missingTagQids}`);
  lines.push(`- Image qids missing objectTags: ${report.summary.imageQidsMissingObjectTags}`);
  lines.push(`- Tags outside objectVocabulary: ${report.summary.tagsOutsideVocabulary}`);
  lines.push(`- Opposite-tag pairs detected: ${report.summary.oppositeTagPairsDetected}`);
  lines.push("", "## Top Tags", "");
  lines.push(...markdownTable(report.topTags, ["tag", "count"]));
  lines.push("", "## Tags Not In Object Vocabulary", "");
  lines.push(report.tagsNotInObjectVocabulary.length ? report.tagsNotInObjectVocabulary.map((tag) => `- ${tag}`).join("\n") : "None.");
  lines.push("", "## Possible Tag Families", "");
  for (const [family, tags] of Object.entries(report.possibleTagFamilies)) {
    lines.push(`- ${family}: ${tags.length ? tags.join(", ") : "none detected"}`);
  }
  lines.push("", "## Opposite-Tag Pairs Detected", "");
  lines.push(...markdownTable(report.oppositeTagPairsDetected.slice(0, 80), ["qidA", "qidB", "tagA", "tagB"]));
  lines.push("", "## Integration Usage", "");
  lines.push(`- Duplicate audit tag-score usage: ${report.usage.duplicateAuditTagScoreUsage}`);
  lines.push(`- New-question gate tag-score usage: ${report.usage.newQuestionGateTagScoreUsage}`);
  lines.push(`- Image replacement tag-score usage: ${report.usage.imageReplacementTagScoreUsage}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function scoreTagEntries(left, right) {
  const leftTags = new Set(left.allTags);
  const rightTags = new Set(right.allTags);
  const exactOverlap = [...leftTags].filter((tag) => rightTags.has(tag)).sort();
  const familyOverlap = intersectFamilies(left.familyTags, right.familyTags);
  const oppositePairs = findOppositePairs(left.allTags, right.allTags);
  const hasLowConfidenceTags = left.lowConfidence || right.lowConfidence;
  const hasImageSignal = left.assetSrcs.length > 0 || right.assetSrcs.length > 0 || left.allTags.length > 0 || right.allTags.length > 0;
  if (!left.allTags.length || !right.allTags.length) {
    return {
      score: 0,
      exactScore: 0,
      familyScore: 0,
      exactOverlap,
      familyOverlap,
      oppositePairs,
      lowConfidence: hasLowConfidenceTags,
      warning: hasLowConfidenceTags ? "low-confidence auto-backfilled tags" : null,
      confidence: hasImageSignal ? "empty-tags" : "no-image-or-tags",
      reason: hasLowConfidenceTags ? "low-confidence auto-backfilled tags" : "empty tags do not create confidence",
    };
  }
  const exactScore = jaccard(leftTags, rightTags);
  const familyScore = familyOverlap.length ? jaccard(new Set(left.familyTags), new Set(right.familyTags)) : 0;
  const oppositePenalty = oppositePairs.length ? 0.35 : 0;
  const rawScore = clamp01(exactScore * 0.72 + familyScore * 0.42 - oppositePenalty);
  const score = hasLowConfidenceTags ? Math.min(rawScore, LOW_CONFIDENCE_SCORE_CAP) : rawScore;
  return {
    score: round(score),
    rawScore: round(rawScore),
    exactScore: round(exactScore),
    familyScore: round(familyScore),
    exactOverlap,
    familyOverlap,
    oppositePairs,
    lowConfidence: hasLowConfidenceTags,
    warning: hasLowConfidenceTags ? "low-confidence auto-backfilled tags" : null,
    confidence: hasLowConfidenceTags ? "low-confidence-auto-backfilled-tags" : oppositePairs.length ? "opposite-tags" : score > 0 ? "tag-signal" : "no-overlap",
    reason: hasLowConfidenceTags ? "low-confidence auto-backfilled tags" : explainScore({ exactOverlap, familyOverlap, oppositePairs, score }),
  };
}

function tagsFromCandidate(candidate, context) {
  if (typeof candidate === "string") return getQidTags(candidate, context);
  if (candidate instanceof Set) return tagEntryFromTags([...candidate]);
  if (Array.isArray(candidate)) return tagEntryFromTags(candidate);
  if (candidate && typeof candidate === "object") {
    const qid = candidate.qid ?? candidate.referencedQid ?? candidate.contextQid;
    if (qid) return mergeTagEntries([getQidTags(qid, context), tagEntryFromTags(flattenCandidateTags(candidate))]);
    const qids = [...(candidate.referencedQids ?? []), ...(candidate.contextQids ?? [])].filter(Boolean);
    if (qids.length) return mergeTagEntries([...qids.map((entry) => getQidTags(entry, context)), tagEntryFromTags(flattenCandidateTags(candidate))]);
    return tagEntryFromTags(flattenCandidateTags(candidate));
  }
  return emptyTagEntry();
}

function flattenCandidateTags(candidate) {
  return [
    ...(candidate.tags instanceof Set ? [...candidate.tags] : Array.isArray(candidate.tags) ? candidate.tags : []),
    ...(candidate.objectTags ?? []),
    ...(candidate.colorTags ?? []),
    ...(candidate.allTags ?? []),
  ];
}

function buildTagMap(doc) {
  const rawQuestions = doc?.questions ?? {};
  const entries = Array.isArray(rawQuestions)
    ? rawQuestions.map((entry) => [entry.qid ?? entry.id, entry])
    : Object.entries(rawQuestions);
  return new Map(entries.map(([qid, entry]) => [normalizeQid(qid), normalizeTagEntry(entry)]).filter(([qid]) => qid));
}

function normalizeTagEntry(entry) {
  return tagEntryFromTags({
    colorTags: entry?.colorTags ?? [],
    objectTags: entry?.objectTags ?? [],
    assetSrcs: entry?.assetSrcs ?? [],
  });
}

function tagEntryFromTags(input) {
  const colorTags = Array.isArray(input?.colorTags) ? input.colorTags.map(normalizeTag).filter(Boolean) : [];
  const objectTags = Array.isArray(input?.objectTags)
    ? input.objectTags.map(normalizeTag).filter(Boolean)
    : (Array.isArray(input) ? input.map(normalizeTag).filter(Boolean) : []);
  const trustedObjectTags = objectTags.filter((tag) => tag !== LOW_CONFIDENCE_TAG);
  const lowConfidence = objectTags.includes(LOW_CONFIDENCE_TAG);
  const scoringObjectTags = lowConfidence ? [] : trustedObjectTags;
  const allTags = [...new Set([...colorTags, ...scoringObjectTags].filter(Boolean))].sort();
  const assetSrcs = Array.isArray(input?.assetSrcs) ? input.assetSrcs.map(String).filter(Boolean) : [];
  return {
    colorTags: [...new Set(colorTags)].sort(),
    objectTags: [...new Set(objectTags)].sort(),
    trustedObjectTags: [...new Set(trustedObjectTags)].sort(),
    allTags,
    familyTags: [...new Set(allTags.map((tag) => familyByTag.get(tag)).filter(Boolean))].sort(),
    assetSrcs,
    lowConfidence,
  };
}

function mergeTagEntries(entries) {
  return tagEntryFromTags({
    colorTags: entries.flatMap((entry) => entry.colorTags),
    objectTags: entries.flatMap((entry) => entry.objectTags),
    assetSrcs: entries.flatMap((entry) => entry.assetSrcs),
  });
}

function cloneTagEntry(entry) {
  return {
    colorTags: [...entry.colorTags],
    objectTags: [...entry.objectTags],
    trustedObjectTags: [...entry.trustedObjectTags],
    allTags: [...entry.allTags],
    familyTags: [...entry.familyTags],
    assetSrcs: [...entry.assetSrcs],
    lowConfidence: entry.lowConfidence,
  };
}

function emptyTagEntry() {
  return { colorTags: [], objectTags: [], trustedObjectTags: [], allTags: [], familyTags: [], assetSrcs: [], lowConfidence: false };
}

function intersectFamilies(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left.filter((family) => rightSet.has(family)))].sort();
}

function findOppositePairs(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return OPPOSITE_TAG_PAIRS
    .filter(([a, b]) => (leftSet.has(a) && rightSet.has(b)) || (leftSet.has(b) && rightSet.has(a)))
    .map(([a, b]) => ({ tagA: a, tagB: b }));
}

function detectOppositeTagPairs(rows) {
  const out = [];
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const oppositePairs = findOppositePairs(rows[leftIndex].tags.allTags, rows[rightIndex].tags.allTags);
      if (!oppositePairs.length) continue;
      for (const pair of oppositePairs) {
        out.push({ qidA: rows[leftIndex].qid, qidB: rows[rightIndex].qid, ...pair });
      }
    }
  }
  return out.slice(0, 500);
}

function explainScore({ exactOverlap, familyOverlap, oppositePairs, score }) {
  if (oppositePairs.length) return "opposite tags reduce duplicate confidence";
  if (exactOverlap.length) return `exact tag overlap: ${exactOverlap.join(", ")}`;
  if (familyOverlap.length) return `same tag family: ${familyOverlap.join(", ")}`;
  return score > 0 ? "weak tag similarity" : "no tag similarity";
}

function getDefaultContext() {
  defaultContext ??= createTagIntelligence();
  return defaultContext;
}

function normalizeQid(value) {
  const match = String(value ?? "").match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  if (doc?.questions && typeof doc.questions === "object") {
    return Object.entries(doc.questions).map(([qid, value]) => ({ id: qid, ...value }));
  }
  return [];
}

function topCounts(values, limit) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value) {
  return Number(value.toFixed(4));
}

function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function relative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function markdownTable(rows, columns) {
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
