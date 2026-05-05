#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";

import sharp from "sharp";

import {
  DEFAULT_DATASET,
  ensureDir,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "qbank-tools", "generated");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const CACHE_DIR = path.join(GENERATED_DIR, "cache");
const ASSETS_DIR = path.join(REPORTS_DIR, "image-replacement-second-pass-assets");
const SCREENSHOT_DESCRIPTOR_CACHE_PATH = path.join(CACHE_DIR, "image-replacement-screenshot-descriptors.json");
const DEFAULT_DECISIONS_PATH = path.join(STAGING_DIR, "image-replacement-decisions.json");
const FIRST_PASS_WORKBENCH_PATH = path.join(REPORTS_DIR, "image-replacement-workbench.json");
const DEFAULT_TOP_N = 10;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_SCREENSHOTS = 500;
const DEFAULT_MAX_CROPS_PER_SCREENSHOT = 8;
const HARD_MAX_QIDS = 100;
const HARD_MAX_SCREENSHOTS = 1200;
const HARD_MAX_CROPS_PER_SCREENSHOT = 12;
const CACHE_VERSION = 2;
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DETECTION_WIDTH = 760;
const DESCRIPTOR_SIZE = 32;
const HASH_SIZE = 8;
const PHASH_SIZE = 16;
const COS_TABLE = buildCosTable(HASH_SIZE, PHASH_SIZE);

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
  "how", "if", "in", "into", "is", "it", "its", "must", "not", "of", "on", "or", "road",
  "should", "that", "the", "their", "this", "to", "traffic", "vehicle", "vehicles", "what",
  "when", "which", "with", "meaning", "mean", "indicate", "sign", "shown", "picture",
]);

const PHRASE_HINTS = [
  ["speed limit", "speed-limit"],
  ["no entry", "no-entry"],
  ["no u turn", "no-u-turn"],
  ["u turn", "u-turn"],
  ["left turn", "left-turn"],
  ["right turn", "right-turn"],
  ["straight ahead", "straight"],
  ["one way", "one-way"],
  ["pedestrian crossing", "pedestrian"],
  ["traffic light", "traffic-light"],
  ["railroad crossing", "railroad-crossing"],
  ["level crossing", "railroad-crossing"],
  ["roundabout", "roundabout"],
  ["expressway", "expressway"],
  ["highway", "highway"],
  ["bus lane", "bus-lane"],
  ["bicycle", "bicycle"],
  ["tunnel", "tunnel"],
  ["phone", "phone"],
  ["telephone", "phone"],
  ["etc lane", "etc"],
  ["payment lane", "payment"],
  ["children", "children"],
  ["slippery", "slippery"],
  ["snow", "snow"],
  ["rain", "rain"],
  ["intersection", "intersection"],
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const dataset = stringArg(args, "dataset", DEFAULT_DATASET);
  const topN = positiveIntegerArg(args, "top", DEFAULT_TOP_N);
  const concurrency = positiveIntegerArg(args, "concurrency", DEFAULT_CONCURRENCY);
  const limitQids = boundedPositiveIntegerArg(args, "limit-qids", null, HARD_MAX_QIDS);
  const maxScreenshots = boundedPositiveIntegerArg(args, "max-screenshots", DEFAULT_MAX_SCREENSHOTS, HARD_MAX_SCREENSHOTS);
  const maxCropsPerScreenshot = boundedPositiveIntegerArg(args, "max-crops-per-screenshot", DEFAULT_MAX_CROPS_PER_SCREENSHOT, HARD_MAX_CROPS_PER_SCREENSHOT);
  const reuseCache = booleanArg(args, "reuse-cache", true);
  const forceRebuildCache = booleanArg(args, "force-rebuild-cache", false);
  const decisionFilter = parseDecisionFilter(stringArg(args, "decision-filter", "needsManualSearch"));
  const decisionsPath = await resolveDecisionsPath(stringArg(args, "decisions", DEFAULT_DECISIONS_PATH), dataset);
  const htmlPath = path.resolve(
    ROOT,
    stringArg(args, "html-path", path.join(REPORTS_DIR, "image-replacement-second-pass-workbench.html")),
  );
  const jsonPath = path.resolve(
    ROOT,
    stringArg(args, "json-path", path.join(REPORTS_DIR, "image-replacement-second-pass-workbench.json")),
  );
  const mdPath = path.resolve(
    ROOT,
    stringArg(args, "md-path", path.join(REPORTS_DIR, "image-replacement-second-pass-workbench.md")),
  );

  await ensureDir(REPORTS_DIR);
  await ensureDir(CACHE_DIR);
  await ensureDir(ASSETS_DIR);

  const decisionsDoc = readJson(decisionsPath.path);
  const requestedQids = applyLimit(extractDecisionQids(decisionsDoc, decisionFilter), limitQids);
  if (requestedQids.length === 0) {
    throw new Error(`No matching decisions found in ${relativePath(decisionsPath.path)} for ${[...decisionFilter].join(", ")}.`);
  }

  const questionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
  const rawQuestionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.raw.json");
  const imageTagsPath = path.join(ROOT, "public", "qbank", dataset, "image-color-tags.json");
  const questionsDoc = readJson(questionsPath);
  const rawQuestionsDoc = readJson(rawQuestionsPath);
  const imageTagsDoc = readJson(imageTagsPath);
  const questionMap = buildQuestionMap(questionsDoc);
  const rawQuestionMap = buildQuestionMap(rawQuestionsDoc);
  const imageTagsMap = buildImageTagsMap(imageTagsDoc);
  const productionImageIndex = buildProductionImageIndex(questionMap, imageTagsMap, dataset);
  const firstPass = await loadFirstPassWorkbench();
  const previousCandidateKeys = buildPreviousCandidateKeyMap(firstPass, requestedQids);
  const screenshotContext = buildScreenshotContext(firstPass, questionMap, imageTagsMap);
  const descriptorCache = await loadScreenshotDescriptorCache({ reuseCache, forceRebuildCache });
  const cacheStats = {
    hits: 0,
    misses: 0,
    rebuilt: 0,
    written: false,
    used: false,
  };

  console.log(`Second-pass qids: ${requestedQids.join(", ")}`);
  console.log(`Using decisions file: ${relativePath(decisionsPath.path)}`);
  console.log(`Decision filter: ${[...decisionFilter].join(", ")}`);
  console.log(`Bounds: limit-qids=${limitQids ?? "all"} max-screenshots=${maxScreenshots} max-crops-per-screenshot=${maxCropsPerScreenshot}`);
  console.log(`Screenshot descriptor cache: ${reuseCache ? "enabled" : "disabled"}${forceRebuildCache ? " (force rebuild)" : ""}`);

  const targets = await buildTargets({
    qids: requestedQids,
    questionMap,
    rawQuestionMap,
    imageTagsMap,
    dataset,
  });

  const allScreenshotPaths = await listScreenshotFiles(path.join(ROOT, "imports"));
  const screenshotPaths = prioritizeScreenshotPaths(allScreenshotPaths, firstPass, requestedQids).slice(0, maxScreenshots);
  const workbenchAssetCandidates = await buildWorkbenchAssetCandidateSeeds(firstPass, requestedQids);
  console.log(`Indexing ${productionImageIndex.assets.length} production asset candidate(s).`);
  const productionCandidates = (await mapLimit(productionImageIndex.assets, concurrency, async (asset) =>
    buildProductionCandidate(asset, questionMap, rawQuestionMap, imageTagsMap),
  )).filter(Boolean);

  console.log(`Indexing ${screenshotPaths.length}/${allScreenshotPaths.length} screenshot candidate source(s).`);
  let screenshotCount = 0;
  const screenshotCandidates = (await mapLimit(screenshotPaths, concurrency, async (screenshotPath) => {
    const candidates = await buildScreenshotCandidates(screenshotPath, screenshotContext, {
      maxCropsPerScreenshot,
      descriptorCache,
      cacheStats,
      reuseCache,
      forceRebuildCache,
    });
    screenshotCount += 1;
    if (screenshotCount % 25 === 0 || screenshotCount === screenshotPaths.length) {
      console.log(`Indexed ${screenshotCount}/${screenshotPaths.length} screenshots.`);
    }
    return candidates;
  })).flat();

  if (reuseCache || forceRebuildCache || cacheStats.rebuilt > 0) {
    await writeScreenshotDescriptorCache(descriptorCache);
    cacheStats.written = true;
  }
  cacheStats.used = cacheStats.hits > 0;

  console.log(`Indexing ${workbenchAssetCandidates.length} first-pass preview crop candidate(s).`);
  const priorCropCandidates = await mapLimit(workbenchAssetCandidates, concurrency, buildPriorCropCandidate);

  const candidatePool = [
    ...productionCandidates,
    ...screenshotCandidates.filter(Boolean),
    ...priorCropCandidates.filter(Boolean),
  ];

  const results = [];
  for (const target of targets) {
    if (target.error) {
      results.push({
        qid: target.qid,
        error: target.error,
        currentAsset: target.currentAsset ?? null,
        question: target.question ?? null,
        tags: target.tags ?? [],
        candidates: [],
      });
      continue;
    }

    const ranked = annotateExistingQidMatches(rankSecondPassCandidates({
      target,
      candidatePool,
      previousKeys: previousCandidateKeys.get(target.qid) ?? new Set(),
      topN,
    }), {
      target,
      productionCandidates,
      questionMap,
      rawQuestionMap,
    });
    results.push({
      qid: target.qid,
      currentAsset: target.currentAsset,
      question: target.question,
      tags: target.tags,
      keywords: [...target.keywords],
      candidates: ranked,
    });
  }

  await writeCandidatePreviews(results);

  const workbench = {
    generatedAt: stableNow(),
    dataset,
    source: "image-replacement-second-pass",
    decisionsPath: relativePath(decisionsPath.path),
    decisionsPathWarning: decisionsPath.warning,
    searchRoots: [
      "imports/ru/batch-*/screenshots/",
      "imports/*/batch-*/screenshots/",
      "qbank-tools/generated/reports/image-replacement-workbench-assets/",
      "public/qbank/2023-test1/images/",
    ],
    settings: {
      topN,
      concurrency,
      qids: requestedQids,
      decisionFilter: [...decisionFilter],
      limitQids,
      maxScreenshots,
      maxCropsPerScreenshot,
      reuseCache,
      forceRebuildCache,
    },
    cache: cacheStats,
    counts: {
      qids: results.length,
      candidates: results.reduce((sum, result) => sum + (result.candidates?.length ?? 0), 0),
      existingProductionImageMatches: results.reduce(
        (sum, result) => sum + (result.candidates ?? []).filter((candidate) => candidate.operation === "reuse-existing-qid-image").length,
        0,
      ),
      screenshotsScanned: screenshotPaths.length,
      screenshotsAvailable: allScreenshotPaths.length,
      productionAssetsScanned: productionImageIndex.assets.length,
      priorPreviewCropsScanned: workbenchAssetCandidates.length,
    },
    results: results.map(serializeResult),
  };

  await writeJson(jsonPath, workbench);
  await writeText(htmlPath, buildHtml(workbench, { htmlPath, jsonPath }));
  await writeText(mdPath, buildMarkdown(workbench));

  console.log(`Wrote ${relativePath(htmlPath)}.`);
  console.log(`Wrote ${relativePath(jsonPath)}.`);
  console.log(`Wrote ${relativePath(mdPath)}.`);
}

