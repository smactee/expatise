#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const DEFAULT_DATASET = "2023-test1";
const COLOR_VOCABULARY = ["blue", "red", "yellow", "brown", "green", "white", "black", "gray"];
const PRIMARY_THRESHOLD = 0.3;
const SECONDARY_THRESHOLD = 0.15;
const CHROMATIC_PRIMARY_THRESHOLD = 0.3;
const CHROMATIC_SECONDARY_THRESHOLD = 0.15;
const CHROMATIC_PRIMARY_MIN_OVERALL = 0.08;
const CHROMATIC_SECONDARY_MIN_OVERALL = 0.05;
const CROP_INSET_RATIO = 0.08;
const RESIZE_MAX = 96;
const ALPHA_THRESHOLD = 32;

sharp.cache(false);

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function rgbToHsv(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * (((blue - red) / delta) + 2);
    } else {
      hue = 60 * (((red - green) / delta) + 4);
    }
  }

  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return { h: hue, s: saturation, v: value };
}

function bucketColor(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);

  if (v <= 0.18) return "black";
  if (s <= 0.14 && v >= 0.9) return "white";
  if (s <= 0.18) return "gray";

  if (h < 18 || h >= 330) return "red";
  if (h < 50) return v < 0.72 ? "brown" : "yellow";
  if (h < 72) return "yellow";
  if (h < 170) return "green";
  if (h < 285) return "blue";
  return "red";
}

function isChromatic(color) {
  return !["white", "black", "gray"].includes(color);
}

function pickColorTags(counts, totalWeight) {
  const chromaticTotal = COLOR_VOCABULARY
    .filter((color) => isChromatic(color))
    .reduce((sum, color) => sum + (counts.get(color) ?? 0), 0);

  const ranked = COLOR_VOCABULARY
    .map((color) => {
      const count = counts.get(color) ?? 0;
      const overallShare = totalWeight > 0 ? count / totalWeight : 0;
      const chromaticShare = isChromatic(color) && chromaticTotal > 0 ? count / chromaticTotal : 0;
      return { color, overallShare, chromaticShare };
    })
    .filter((entry) => entry.overallShare > 0)
    .sort((left, right) => right.overallShare - left.overallShare);

  const tags = [];
  for (const entry of ranked) {
    const qualifiesPrimary = entry.overallShare >= PRIMARY_THRESHOLD
      || (isChromatic(entry.color)
        && entry.overallShare >= CHROMATIC_PRIMARY_MIN_OVERALL
        && entry.chromaticShare >= CHROMATIC_PRIMARY_THRESHOLD);

    const qualifiesSecondary = entry.overallShare >= SECONDARY_THRESHOLD
      || (isChromatic(entry.color)
        && entry.overallShare >= CHROMATIC_SECONDARY_MIN_OVERALL
        && entry.chromaticShare >= CHROMATIC_SECONDARY_THRESHOLD);

    if (qualifiesPrimary || qualifiesSecondary) {
      tags.push(entry.color);
    }

    if (tags.length >= 2) break;
  }

  return {
    colorTags: tags,
    dominantColors: ranked.slice(0, 4).map((entry) => ({
      color: entry.color,
      overallShare: round(entry.overallShare),
      chromaticShare: isChromatic(entry.color) ? round(entry.chromaticShare) : null,
    })),
  };
}

