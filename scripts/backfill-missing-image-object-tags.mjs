#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { normalizeTag } from "../qbank-tools/lib/tag-intelligence.mjs";

const ROOT = process.cwd();
const DATASET = "2023-test1";
const DATASET_DIR = path.join(ROOT, "public", "qbank", DATASET);
const QUESTIONS_PATH = path.join(DATASET_DIR, "questions.json");
const RAW_QUESTIONS_PATH = path.join(DATASET_DIR, "questions.raw.json");
const IMAGE_TAGS_PATH = path.join(DATASET_DIR, "image-color-tags.json");
const TAG_REPORT_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "tag-intelligence-report.json");
const OUT_JSON = path.join(ROOT, "qbank-tools", "generated", "reports", "missing-image-object-tags-backfill.json");
const OUT_MD = path.join(ROOT, "qbank-tools", "generated", "reports", "missing-image-object-tags-backfill.md");
const REVIEW_TAG = "needs-tag-review";
const TAG_RULES = [
  rule(["traffic light", "traffic signal", "signal light", "signal lights", "three lights", "three signals"], ["traffic-light"], "traffic signal wording"),
  rule(["red light"], ["traffic-light", "red-light"], "red traffic light wording"),
  rule(["yellow light"], ["traffic-light", "yellow-light"], "yellow traffic light wording"),
  rule(["green light"], ["traffic-light", "green-light"], "green traffic light wording"),
  rule(["crosswalk", "pedestrian crossing"], ["crosswalk", "pedestrian"], "crosswalk/pedestrian wording"),
  rule(["pedestrian", "pedestrians"], ["pedestrian"], "pedestrian wording"),
  rule(["bicycle", "bike", "cycle"], ["bicycle"], "bicycle wording"),
  rule(["bus stop"], ["bus", "bus-stop"], "bus stop wording"),
  rule(["bus"], ["bus"], "bus wording"),
  rule(["train", "railroad", "railway", "level crossing"], ["train", "railroad"], "railroad/train wording"),
  rule(["snow", "snowy"], ["snow"], "snow wording"),
  rule(["rain", "rainy"], ["rain"], "rain wording"),
  rule(["fog", "foggy", "mist"], ["fog"], "fog/mist wording"),
  rule(["tunnel"], ["tunnel"], "tunnel wording"),
  rule(["intersection", "crossroad"], ["intersection"], "intersection wording"),
  rule(["roundabout"], ["roundabout"], "roundabout wording"),
  rule(["highway", "expressway"], ["highway"], "highway wording"),
  rule(["bridge", "overpass"], ["bridge"], "bridge/overpass wording"),
  rule(["mountain", "landslide", "falling rocks", "rock", "rocks", "slope", "cliff"], ["mountain", "rocks"], "mountain/rock/slope wording"),
  rule(["children", "child", "school"], ["children"], "children/school wording"),
  rule(["disabled", "wheelchair", "handicap"], ["wheelchair", "disabled"], "disabled/wheelchair wording"),
  rule(["parking"], ["parking"], "parking wording"),
  rule(["gas station", "gas pump", "fuel"], ["gas-station", "gas-pump"], "gas/fuel wording"),
  rule(["telephone", "phone"], ["telephone"], "phone wording"),
  rule(["horn", "honk"], ["horn"], "horn wording"),
  rule(["seat belt", "seatbelt"], ["seatbelt"], "seatbelt wording"),
  rule(["battery"], ["battery"], "battery wording"),
  rule(["brake"], ["brake"], "brake wording"),
  rule(["wiper", "wipers", "windshield"], ["wiper", "windshield"], "wiper/windshield wording"),
  rule(["open door"], ["open-door"], "open door wording"),
  rule(["open hood"], ["open-hood"], "open hood wording"),
  rule(["open trunk"], ["open-trunk"], "open trunk wording"),
  rule(["turn signal", "turn signals", "blinkers"], ["turn-signals"], "turn signal wording"),
  rule(["left turn"], ["left-turn", "arrow"], "left turn wording"),
  rule(["right turn"], ["right-turn", "arrow"], "right turn wording"),
  rule(["u turn", "uturn"], ["straight-uturn", "arrow"], "u-turn wording"),
  rule(["no u turn", "no uturn", "no-uturn"], ["no-uturn", "red-circle"], "no u-turn wording"),
  rule(["straight ahead", "straight"], ["straight", "arrow"], "straight direction wording"),
  rule(["arrow", "arrows"], ["arrow"], "arrow wording"),
  rule(["no entry", "do not enter", "prohibited", "prohibition"], ["red-circle"], "prohibition wording"),
  rule(["warning", "danger", "caution"], ["yellow-sign", "triangle"], "warning wording"),
  rule(["yield"], ["yield"], "yield wording"),
  rule(["stop"], ["stop"], "stop wording"),
  rule(["slippery", "skid", "skidding"], ["skid"], "skid/slippery wording"),
  rule(["flood", "flooded", "water"], ["flooded", "water"], "flood/water wording"),
];