function stringArg(args, key, fallback = null) {
  if (!(key in args)) {
    return fallback;
  }
  const value = String(args[key] ?? "").trim();
  return value || fallback;
}

function positiveIntegerArg(args, key, fallback) {
  const value = stringArg(args, key, null);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedPositiveIntegerArg(args, key, fallback, hardMax) {
  const value = stringArg(args, key, null);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  if (parsed > hardMax) {
    console.warn(`${key}=${parsed} exceeds hard cap ${hardMax}; using ${hardMax}.`);
    return hardMax;
  }
  return parsed;
}

function booleanArg(args, key, fallback) {
  if (!(key in args)) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(args[key]).toLowerCase());
}

function parseDecisionFilter(raw) {
  const values = String(raw ?? "needsManualSearch")
    .split(/[\s,]+/g)
    .map(normalizeDecision)
    .filter(Boolean);
  return new Set(values.length > 0 ? values : ["needsmanualsearch"]);
}

async function resolveDecisionsPath(requested, dataset) {
  const requestedPath = path.resolve(ROOT, requested);
  if (await fileExists(requestedPath)) {
    return { path: requestedPath, warning: null };
  }
  const datasetPath = path.join(STAGING_DIR, `image-replacement-decisions-${dataset}.json`);
  if (await fileExists(datasetPath)) {
    return {
      path: datasetPath,
      warning: `Requested decisions file was not found; used ${relativePath(datasetPath)}.`,
    };
  }
  const stagingFiles = await safeReaddir(STAGING_DIR);
  const alternatives = stagingFiles
    .filter((file) => /^image-replacement-decisions.*\.json$/i.test(file))
    .map((file) => path.join(STAGING_DIR, file));
  if (alternatives.length === 1) {
    return {
      path: alternatives[0],
      warning: `Requested decisions file was not found; used ${relativePath(alternatives[0])}.`,
    };
  }
  throw new Error(`Decisions file not found: ${relativePath(requestedPath)}`);
}

function extractDecisionQids(decisionsDoc, decisionFilter) {
  const entries = decisionsDoc?.decisions && typeof decisionsDoc.decisions === "object"
    ? Object.entries(decisionsDoc.decisions)
    : [];
  return entries
    .filter(([, decision]) => decisionFilter.has(normalizeDecision(decision?.decision)))
    .map(([qid]) => normalizeQid(qid))
    .sort((left, right) => qidNumber(left) - qidNumber(right));
}

function isNeedsManualSearch(value) {
  return normalizeDecision(value) === "needsmanualsearch";
}

function normalizeDecision(value) {
  const normalized = String(value ?? "undecided").toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "needsmanualsearch") return "needsmanualsearch";
  if (normalized === "disregard" || normalized === "noreplacement") return "disregard";
  if (normalized === "unsure") return "unsure";
  if (normalized === "undecided" || normalized === "") return "undecided";
  if (normalized === "approve" || normalized === "approved") return "approve";
  return normalized;
}

function applyLimit(values, limit) {
  return limit ? values.slice(0, limit) : values;
}

function normalizeQid(value) {
  const digits = String(value ?? "").replace(/^q/i, "").replace(/\D/g, "");
  if (!digits) {
    throw new Error(`Invalid qid: ${value}`);
  }
  return `q${digits.padStart(4, "0")}`;
}

function qidNumber(qid) {
  return Number.parseInt(String(qid).replace(/\D/g, ""), 10);
}

function buildQuestionMap(doc) {
  const questions = Array.isArray(doc) ? doc : Array.isArray(doc?.questions) ? doc.questions : [];
  return new Map(
    questions
      .filter((question) => typeof question?.id === "string" || typeof question?.qid === "string")
      .map((question) => [normalizeQid(question.id ?? question.qid), question]),
  );
}

function buildImageTagsMap(doc) {
  const questions = doc?.questions && typeof doc.questions === "object" ? doc.questions : {};
  if (Array.isArray(questions)) {
    return new Map(questions.map((entry) => [normalizeQid(entry.qid ?? entry.id), normalizeTagEntry(entry)]));
  }
  return new Map(Object.entries(questions).map(([qid, entry]) => [normalizeQid(qid), normalizeTagEntry(entry)]));
}

function normalizeTagEntry(entry) {
  return {
    colorTags: Array.isArray(entry?.colorTags) ? entry.colorTags.map(String) : [],
    objectTags: Array.isArray(entry?.objectTags) ? entry.objectTags.map(String) : [],
    assetSrcs: Array.isArray(entry?.assetSrcs) ? entry.assetSrcs.map(String) : [],
  };
}

async function buildTargets({ qids, questionMap, rawQuestionMap, imageTagsMap, dataset }) {
  const targets = [];
  for (const qid of qids) {
    const question = questionMap.get(qid);
    const rawQuestion = rawQuestionMap.get(qid);
    const tags = imageTagsMap.get(qid) ?? { colorTags: [], objectTags: [], assetSrcs: [] };
    if (!question) {
      targets.push({ qid, error: "qid not found in questions.json", tags: flattenTags(tags) });
      continue;
    }
    const asset = getImageAsset(question);
    if (!asset) {
      targets.push({
        qid,
        question: summarizeQuestion(question, rawQuestion),
        tags: flattenTags(tags),
        error: "no image asset found",
      });
      continue;
    }
    const assetPath = assetSrcToAbsolutePath(asset.src, dataset);
    try {
      const descriptors = await buildTargetDescriptors(assetPath);
      const questionSummary = summarizeQuestion(question, rawQuestion);
      const tagList = flattenTags(tags);
      targets.push({
        qid,
        question: questionSummary,
        currentAsset: {
          src: asset.src,
          path: relativePath(assetPath),
          hash: asset.hash ?? null,
        },
        tags: tagList,
        keywords: buildKeywordSet(questionSummary, tagList),
        descriptors,
      });
    } catch (error) {
      targets.push({
        qid,
        question: summarizeQuestion(question, rawQuestion),
        tags: flattenTags(tags),
        currentAsset: {
          src: asset.src,
          path: relativePath(assetPath),
          hash: asset.hash ?? null,
        },
        error: `failed to load production image: ${error.message}`,
      });
    }
  }
  return targets;
}

function getImageAsset(question) {
  return Array.isArray(question?.assets)
    ? question.assets.find((asset) => asset?.kind === "image" && typeof asset?.src === "string")
    : null;
}

function summarizeQuestion(question, rawQuestion = null) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const rawOptions = Array.isArray(rawQuestion?.options) ? rawQuestion.options : [];
  return {
    prompt: question?.prompt ?? question?.question ?? rawQuestion?.prompt ?? rawQuestion?.question ?? "",
    rawPrompt: rawQuestion?.prompt ?? rawQuestion?.question ?? "",
    options: options.map((option, index) => ({
      id: option.id ?? null,
      text: option.text ?? "",
      rawText: rawOptions[index]?.text ?? "",
    })),
    correctOptionId: question?.correctOptionId ?? rawQuestion?.correctOptionId ?? null,
  };
}

function flattenTags(entry) {
  return [...new Set([...(entry?.colorTags ?? []), ...(entry?.objectTags ?? [])].map(normalizeToken).filter(Boolean))];
}

function assetSrcToAbsolutePath(src, dataset) {
  const cleanSrc = String(src ?? "").replace(/^\/+/, "");
  if (cleanSrc.startsWith("public/")) {
    return path.join(ROOT, cleanSrc);
  }
  if (cleanSrc.startsWith("qbank/")) {
    return path.join(ROOT, "public", cleanSrc);
  }
  return path.join(ROOT, "public", "qbank", dataset, "images", cleanSrc);
}

function buildProductionImageIndex(questionMap, imageTagsMap, dataset) {
  const byPath = new Map();
  for (const [qid, question] of questionMap.entries()) {
    const asset = getImageAsset(question);
    if (!asset) {
      continue;
    }
    const imagePath = relativePath(assetSrcToAbsolutePath(asset.src, dataset));
    const entry = byPath.get(imagePath) ?? {
      imagePath,
      absolutePath: path.join(ROOT, imagePath),
      src: asset.src,
      qids: [],
      tags: new Set(),
    };
    entry.qids.push(qid);
    for (const tag of flattenTags(imageTagsMap.get(qid))) {
      entry.tags.add(tag);
    }
    byPath.set(imagePath, entry);
  }
  return {
    assets: [...byPath.values()].map((entry) => ({
      ...entry,
      qids: [...new Set(entry.qids)].sort(),
      tags: [...entry.tags],
    })),
  };
}