async function analyzeAsset(assetPath) {
  const base = sharp(assetPath, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    return {
      colorTags: [],
      dominantColors: [],
    };
  }

  const insetX = Math.max(0, Math.floor(width * CROP_INSET_RATIO));
  const insetY = Math.max(0, Math.floor(height * CROP_INSET_RATIO));
  const extractWidth = width - insetX * 2;
  const extractHeight = height - insetY * 2;

  let pipeline = base;
  if (extractWidth >= 24 && extractHeight >= 24) {
    pipeline = pipeline.extract({
      left: insetX,
      top: insetY,
      width: extractWidth,
      height: extractHeight,
    });
  }

  const { data, info } = await pipeline
    .resize(RESIZE_MAX, RESIZE_MAX, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map(COLOR_VOCABULARY.map((color) => [color, 0]));
  let totalWeight = 0;

  for (let index = 0; index < data.length; index += info.channels) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const alpha = data[index + 3] ?? 255;

    if (alpha < ALPHA_THRESHOLD) continue;

    const color = bucketColor(r, g, b);
    counts.set(color, (counts.get(color) ?? 0) + 1);
    totalWeight += 1;
  }

  return pickColorTags(counts, totalWeight);
}

async function main() {
  const dataset = argValue("--dataset") ?? DEFAULT_DATASET;
  const questionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
  const outputPath = argValue("--out")
    ? path.resolve(ROOT, String(argValue("--out")))
    : path.join(ROOT, "public", "qbank", dataset, "image-color-tags.json");

  const questionsDoc = JSON.parse(await fs.readFile(questionsPath, "utf8"));
  const questions = Array.isArray(questionsDoc) ? questionsDoc : questionsDoc.questions;
  if (!Array.isArray(questions)) {
    throw new Error(`questions.json does not contain an array: ${questionsPath}`);
  }

  const questionsWithImages = questions.filter((question) => Array.isArray(question.assets) && question.assets.length > 0);
  const byQuestion = {};
  let analyzedAssets = 0;
  let missingAssets = 0;

  for (const question of questionsWithImages) {
    const assetEntries = [];
    const allTags = new Set();
    const dominantByAsset = [];

    for (const asset of question.assets) {
      if (!asset?.src) continue;

      const relativeSrc = String(asset.src).replace(/^\/+/, "");
      const assetPath = path.join(ROOT, "public", relativeSrc);

      try {
        await fs.access(assetPath);
      } catch {
        missingAssets += 1;
        continue;
      }

      const analysis = await analyzeAsset(assetPath);
      analyzedAssets += 1;

      assetEntries.push(String(asset.src));
      for (const tag of analysis.colorTags) {
        allTags.add(tag);
      }
      dominantByAsset.push({
        assetSrc: String(asset.src),
        colors: analysis.dominantColors,
      });
    }

    if (assetEntries.length === 0) continue;

    byQuestion[String(question.id)] = {
      assetSrcs: assetEntries,
      colorTags: COLOR_VOCABULARY.filter((color) => allTags.has(color)),
      dominantByAsset,
    };
  }

  const output = {
    meta: {
      dataset,
      generatedAt: new Date().toISOString(),
      questionCount: questions.length,
      imageQuestionCount: questionsWithImages.length,
      analyzedAssets,
      missingAssets,
      colorVocabulary: COLOR_VOCABULARY,
      thresholds: {
        primaryThreshold: PRIMARY_THRESHOLD,
        secondaryThreshold: SECONDARY_THRESHOLD,
        chromaticPrimaryThreshold: CHROMATIC_PRIMARY_THRESHOLD,
        chromaticSecondaryThreshold: CHROMATIC_SECONDARY_THRESHOLD,
        chromaticPrimaryMinOverallShare: CHROMATIC_PRIMARY_MIN_OVERALL,
        chromaticSecondaryMinOverallShare: CHROMATIC_SECONDARY_MIN_OVERALL,
      },
      imageHandling: {
        cropInsetRatio: CROP_INSET_RATIO,
        resizeMax: RESIZE_MAX,
        alphaThreshold: ALPHA_THRESHOLD,
        notes: [
          "Transparent pixels are ignored.",
          "A small edge crop reduces border and page-background noise.",
          "Chromatic-share fallback helps preserve sign colors even when white background dominates.",
        ],
      },
    },
    questions: byQuestion,
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${path.relative(ROOT, outputPath)} with ${Object.keys(byQuestion).length} image-tagged questions.`);
}

await main();