const args = parseArgs();
const apply = booleanArg(args, "apply", false);

const questionsDoc = readJson(QUESTIONS_PATH);
const rawQuestionsDoc = readJsonIfExists(RAW_QUESTIONS_PATH, { questions: [] });
const imageTagsDoc = readJson(IMAGE_TAGS_PATH);
const tagReport = readJsonIfExists(TAG_REPORT_PATH, null);
const questions = questionArray(questionsDoc);
const rawMap = new Map(questionArray(rawQuestionsDoc).map((question) => [normalizeQid(question.id ?? question.qid), question]));
const vocabulary = buildVocabulary(imageTagsDoc.meta?.objectVocabulary ?? []);
const targetItems = findTargetItems({ questions, rawMap, imageTagsDoc, tagReport });
const planned = targetItems.map((item) => buildPlan(item, vocabulary));
const newVocabularyTags = [...new Set(planned.flatMap((item) => item.newVocabularyTags))].sort();
const appliedDoc = apply ? applyPlans(imageTagsDoc, planned, newVocabularyTags) : imageTagsDoc;

const report = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET,
  apply,
  sources: {
    questions: rel(QUESTIONS_PATH),
    rawQuestions: rel(RAW_QUESTIONS_PATH),
    imageColorTags: rel(IMAGE_TAGS_PATH),
    tagIntelligenceReport: rel(TAG_REPORT_PATH),
  },
  summary: {
    imageQidsInspected: targetItems.length,
    imageQidsBackfilled: planned.filter((item) => item.objectTagsToAdd.length > 0).length,
    qidsMarkedNeedsTagReview: planned.filter((item) => item.objectTagsToAdd.includes(REVIEW_TAG)).length,
    newObjectVocabularyTagsAdded: newVocabularyTags.length,
    tagReportImageMissingCount: tagReport?.summary?.imageQidsMissingObjectTags ?? null,
  },
  newObjectVocabularyTags: newVocabularyTags,
  items: planned,
};

await fsp.mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeJson(OUT_JSON, report);
await fsp.writeFile(OUT_MD, renderMarkdown(report), "utf8");

if (apply) {
  await writeJson(IMAGE_TAGS_PATH, appliedDoc);
}

console.log(`Wrote ${rel(OUT_JSON)}`);
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`Apply: ${apply}`);
console.log(`Image qids inspected: ${report.summary.imageQidsInspected}`);
console.log(`Image qids backfilled: ${report.summary.imageQidsBackfilled}`);
console.log(`Needs tag review: ${report.summary.qidsMarkedNeedsTagReview}`);
console.log(`New objectVocabulary tags: ${report.summary.newObjectVocabularyTagsAdded}`);