async function buildProductionCandidate(asset, questionMap, rawQuestionMap, imageTagsMap) {
  try {
    const metadata = await sharp(asset.absolutePath, { limitInputPixels: false }).metadata();
    const crop = normalizeCrop({ left: 0, top: 0, width: metadata.width, height: metadata.height }, metadata);
    const descriptor = await buildDescriptor(asset.absolutePath, crop, "production-full");
    const qids = asset.qids;
    const keywords = new Set();
    const tags = new Set(asset.tags);
    for (const qid of qids) {
      const summary = summarizeQuestion(questionMap.get(qid), rawQuestionMap.get(qid));
      for (const token of buildKeywordSet(summary, flattenTags(imageTagsMap.get(qid)))) {
        keywords.add(token);
      }
      for (const tag of flattenTags(imageTagsMap.get(qid))) {
        tags.add(tag);
      }
    }
    return {
      sourceType: "existing-production-qid",
      diversityBucket: "existing-production-qid",
      operation: "reuse-existing-qid-image",
      sourcePath: asset.imagePath,
      absolutePath: asset.absolutePath,
      referencedQid: qids[0] ?? null,
      referencedQids: qids,
      referencedImagePath: asset.imagePath,
      crop,
      cropMode: "production-full",
      width: metadata.width,
      height: metadata.height,
      descriptor,
      keywords,
      tags,
      contextQids: qids,
    };
  } catch {
    return null;
  }
}

async function listScreenshotFiles(importsDir) {
  const files = [];
  async function walk(dirPath) {
    const entries = await safeReaddir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      if (/^imports\/[^/]+\/batch-[^/]+\/screenshots\//.test(relativePath(entryPath))) {
        files.push(entryPath);
      }
    }
  }
  await walk(importsDir);
  return files.sort((left, right) => relativePath(left).localeCompare(relativePath(right), undefined, { numeric: true }));
}

async function buildScreenshotCandidates(screenshotPath, screenshotContext, {
  maxCropsPerScreenshot,
  descriptorCache,
  cacheStats,
  reuseCache,
  forceRebuildCache,
}) {
  try {
    const relative = relativePath(screenshotPath);
    const stat = await fs.stat(screenshotPath);
    const cached = descriptorCache.entries?.[relative];
    if (reuseCache && !forceRebuildCache && await isReusableScreenshotCacheEntry(cached, stat, screenshotPath, maxCropsPerScreenshot)) {
      cacheStats.hits += 1;
      return hydrateScreenshotCandidates(cached.candidates.slice(0, maxCropsPerScreenshot), screenshotPath, screenshotContext);
    }

    cacheStats.misses += 1;
    cacheStats.rebuilt += 1;
    const metadata = await sharp(screenshotPath, { limitInputPixels: false }).metadata();
    const cropSpecs = await buildScreenshotCropSpecs(screenshotPath, metadata, maxCropsPerScreenshot);
    const baseCandidates = [];
    for (const spec of cropSpecs) {
      try {
        const descriptor = await buildDescriptor(screenshotPath, spec.crop, spec.name);
        baseCandidates.push({
          sourceType: spec.name === "full-screenshot" ? "full-screenshot" : "screenshot-crop",
          diversityBucket: spec.name === "full-screenshot" ? "full-screenshot" : "screenshot-crop",
          operation: "extract-enhance-from-approved-source",
          sourcePath: relative,
          absolutePath: screenshotPath,
          crop: spec.crop,
          cropMode: spec.name,
          width: metadata.width,
          height: metadata.height,
          descriptor,
        });
      } catch {
        continue;
      }
    }
    descriptorCache.entries[relative] = {
      version: CACHE_VERSION,
      sourcePath: relative,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      quickHash: await quickFileHash(screenshotPath, stat),
      sha1: await sha1File(screenshotPath),
      maxCropsPerScreenshot,
      width: metadata.width,
      height: metadata.height,
      candidates: baseCandidates.map(serializeCachedScreenshotCandidate),
    };
    return hydrateScreenshotCandidates(descriptorCache.entries[relative].candidates, screenshotPath, screenshotContext);
  } catch {
    return [];
  }
}

async function isReusableScreenshotCacheEntry(entry, stat, screenshotPath, maxCropsPerScreenshot) {
  if (!entry || entry.version !== CACHE_VERSION || !Array.isArray(entry.candidates)) {
    return false;
  }
  if (Number(entry.mtimeMs) !== Number(stat.mtimeMs) || Number(entry.size) !== Number(stat.size)) {
    return false;
  }
  if (Number(entry.maxCropsPerScreenshot) < maxCropsPerScreenshot) {
    return false;
  }
  if (!entry.quickHash || entry.quickHash !== await quickFileHash(screenshotPath, stat)) {
    return false;
  }
  return true;
}

function hydrateScreenshotCandidates(candidates, screenshotPath, screenshotContext) {
  return candidates.map((candidate) => {
    const sourcePath = candidate.sourcePath;
    const context = screenshotContext.get(sourcePath) ?? { qids: [], keywords: new Set(), tags: new Set() };
    const descriptor = deserializeDescriptor(candidate.descriptor);
    return {
      ...candidate,
      absolutePath: screenshotPath,
      crop: candidate.crop,
      descriptor,
      keywords: new Set([...pathKeywordTokens(sourcePath), ...context.keywords]),
      tags: new Set([...descriptor.colorTags, ...context.tags]),
      contextQids: context.qids,
    };
  });
}

async function buildScreenshotCropSpecs(screenshotPath, metadata, maxCropsPerScreenshot) {
  const fixedCrops = [
    {
      name: "full-screenshot",
      crop: { left: 0, top: 0, width: metadata.width, height: metadata.height },
    },
    {
      name: "layout-upper-wide",
      crop: proportionalCrop(metadata, 0.18, 0.06, 0.64, 0.55),
    },
    {
      name: "layout-upper-card",
      crop: proportionalCrop(metadata, 0.27, 0.09, 0.46, 0.5),
    },
    {
      name: "layout-asset-center",
      crop: proportionalCrop(metadata, 0.34, 0.11, 0.32, 0.43),
    },
  ];
  const components = await detectScreenshotComponents(screenshotPath, metadata);
  const componentCrops = components.slice(0, 6).map((component, index) => ({
    name: `detected-component-${index + 1}`,
    crop: expandCrop(component.crop, metadata, 0.08),
  }));
  const unionCrop = buildUnionCrop(components.slice(0, 4).map((component) => component.crop), metadata);
  const unionCrops = unionCrop ? [{ name: "detected-union", crop: expandCrop(unionCrop, metadata, 0.06) }] : [];
  const trimCrops = [];
  for (const spec of [...fixedCrops.slice(1), ...unionCrops]) {
    const trimCrop = await detectTrimCrop(screenshotPath, spec.crop);
    if (trimCrop && cropMeaningfullyDiffers(spec.crop, trimCrop)) {
      trimCrops.push({ name: `${spec.name}-content-trim`, crop: expandCrop(trimCrop, metadata, 0.04) });
    }
  }
  return dedupeCrops([...componentCrops, ...unionCrops, ...trimCrops, ...fixedCrops], metadata).slice(0, maxCropsPerScreenshot);
}

function proportionalCrop(metadata, left, top, width, height) {
  return normalizeCrop({
    left: metadata.width * left,
    top: metadata.height * top,
    width: metadata.width * width,
    height: metadata.height * height,
  }, metadata);
}

async function detectScreenshotComponents(screenshotPath, metadata) {
  const resized = await sharp(screenshotPath, { limitInputPixels: false })
    .rotate()
    .resize({ width: DETECTION_WIDTH, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const width = info.width;
  const height = info.height;
  const mask = new Uint8Array(width * height);
  const minX = Math.floor(width * 0.06);
  const maxX = Math.ceil(width * 0.94);
  const minY = Math.floor(height * 0.04);
  const maxY = Math.ceil(height * 0.74);

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const offset = (y * width + x) * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel - minChannel;
      const nearWhite = red > 246 && green > 246 && blue > 246;
      const nearLightGray = red > 234 && green > 234 && blue > 234 && saturation < 14;
      const veryDarkChrome = y < height * 0.08 && red < 18 && green < 18 && blue < 18;
      if (!nearWhite && !nearLightGray && !veryDarkChrome) {
        mask[y * width + x] = 1;
      }
    }
  }

  return connectedComponents(mask, width, height)
    .filter((component) => {
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      const fill = component.area / (componentWidth * componentHeight);
      return component.area >= 70 && componentWidth >= 8 && componentHeight >= 8 && !(componentHeight < 12 && componentWidth > componentHeight * 5) && !(fill < 0.015 && component.area < 500);
    })
    .map((component) => {
      const scaleX = metadata.width / width;
      const scaleY = metadata.height / height;
      const crop = normalizeCrop({
        left: component.minX * scaleX,
        top: component.minY * scaleY,
        width: (component.maxX - component.minX + 1) * scaleX,
        height: (component.maxY - component.minY + 1) * scaleY,
      }, metadata);
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      return {
        ...component,
        crop,
        visualScore: component.area * Math.min(2, componentWidth / 28) * Math.min(2, componentHeight / 28),
      };
    })
    .sort((left, right) => right.visualScore - left.visualScore);
}

function connectedComponents(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  const stack = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    visited[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) {
          continue;
        }
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) {
          continue;
        }
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }
    components.push({ area, minX, minY, maxX, maxY });
  }
  return components;
}

