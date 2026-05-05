#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";

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
import fs from "node:fs/promises";

const DEFAULT_QIDS = [
  662, 663, 669, 670, 680, 697, 700, 717, 718, 719, 752, 755, 756, 761, 768,
  772, 787, 789, 790, 794, 795, 839, 840, 841, 843, 844, 846, 854, 866, 867,
  871, 876, 878, 881, 889, 928, 930, 931, 932, 933, 934, 935, 936, 937, 938,
  939, 940, 941, 942, 943, 944, 945, 946, 947, 948, 949, 950, 951, 952, 953,
  954, 956, 957, 959, 960, 961, 963, 964, 966, 968, 977,
].map(normalizeQid);

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const WORKBENCH_ASSETS_DIR = path.join(REPORTS_DIR, "image-replacement-workbench-assets");
const DEFAULT_TOP_N = 5;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_CONCURRENCY = 6;
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const DETECTION_WIDTH = 800;
const DESCRIPTOR_SIZE = 32;
const PHASH_SIZE = 16;
const HASH_SIZE = 8;
const COS_TABLE = buildCosTable(HASH_SIZE, PHASH_SIZE);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const dataset = stringArg(args, "dataset", DEFAULT_DATASET);
  const topN = positiveIntegerArg(args, "top", DEFAULT_TOP_N);
  const confidenceThreshold = numericArg(args, "confidence-threshold", DEFAULT_CONFIDENCE_THRESHOLD);
  const concurrency = positiveIntegerArg(args, "concurrency", DEFAULT_CONCURRENCY);
  const qids = parseQids(stringArg(args, "qids", null)) ?? DEFAULT_QIDS;
  const htmlPath = path.resolve(
    ROOT,
    stringArg(args, "html-path", path.join(REPORTS_DIR, "image-replacement-workbench.html")),
  );
  const jsonPath = path.resolve(
    ROOT,
    stringArg(args, "json-path", path.join(REPORTS_DIR, "image-replacement-workbench.json")),
  );

  await ensureDir(REPORTS_DIR);
  await ensureDir(WORKBENCH_ASSETS_DIR);

  const questionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
  const questionsDoc = readJson(questionsPath);
  const questionMap = buildQuestionMap(questionsDoc);
  const screenshotPaths = await listScreenshotFiles(path.join(ROOT, "imports"));

  if (screenshotPaths.length === 0) {
    throw new Error("No screenshot files found under imports/*/batch-*/screenshots/.");
  }

  console.log(`Loading ${qids.length} qid target(s) from ${relativePath(questionsPath)}.`);
  const targets = await buildTargets({ dataset, qids, questionMap });

  console.log(`Indexing ${screenshotPaths.length} screenshot candidate(s).`);
  let indexedCount = 0;
  const screenshotIndex = await mapLimit(screenshotPaths, concurrency, async (screenshotPath) => {
    const entry = await buildScreenshotEntry(screenshotPath);
    indexedCount += 1;
    if (indexedCount % 50 === 0 || indexedCount === screenshotPaths.length) {
      console.log(`Indexed ${indexedCount}/${screenshotPaths.length} screenshots.`);
    }
    return entry;
  });

  const results = [];
  for (const target of targets) {
    if (target.error) {
      results.push({
        ...target,
        status: "needsManualSearch",
        needsManualSearch: true,
        candidates: [],
      });
      continue;
    }

    const candidates = rankCandidates(target, screenshotIndex, topN);
    const topScore = candidates[0]?.score ?? 0;
    const runnerUpScore = candidates[1]?.score ?? 0;
    const margin = topScore - runnerUpScore;
    const needsManualSearch = topScore < confidenceThreshold;

    results.push({
      ...target,
      status: needsManualSearch ? "needsManualSearch" : confidenceLabel(topScore, margin),
      needsManualSearch,
      topScore,
      runnerUpScore,
      margin,
      candidates,
    });
  }

  await writeCandidateThumbnails(results);

  const workbench = {
    generatedAt: stableNow(),
    dataset,
    sourceMode: "candidate-discovery",
    screenshotSearchRoots: [
      "imports/ru/batch-*/screenshots/",
      "imports/*/batch-*/screenshots/",
    ],
    qids,
    settings: {
      topN,
      confidenceThreshold,
      concurrency,
    },
    counts: summarizeResults(results),
    screenshotsScanned: screenshotIndex.length,
    results: results.map(serializeResult),
  };

  await writeJson(jsonPath, workbench);
  await writeText(htmlPath, buildHtml(workbench, {
    htmlPath,
    jsonPath,
  }));

  console.log(`Wrote ${relativePath(htmlPath)}.`);
  console.log(`Wrote ${relativePath(jsonPath)}.`);
  console.log(`Needs manual search: ${workbench.counts.needsManualSearch}/${workbench.counts.total}.`);
}

function stringArg(args, key, fallback = null) {
  if (!(key in args)) {
    return fallback;
  }
  const value = String(args[key] ?? "").trim();
  return value || fallback;
}