function findTargetItems({ questions, rawMap, imageTagsDoc, tagReport }) {
  const tagReportCount = tagReport?.summary?.imageQidsMissingObjectTags;
  const out = [];
  for (const question of questions) {
    const qid = normalizeQid(question.id ?? question.qid);
    if (!qid) continue;
    const rawQuestion = rawMap.get(qid) ?? {};
    const assets = imageAssets(question).length ? imageAssets(question) : imageAssets(rawQuestion);
    if (!assets.length) continue;
    const tagEntry = imageTagsDoc.questions?.[qid];
    if (Array.isArray(tagEntry?.objectTags) && tagEntry.objectTags.length > 0) continue;
    out.push({
      qid,
      number: question.number ?? rawQuestion.number ?? Number(qid.replace(/\D/g, "")),
      question,
      rawQuestion,
      tagEntry,
      assets,
    });
  }
  if (Number.isFinite(Number(tagReportCount)) && out.length !== Number(tagReportCount)) {
    console.warn(`Computed ${out.length} target image qids, while tag report summary says ${tagReportCount}. Continuing with current source-of-truth files.`);
  }
  return out.sort((left, right) => Number(left.number) - Number(right.number) || left.qid.localeCompare(right.qid));
}

function buildPlan(item, vocabulary) {
  const text = searchableText(item);
  const normalized = normalizeSearchText(text);
  const colorTags = (item.tagEntry?.colorTags ?? []).map(String);
  const proposed = [];
  const evidence = [];

  for (const rule of TAG_RULES) {
    if (rule.match(normalized, item, colorTags)) {
      for (const tag of rule.tags) proposed.push(resolveVocabularyTag(tag, vocabulary));
      evidence.push(rule.reason);
    }
  }

  if (/\bsign|signal|marking|arrow|shown|picture\b/.test(normalized)) {
    proposed.push(resolveVocabularyTag("sign", vocabulary));
    evidence.push("question text references a sign/marking/image");
  }

  for (const number of normalized.match(/\b(?:30|40|50|60|80|90|100|120)\b/g) ?? []) {
    proposed.push(resolveVocabularyTag(number, vocabulary));
    evidence.push(`text contains numeric sign value ${number}`);
  }

  const confidence = confidenceFor(proposed, evidence, normalized);
  if (confidence !== "high") {
    proposed.push(resolveVocabularyTag(REVIEW_TAG, vocabulary));
    evidence.push("conservative inference requires human tag review");
  }

  const currentObjectTags = Array.isArray(item.tagEntry?.objectTags) ? item.tagEntry.objectTags : [];
  const objectTagsToAdd = unique(proposed.filter((tag) => tag && !currentObjectTags.includes(tag)));
  const newVocabularyTags = objectTagsToAdd.filter((tag) => !vocabulary.raw.has(tag));

  return {
    qid: item.qid,
    number: item.number,
    imageAssets: item.assets,
    existingColorTags: colorTags,
    existingObjectTags: currentObjectTags,
    objectTagsToAdd,
    finalObjectTags: [...currentObjectTags, ...objectTagsToAdd],
    confidence,
    needsTagReview: objectTagsToAdd.includes(REVIEW_TAG),
    newVocabularyTags,
    evidence: unique(evidence),
    prompt: String(item.question.prompt ?? item.rawQuestion.prompt ?? "").trim(),
  };
}

function rule(phrases, tags, reason) {
  return {
    tags,
    reason,
    match(normalized) {
      return phrases.some((phrase) => hasPhrase(normalized, phrase));
    },
  };
}

function confidenceFor(tags, evidence, normalized) {
  const semanticTags = tags.filter((tag) => tag !== "sign" && tag !== REVIEW_TAG);
  if (semanticTags.length >= 2) return "high";
  if (semanticTags.length === 1 && evidence.some((item) => !item.includes("references a sign"))) return "medium";
  if (semanticTags.length === 1 && /\bsign|signal|marking\b/.test(normalized)) return "medium";
  return "low";
}