async function detectTrimCrop(imagePath, crop) {
  const safeCrop = normalizeCrop(crop, cropToMetadata(crop));
  const resized = await sharp(imagePath, { limitInputPixels: false })
    .rotate()
    .extract(safeCrop)
    .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const background = estimateCornerBackground(data, info.width, info.height);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel - minChannel;
      const distance = Math.abs(red - background.red) + Math.abs(green - background.green) + Math.abs(blue - background.blue);
      if (distance > 42 || (saturation > 48 && distance > 24)) {
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (count < Math.max(18, info.width * info.height * 0.004) || maxX < minX || maxY < minY) {
    return null;
  }
  const scaleX = safeCrop.width / info.width;
  const scaleY = safeCrop.height / info.height;
  const paddingX = Math.max(2, (maxX - minX + 1) * 0.06);
  const paddingY = Math.max(2, (maxY - minY + 1) * 0.06);
  return normalizeCrop({
    left: safeCrop.left + (minX - paddingX) * scaleX,
    top: safeCrop.top + (minY - paddingY) * scaleY,
    width: (maxX - minX + 1 + paddingX * 2) * scaleX,
    height: (maxY - minY + 1 + paddingY * 2) * scaleY,
  }, cropToMetadata(safeCrop));
}

function estimateCornerBackground(data, width, height) {
  const samples = [];
  const sampleSize = Math.max(2, Math.floor(Math.min(width, height) * 0.08));
  for (const [startX, startY] of [[0, 0], [width - sampleSize, 0], [0, height - sampleSize], [width - sampleSize, height - sampleSize]]) {
    for (let y = Math.max(0, startY); y < Math.min(height, startY + sampleSize); y += 1) {
      for (let x = Math.max(0, startX); x < Math.min(width, startX + sampleSize); x += 1) {
        const offset = (y * width + x) * 3;
        samples.push([data[offset], data[offset + 1], data[offset + 2]]);
      }
    }
  }
  return {
    red: median(samples.map((sample) => sample[0])),
    green: median(samples.map((sample) => sample[1])),
    blue: median(samples.map((sample) => sample[2])),
  };
}

async function buildTargetDescriptors(assetPath) {
  const metadata = await sharp(assetPath, { limitInputPixels: false }).metadata();
  const fullCrop = normalizeCrop({ left: 0, top: 0, width: metadata.width, height: metadata.height }, metadata);
  const crops = [{ name: "asset-full", crop: fullCrop }];
  const trimCrop = await detectTrimCrop(assetPath, fullCrop);
  if (trimCrop && cropMeaningfullyDiffers(fullCrop, trimCrop)) {
    crops.push({ name: "asset-content-trim", crop: trimCrop });
  }
  return Promise.all(crops.map(({ name, crop }) => buildDescriptor(assetPath, crop, name)));
}

async function buildDescriptor(imagePath, crop, name) {
  const safeCrop = normalizeCrop(crop, cropToMetadata(crop));
  const { data } = await sharp(imagePath, { limitInputPixels: false })
    .rotate()
    .extract(safeCrop)
    .resize(DESCRIPTOR_SIZE, DESCRIPTOR_SIZE, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const gray = new Float64Array(DESCRIPTOR_SIZE * DESCRIPTOR_SIZE);
  const histogram = new Float64Array(64);
  const colorCounts = new Map();
  let edgeTotal = 0;
  for (let y = 0; y < DESCRIPTOR_SIZE; y += 1) {
    for (let x = 0; x < DESCRIPTOR_SIZE; x += 1) {
      const pixelIndex = y * DESCRIPTOR_SIZE + x;
      const offset = pixelIndex * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      gray[pixelIndex] = 0.299 * red + 0.587 * green + 0.114 * blue;
      const redBin = Math.min(3, Math.floor(red / 64));
      const greenBin = Math.min(3, Math.floor(green / 64));
      const blueBin = Math.min(3, Math.floor(blue / 64));
      histogram[redBin * 16 + greenBin * 4 + blueBin] += 1;
      const color = classifyColor(red, green, blue);
      colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
      if (x > 0) {
        edgeTotal += Math.abs(gray[pixelIndex] - gray[pixelIndex - 1]);
      }
      if (y > 0) {
        edgeTotal += Math.abs(gray[pixelIndex] - gray[pixelIndex - DESCRIPTOR_SIZE]);
      }
    }
  }
  normalizeVector(histogram);
  const dominantColors = [...colorCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([color]) => color);
  return {
    name,
    crop: safeCrop,
    width: safeCrop.width,
    height: safeCrop.height,
    aspectRatio: safeCrop.width / safeCrop.height,
    avgHash: averageHash(gray),
    diffHash: differenceHash(gray),
    pHash: perceptualHash(gray),
    histogram: Array.from(histogram),
    edgeDensity: edgeTotal / (DESCRIPTOR_SIZE * DESCRIPTOR_SIZE * 255 * 2),
    colorTags: dominantColors,
  };
}

function classifyColor(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const sat = max - min;
  if (max > 238 && sat < 16) return "white";
  if (max < 44 && sat < 24) return "black";
  if (sat < 24) return "gray";
  if (red > 150 && green < 115 && blue < 115) return "red";
  if (red > 170 && green > 140 && blue < 110) return "yellow";
  if (green > 120 && red < 130 && blue < 140) return "green";
  if (blue > 135 && red < 140 && green < 170) return "blue";
  if (red > 150 && green > 75 && green < 150 && blue < 90) return "orange";
  return "mixed";
}

function averageHash(gray) {
  const block = blockAverages(gray, DESCRIPTOR_SIZE, HASH_SIZE, HASH_SIZE);
  const average = block.reduce((sum, value) => sum + value, 0) / block.length;
  return Uint8Array.from(block.map((value) => (value >= average ? 1 : 0)));
}

function differenceHash(gray) {
  const width = HASH_SIZE + 1;
  const block = blockAverages(gray, DESCRIPTOR_SIZE, width, HASH_SIZE);
  const bits = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      bits.push(block[y * width + x] > block[y * width + x + 1] ? 1 : 0);
    }
  }
  return Uint8Array.from(bits);
}

function perceptualHash(gray) {
  const lowRes = blockAverages(gray, DESCRIPTOR_SIZE, PHASH_SIZE, PHASH_SIZE);
  const coefficients = [];
  for (let u = 0; u < HASH_SIZE; u += 1) {
    for (let v = 0; v < HASH_SIZE; v += 1) {
      let sum = 0;
      for (let y = 0; y < PHASH_SIZE; y += 1) {
        for (let x = 0; x < PHASH_SIZE; x += 1) {
          sum += lowRes[y * PHASH_SIZE + x] * COS_TABLE[u][x] * COS_TABLE[v][y];
        }
      }
      coefficients.push(sum);
    }
  }
  const threshold = median(coefficients.slice(1));
  return Uint8Array.from(coefficients.map((value, index) => (index > 0 && value >= threshold ? 1 : 0)));
}

function blockAverages(values, inputSize, outputWidth, outputHeight) {
  const out = [];
  const blockWidth = inputSize / outputWidth;
  const blockHeight = inputSize / outputHeight;
  for (let outY = 0; outY < outputHeight; outY += 1) {
    for (let outX = 0; outX < outputWidth; outX += 1) {
      const startX = Math.floor(outX * blockWidth);
      const endX = Math.floor((outX + 1) * blockWidth);
      const startY = Math.floor(outY * blockHeight);
      const endY = Math.floor((outY + 1) * blockHeight);
      let sum = 0;
      let count = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          sum += values[y * inputSize + x];
          count += 1;
        }
      }
      out.push(count > 0 ? sum / count : 0);
    }
  }
  return out;
}

function buildCosTable(hashSize, inputSize) {
  return Array.from({ length: hashSize }, (_, u) =>
    Array.from({ length: inputSize }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * inputSize))),
  );
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return;
  }
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= magnitude;
  }
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function rankSecondPassCandidates({ target, candidatePool, previousKeys, topN }) {
  const targetNumber = qidNumber(target.qid);
  const ranked = [];
  for (const candidate of candidatePool) {
    if (candidate.operation === "reuse-existing-qid-image" && candidate.contextQids?.includes(target.qid)) {
      continue;
    }
    let best = null;
    for (const targetDescriptor of target.descriptors) {
      const visualParts = scoreDescriptors(targetDescriptor, candidate.descriptor);
      if (!best || visualParts.score > best.visualScore) {
        best = { targetDescriptor: targetDescriptor.name, visualParts, visualScore: visualParts.score };
      }
    }
    if (!best) {
      continue;
    }
    const keywordScore = setSimilarity(target.keywords, candidate.keywords);
    const tagScore = setSimilarity(new Set(target.tags), candidate.tags);
    const shapeScore = clamp01(best.visualParts.aspect * 0.52 + best.visualParts.edge * 0.18 + best.visualParts.pHash * 0.3);
    const proximityScore = qidProximityScore(targetNumber, candidate.contextQids ?? []);
    const priorKey = candidateKey(candidate.sourcePath, candidate.crop);
    const previousPenalty = previousKeys.has(priorKey) ? 0.18 : 0;
    const sourceBoost = candidate.operation === "reuse-existing-qid-image" ? 0.06 : candidate.diversityBucket === "first-pass-preview-asset" ? 0.02 : 0;
    const score = clamp01(
      best.visualScore * 0.34 +
      keywordScore * 0.28 +
      tagScore * 0.18 +
      shapeScore * 0.12 +
      proximityScore * 0.08 +
      sourceBoost -
      previousPenalty,
    );
    const nearQid = candidate.operation === "reuse-existing-qid-image" && qidProximityScore(targetNumber, candidate.contextQids ?? []) >= 0.7;
    const sourceType = nearQid ? "nearby-qid-production" : candidate.sourceType;
    const diversityBucket = nearQid ? "nearby-qid-production" : candidate.diversityBucket;
    ranked.push({
      ...candidate,
      sourceType,
      diversityBucket,
      score,
      scoring: {
        visualScore: best.visualScore,
        keywordScore,
        tagScore,
        shapeScore,
        proximityScore,
        previousPenalty,
        sourceBoost,
        pHash: best.visualParts.pHash,
        hist: best.visualParts.histogram,
        aspect: best.visualParts.aspect,
      },
      targetDescriptor: best.targetDescriptor,
      candidateDescriptor: candidate.descriptor.name,
      reason: buildReason({ keywordScore, tagScore, shapeScore, proximityScore, previousPenalty, candidate }),
    });
  }
  return diversifyCandidates(ranked, topN).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }));
}

function scoreDescriptors(target, candidate) {
  const pHash = hashSimilarity(target.pHash, candidate.pHash);
  const avgHash = hashSimilarity(target.avgHash, candidate.avgHash);
  const diffHash = hashSimilarity(target.diffHash, candidate.diffHash);
  const histogram = cosineSimilarity(target.histogram, candidate.histogram);
  const aspect = Math.exp(-Math.abs(Math.log(target.aspectRatio / candidate.aspectRatio)));
  const edge = 1 - Math.min(1, Math.abs(target.edgeDensity - candidate.edgeDensity) * 5);
  const score = pHash * 0.28 + diffHash * 0.16 + avgHash * 0.08 + histogram * 0.28 + aspect * 0.12 + edge * 0.08;
  return { score, pHash, avgHash, diffHash, histogram, aspect, edge };
}

function hashSimilarity(left, right) {
  let same = 0;
  const length = Math.min(left?.length ?? 0, right?.length ?? 0);
  for (let index = 0; index < length; index += 1) {
    if (left[index] === right[index]) {
      same += 1;
    }
  }
  return length > 0 ? same / length : 0;
}

function cosineSimilarity(left, right) {
  let dot = 0;
  const length = Math.min(left?.length ?? 0, right?.length ?? 0);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }
  return dot;
}