function positiveIntegerArg(args, key, fallback) {
  const raw = stringArg(args, key, null);
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numericArg(args, key, fallback) {
  const raw = stringArg(args, key, null);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseQids(raw) {
  if (!raw) {
    return null;
  }

  const qids = raw
    .split(/[\s,]+/g)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeQid);

  return qids.length > 0 ? [...new Set(qids)] : null;
}

function normalizeQid(value) {
  const digits = String(value ?? "").replace(/^q/i, "").replace(/\D/g, "");
  if (!digits) {
    throw new Error(`Invalid qid: ${value}`);
  }
  return `q${digits.padStart(4, "0")}`;
}

function buildQuestionMap(doc) {
  const questions = Array.isArray(doc) ? doc : Array.isArray(doc?.questions) ? doc.questions : [];
  return new Map(
    questions
      .filter((question) => typeof question?.id === "string")
      .map((question) => [question.id, question]),
  );
}

async function buildTargets({ dataset, qids, questionMap }) {
  const targets = [];

  for (const qid of qids) {
    const question = questionMap.get(qid);
    if (!question) {
      targets.push({
        qid,
        error: "qid not found in questions.json",
      });
      continue;
    }

    const asset = Array.isArray(question.assets)
      ? question.assets.find((candidate) => candidate?.kind === "image" && typeof candidate?.src === "string")
      : null;
    if (!asset) {
      targets.push({
        qid,
        question: summarizeQuestion(question),
        error: "no image asset found",
      });
      continue;
    }

    const assetPath = path.join(ROOT, "public", asset.src.replace(/^\/+/, ""));
    try {
      const descriptors = await buildTargetDescriptors(assetPath);
      targets.push({
        qid,
        question: summarizeQuestion(question),
        currentAsset: {
          src: asset.src,
          path: relativePath(assetPath),
          hash: asset.hash ?? null,
          page: asset.page ?? null,
          bbox: asset.bbox ?? null,
        },
        dataset,
        descriptors,
      });
    } catch (error) {
      targets.push({
        qid,
        question: summarizeQuestion(question),
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

function summarizeQuestion(question) {
  return {
    prompt: question.prompt ?? question.question ?? "",
    type: question.type ?? null,
    options: Array.isArray(question.options)
      ? question.options.map((option) => ({
        id: option.id ?? null,
        text: option.text ?? "",
      }))
      : [],
    correctOptionId: question.correctOptionId ?? null,
  };
}

async function listScreenshotFiles(importsDir) {
  const files = [];

  async function walk(dirPath) {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        continue;
      }
      const relative = relativePath(entryPath);
      if (/^imports\/[^/]+\/batch-[^/]+\/screenshots\//.test(relative)) {
        files.push(entryPath);
      }
    }
  }

  await walk(importsDir);

  return files.sort((left, right) => {
    const leftMeta = screenshotPathMeta(left);
    const rightMeta = screenshotPathMeta(right);
    return (
      leftMeta.lang.localeCompare(rightMeta.lang) ||
      leftMeta.batchNumber - rightMeta.batchNumber ||
      leftMeta.batch.localeCompare(rightMeta.batch) ||
      leftMeta.file.localeCompare(rightMeta.file, undefined, { numeric: true })
    );
  });
}

function screenshotPathMeta(filePath) {
  const relative = relativePath(filePath);
  const match = relative.match(/^imports\/([^/]+)\/(batch-[^/]+)\/screenshots\/(.+)$/);
  const batch = match?.[2] ?? "";
  const numberMatch = batch.match(/(\d+)/);
  return {
    lang: match?.[1] ?? "",
    batch,
    batchNumber: numberMatch ? Number.parseInt(numberMatch[1], 10) : 0,
    file: match?.[3] ?? path.basename(filePath),
  };
}

async function buildTargetDescriptors(assetPath) {
  const metadata = await sharp(assetPath, { limitInputPixels: false }).metadata();
  const fullCrop = normalizeCrop({
    left: 0,
    top: 0,
    width: metadata.width,
    height: metadata.height,
  }, metadata);
  const crops = [{ name: "asset-full", crop: fullCrop }];
  const trimCrop = await detectTrimCrop(assetPath, fullCrop);

  if (trimCrop && cropMeaningfullyDiffers(fullCrop, trimCrop)) {
    crops.push({ name: "asset-content-trim", crop: trimCrop });
  }

  return Promise.all(crops.map(({ name, crop }) => buildDescriptor(assetPath, crop, name)));
}

async function buildScreenshotEntry(screenshotPath) {
  const metadata = await sharp(screenshotPath, { limitInputPixels: false }).metadata();
  const cropSpecs = await buildScreenshotCropSpecs(screenshotPath, metadata);
  const descriptors = [];

  for (const spec of cropSpecs) {
    try {
      descriptors.push(await buildDescriptor(screenshotPath, spec.crop, spec.name));
    } catch {
      continue;
    }
  }

  return {
    path: screenshotPath,
    relativePath: relativePath(screenshotPath),
    meta: screenshotPathMeta(screenshotPath),
    width: metadata.width,
    height: metadata.height,
    descriptors,
  };
}

async function buildScreenshotCropSpecs(screenshotPath, metadata) {
  const fixedCrops = [
    {
      name: "full-screenshot",
      crop: { left: 0, top: 0, width: metadata.width, height: metadata.height },
    },
    {
      name: "layout-upper-wide",
      crop: proportionalCrop(metadata, 0.2, 0.07, 0.6, 0.55),
    },
    {
      name: "layout-upper-card",
      crop: proportionalCrop(metadata, 0.28, 0.1, 0.44, 0.48),
    },
    {
      name: "layout-asset-center",
      crop: proportionalCrop(metadata, 0.36, 0.12, 0.28, 0.42),
    },
  ];

  const components = await detectScreenshotComponents(screenshotPath, metadata);
  const componentCrops = components.slice(0, 8).map((component, index) => ({
    name: `detected-component-${index + 1}`,
    crop: expandCrop(component.crop, metadata, 0.08),
  }));

  const unionCrop = buildUnionCrop(components.slice(0, 4).map((component) => component.crop), metadata);
  const unionCrops = unionCrop ? [{ name: "detected-union", crop: expandCrop(unionCrop, metadata, 0.06) }] : [];
  const trimCrops = [];

  for (const spec of [...fixedCrops.slice(1), ...unionCrops]) {
    const trimCrop = await detectTrimCrop(screenshotPath, spec.crop);
    if (trimCrop && cropMeaningfullyDiffers(spec.crop, trimCrop)) {
      trimCrops.push({
        name: `${spec.name}-content-trim`,
        crop: expandCrop(trimCrop, metadata, 0.04),
      });
    }
  }

  return dedupeCrops([
    ...componentCrops,
    ...unionCrops,
    ...trimCrops,
    ...fixedCrops,
  ], metadata).slice(0, 16);
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
  const minX = Math.floor(width * 0.08);
  const maxX = Math.ceil(width * 0.92);
  const minY = Math.floor(height * 0.04);
  const maxY = Math.ceil(height * 0.72);

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const pixelIndex = (y * width + x) * 3;
      const red = data[pixelIndex];
      const green = data[pixelIndex + 1];
      const blue = data[pixelIndex + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const saturation = maxChannel - minChannel;
      const nearWhite = red > 246 && green > 246 && blue > 246;
      const nearLightGray = red > 235 && green > 235 && blue > 235 && saturation < 12;
      const veryDarkChrome = y < height * 0.08 && red < 18 && green < 18 && blue < 18;

      if (!nearWhite && !nearLightGray && !veryDarkChrome) {
        mask[y * width + x] = 1;
      }
    }
  }

  const components = connectedComponents(mask, width, height)
    .filter((component) => {
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      const fill = component.area / (componentWidth * componentHeight);
      const isTiny = component.area < 70 || componentWidth < 8 || componentHeight < 8;
      const isFlatTextLine = componentHeight < 12 && componentWidth > componentHeight * 5;
      const isSparseNoise = fill < 0.015 && component.area < 500;
      return !isTiny && !isFlatTextLine && !isSparseNoise;
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
      const visualScore = component.area * Math.min(2, componentWidth / 28) * Math.min(2, componentHeight / 28);
      return {
        ...component,
        crop,
        visualScore,
      };
    })
    .sort((left, right) => right.visualScore - left.visualScore);

  return components;
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
        if (
          neighbor < 0 ||
          neighbor >= mask.length ||
          visited[neighbor] ||
          !mask[neighbor]
        ) {
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
      const distance =
        Math.abs(red - background.red) +
        Math.abs(green - background.green) +
        Math.abs(blue - background.blue);
      const content = distance > 42 || (saturation > 48 && distance > 24);

      if (!content) {
        continue;
      }

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
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
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];

  for (const [startX, startY] of corners) {
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

function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
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

  const pixels = [];
  const gray = new Float64Array(DESCRIPTOR_SIZE * DESCRIPTOR_SIZE);
  const histogram = new Float64Array(64);
  let edgeTotal = 0;

  for (let y = 0; y < DESCRIPTOR_SIZE; y += 1) {
    for (let x = 0; x < DESCRIPTOR_SIZE; x += 1) {
      const pixelIndex = y * DESCRIPTOR_SIZE + x;
      const offset = pixelIndex * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      pixels.push([red, green, blue]);
      gray[pixelIndex] = 0.299 * red + 0.587 * green + 0.114 * blue;
      const redBin = Math.min(3, Math.floor(red / 64));
      const greenBin = Math.min(3, Math.floor(green / 64));
      const blueBin = Math.min(3, Math.floor(blue / 64));
      histogram[redBin * 16 + greenBin * 4 + blueBin] += 1;

      if (x > 0) {
        edgeTotal += Math.abs(gray[pixelIndex] - gray[pixelIndex - 1]);
      }
      if (y > 0) {
        edgeTotal += Math.abs(gray[pixelIndex] - gray[pixelIndex - DESCRIPTOR_SIZE]);
      }
    }
  }

  normalizeVector(histogram);

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
  };
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

  const withoutDc = coefficients.slice(1);
  const threshold = median(withoutDc);
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
    Array.from({ length: inputSize }, (_, x) =>
      Math.cos(((2 * x + 1) * u * Math.PI) / (2 * inputSize)),
    ),
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

function rankCandidates(target, screenshotIndex, topN) {
  const ranked = [];

  for (const screenshot of screenshotIndex) {
    let best = null;

    for (const candidateDescriptor of screenshot.descriptors) {
      for (const targetDescriptor of target.descriptors) {
        const scoreParts = scoreDescriptors(targetDescriptor, candidateDescriptor);
        if (!best || scoreParts.score > best.score) {
          best = {
            score: scoreParts.score,
            scoreParts,
            targetDescriptor: targetDescriptor.name,
            candidateDescriptor: candidateDescriptor.name,
            crop: candidateDescriptor.crop,
          };
        }
      }
    }

    if (!best) {
      continue;
    }

    ranked.push({
      screenshotPath: screenshot.relativePath,
      screenshotAbsolutePath: screenshot.path,
      lang: screenshot.meta.lang,
      batch: screenshot.meta.batch,
      file: screenshot.meta.file,
      screenshotWidth: screenshot.width,
      screenshotHeight: screenshot.height,
      ...best,
    });
  }

  return ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, topN)
    .map((candidate, index) => ({
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
  const score =
    pHash * 0.34 +
    diffHash * 0.2 +
    avgHash * 0.12 +
    histogram * 0.24 +
    aspect * 0.06 +
    edge * 0.04;

  return {
    score,
    pHash,
    avgHash,
    diffHash,
    histogram,
    aspect,
    edge,
  };
}

function hashSimilarity(left, right) {
  let same = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] === right[index]) {
      same += 1;
    }
  }
  return length > 0 ? same / length : 0;
}

function cosineSimilarity(left, right) {
  let dot = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }
  return dot;
}

function confidenceLabel(topScore, margin) {
  if (topScore >= 0.84 && margin >= 0.025) {
    return "highConfidence";
  }
  if (topScore >= 0.76) {
    return "mediumConfidence";
  }
  return "lowConfidence";
}

async function writeCandidateThumbnails(results) {
  await ensureDir(WORKBENCH_ASSETS_DIR);

  for (const result of results) {
    for (const candidate of result.candidates ?? []) {
      const key = crypto
        .createHash("md5")
        .update(`${candidate.screenshotPath}:${candidate.crop.left}:${candidate.crop.top}:${candidate.crop.width}:${candidate.crop.height}`)
        .digest("hex")
        .slice(0, 16);
      const fileName = `${result.qid}-rank${candidate.rank}-${key}.jpeg`;
      const outputPath = path.join(WORKBENCH_ASSETS_DIR, fileName);
      const previewInfo = await sharp(candidate.screenshotAbsolutePath, { limitInputPixels: false })
        .rotate()
        .extract(normalizeCrop(candidate.crop, cropToMetadata(candidate.crop)))
        .resize({ width: 360, withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(outputPath);
      candidate.thumbnailPath = relativePath(outputPath);
      candidate.previewWidth = previewInfo.width ?? null;
      candidate.previewHeight = previewInfo.height ?? null;
    }
  }
}

function summarizeResults(results) {
  return {
    total: results.length,
    withCurrentAsset: results.filter((result) => !result.error).length,
    missingOrErrored: results.filter((result) => result.error).length,
    needsManualSearch: results.filter((result) => result.needsManualSearch).length,
    highConfidence: results.filter((result) => result.status === "highConfidence").length,
    mediumConfidence: results.filter((result) => result.status === "mediumConfidence").length,
    lowConfidence: results.filter((result) => result.status === "lowConfidence").length,
  };
}

function serializeResult(result) {
  return {
    qid: result.qid,
    status: result.status,
    needsManualSearch: result.needsManualSearch,
    error: result.error ?? null,
    currentAsset: result.currentAsset ?? null,
    question: result.question ?? null,
    topScore: roundScore(result.topScore),
    runnerUpScore: roundScore(result.runnerUpScore),
    margin: roundScore(result.margin),
    candidates: (result.candidates ?? []).map((candidate) => ({
      rank: candidate.rank,
      score: roundScore(candidate.score),
      scoreParts: Object.fromEntries(
        Object.entries(candidate.scoreParts ?? {}).map(([key, value]) => [key, roundScore(value)]),
      ),
      screenshotPath: candidate.screenshotPath,
      thumbnailPath: candidate.thumbnailPath,
      lang: candidate.lang,
      batch: candidate.batch,
      file: candidate.file,
      crop: roundCrop(candidate.crop),
      targetDescriptor: candidate.targetDescriptor,
      candidateDescriptor: candidate.candidateDescriptor,
      screenshotWidth: candidate.screenshotWidth,
      screenshotHeight: candidate.screenshotHeight,
      previewWidth: candidate.previewWidth ?? null,
      previewHeight: candidate.previewHeight ?? null,
    })),
  };
}

function roundScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(4)) : null;
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
  const jsonRelativePath = path.relative(path.dirname(htmlPath), jsonPath).split(path.sep).join("/");
  const storageKey = `image-replacement-workbench:${workbench.dataset}:${workbench.qids.join(",")}`;
  const exportFileName = `image-replacement-decisions-${workbench.dataset}.json`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Replacement Candidate Workbench</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #64748b;
      --line: #d9e0ea;
      --accent: #0f766e;
      --warn: #b45309;
      --bad: #b91c1c;
      --good: #047857;
      --selected: #2563eb;
      --selected-bg: #eff6ff;
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(10px);
      padding: 16px 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 20px;
      letter-spacing: 0;
    }
    .meta, .small {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 12px;
    }
    button, input, select, textarea {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      padding: 8px 10px;
    }
    button {
      cursor: pointer;
      font-weight: 650;
    }
    button.primary {
      border-color: #0f766e;
      background: #0f766e;
      color: #fff;
    }
    button.secondary {
      background: #f8fafc;
    }
    button.danger {
      border-color: #fecaca;
      background: #fef2f2;
      color: var(--bad);
    }
    button.selected {
      border-color: var(--selected);
      background: var(--selected-bg);
      color: #1d4ed8;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
    }
    textarea {
      width: 100%;
      min-height: 70px;
      resize: vertical;
      box-sizing: border-box;
    }
    main {
      padding: 20px 24px 36px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .stat, .qid-block {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .stat {
      padding: 12px;
    }
    .stat strong {
      display: block;
      font-size: 20px;
    }
    .qid-block {
      margin: 0 0 18px;
      overflow: hidden;
    }
    .qid-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      border-bottom: 1px solid var(--line);
      padding: 14px 16px;
    }
    .qid-head h2 {
      margin: 0 0 6px;
      font-size: 17px;
      letter-spacing: 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 3px 8px;
      font-size: 12px;
      white-space: nowrap;
      background: #fff;
    }
    .badge.highConfidence { color: var(--good); border-color: #a7f3d0; background: #ecfdf5; }
    .badge.mediumConfidence { color: var(--accent); border-color: #99f6e4; background: #f0fdfa; }
    .badge.lowConfidence { color: var(--warn); border-color: #fed7aa; background: #fff7ed; }
    .badge.needsManualSearch { color: var(--bad); border-color: #fecaca; background: #fef2f2; }
    .qid-body {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: 16px;
      padding: 16px;
    }
    .decision-panel {
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 1fr minmax(220px, 360px);
      gap: 16px;
      padding: 14px 16px 16px;
      background: #fbfdff;
    }
    .decision-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .decision-state {
      color: var(--muted);
      font-size: 12px;
      margin-top: 8px;
    }
    .current img, .candidate img {
      display: block;
      max-width: 100%;
      max-height: 230px;
      object-fit: contain;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .prompt {
      margin: 10px 0 0;
      font-size: 13px;
      line-height: 1.45;
    }
    .candidates {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .candidate {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      min-width: 0;
      cursor: pointer;
      outline: none;
      position: relative;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .candidate:hover {
      border-color: #94a3b8;
      box-shadow: 0 1px 10px rgba(15, 23, 42, 0.08);
    }
    .candidate.selected {
      border: 3px solid var(--selected);
      background: var(--selected-bg);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
      padding: 8px;
    }
    .candidate .selected-label {
      display: none;
      position: absolute;
      top: 8px;
      right: 8px;
      border-radius: 999px;
      background: #1d4ed8;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 8px;
    }
    .candidate.selected .selected-label {
      display: inline-flex;
    }
    .candidate h3 {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    a { color: #0f766e; }
    .export-status {
      margin-top: 10px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e3a8a;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
    }
    .page-end {
      margin-top: 22px;
      padding: 16px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .hidden { display: none; }
    @media (max-width: 760px) {
      .qid-body { grid-template-columns: 1fr; }
      .decision-panel { grid-template-columns: 1fr; }
      header, main { padding-left: 14px; padding-right: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Image Replacement Candidate Workbench</h1>
    <div class="meta">
      Generated ${escapeHtml(workbench.generatedAt)} · dataset <code>${escapeHtml(workbench.dataset)}</code> · scanned ${workbench.screenshotsScanned} screenshots ·
      JSON <a href="${escapeAttribute(jsonRelativePath)}">${escapeHtml(jsonRelativePath)}</a>
    </div>
    <div class="meta">
      Clicking a candidate card automatically approves it. Use Needs manual search, Disregard, or Unsure to override.
    </div>
    <div class="toolbar">
      <input id="search" type="search" placeholder="Filter qid or path">
      <select id="decision-filter">
        <option value="all">All decisions</option>
        <option value="approve">Approve</option>
        <option value="needsManualSearch">Needs manual search</option>
        <option value="disregard">Disregard / no replacement</option>
        <option value="unsure">Unsure</option>
        <option value="undecided">Undecided</option>
      </select>
      <button type="button" class="primary export-decisions">Export Decisions JSON</button>
      <button type="button" class="danger" id="clear-saved-decisions">Clear saved decisions</button>
    </div>
    <div class="export-status" id="export-status" role="status" aria-live="polite" hidden></div>
  </header>
  <main>
    <section class="summary" id="decision-summary">
      ${summaryStat("Total", workbench.counts.total, "summary-total")}
      ${summaryStat("Approved", 0, "summary-approve")}
      ${summaryStat("Needs manual", 0, "summary-needsManualSearch")}
      ${summaryStat("Disregard", 0, "summary-disregard")}
      ${summaryStat("Unsure", 0, "summary-unsure")}
      ${summaryStat("Undecided", workbench.counts.total, "summary-undecided")}
    </section>
    ${rows}
    <section class="page-end">
      <div class="toolbar">
        <button type="button" class="primary export-decisions">Export Decisions JSON</button>
        <span class="small">Downloads <code>${escapeHtml(exportFileName)}</code>. Saved review state key: <code>${escapeHtml(storageKey)}</code></span>
      </div>
    </section>
  </main>
  <script>
    const WORKBENCH = ${serializeJsonForInlineScript(workbench)};
    const RESULTS_BY_QID = new Map(WORKBENCH.results.map((result) => [result.qid, result]));
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const EXPORT_FILE_NAME = ${JSON.stringify(exportFileName)};
    const searchInput = document.getElementById("search");
    const decisionFilter = document.getElementById("decision-filter");
    const exportStatus = document.getElementById("export-status");
    const DECISIONS = ["approve", "needsManualSearch", "disregard", "unsure", "undecided"];

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function baseState() {
      const state = {};
      for (const result of WORKBENCH.results) {
        state[result.qid] = {
          decision: "undecided",
          selectedCandidateIndex: null,
          notes: "",
        };
      }
      return state;
    }

    function normalizeDecision(value) {
      return DECISIONS.includes(value) ? value : "undecided";
    }

    function loadState() {
      const fallback = baseState();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return fallback;
        }
        const parsed = JSON.parse(raw);
        const source = parsed && typeof parsed === "object" && parsed.decisions && typeof parsed.decisions === "object"
          ? parsed.decisions
          : parsed;
        for (const qid of WORKBENCH.qids) {
          const stored = source?.[qid] || {};
          const legacySelectedCandidate =
            stored.selectedCandidateIndex ??
            stored.candidateIndex ??
            stored.selectedCandidate?.rank ??
            stored.selectedCandidate;
          const selectedCandidateIndex = Number.isFinite(Number(legacySelectedCandidate))
            ? Number(legacySelectedCandidate)
            : null;
          const decision = normalizeDecision(stored.decision);
          fallback[qid] = {
            decision: selectedCandidateIndex && decision === "undecided" ? "approve" : decision,
            selectedCandidateIndex,
            notes: String(stored.notes ?? ""),
          };
        }
        return fallback;
      } catch {
        return fallback;
      }
    }

    let state = loadState();

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function getState(qid) {
      if (!state[qid]) {
        state[qid] = { decision: "undecided", selectedCandidateIndex: null, notes: "" };
      }
      return state[qid];
    }

    function setExportStatus(message) {
      const text = String(message ?? "").trim();
      exportStatus.textContent = text;
      exportStatus.hidden = !text;
    }

    function countDecisions() {
      const counts = {
        approve: 0,
        needsManualSearch: 0,
        disregard: 0,
        unsure: 0,
        undecided: 0,
      };
      for (const qid of WORKBENCH.qids) {
        counts[normalizeDecision(getState(qid).decision)] += 1;
      }
      return counts;
    }

    function updateSummary() {
      const counts = countDecisions();
      for (const key of Object.keys(counts)) {
        const element = document.getElementById("summary-" + key);
        if (element) {
          element.textContent = String(counts[key]);
        }
      }
    }

    function updateRow(qid) {
      const row = document.querySelector("[data-qid=" + JSON.stringify(qid) + "]");
      if (!row) {
        return;
      }
      const qidState = getState(qid);
      row.dataset.reviewDecision = normalizeDecision(qidState.decision);
      row.querySelectorAll(".candidate").forEach((card) => {
        const candidateIndex = Number(card.dataset.candidateIndex);
        card.classList.toggle("selected", candidateIndex === Number(qidState.selectedCandidateIndex));
      });
      row.querySelectorAll("[data-decision]").forEach((button) => {
        button.classList.toggle("selected", button.dataset.decision === qidState.decision);
      });
      const label = row.querySelector("[data-decision-label]");
      if (label) {
        const selected = qidState.selectedCandidateIndex ? " · selected candidate #" + qidState.selectedCandidateIndex : "";
        label.textContent = "Decision: " + normalizeDecision(qidState.decision) + selected;
      }
      const notes = row.querySelector("[data-notes]");
      if (notes && notes.value !== qidState.notes) {
        notes.value = qidState.notes;
      }
    }

    function selectCandidate(qid, candidateIndex) {
      const qidState = getState(qid);
      qidState.selectedCandidateIndex = Number(candidateIndex);
      qidState.decision = "approve";
      saveState();
      updateRow(qid);
      updateSummary();
      applyFilters();
    }

    function setDecision(qid, decision) {
      const qidState = getState(qid);
      if (decision === "approve" && !qidState.selectedCandidateIndex) {
        alert("Select a candidate before approving " + qid + ".");
        return;
      }
      qidState.decision = normalizeDecision(decision);
      saveState();
      updateRow(qid);
      updateSummary();
      applyFilters();
    }

    function setNotes(qid, notes) {
      getState(qid).notes = String(notes ?? "");
      saveState();
    }

    function applyFilters() {
      const needle = searchInput.value.trim().toLowerCase();
      const decision = decisionFilter.value;
      for (const block of document.querySelectorAll(".qid-block")) {
        const text = block.dataset.search;
        const matchesText = !needle || text.includes(needle);
        const blockDecision = block.dataset.reviewDecision || "undecided";
        const matchesDecision = decision === "all" || blockDecision === decision;
        block.classList.toggle("hidden", !(matchesText && matchesDecision));
      }
    }

    function selectedCandidate(result, qidState) {
      const selectedIndex = Number(qidState.selectedCandidateIndex);
      return result.candidates.find((candidate) => Number(candidate.rank) === selectedIndex) || null;
    }

    function decisionForExport(result) {
      const qidState = getState(result.qid);
      const decision = normalizeDecision(qidState.decision);
      const base = {
        decision,
        currentImagePath: result.currentAsset?.path ?? null,
        questionText: result.question?.prompt ?? "",
        notes: qidState.notes,
      };

      if (decision !== "approve") {
        return base;
      }

      const candidate = selectedCandidate(result, qidState);
      if (!candidate) {
        return null;
      }

      return {
        ...base,
        approvedSourcePath: candidate.screenshotPath,
        approvedPreviewPath: candidate.thumbnailPath ?? null,
        candidateIndex: candidate.rank,
        score: candidate.score,
        cropMode: candidate.candidateDescriptor ?? null,
        target: candidate.targetDescriptor ?? null,
        sourceWidth: candidate.screenshotWidth ?? null,
        sourceHeight: candidate.screenshotHeight ?? null,
        previewWidth: candidate.previewWidth ?? null,
        previewHeight: candidate.previewHeight ?? null,
        box: clone(candidate.crop ?? null),
        sourceCrop: clone(candidate.crop ?? null),
        scoreParts: clone(candidate.scoreParts ?? null),
      };
    }

    function buildExportPayload() {
      const decisions = {};
      for (const result of WORKBENCH.results) {
        const qidState = getState(result.qid);
        if (qidState.decision === "approve" && !qidState.selectedCandidateIndex) {
          alert("Export blocked: " + result.qid + " is approved but has no selected candidate.");
          document.querySelector("[data-qid=" + JSON.stringify(result.qid) + "]")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return null;
        }
        const exported = decisionForExport(result);
        if (!exported) {
          alert("Export blocked: " + result.qid + " is approved but the selected candidate was not found.");
          return null;
        }
        decisions[result.qid] = exported;
      }

      return {
        dataset: WORKBENCH.dataset,
        generatedAt: new Date().toISOString(),
        sourceWorkbenchGeneratedAt: WORKBENCH.generatedAt,
        sourceWorkbenchJsonPath: ${JSON.stringify(relativePath(jsonPath))},
        decisions,
      };
    }

    function download(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    function exportDecisions() {
      const payload = buildExportPayload();
      if (!payload) {
        return;
      }
      const counts = countDecisions();
      setExportStatus(
        "Export summary before download: approved " + counts.approve +
        " · needsManualSearch " + counts.needsManualSearch +
        " · disregard " + counts.disregard +
        " · unsure " + counts.unsure +
        " · undecided " + counts.undecided
      );
      window.setTimeout(() => {
        download(EXPORT_FILE_NAME, JSON.stringify(payload, null, 2) + "\\n", "application/json");
        setExportStatus(
          "Exported decisions. approved " + counts.approve +
          " · needsManualSearch " + counts.needsManualSearch +
          " · disregard " + counts.disregard +
          " · unsure " + counts.unsure +
          " · undecided " + counts.undecided
        );
      }, 0);
    }

    function clearSavedDecisions() {
      if (!confirm("Clear saved image replacement decisions from this browser?")) {
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      state = baseState();
      for (const qid of WORKBENCH.qids) {
        updateRow(qid);
      }
      updateSummary();
      applyFilters();
      setExportStatus("Saved decisions cleared.");
    }

    document.querySelectorAll(".candidate").forEach((card) => {
      card.addEventListener("click", () => {
        selectCandidate(card.dataset.qid, card.dataset.candidateIndex);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCandidate(card.dataset.qid, card.dataset.candidateIndex);
        }
      });
    });

    document.querySelectorAll("[data-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        setDecision(button.dataset.qid, button.dataset.decision);
      });
    });

    document.querySelectorAll("[data-notes]").forEach((textarea) => {
      textarea.addEventListener("input", () => {
        setNotes(textarea.dataset.qid, textarea.value);
      });
    });

    document.querySelectorAll(".export-decisions").forEach((button) => {
      button.addEventListener("click", exportDecisions);
    });

    document.getElementById("clear-saved-decisions").addEventListener("click", clearSavedDecisions);

    searchInput.addEventListener("input", applyFilters);
    decisionFilter.addEventListener("change", applyFilters);

    for (const qid of WORKBENCH.qids) {
      updateRow(qid);
    }
    updateSummary();
    applyFilters();
  </script>
</body>
</html>
`;
}

function summaryStat(label, value, id = null) {
  return `<div class="stat"><strong${id ? ` id="${escapeAttribute(id)}"` : ""}>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function buildResultSection(result, htmlPath) {
  const status = result.status ?? "needsManualSearch";
  const searchText = [
    result.qid,
    status,
    result.currentAsset?.path,
    ...(result.candidates ?? []).map((candidate) => candidate.screenshotPath),
  ].filter(Boolean).join(" ").toLowerCase();
  const currentSrc = result.currentAsset?.path
    ? path.relative(path.dirname(htmlPath), path.join(ROOT, result.currentAsset.path)).split(path.sep).join("/")
    : "";
  const candidateCards = (result.candidates ?? [])
    .map((candidate) => buildCandidateCard(candidate, htmlPath, result.qid))
    .join("\n");

  return `<section class="qid-block" data-qid="${escapeAttribute(result.qid)}" data-status="${escapeAttribute(status)}" data-review-decision="undecided" data-search="${escapeAttribute(searchText)}">
  <div class="qid-head">
    <div>
      <h2>${escapeHtml(result.qid)}</h2>
      <div class="small">top score ${escapeHtml(formatMaybeScore(result.topScore))} · margin ${escapeHtml(formatMaybeScore(result.margin))}</div>
    </div>
    <span class="badge ${escapeAttribute(status)}">${escapeHtml(status)}</span>
  </div>
  <div class="qid-body">
    <div class="current">
      ${currentSrc ? `<img loading="lazy" src="${escapeAttribute(currentSrc)}" alt="Current production image for ${escapeAttribute(result.qid)}">` : ""}
      <p class="small"><code>${escapeHtml(result.currentAsset?.path ?? result.error ?? "no current asset")}</code></p>
      <p class="prompt">${escapeHtml(result.question?.prompt ?? "")}</p>
    </div>
    <div class="candidates">
      ${candidateCards || `<div class="small">${escapeHtml(result.error ?? "No candidates generated.")}</div>`}
    </div>
  </div>
  <div class="decision-panel">
    <div>
      <div class="decision-buttons">
        ${decisionButton(result.qid, "approve", "Approve selected candidate")}
        ${decisionButton(result.qid, "needsManualSearch", "Needs manual search")}
        ${decisionButton(result.qid, "disregard", "Disregard / no replacement")}
        ${decisionButton(result.qid, "unsure", "Unsure")}
      </div>
      <div class="decision-state" data-decision-label>Decision: undecided</div>
    </div>
    <label class="small">Notes
      <textarea data-notes data-qid="${escapeAttribute(result.qid)}" placeholder="Reviewer notes"></textarea>
    </label>
  </div>
</section>`;
}

function buildCandidateCard(candidate, htmlPath, qid) {
  const thumbSrc = candidate.thumbnailPath
    ? path.relative(path.dirname(htmlPath), path.join(ROOT, candidate.thumbnailPath)).split(path.sep).join("/")
    : "";
  const screenshotSrc = path.relative(path.dirname(htmlPath), path.join(ROOT, candidate.screenshotPath)).split(path.sep).join("/");

  return `<article class="candidate" role="button" tabindex="0" data-qid="${escapeAttribute(qid)}" data-candidate-index="${escapeAttribute(candidate.rank)}">
  <span class="selected-label">✓ Selected</span>
  <h3>#${candidate.rank} · score ${escapeHtml(formatMaybeScore(candidate.score))}</h3>
  ${thumbSrc ? `<img loading="lazy" src="${escapeAttribute(thumbSrc)}" alt="Candidate crop ${candidate.rank}">` : ""}
  <p class="small">source <code>${escapeHtml(candidate.screenshotPath)}</code></p>
  <p class="small">preview <code>${escapeHtml(candidate.thumbnailPath ?? "")}</code></p>
  <p class="small">crop <code>${escapeHtml(candidate.candidateDescriptor)}</code> · target <code>${escapeHtml(candidate.targetDescriptor)}</code> · box <code>${escapeHtml(JSON.stringify(candidate.crop ?? null))}</code></p>
  <p class="small">pHash ${escapeHtml(formatMaybeScore(candidate.scoreParts?.pHash))} · hist ${escapeHtml(formatMaybeScore(candidate.scoreParts?.histogram))} · aspect ${escapeHtml(formatMaybeScore(candidate.scoreParts?.aspect))}</p>
  <p class="small">full screenshot <code>${escapeHtml(screenshotSrc)}</code></p>
</article>`;
}

function decisionButton(qid, decision, label) {
  return `<button type="button" class="secondary" data-qid="${escapeAttribute(qid)}" data-decision="${escapeAttribute(decision)}">${escapeHtml(label)}</button>`;
}

function serializeJsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function formatMaybeScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "n/a";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function normalizeCrop(crop, metadata) {
  const left = clamp(Math.round(crop.left), 0, Math.max(0, metadata.width - 1));
  const top = clamp(Math.round(crop.top), 0, Math.max(0, metadata.height - 1));
  const right = clamp(Math.round(crop.left + crop.width), left + 1, metadata.width);
  const bottom = clamp(Math.round(crop.top + crop.height), top + 1, metadata.height);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function cropToMetadata(crop) {
  return {
    width: Math.max(1, Math.round(crop.left + crop.width)),
    height: Math.max(1, Math.round(crop.top + crop.height)),
  };
}

function expandCrop(crop, metadata, ratio) {
  const paddingX = crop.width * ratio;
  const paddingY = crop.height * ratio;
  return normalizeCrop({
    left: crop.left - paddingX,
    top: crop.top - paddingY,
    width: crop.width + paddingX * 2,
    height: crop.height + paddingY * 2,
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
  const union = normalizeCrop({ left, top, width: right - left, height: bottom - top }, metadata);

  if (union.width > metadata.width * 0.75 || union.height > metadata.height * 0.68) {
    return null;
  }

  return union;
}

function dedupeCrops(specs, metadata) {
  const out = [];

  for (const spec of specs) {
    const crop = normalizeCrop(spec.crop, metadata);
    const duplicate = out.some((existing) => cropIou(existing.crop, crop) > 0.88);
    if (!duplicate && crop.width >= 8 && crop.height >= 8) {
      out.push({ ...spec, crop });
    }
  }

  return out;
}

function cropIou(left, right) {
  const x1 = Math.max(left.left, right.left);
  const y1 = Math.max(left.top, right.top);
  const x2 = Math.min(left.left + left.width, right.left + right.width);
  const y2 = Math.min(left.top + left.height, right.top + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const leftArea = left.width * left.height;
  const rightArea = right.width * right.height;
  const union = leftArea + rightArea - intersection;
  return union > 0 ? intersection / union : 0;
}

function cropMeaningfullyDiffers(left, right) {
  const iou = cropIou(left, right);
  const areaRatio = (right.width * right.height) / Math.max(1, left.width * left.height);
  return iou < 0.9 && areaRatio > 0.01 && areaRatio < 0.96;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}