function applyPlans(doc, plans, newVocabularyTags) {
  const next = structuredClone(doc);
  next.questions ??= {};
  next.meta ??= {};
  next.meta.objectVocabulary = Array.isArray(next.meta.objectVocabulary) ? next.meta.objectVocabulary : [];
  for (const tag of newVocabularyTags) {
    if (!next.meta.objectVocabulary.includes(tag)) next.meta.objectVocabulary.push(tag);
  }
  for (const plan of plans) {
    const entry = next.questions[plan.qid] ?? {};
    entry.assetSrcs = Array.isArray(entry.assetSrcs) ? entry.assetSrcs : plan.imageAssets;
    entry.colorTags = Array.isArray(entry.colorTags) ? entry.colorTags : [];
    entry.objectTags = Array.isArray(entry.objectTags) ? entry.objectTags : [];
    for (const tag of plan.objectTagsToAdd) {
      if (!entry.objectTags.includes(tag)) entry.objectTags.push(tag);
    }
    next.questions[plan.qid] = entry;
  }
  return next;
}

function searchableText(item) {
  const question = item.question;
  const raw = item.rawQuestion;
  const options = [
    ...(Array.isArray(question.options) ? question.options : []),
    ...(Array.isArray(raw.options) ? raw.options : []),
  ].flatMap((option) => [option?.text, option?.label, option?.originalKey, option?.key]);
  return [
    question.prompt,
    raw.prompt,
    question.explanation,
    raw.explanation,
    question.answerRaw,
    raw.answerRaw,
    ...options,
    ...item.assets,
    ...(item.tagEntry?.colorTags ?? []),
  ].join(" ");
}

function buildVocabulary(values) {
  const raw = new Set(values.map(String));
  const byNormalized = new Map();
  for (const value of raw) {
    const normalized = normalizeTag(value);
    if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, value);
  }
  return { raw, byNormalized };
}

function resolveVocabularyTag(tag, vocabulary) {
  if (vocabulary.raw.has(tag)) return tag;
  const normalized = normalizeTag(tag);
  return vocabulary.byNormalized.get(normalized) ?? normalized;
}

function hasPhrase(normalized, phrase) {
  const words = normalizeSearchText(phrase).split(/\s+/g).filter(Boolean);
  if (!words.length) return false;
  return new RegExp(`\\b${words.join("\\s+")}\\b`).test(normalized);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function imageAssets(question) {
  return (Array.isArray(question?.assets) ? question.assets : [])
    .filter((asset) => asset?.kind === "image" && asset?.src)
    .map((asset) => String(asset.src));
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  if (doc?.questions && typeof doc.questions === "object") {
    return Object.entries(doc.questions).map(([qid, value]) => ({ id: qid, ...value }));
  }
  return [];
}

function normalizeQid(value) {
  const match = String(value ?? "").match(/q?(\d{1,4})/i);
  return match ? `q${match[1].padStart(4, "0")}` : null;
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

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Missing Image Object Tags Backfill", "");
  lines.push(`Generated: ${report.generatedAt}`, "");
  lines.push("## Summary", "");
  lines.push(`- Apply: ${report.apply}`);
  lines.push(`- Image qids inspected: ${report.summary.imageQidsInspected}`);
  lines.push(`- Image qids backfilled: ${report.summary.imageQidsBackfilled}`);
  lines.push(`- Qids marked needs-tag-review: ${report.summary.qidsMarkedNeedsTagReview}`);
  lines.push(`- New objectVocabulary tags added: ${report.summary.newObjectVocabularyTagsAdded}`);
  lines.push(`- Tag report image missing count: ${report.summary.tagReportImageMissingCount ?? "n/a"}`);
  lines.push("", "## New Vocabulary Tags", "");
  lines.push(report.newObjectVocabularyTags.length ? report.newObjectVocabularyTags.map((tag) => `- ${tag}`).join("\n") : "None.");
  lines.push("", "## Planned Items", "");
  lines.push("| qid | # | confidence | tags to add | evidence |");
  lines.push("| --- | ---: | --- | --- | --- |");
  for (const item of report.items) {
    lines.push(`| ${item.qid} | ${item.number ?? ""} | ${item.confidence} | ${item.objectTagsToAdd.join(", ")} | ${item.evidence.join("; ")} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