function setSimilarity(left, right) {
  const leftSet = left instanceof Set ? left : new Set(left ?? []);
  const rightSet = right instanceof Set ? right : new Set(right ?? []);
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      overlap += 1;
    }
  }
  return overlap / Math.sqrt(leftSet.size * rightSet.size);
}

function qidProximityScore(targetNumber, qids) {
  const distances = (qids ?? [])
    .map(qidNumber)
    .filter(Number.isFinite)
    .map((number) => Math.abs(number - targetNumber));
  if (distances.length === 0) {
    return 0;
  }
  const best = Math.min(...distances);
  if (best === 0) {
    return 0;
  }
  if (best <= 3) {
    return 1;
  }
  if (best <= 10) {
    return 0.82;
  }
  if (best <= 25) {
    return 0.58;
  }
  if (best <= 60) {
    return 0.25;
  }
  return 0;
}

function diversifyCandidates(candidates, topN) {
  const sorted = candidates.sort((left, right) => right.score - left.score);
  const selected = [];
  const seen = new Set();
  const bucketCaps = new Map([
    ["nearby-qid-production", 3],
    ["existing-production-qid", 3],
    ["screenshot-crop", 5],
    ["full-screenshot", 2],
    ["first-pass-preview-asset", 2],
  ]);
  for (const bucket of ["nearby-qid-production", "existing-production-qid", "screenshot-crop", "full-screenshot", "first-pass-preview-asset"]) {
    let count = 0;
    for (const candidate of sorted) {
      if (selected.length >= topN || count >= (bucketCaps.get(bucket) ?? 2)) {
        break;
      }
      if (candidate.diversityBucket !== bucket) {
        continue;
      }
      const key = candidateDedupeKey(candidate);
      if (seen.has(key)) {
        continue;
      }
      selected.push(candidate);
      seen.add(key);
      count += 1;
    }
  }
  for (const candidate of sorted) {
    if (selected.length >= topN) {
      break;
    }
    const key = candidateDedupeKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    selected.push(candidate);
    seen.add(key);
  }
  return selected.sort((left, right) => right.score - left.score).slice(0, topN);
}

function annotateExistingQidMatches(candidates, { target, productionCandidates, questionMap, rawQuestionMap }) {
  return candidates.map((candidate) => {
    const matches = findExistingQidMatches(candidate, {
      targetQid: target.qid,
      productionCandidates,
      questionMap,
      rawQuestionMap,
    });
    return {
      ...candidate,
      possibleExistingQidMatches: matches,
      likelyExistingQidMatch: matches.find((match) => match.exactOrNearExactExistingProductionImageMatch) ?? matches[0] ?? null,
    };
  });
}

function findExistingQidMatches(candidate, { targetQid, productionCandidates, questionMap, rawQuestionMap }) {
  const matches = [];
  for (const production of productionCandidates) {
    const qids = (production.contextQids ?? []).filter((qid) => qid !== targetQid);
    if (qids.length === 0) {
      continue;
    }
    const isSameImage = candidate.referencedImagePath && candidate.referencedImagePath === production.referencedImagePath;
    const visualScore = isSameImage ? 1 : scoreDescriptors(candidate.descriptor, production.descriptor).score;
    if (visualScore < 0.76 && !isSameImage) {
      continue;
    }
    const qid = qids[0];
    const question = summarizeQuestion(questionMap.get(qid), rawQuestionMap.get(qid));
    matches.push({
      qid,
      questionText: question.prompt,
      currentImagePath: production.referencedImagePath,
      visualSimilarityScore: roundScore(visualScore),
      exactOrNearExactExistingProductionImageMatch: isSameImage || visualScore >= 0.94,
      matchKind: isSameImage || visualScore >= 0.985 ? "exact" : visualScore >= 0.94 ? "near-exact" : "similar",
    });
  }
  return matches
    .sort((left, right) => right.visualSimilarityScore - left.visualSimilarityScore)
    .slice(0, 3);
}

function candidateDedupeKey(candidate) {
  if (candidate.operation === "reuse-existing-qid-image") {
    return `${candidate.operation}:${candidate.referencedImagePath}`;
  }
  return candidateKey(candidate.sourcePath, candidate.crop);
}

function candidateKey(sourcePath, crop) {
  if (!crop) {
    return `${sourcePath}:full`;
  }
  return `${sourcePath}:${Math.round(crop.left)}:${Math.round(crop.top)}:${Math.round(crop.width)}:${Math.round(crop.height)}`;
}

function buildReason({ keywordScore, tagScore, shapeScore, proximityScore, previousPenalty, candidate }) {
  const parts = [];
  if (candidate.operation === "reuse-existing-qid-image") parts.push("existing production asset");
  if (keywordScore >= 0.45) parts.push("keyword overlap");
  if (tagScore >= 0.45) parts.push("tag overlap");
  if (shapeScore >= 0.78) parts.push("shape match");
  if (proximityScore >= 0.58) parts.push("nearby qid context");
  if (previousPenalty > 0) parts.push("downranked first-pass repeat");
  return parts.length > 0 ? parts.join(", ") : "second-pass visual fallback";
}

function buildKeywordSet(question, tags = []) {
  const text = [
    question?.prompt,
    question?.rawPrompt,
    ...(question?.options ?? []).flatMap((option) => [option.text, option.rawText]),
    ...(tags ?? []),
  ].join(" ");
  const normalized = normalizeSearchText(text);
  const tokens = new Set();
  for (const [phrase, token] of PHRASE_HINTS) {
    if (normalized.includes(phrase)) {
      tokens.add(token);
    }
  }
  for (const number of normalized.match(/\b\d{1,4}\b/g) ?? []) {
    tokens.add(number);
    tokens.add(`number-${number}`);
  }
  for (const rawToken of normalized.split(/[^a-z0-9-]+/g)) {
    const token = normalizeToken(rawToken);
    if (token && token.length >= 2 && !STOPWORDS.has(token)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function pathKeywordTokens(value) {
  return buildKeywordSet({ prompt: String(value ?? ""), options: [] });
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\bkm\s*\/\s*h(?:r)?\b/g, "kmh")
    .replace(/\btelephone\b/g, "phone")
    .replace(/\bmotorized\b/g, "vehicle")
    .replace(/[_/]+/g, " ");
}

function normalizeToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildScreenshotContext(firstPass, questionMap, imageTagsMap) {
  const map = new Map();
  for (const result of firstPass?.results ?? []) {
    const qid = safeNormalizeQid(result.qid);
    if (!qid) {
      continue;
    }
    const question = questionMap.get(qid);
    const tags = flattenTags(imageTagsMap.get(qid));
    const keywords = buildKeywordSet(summarizeQuestion(question), tags);
    for (const candidate of result.candidates ?? []) {
      const sourcePath = candidate.screenshotPath;
      if (!sourcePath) {
        continue;
      }
      const entry = map.get(sourcePath) ?? { qids: new Set(), keywords: new Set(), tags: new Set() };
      entry.qids.add(qid);
      for (const token of keywords) entry.keywords.add(token);
      for (const tag of tags) entry.tags.add(tag);
      map.set(sourcePath, entry);
    }
  }
  return new Map([...map.entries()].map(([key, value]) => [
    key,
    {
      qids: [...value.qids],
      keywords: value.keywords,
      tags: value.tags,
    },
  ]));
}

function buildPreviousCandidateKeyMap(firstPass, qids) {
  const wanted = new Set(qids);
  const map = new Map(qids.map((qid) => [qid, new Set()]));
  for (const result of firstPass?.results ?? []) {
    const qid = safeNormalizeQid(result.qid);
    if (!qid || !wanted.has(qid)) {
      continue;
    }
    for (const candidate of (result.candidates ?? []).slice(0, 5)) {
      if (candidate.screenshotPath) {
        map.get(qid)?.add(candidateKey(candidate.screenshotPath, candidate.crop));
      }
    }
  }
  return map;
}

async function buildWorkbenchAssetCandidateSeeds(firstPass, qids) {
  const wanted = new Set(qids);
  const seeds = [];
  for (const result of firstPass?.results ?? []) {
    const sourceQid = safeNormalizeQid(result.qid);
    if (!sourceQid || !wanted.has(sourceQid)) {
      continue;
    }
    for (const candidate of result.candidates ?? []) {
      if (!candidate.thumbnailPath || !candidate.screenshotPath || !candidate.crop) {
        continue;
      }
      const thumbnailAbsolutePath = path.join(ROOT, candidate.thumbnailPath);
      const screenshotAbsolutePath = path.join(ROOT, candidate.screenshotPath);
      if (!(await fileExists(thumbnailAbsolutePath)) || !(await fileExists(screenshotAbsolutePath))) {
        continue;
      }
      seeds.push({
        sourceQid,
        sourcePath: candidate.screenshotPath,
        absolutePath: screenshotAbsolutePath,
        thumbnailPath: candidate.thumbnailPath,
        crop: candidate.crop,
        cropMode: `first-pass-${candidate.candidateDescriptor ?? "crop"}`,
      });
    }
  }
  return seeds;
}

async function buildPriorCropCandidate(seed) {
  try {
    const metadata = await sharp(seed.absolutePath, { limitInputPixels: false }).metadata();
    const crop = normalizeCrop(seed.crop, metadata);
    const descriptor = await buildDescriptor(seed.absolutePath, crop, seed.cropMode);
    return {
      sourceType: "screenshot-crop",
      diversityBucket: "first-pass-preview-asset",
      operation: "extract-enhance-from-approved-source",
      sourcePath: seed.sourcePath,
      absolutePath: seed.absolutePath,
      existingPreviewPath: seed.thumbnailPath,
      crop,
      cropMode: seed.cropMode,
      width: metadata.width,
      height: metadata.height,
      descriptor,
      keywords: new Set([...(seed.sourceQid ? [`source-${seed.sourceQid}`] : []), ...pathKeywordTokens(seed.sourcePath)]),
      tags: new Set(descriptor.colorTags),
      contextQids: seed.sourceQid ? [seed.sourceQid] : [],
    };
  } catch {
    return null;
  }
}

async function loadFirstPassWorkbench() {
  if (!(await fileExists(FIRST_PASS_WORKBENCH_PATH))) {
    return null;
  }
  return readJson(FIRST_PASS_WORKBENCH_PATH);
}

async function loadScreenshotDescriptorCache({ reuseCache, forceRebuildCache }) {
  if (!reuseCache || forceRebuildCache || !(await fileExists(SCREENSHOT_DESCRIPTOR_CACHE_PATH))) {
    return {
      version: CACHE_VERSION,
      generatedAt: stableNow(),
      entries: {},
    };
  }
  try {
    const cache = readJson(SCREENSHOT_DESCRIPTOR_CACHE_PATH);
    if (cache?.version !== CACHE_VERSION || !cache.entries || typeof cache.entries !== "object") {
      return { version: CACHE_VERSION, generatedAt: stableNow(), entries: {} };
    }
    return cache;
  } catch {
    return { version: CACHE_VERSION, generatedAt: stableNow(), entries: {} };
  }
}

async function writeScreenshotDescriptorCache(cache) {
  cache.version = CACHE_VERSION;
  cache.generatedAt = stableNow();
  await writeJson(SCREENSHOT_DESCRIPTOR_CACHE_PATH, cache);
}

function safeNormalizeQid(value) {
  try {
    return normalizeQid(value);
  } catch {
    return null;
  }
}

function prioritizeScreenshotPaths(paths, firstPass, qids) {
  const wanted = new Set(qids);
  const priority = new Map();
  for (const result of firstPass?.results ?? []) {
    const qid = safeNormalizeQid(result.qid);
    if (!qid || !wanted.has(qid)) {
      continue;
    }
    let rankBoost = 1000;
    for (const candidate of result.candidates ?? []) {
      if (candidate.screenshotPath && !priority.has(candidate.screenshotPath)) {
        priority.set(candidate.screenshotPath, rankBoost);
        rankBoost -= 1;
      }
    }
  }
  return [...paths].sort((left, right) => {
    const leftRelative = relativePath(left);
    const rightRelative = relativePath(right);
    const leftPriority = priority.get(leftRelative) ?? 0;
    const rightPriority = priority.get(rightRelative) ?? 0;
    return rightPriority - leftPriority || leftRelative.localeCompare(rightRelative, undefined, { numeric: true });
  });
}

function serializeCachedScreenshotCandidate(candidate) {
  return {
    sourceType: candidate.sourceType,
    diversityBucket: candidate.diversityBucket,
    operation: candidate.operation,
    sourcePath: candidate.sourcePath,
    crop: roundCrop(candidate.crop),
    cropMode: candidate.cropMode,
    width: candidate.width,
    height: candidate.height,
    descriptor: serializeDescriptor(candidate.descriptor),
  };
}

function serializeDescriptor(descriptor) {
  return {
    name: descriptor.name,
    crop: roundCrop(descriptor.crop),
    width: descriptor.width,
    height: descriptor.height,
    aspectRatio: descriptor.aspectRatio,
    avgHash: Array.from(descriptor.avgHash ?? []),
    diffHash: Array.from(descriptor.diffHash ?? []),
    pHash: Array.from(descriptor.pHash ?? []),
    histogram: Array.from(descriptor.histogram ?? []),
    edgeDensity: descriptor.edgeDensity,
    colorTags: Array.from(descriptor.colorTags ?? []),
  };
}

function deserializeDescriptor(descriptor) {
  return {
    ...descriptor,
    crop: descriptor.crop,
    avgHash: Array.from(descriptor.avgHash ?? []),
    diffHash: Array.from(descriptor.diffHash ?? []),
    pHash: Array.from(descriptor.pHash ?? []),
    histogram: Array.from(descriptor.histogram ?? []),
    colorTags: Array.from(descriptor.colorTags ?? []),
  };
}

async function writeCandidatePreviews(results) {
  await ensureDir(ASSETS_DIR);
  for (const result of results) {
    for (const candidate of result.candidates ?? []) {
      const hash = crypto
        .createHash("md5")
        .update(`${result.qid}:${candidate.sourcePath}:${candidate.referencedQid ?? ""}:${candidate.cropMode}:${candidateKey(candidate.sourcePath, candidate.crop)}`)
        .digest("hex")
        .slice(0, 16);
      const outputPath = path.join(ASSETS_DIR, `${result.qid}-rank${candidate.rank}-${hash}.jpeg`);
      const inputPath = candidate.operation === "reuse-existing-qid-image"
        ? path.join(ROOT, candidate.referencedImagePath)
        : candidate.absolutePath;
      const crop = candidate.operation === "reuse-existing-qid-image"
        ? { left: 0, top: 0, width: candidate.descriptor.width, height: candidate.descriptor.height }
        : normalizeCrop(candidate.crop, cropToMetadata(candidate.crop));
      if (await fileExists(outputPath)) {
        const metadata = await sharp(outputPath, { limitInputPixels: false }).metadata();
        candidate.previewPath = relativePath(outputPath);
        candidate.previewWidth = metadata.width ?? null;
        candidate.previewHeight = metadata.height ?? null;
        continue;
      }
      const info = await sharp(inputPath, { limitInputPixels: false })
        .rotate()
        .extract(crop)
        .resize({ width: 360, withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(outputPath);
      candidate.previewPath = relativePath(outputPath);
      candidate.previewWidth = info.width ?? null;
      candidate.previewHeight = info.height ?? null;
    }
  }
}

function serializeResult(result) {
  return {
    qid: result.qid,
    error: result.error ?? null,
    currentAsset: result.currentAsset ?? null,
    question: result.question ?? null,
    tags: result.tags ?? [],
    keywords: result.keywords ?? [],
    candidates: (result.candidates ?? []).map(serializeCandidate),
  };
}

function serializeCandidate(candidate) {
  return {
    rank: candidate.rank,
    sourceType: candidate.sourceType,
    sourcePath: candidate.sourcePath,
    referencedQid: candidate.referencedQid ?? null,
    referencedQids: candidate.referencedQids ?? null,
    referencedImagePath: candidate.referencedImagePath ?? null,
    previewPath: candidate.previewPath ?? candidate.existingPreviewPath ?? null,
    previewWidth: candidate.previewWidth ?? null,
    previewHeight: candidate.previewHeight ?? null,
    score: roundScore(candidate.score),
    scoring: Object.fromEntries(Object.entries(candidate.scoring ?? {}).map(([key, value]) => [key, roundScore(value)])),
    crop: roundCrop(candidate.crop),
    cropMode: candidate.cropMode,
    operation: candidate.operation,
    diversityBucket: candidate.diversityBucket,
    targetDescriptor: candidate.targetDescriptor,
    candidateDescriptor: candidate.candidateDescriptor,
    sourceWidth: candidate.width ?? null,
    sourceHeight: candidate.height ?? null,
    reason: candidate.reason,
    possibleExistingQidMatches: candidate.possibleExistingQidMatches ?? [],
    likelyExistingQidMatch: candidate.likelyExistingQidMatch ?? null,
  };
}

function roundScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(4)) : value ?? null;
}

function roundCrop(crop) {
  if (!crop) {
    return null;
  }
  return {
    left: Math.round(crop.left),
    top: Math.round(crop.top),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  };
}

function buildHtml(workbench, { htmlPath, jsonPath }) {
  const rows = workbench.results.map((result) => buildResultSection(result, htmlPath)).join("\n");
  const storageKey = `image-replacement-second-pass:${workbench.dataset}:${workbench.settings.qids.join(",")}`;
  const exportFileName = "image-replacement-second-pass-decisions.json";
  const clientData = {
    dataset: workbench.dataset,
    generatedAt: workbench.generatedAt,
    source: workbench.source,
    results: workbench.results,
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Replacement Second-Pass Workbench</title>
  <style>
    :root { color-scheme: light; --bg:#f6f7f9; --panel:#fff; --ink:#17202a; --muted:#64748b; --line:#d9e0ea; --selected:#2563eb; --selected-bg:#eff6ff; --good:#047857; --warn:#b45309; --bad:#b91c1c; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--ink); }
    header { position:sticky; top:0; z-index:10; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); padding:16px 24px; backdrop-filter: blur(10px); }
    h1 { margin:0 0 8px; font-size:20px; letter-spacing:0; }
    h2 { margin:0; font-size:18px; }
    .meta, .small { color:var(--muted); font-size:12px; line-height:1.45; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px; }
    button { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:6px; padding:8px 10px; font-weight:650; cursor:pointer; }
    button.primary { background:#0f766e; border-color:#0f766e; color:#fff; }
    button.danger { border-color:#fecaca; color:#991b1b; }
    button.active { outline:2px solid var(--selected); outline-offset:1px; }
    main { padding:18px 24px 36px; }
    .qid-row { background:var(--panel); border:1px solid var(--line); border-radius:8px; margin:0 0 18px; overflow:hidden; }
    .qid-row[data-filter-hidden="true"] { display:none; }
    .row-head { display:grid; grid-template-columns: 220px 1fr; gap:18px; padding:16px; border-bottom:1px solid var(--line); }
    .current-img { width:100%; max-height:180px; object-fit:contain; background:#fff; border:1px solid var(--line); border-radius:6px; }
    .path { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap:anywhere; }
    .options { margin:8px 0 0; padding:0; list-style:none; display:grid; gap:4px; }
    .tagline { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .tag { font-size:12px; color:#334155; border:1px solid #cbd5e1; border-radius:999px; padding:2px 7px; background:#f8fafc; }
    .decision-panel { display:grid; gap:10px; padding:12px 16px; background:#f8fafc; border-bottom:1px solid var(--line); }
    .decision-buttons { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .status { font-weight:750; }
    textarea { width:100%; min-height:58px; resize:vertical; border:1px solid var(--line); border-radius:6px; padding:8px; font:inherit; background:#fff; }
    .candidates { display:grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap:12px; padding:16px; }
    .candidate { border:1px solid var(--line); border-radius:8px; background:#fff; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; min-height:100%; }
    .candidate.selected { border:3px solid var(--selected); background:var(--selected-bg); box-shadow:0 0 0 2px rgba(37,99,235,.12); }
    .candidate img { width:100%; height:170px; object-fit:contain; background:#fff; border-bottom:1px solid var(--line); }
    .candidate-body { padding:10px; display:grid; gap:6px; font-size:12px; }
    .candidate-title { display:flex; justify-content:space-between; gap:8px; font-weight:800; font-size:13px; }
    .selected-label { display:none; color:var(--selected); font-weight:900; }
    .candidate.selected .selected-label { display:inline; }
    .score-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:4px 8px; color:#334155; }
    .existing-match { border:1px solid #bfdbfe; border-radius:6px; background:#eff6ff; padding:7px; display:grid; gap:5px; }
    .existing-match strong { color:#1d4ed8; }
    .existing-match button { justify-self:start; padding:6px 8px; border-color:#2563eb; color:#1d4ed8; }
    .match-list { display:grid; gap:5px; }
    .summary { margin-top:10px; font-size:13px; font-weight:700; }
    .footer-actions { display:flex; justify-content:center; padding:18px; }
    @media (max-width: 760px) { .row-head { grid-template-columns:1fr; } main, header { padding-left:14px; padding-right:14px; } }
  </style>
</head>
<body>
  <header>
    <h1>Image Replacement Second-Pass Workbench</h1>
    <div class="meta">Dataset ${escapeHtml(workbench.dataset)} · generated ${escapeHtml(workbench.generatedAt)} · JSON ${escapeHtml(relativePath(jsonPath))}</div>
    <div class="meta">Clicking a candidate card automatically approves it. Use Needs manual search, Disregard, or Unsure to override.</div>
    ${workbench.decisionsPathWarning ? `<div class="meta">${escapeHtml(workbench.decisionsPathWarning)}</div>` : ""}
    <div class="toolbar">
      <button class="primary" type="button" data-export>Export decisions JSON</button>
      <button class="danger" type="button" data-clear>Clear saved decisions</button>
      <button type="button" class="active" data-filter="all">All</button>
      <button type="button" data-filter="approve">Approve</button>
      <button type="button" data-filter="needsManualSearch">Needs manual</button>
      <button type="button" data-filter="disregard">Disregard</button>
      <button type="button" data-filter="unsure">Unsure</button>
      <button type="button" data-filter="undecided">Undecided</button>
    </div>
    <div class="summary" data-summary></div>
  </header>
  <main>
    ${rows}
    <div class="footer-actions"><button class="primary" type="button" data-export>Export decisions JSON</button></div>
  </main>
  <script>
    const WORKBENCH = ${safeJsonForHtml(clientData)};
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const EXPORT_FILE_NAME = ${JSON.stringify(exportFileName)};
    let state = loadState();
    let activeFilter = "all";

    function loadState() {
      let parsed = {};
      try { parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { parsed = {}; }
      for (const result of WORKBENCH.results) {
        const current = parsed[result.qid] || {};
        if (current.selectedCandidateIndex != null && (!current.decision || current.decision === "undecided")) {
          current.decision = "approve";
        }
        parsed[result.qid] = {
          decision: current.decision || "undecided",
          selectedCandidateIndex: current.selectedCandidateIndex ?? null,
          reuseExistingQid: current.reuseExistingQid || null,
          reuseExistingImagePath: current.reuseExistingImagePath || null,
          notes: current.notes || "",
        };
      }
      return parsed;
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function render() {
      for (const result of WORKBENCH.results) {
        const row = document.querySelector('[data-qid="' + result.qid + '"]');
        const item = state[result.qid] || { decision: "undecided", selectedCandidateIndex: null, notes: "" };
        row.dataset.decision = item.decision || "undecided";
        row.querySelectorAll(".candidate").forEach((card) => {
          card.classList.toggle("selected", Number(card.dataset.index) === item.selectedCandidateIndex);
        });
        row.querySelectorAll("[data-decision-button]").forEach((button) => {
          button.classList.toggle("active", button.dataset.decisionButton === item.decision);
        });
        const status = row.querySelector("[data-status]");
        const reuseText = item.reuseExistingQid ? " · reuse existing " + item.reuseExistingQid : "";
        const selectedText = item.selectedCandidateIndex == null ? "no candidate selected" : "selected candidate #" + item.selectedCandidateIndex + reuseText;
        status.textContent = "Decision: " + (item.decision || "undecided") + " · " + selectedText;
        const notes = row.querySelector("textarea");
        if (notes.value !== item.notes) notes.value = item.notes || "";
        row.dataset.filterHidden = activeFilter !== "all" && (item.decision || "undecided") !== activeFilter ? "true" : "false";
      }
      renderSummary();
    }

    function counts() {
      const out = { approve: 0, needsManualSearch: 0, disregard: 0, unsure: 0, undecided: 0 };
      for (const result of WORKBENCH.results) {
        const decision = state[result.qid]?.decision || "undecided";
        out[decision] = (out[decision] || 0) + 1;
      }
      return out;
    }

    function renderSummary(prefix = "") {
      const c = counts();
      document.querySelector("[data-summary]").textContent =
        prefix + "approved " + c.approve + " · needsManualSearch " + c.needsManualSearch + " · disregard " + c.disregard + " · unsure " + c.unsure + " · undecided " + c.undecided;
    }

    function selectCandidate(qid, index) {
      state[qid] = state[qid] || {};
      if (state[qid].selectedCandidateIndex === index) {
        state[qid].selectedCandidateIndex = null;
        state[qid].decision = "undecided";
        state[qid].reuseExistingQid = null;
        state[qid].reuseExistingImagePath = null;
        saveState();
        render();
        return;
      }
      state[qid].selectedCandidateIndex = index;
      state[qid].decision = "approve";
      state[qid].reuseExistingQid = null;
      state[qid].reuseExistingImagePath = null;
      saveState();
      render();
    }

    function useExistingQid(qid, index, referencedQid, referencedImagePath) {
      state[qid] = state[qid] || {};
      state[qid].selectedCandidateIndex = index;
      state[qid].decision = "approve";
      state[qid].reuseExistingQid = referencedQid;
      state[qid].reuseExistingImagePath = referencedImagePath;
      const note = "reuse existing " + referencedQid + " image";
      const existingNotes = state[qid].notes || "";
      state[qid].notes = existingNotes.toLowerCase().includes(note.toLowerCase()) ? existingNotes : (existingNotes ? existingNotes + "\\n" + note : note);
      saveState();
      render();
    }

    function setDecision(qid, decision) {
      state[qid] = state[qid] || {};
      if (decision === "approve" && state[qid].selectedCandidateIndex == null) {
        alert("Select a candidate for " + qid + " before approving.");
        return;
      }
      state[qid].decision = decision;
      saveState();
      render();
    }

    function buildExport() {
      const decisions = {};
      for (const result of WORKBENCH.results) {
        const item = state[result.qid] || {};
        const decision = item.decision || "undecided";
        const selected = result.candidates.find((candidate) => candidate.rank === item.selectedCandidateIndex) || null;
        if (decision === "approve" && !selected) {
          throw new Error("Approved qid has no selected candidate: " + result.qid);
        }
        const base = {
          decision,
          currentImagePath: result.currentAsset?.path || null,
          questionText: result.question?.prompt || "",
          tags: result.tags || [],
          notes: item.notes || "",
        };
        if (decision === "approve" && selected) {
          const useExistingOverride = item.reuseExistingQid && item.reuseExistingImagePath;
          const effectiveOperation = useExistingOverride ? "reuse-existing-qid-image" : selected.operation;
          const effectiveReferencedQid = useExistingOverride ? item.reuseExistingQid : selected.referencedQid || null;
          const effectiveReferencedImagePath = useExistingOverride ? item.reuseExistingImagePath : selected.referencedImagePath || null;
          decisions[result.qid] = {
            ...base,
            approvedSourcePath: effectiveOperation === "extract-enhance-from-approved-source" ? selected.sourcePath : null,
            approvedPreviewPath: selected.previewPath || null,
            candidateIndex: selected.rank,
            operation: effectiveOperation,
            sourcePath: selected.sourcePath || null,
            score: selected.score,
            referencedQid: effectiveReferencedQid,
            referencedImagePath: effectiveReferencedImagePath,
            sourceType: selected.sourceType,
            cropMode: selected.cropMode,
            target: selected.targetDescriptor || null,
            box: selected.crop || null,
            sourceWidth: selected.sourceWidth ?? null,
            sourceHeight: selected.sourceHeight ?? null,
            previewWidth: selected.previewWidth ?? null,
            previewHeight: selected.previewHeight ?? null,
            secondPass: {
              visualScore: selected.scoring?.visualScore ?? null,
              keywordScore: selected.scoring?.keywordScore ?? null,
              tagScore: selected.scoring?.tagScore ?? null,
              shapeScore: selected.scoring?.shapeScore ?? null,
              reason: selected.reason || "",
            },
          };
        } else {
          decisions[result.qid] = base;
        }
      }
      return {
        dataset: WORKBENCH.dataset,
        generatedAt: new Date().toISOString(),
        source: "image-replacement-second-pass",
        decisions,
      };
    }

    function exportDecisions() {
      try {
        const c = counts();
        renderSummary("Before export: ");
        const payload = buildExport();
        const body = JSON.stringify(payload, null, 2) + "\\n";
        const blob = new Blob([body], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = EXPORT_FILE_NAME;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        renderSummary("Exported: ");
      } catch (error) {
        alert(error.message);
      }
    }

    document.addEventListener("click", (event) => {
      const useExistingButton = event.target.closest("[data-use-existing]");
      if (useExistingButton) {
        useExistingQid(
          useExistingButton.closest("[data-qid]").dataset.qid,
          Number(useExistingButton.dataset.candidateIndex),
          useExistingButton.dataset.referencedQid,
          useExistingButton.dataset.referencedImagePath,
        );
        return;
      }
      const card = event.target.closest(".candidate");
      if (card) {
        selectCandidate(card.closest("[data-qid]").dataset.qid, Number(card.dataset.index));
        return;
      }
      const decisionButton = event.target.closest("[data-decision-button]");
      if (decisionButton) {
        setDecision(decisionButton.closest("[data-qid]").dataset.qid, decisionButton.dataset.decisionButton);
        return;
      }
      const filterButton = event.target.closest("[data-filter]");
      if (filterButton) {
        activeFilter = filterButton.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button === filterButton));
        render();
        return;
      }
      if (event.target.closest("[data-export]")) exportDecisions();
      if (event.target.closest("[data-clear]") && confirm("Clear saved second-pass decisions?")) {
        localStorage.removeItem(STORAGE_KEY);
        state = loadState();
        render();
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches("textarea[data-notes]")) {
        const qid = event.target.closest("[data-qid]").dataset.qid;
        state[qid] = state[qid] || {};
        state[qid].notes = event.target.value;
        saveState();
      }
    });

    render();
  </script>
</body>
</html>`;
}

function buildResultSection(result, htmlPath) {
  const currentSrc = result.currentAsset?.path ? browserPath(result.currentAsset.path, htmlPath) : "";
  const options = (result.question?.options ?? [])
    .map((option) => `<li>${escapeHtml(option.text || option.rawText || "")}</li>`)
    .join("");
  const tags = (result.tags ?? []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const candidates = (result.candidates ?? []).map((candidate) => buildCandidateCard(candidate, htmlPath)).join("\n");
  return `<section class="qid-row" data-qid="${escapeAttr(result.qid)}" data-decision="undecided">
    <div class="row-head">
      <div>
        ${currentSrc ? `<img class="current-img" src="${escapeAttr(currentSrc)}" alt="${escapeAttr(result.qid)} current production image">` : ""}
        <div class="small path">${escapeHtml(result.currentAsset?.path ?? "missing current image")}</div>
      </div>
      <div>
        <h2>${escapeHtml(result.qid)}</h2>
        <p>${escapeHtml(result.question?.prompt ?? result.error ?? "")}</p>
        ${options ? `<ul class="options">${options}</ul>` : ""}
        ${tags ? `<div class="tagline">${tags}</div>` : ""}
      </div>
    </div>
    <div class="decision-panel">
      <div class="decision-buttons">
        <span class="status" data-status>Decision: undecided · no candidate selected</span>
        <button type="button" data-decision-button="approve">Approve selected candidate</button>
        <button type="button" data-decision-button="needsManualSearch">Needs manual search</button>
        <button type="button" data-decision-button="disregard">Disregard / no replacement</button>
        <button type="button" data-decision-button="unsure">Unsure</button>
      </div>
      <textarea data-notes placeholder="Reviewer notes"></textarea>
    </div>
    <div class="candidates">${candidates || `<div class="small">No second-pass candidates generated.</div>`}</div>
  </section>`;
}

function buildCandidateCard(candidate, htmlPath) {
  const previewSrc = candidate.previewPath ? browserPath(candidate.previewPath, htmlPath) : "";
  const crop = candidate.crop ? `${candidate.crop.left}, ${candidate.crop.top}, ${candidate.crop.width} × ${candidate.crop.height}` : "none";
  const likely = candidate.likelyExistingQidMatch;
  const likelyMatch = likely
    ? `<div class="existing-match">
        <strong>Likely existing qid: ${escapeHtml(likely.qid)}</strong>
        <div>${escapeHtml(likely.questionText ?? "")}</div>
        <div class="path">${escapeHtml(likely.currentImagePath ?? "")}</div>
        <div>visual similarity ${formatNumber(likely.visualSimilarityScore)} · ${escapeHtml(likely.matchKind ?? "")}</div>
        <button type="button" data-use-existing data-candidate-index="${candidate.rank}" data-referenced-qid="${escapeAttr(likely.qid)}" data-referenced-image-path="${escapeAttr(likely.currentImagePath ?? "")}">Use existing ${escapeHtml(likely.qid)} image</button>
      </div>`
    : "";
  const matchList = (candidate.possibleExistingQidMatches ?? []).length > 0
    ? `<div class="match-list">
        <strong>possibleExistingQidMatches</strong>
        ${(candidate.possibleExistingQidMatches ?? []).map((match) => `<div>
          ${escapeHtml(match.qid)} · ${formatNumber(match.visualSimilarityScore)} · ${escapeHtml(match.exactOrNearExactExistingProductionImageMatch ? "exact/near-exact" : "similar")}<br>
          ${escapeHtml(match.questionText ?? "")}<br>
          <span class="path">${escapeHtml(match.currentImagePath ?? "")}</span>
        </div>`).join("")}
      </div>`
    : "";
  return `<article class="candidate" data-index="${candidate.rank}">
    ${previewSrc ? `<img src="${escapeAttr(previewSrc)}" alt="candidate ${candidate.rank}">` : ""}
    <div class="candidate-body">
      <div class="candidate-title"><span>#${candidate.rank} · ${escapeHtml(candidate.sourceType)}</span><span class="selected-label">✓ Selected</span></div>
      <div><strong>operation:</strong> ${escapeHtml(candidate.operation)}</div>
      ${likelyMatch}
      ${candidate.referencedQid ? `<div><strong>referenced qid:</strong> ${escapeHtml(candidate.referencedQid)}</div>` : ""}
      <div class="path"><strong>source:</strong> ${escapeHtml(candidate.sourcePath ?? "")}</div>
      ${candidate.referencedImagePath ? `<div class="path"><strong>image:</strong> ${escapeHtml(candidate.referencedImagePath)}</div>` : ""}
      ${matchList}
      <div class="score-grid">
        <span>score ${formatNumber(candidate.score)}</span>
        <span>visual ${formatNumber(candidate.scoring?.visualScore)}</span>
        <span>keyword ${formatNumber(candidate.scoring?.keywordScore)}</span>
        <span>tag ${formatNumber(candidate.scoring?.tagScore)}</span>
        <span>shape ${formatNumber(candidate.scoring?.shapeScore)}</span>
        <span>bucket ${escapeHtml(candidate.diversityBucket ?? "")}</span>
        <span>pHash ${formatNumber(candidate.scoring?.pHash)}</span>
        <span>hist ${formatNumber(candidate.scoring?.hist)}</span>
        <span>aspect ${formatNumber(candidate.scoring?.aspect)}</span>
      </div>
      <div><strong>crop:</strong> ${escapeHtml(crop)}</div>
      <div><strong>reason:</strong> ${escapeHtml(candidate.reason ?? "")}</div>
    </div>
  </article>`;
}

function buildMarkdown(workbench) {
  const lines = [
    "# Image Replacement Second-Pass Workbench",
    "",
    `- dataset: ${workbench.dataset}`,
    `- generatedAt: ${workbench.generatedAt}`,
    `- decisionsPath: ${workbench.decisionsPath}`,
    `- qids searched again: ${workbench.settings.qids.join(", ")}`,
    `- candidates generated: ${workbench.counts.candidates}`,
    `- existing-production-image matches found: ${workbench.counts.existingProductionImageMatches}`,
    "",
    "| qid | candidates | existing production matches | top score | top source |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  for (const result of workbench.results) {
    const existing = (result.candidates ?? []).filter((candidate) => candidate.operation === "reuse-existing-qid-image").length;
    const top = result.candidates?.[0];
    lines.push(`| ${result.qid} | ${result.candidates?.length ?? 0} | ${existing} | ${top?.score ?? ""} | ${top?.sourcePath ?? ""} |`);
  }
  lines.push("");
  if (workbench.decisionsPathWarning) {
    lines.push(`Warning: ${workbench.decisionsPathWarning}`, "");
  }
  return `${lines.join("\n")}\n`;
}

function browserPath(relativeOrAbsolutePath, htmlPath) {
  const absolute = path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(ROOT, relativeOrAbsolutePath);
  return path.relative(path.dirname(htmlPath), absolute).split(path.sep).join("/");
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "";
}

function safeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function normalizeCrop(crop, metadata) {
  const width = Math.max(1, Math.round(Number(metadata.width) || Number(crop.width) || 1));
  const height = Math.max(1, Math.round(Number(metadata.height) || Number(crop.height) || 1));
  const left = Math.max(0, Math.min(width - 1, Math.round(Number(crop.left) || 0)));
  const top = Math.max(0, Math.min(height - 1, Math.round(Number(crop.top) || 0)));
  const right = Math.max(left + 1, Math.min(width, Math.round((Number(crop.left) || 0) + (Number(crop.width) || width))));
  const bottom = Math.max(top + 1, Math.min(height, Math.round((Number(crop.top) || 0) + (Number(crop.height) || height))));
  return { left, top, width: right - left, height: bottom - top };
}

function cropToMetadata(crop) {
  return {
    width: Math.max(1, Math.round((Number(crop.left) || 0) + (Number(crop.width) || 1))),
    height: Math.max(1, Math.round((Number(crop.top) || 0) + (Number(crop.height) || 1))),
  };
}

function expandCrop(crop, metadata, ratio) {
  const padX = crop.width * ratio;
  const padY = crop.height * ratio;
  return normalizeCrop({
    left: crop.left - padX,
    top: crop.top - padY,
    width: crop.width + padX * 2,
    height: crop.height + padY * 2,
  }, metadata);
}

function buildUnionCrop(crops, metadata) {
  const valid = crops.filter(Boolean);
  if (valid.length === 0) {
    return null;
  }
  const left = Math.min(...valid.map((crop) => crop.left));
  const top = Math.min(...valid.map((crop) => crop.top));
  const right = Math.max(...valid.map((crop) => crop.left + crop.width));
  const bottom = Math.max(...valid.map((crop) => crop.top + crop.height));
  return normalizeCrop({ left, top, width: right - left, height: bottom - top }, metadata);
}

function cropMeaningfullyDiffers(left, right) {
  const delta = Math.abs(left.left - right.left) + Math.abs(left.top - right.top) + Math.abs(left.width - right.width) + Math.abs(left.height - right.height);
  return delta > 12;
}

function dedupeCrops(specs, metadata) {
  const out = [];
  const seen = new Set();
  for (const spec of specs) {
    const crop = normalizeCrop(spec.crop, metadata);
    const key = `${Math.round(crop.left / 8)}:${Math.round(crop.top / 8)}:${Math.round(crop.width / 8)}:${Math.round(crop.height / 8)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ name: spec.name, crop });
  }
  return out;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function safeReaddir(dirPath, options = undefined) {
  try {
    return await fs.readdir(dirPath, options);
  } catch {
    return [];
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha1File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

async function quickFileHash(filePath, stat) {
  const handle = await fs.open(filePath, "r");
  try {
    const chunkSize = Math.min(65536, stat.size);
    const first = Buffer.alloc(chunkSize);
    await handle.read(first, 0, chunkSize, 0);
    const tailSize = Math.min(65536, stat.size);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, Math.max(0, stat.size - tailSize));
    return crypto
      .createHash("sha1")
      .update(String(stat.size))
      .update(":")
      .update(first)
      .update(tail)
      .digest("hex");
  } finally {
    await handle.close();
  }
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
