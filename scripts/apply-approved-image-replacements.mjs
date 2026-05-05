#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ensureDir,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const ROOT = process.cwd();
const DEFAULT_DECISIONS_PATH = path.join(ROOT, "qbank-tools", "generated", "staging", "image-replacement-decisions.json");
const APPLY_REPORT_JSON_PATH = path.join(REPORTS_DIR, "image-replacement-apply-report.json");
const APPLY_REPORT_MD_PATH = path.join(REPORTS_DIR, "image-replacement-apply-report.md");
const TEMP_DIR = path.join(ROOT, ".tmp", "image-replacement-apply");
const NOTE_WARNING = "reviewer notes present but not applied to image processing";
const IMAGE_TAGS_UNCHANGED = "image-color-tags unchanged";

main().catch(async (error) => {
  try {
    await writeFailureReport(error);
  } catch {
    // Preserve the original failure.
  }
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const requestedDecisionsPath = path.resolve(ROOT, stringArg(args, "decisions", DEFAULT_DECISIONS_PATH));
  const apply = booleanArg(args, "apply", false);

  await ensureDir(REPORTS_DIR);
  await ensureDir(TEMP_DIR);

  const decisionResolution = resolveDecisionsPath(requestedDecisionsPath);
  const decisionsPath = decisionResolution.path;
  const runWarnings = [...decisionResolution.warnings];

  if (!decisionsPath || !fileExists(decisionsPath)) {
    throw new Error(`Decisions file not found: ${relativePath(requestedDecisionsPath)}`);
  }

  const decisionDoc = readJson(decisionsPath);
  const dataset = String(decisionDoc.dataset ?? stringArg(args, "dataset", DEFAULT_DATASET));
  const datasetPaths = getDatasetPaths(dataset);
  const questionsDoc = readJson(datasetPaths.questionsPath);
  const rawQuestionsDoc = readJson(datasetPaths.rawQuestionsPath);
  const imageTagsDoc = fileExists(datasetPaths.imageColorTagsPath)
    ? readJson(datasetPaths.imageColorTagsPath)
    : null;
  const questionsByQid = buildQuestionMap(questionsDoc);
  const rawQuestionsByQid = buildQuestionMap(rawQuestionsDoc);
  const decisions = normalizeDecisionEntries(decisionDoc);
  const approvedQids = new Set(decisions.filter((entry) => entry.decision === "approve").map((entry) => entry.qid));
  const reportEntries = [];
  const errors = [];
  const modifiedQids = new Set();

  for (const entry of decisions) {
    if (entry.decision !== "approve") {
      reportEntries.push(buildSkippedReportEntry(entry));
      continue;
    }

    const qidErrors = [];
    const warnings = [];
    const approvedSourcePath = entry.approvedSourcePath ?? entry.sourcePath ?? entry.originalSourcePath ?? entry.candidateSourcePath;
    const sourcePath = resolveRepoPath(approvedSourcePath);
    const currentPath = resolveRepoPath(entry.currentImagePath);
    const notes = normalizeNotes(entry.notes);
    const box = normalizeBox(entry.box ?? entry.sourceCrop ?? entry.crop ?? entry.sourceBox);
    const crossQidReference = detectCrossQidReference(notes);
    const enhancementInstructionUsed = buildEnhancementInstruction({
      qid: entry.qid,
      approvedSourcePath,
      box,
      notes,
    });
    const currentQuestion = questionsByQid.get(entry.qid);
    const previousImagePath = entry.currentImagePath ?? null;

    if (!entry.currentImagePath) {
      qidErrors.push("currentImagePath is missing");
    } else if (!currentPath || !fileExists(currentPath)) {
      qidErrors.push(`currentImagePath does not exist: ${entry.currentImagePath}`);
    }

    if (!currentQuestion) {
      qidErrors.push(`qid not found in questions.json: ${entry.qid}`);
    }
    if (!rawQuestionsByQid.has(entry.qid)) {
      qidErrors.push(`qid not found in questions.raw.json: ${entry.qid}`);
    }

    let operation = entry.operation ?? "extract-enhance-from-approved-source";
    let referencedQid = entry.referencedQid ?? null;
    let referencedImagePath = entry.referencedImagePath ?? null;
    let finalImagePath = null;
    let imageColorTagsStatus = null;
    let newHash = null;
    let imageDimensions = null;

    if (operation === "reuse-existing-qid-image") {
      if (!referencedQid) {
        qidErrors.push("referencedQid is missing for reuse-existing-qid-image");
      }
      if (!referencedImagePath) {
        qidErrors.push("referencedImagePath is missing for reuse-existing-qid-image");
      }

      const normalizedReferencedQid = referencedQid ? normalizeQid(referencedQid) : null;
      const referencedQuestion = normalizedReferencedQid ? questionsByQid.get(normalizedReferencedQid) : null;
      const referencedAbsolutePath = referencedImagePath ? resolveRepoPath(referencedImagePath) : null;
      const referencedAsset = referencedQuestion ? getQuestionImageAsset(referencedQuestion) : null;

      if (normalizedReferencedQid) {
        referencedQid = normalizedReferencedQid;
      }
      if (referencedQid === entry.qid) {
        operation = "skip";
        finalImagePath = previousImagePath;
        warnings.push(`referenced qid equals current qid (${entry.qid}); skipping as no-op`);
      } else if (referencedQid && !referencedQuestion) {
        qidErrors.push(`referenced qid does not exist: ${referencedQid}`);
      } else if (referencedImagePath && (!referencedAbsolutePath || !fileExists(referencedAbsolutePath))) {
        qidErrors.push(`referenced qid image file does not exist: ${referencedImagePath}`);
      } else if (referencedQuestion && !referencedAsset) {
        qidErrors.push(`referenced qid has no production image: ${referencedQid}`);
      } else if (referencedAbsolutePath && fileExists(referencedAbsolutePath)) {
        finalImagePath = referencedImagePath;
        newHash = hashFile(referencedAbsolutePath);
        imageDimensions = await imageDimensionsForPath(referencedAbsolutePath);
        if (questionContextsDiffer(currentQuestion, referencedQuestion)) {
          warnings.push(`current qid and referenced qid question/answer text differ; using explicit referenced qid ${referencedQid}`);
        }
        imageColorTagsStatus = getImageColorTagsStatus({
          imageTagsDoc,
          qid: entry.qid,
          referencedQid,
          oldSrc: publicPathToAssetSrc(previousImagePath),
          newSrc: publicPathToAssetSrc(referencedImagePath),
        });
        if (imageColorTagsStatus === IMAGE_TAGS_UNCHANGED) {
          warnings.push(IMAGE_TAGS_UNCHANGED);
        }
      }
    } else if (crossQidReference.detected) {
      referencedQid = crossQidReference.referencedQid;

      if (crossQidReference.ambiguous) {
        operation = "skip";
        warnings.push(`ambiguousReference: notes contain multiple qid references: ${crossQidReference.references.join(", ")}`);
      } else if (referencedQid === entry.qid) {
        operation = "skip";
        finalImagePath = previousImagePath;
        warnings.push(`referenced qid equals current qid (${entry.qid}); skipping as no-op`);
      } else {
        operation = "reuse-existing-qid-image";
        const referencedQuestion = questionsByQid.get(referencedQid);
        const referencedAsset = referencedQuestion ? getQuestionImageAsset(referencedQuestion) : null;
        referencedImagePath = referencedAsset?.src ? assetSrcToPublicPath(referencedAsset.src) : null;
        const referencedAbsolutePath = referencedImagePath ? resolveRepoPath(referencedImagePath) : null;

        if (!referencedQuestion) {
          qidErrors.push(`referenced qid does not exist: ${referencedQid}`);
        } else if (!referencedAsset) {
          qidErrors.push(`referenced qid has no production image: ${referencedQid}`);
        } else if (!referencedAbsolutePath || !fileExists(referencedAbsolutePath)) {
          qidErrors.push(`referenced qid image file does not exist: ${referencedImagePath}`);
        } else {
          finalImagePath = referencedImagePath;
          newHash = referencedAsset.hash ?? hashFile(referencedAbsolutePath);
          imageDimensions = await imageDimensionsForPath(referencedAbsolutePath);
          if (questionContextsDiffer(currentQuestion, referencedQuestion)) {
            warnings.push(`current qid and referenced qid question/answer text differ; using explicit reviewer reference ${referencedQid}`);
          }
          imageColorTagsStatus = getImageColorTagsStatus({
            imageTagsDoc,
            qid: entry.qid,
            referencedQid,
            oldSrc: publicPathToAssetSrc(previousImagePath),
            newSrc: referencedAsset.src,
          });
          if (imageColorTagsStatus === IMAGE_TAGS_UNCHANGED) {
            warnings.push(IMAGE_TAGS_UNCHANGED);
          }
        }
      }
    } else {
      if (!approvedSourcePath) {
        qidErrors.push("approvedSourcePath is missing");
      } else if (!sourcePath || !fileExists(sourcePath)) {
        qidErrors.push(`approvedSourcePath does not exist: ${approvedSourcePath}`);
      }
    }

    if (notes && !crossQidReference.detected && operation === "skip") {
      warnings.push(NOTE_WARNING);
      console.warn(`${entry.qid}: ${NOTE_WARNING}`);
    }

    let finalAssetPath = null;
    let oldHash = currentPath && fileExists(currentPath) ? hashFile(currentPath) : null;
    let changedFiles = [];

    if (qidErrors.length > 0) {
      operation = "failed";
    }

    if (qidErrors.length === 0 && operation === "reuse-existing-qid-image") {
      finalAssetPath = finalImagePath;
      changedFiles = planQidImageReferenceChanges({
        dataset,
        qid: entry.qid,
        imageTagsDoc,
        oldSrc: publicPathToAssetSrc(previousImagePath),
        newSrc: publicPathToAssetSrc(finalImagePath),
        referencedQid,
        includeFinalAssetFile: false,
        finalAssetPath,
      });
      if (apply) {
        changedFiles = updateQidImageReferences({
          dataset,
          qid: entry.qid,
          questionsDoc,
          rawQuestionsDoc,
          imageTagsDoc,
          currentImagePath: previousImagePath,
          finalAssetPath,
          newHash,
          referencedQid,
          includeFinalAssetFile: false,
        });
        modifiedQids.add(entry.qid);
      }
    } else if (qidErrors.length === 0 && operation === "extract-enhance-from-approved-source") {
      const tempPath = path.join(TEMP_DIR, `${entry.qid}.jpeg`);
      await extractLocalPreview({
        sourcePath,
        box,
        notes,
        outputPath: tempPath,
      });
      newHash = hashFile(tempPath);
      finalAssetPath = `public/qbank/${dataset}/images/img_replacement_${entry.qid}_${newHash.slice(0, 12)}.jpeg`;
      finalImagePath = finalAssetPath;
      changedFiles = planQidImageReferenceChanges({
        dataset,
        qid: entry.qid,
        imageTagsDoc,
        oldSrc: publicPathToAssetSrc(previousImagePath),
        newSrc: publicPathToAssetSrc(finalAssetPath),
        referencedQid: null,
        includeFinalAssetFile: true,
        finalAssetPath,
      });

      if (apply) {
        const finalAbsolutePath = path.join(ROOT, finalAssetPath);
        if (fileExists(finalAbsolutePath)) {
          const existingHash = hashFile(finalAbsolutePath);
          if (existingHash !== newHash) {
            qidErrors.push(`refusing to overwrite existing different asset: ${finalAssetPath}`);
          }
        } else {
          await fsp.copyFile(tempPath, finalAbsolutePath);
        }
        if (qidErrors.length === 0) {
          changedFiles = updateQidImageReferences({
            dataset,
            qid: entry.qid,
            questionsDoc,
            rawQuestionsDoc,
            imageTagsDoc,
            currentImagePath: entry.currentImagePath,
            finalAssetPath,
            newHash,
            referencedQid: null,
            includeFinalAssetFile: true,
          });
          modifiedQids.add(entry.qid);
        }
      }
      imageDimensions = await imageDimensionsForPath(tempPath);
    }

    if (qidErrors.length > 0) {
      operation = "failed";
      errors.push(...qidErrors.map((message) => `${entry.qid}: ${message}`));
    }

    reportEntries.push({
      qid: entry.qid,
      decision: entry.decision,
      approvedSourcePath: approvedSourcePath ?? null,
      approvedPreviewPath: entry.approvedPreviewPath ?? null,
      currentImagePath: entry.currentImagePath ?? null,
      previousImagePath,
      finalAssetPath,
      finalImagePath,
      notes,
      notesIncluded: Boolean(notes),
      reviewerNotes: notes,
      notesApplied: operation === "extract-enhance-from-approved-source" ? Boolean(notes) : crossQidReference.detected,
      enhancementInstructionUsed: operation === "extract-enhance-from-approved-source" ? enhancementInstructionUsed : null,
      crossQidReferenceDetected: crossQidReference.detected,
      referencedQid,
      referencedImagePath,
      operation,
      imageColorTagsStatus,
      warnings,
      errors: qidErrors,
      validationStatus: validationStatus(qidErrors, warnings),
      oldHash,
      newHash,
      imageDimensions,
      changedFiles,
    });
  }

  for (const qid of modifiedQids) {
    if (!approvedQids.has(qid)) {
      errors.push(`script would modify non-approved qid: ${qid}`);
    }
  }

  const hasProductionChanges = reportEntries.some((entry) => entry.changedFiles.some((file) =>
    file.startsWith(`public/qbank/${dataset}/`),
  ));

  if (apply && errors.length === 0 && hasProductionChanges) {
    await writeJson(datasetPaths.questionsPath, questionsDoc);
    await writeJson(datasetPaths.rawQuestionsPath, rawQuestionsDoc);
    if (imageTagsDoc) {
      await writeJson(datasetPaths.imageColorTagsPath, imageTagsDoc);
    }
  }

  const report = buildReport({
    decisionsPath,
    requestedDecisionsPath,
    dataset,
    apply,
    runWarnings,
    entries: reportEntries,
    errors,
  });

  await validateRun({
    apply,
    datasetPaths,
    questionsDoc,
    rawQuestionsDoc,
    imageTagsDoc,
    report,
    errors,
  });
  syncReportErrorCounts(report, errors);

  await writeReports(report);

  if (errors.length > 0) {
    console.error(`Image replacement apply validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(`Wrote ${relativePath(APPLY_REPORT_JSON_PATH)}.`);
  console.log(`Wrote ${relativePath(APPLY_REPORT_MD_PATH)}.`);
  console.log(apply ? "Applied approved image replacements." : "Dry run complete; no production files were modified.");
}

function resolveDecisionsPath(requestedPath) {
  if (fileExists(requestedPath)) {
    return { path: requestedPath, warnings: [] };
  }

  const requestedDir = path.dirname(requestedPath);
  const requestedBase = path.basename(requestedPath);
  if (requestedBase !== "image-replacement-decisions.json" || !fileExists(requestedDir)) {
    return { path: requestedPath, warnings: [] };
  }

  const matches = fs.readdirSync(requestedDir)
    .filter((name) => /^image-replacement-decisions-[^.]+\.json$/i.test(name))
    .map((name) => path.join(requestedDir, name))
    .sort();

  if (matches.length === 1) {
    return {
      path: matches[0],
      warnings: [`requested decisions file missing; using ${relativePath(matches[0])}`],
    };
  }

  return { path: requestedPath, warnings: [] };
}

function stringArg(args, key, fallback = null) {
  if (!(key in args)) {
    return fallback;
  }
  const value = String(args[key] ?? "").trim();
  return value || fallback;
}

function booleanArg(args, key, fallback = false) {
  if (!(key in args)) {
    return fallback;
  }
  const value = args[key];
  if (value === true) {
    return true;
  }
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function normalizeDecisionEntries(doc) {
  const source = doc?.decisions && typeof doc.decisions === "object"
    ? doc.decisions
    : {};

  return Object.entries(source).map(([qid, raw]) => ({
    qid: normalizeQid(qid),
    decision: normalizeDecision(raw?.decision),
    approvedSourcePath: stringOrNull(raw?.approvedSourcePath),
    sourcePath: stringOrNull(raw?.sourcePath),
    originalSourcePath: stringOrNull(raw?.originalSourcePath),
    candidateSourcePath: stringOrNull(raw?.candidate?.sourcePath),
    approvedPreviewPath: stringOrNull(raw?.approvedPreviewPath),
    operation: stringOrNull(raw?.operation),
    referencedQid: raw?.referencedQid ? normalizeQid(raw.referencedQid) : null,
    referencedImagePath: stringOrNull(raw?.referencedImagePath),
    candidateIndex: raw?.candidateIndex ?? null,
    score: raw?.score ?? null,
    currentImagePath: stringOrNull(raw?.currentImagePath),
    questionText: stringOrNull(raw?.questionText),
    cropMode: stringOrNull(raw?.cropMode),
    target: stringOrNull(raw?.target),
    sourceWidth: raw?.sourceWidth ?? null,
    sourceHeight: raw?.sourceHeight ?? null,
    previewWidth: raw?.previewWidth ?? null,
    previewHeight: raw?.previewHeight ?? null,
    box: raw?.box ?? raw?.sourceCrop ?? raw?.crop ?? null,
    sourceCrop: raw?.sourceCrop ?? null,
    notes: normalizeNotes(raw?.notes),
    raw,
  }));
}

function normalizeQid(value) {
  const digits = String(value ?? "").replace(/^q/i, "").replace(/\D/g, "");
  return `q${digits.padStart(4, "0")}`;
}

function normalizeDecision(value) {
  const text = String(value ?? "undecided").trim();
  return new Set(["approve", "needsManualSearch", "disregard", "unsure", "undecided"]).has(text)
    ? text
    : "undecided";
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNotes(value) {
  return String(value ?? "").trim();
}

function normalizeBox(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const left = Number(value.left);
  const top = Number(value.top);
  const width = Number(value.width);
  const height = Number(value.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function detectCrossQidReference(notes) {
  const text = String(notes ?? "").trim();
  if (!text) {
    return {
      detected: false,
      ambiguous: false,
      references: [],
      referencedQid: null,
    };
  }

  const references = [];
  const addReference = (value) => {
    const qid = normalizeQid(value);
    if (!references.includes(qid)) {
      references.push(qid);
    }
  };
  const qidPattern = /\bq\s*0*(\d{1,4})\b/gi;
  const phrasePattern = /\b(?:use|same\s+as|replace\s+with|asset\s+from|this\s+is|copy\s+from)(?:\s+(?:the\s+)?(?:existing\s+)?(?:production\s+)?(?:image|asset))?(?:\s+from)?\s+q?0*(\d{1,4})\b/gi;

  for (const match of text.matchAll(qidPattern)) {
    addReference(match[1]);
  }
  for (const match of text.matchAll(phrasePattern)) {
    addReference(match[1]);
  }

  const bareNumber = text.match(/^\s*0*(\d{1,4})\s*$/);
  if (bareNumber) {
    addReference(bareNumber[1]);
  }

  return {
    detected: references.length > 0,
    ambiguous: references.length > 1,
    references,
    referencedQid: references.length === 1 ? references[0] : null,
  };
}

function buildQuestionMap(doc) {
  const questions = Array.isArray(doc) ? doc : Array.isArray(doc?.questions) ? doc.questions : [];
  return new Map(
    questions
      .filter((question) => typeof question?.id === "string")
      .map((question) => [question.id, question]),
  );
}

function buildSkippedReportEntry(entry) {
  const notes = normalizeNotes(entry.notes);
  return {
    qid: entry.qid,
    decision: entry.decision,
    approvedSourcePath: entry.approvedSourcePath ?? null,
    approvedPreviewPath: entry.approvedPreviewPath ?? null,
    currentImagePath: entry.currentImagePath ?? null,
    previousImagePath: entry.currentImagePath ?? null,
    finalAssetPath: null,
    finalImagePath: null,
    notes,
    notesIncluded: false,
    enhancementInstructionUsed: null,
    crossQidReferenceDetected: false,
    referencedQid: null,
    referencedImagePath: null,
    operation: "skip",
    imageColorTagsStatus: null,
    warnings: [],
    errors: [],
    validationStatus: "skipped",
    oldHash: null,
    newHash: null,
    changedFiles: [],
  };
}

function getQuestionImageAsset(question) {
  return Array.isArray(question?.assets)
    ? question.assets.find((asset) => asset?.kind === "image" && typeof asset?.src === "string")
    : null;
}

function questionContextsDiffer(left, right) {
  if (!left || !right) {
    return false;
  }
  return questionContextSignature(left) !== questionContextSignature(right);
}

function questionContextSignature(question) {
  const optionTexts = Array.isArray(question.options)
    ? question.options.map((option) => String(option?.text ?? "")).join("|")
    : "";
  const correctOption = Array.isArray(question.options)
    ? question.options.find((option) => option?.id === question.correctOptionId)?.text ?? ""
    : "";
  return normalizeContextText([
    question.prompt ?? question.question ?? "",
    optionTexts,
    question.correctOptionId ?? "",
    correctOption,
  ].join("|"));
}

function normalizeContextText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validationStatus(errors, warnings) {
  if (errors.length > 0) {
    return "failed";
  }
  if (warnings.length > 0) {
    return "warning";
  }
  return "passed";
}

function buildEnhancementInstruction({ qid, approvedSourcePath, box, notes }) {
  return `You are replacing a production qbank image for ${qid}.

Use the approved source screenshot:
${approvedSourcePath ?? ""}

Use this crop information if available:
${box ? JSON.stringify(box, null, 2) : "null"}

Reviewer notes:
${notes || ""}

Strict output requirements:
- Extract only the actual illustration/sign/image.
- Remove app UI, phone frame, screenshot margins, text controls, and surrounding page elements.
- Final background must be pure white (#ffffff), unless the illustration itself contains a colored background.
- Do not add gray background, border, shadow, rounded corners, or decorative padding.
- Keep the image sharp, centered, and high-definition.
- Preserve original symbol colors and proportions.
- Do not stretch or distort.
- If the reviewer notes mention corrupted areas, repair only those areas while preserving the valid parts.
- If notes conflict with the strict output rules, the strict output rules win except where the notes clarify repair needs.
- Save the final cleaned asset to the production image path for this qid only.`;
}

async function extractLocalPreview({ sourcePath, box, notes, outputPath }) {
  const image = sharp(sourcePath, { limitInputPixels: false }).rotate();
  const metadata = await image.metadata();
  const crop = box
    ? normalizeCropToMetadata(box, metadata)
    : { left: 0, top: 0, width: metadata.width, height: metadata.height };
  const extracted = await sharp(sourcePath, { limitInputPixels: false })
    .rotate()
    .extract(crop)
    .removeAlpha()
    .png()
    .toBuffer();
  const cleaned = await cleanExtractedImage(extracted, { notes });

  await sharp(cleaned, { limitInputPixels: false })
    .sharpen({ sigma: 0.7, m1: 0.9, m2: 1.6 })
    .jpeg({ quality: 95, progressive: true, mozjpeg: true })
    .toFile(outputPath);
}

async function cleanExtractedImage(inputBuffer, { notes = "" } = {}) {
  const aggressiveBackgroundRepair = notesRequestBackgroundRepair(notes);
  const { data, info } = await sharp(inputBuffer, { limitInputPixels: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const background = estimateImageBackground(data, width, height);
  const backgroundMask = floodFillBackground(data, width, height, background, { aggressiveBackgroundRepair });
  const cleaned = Buffer.from(data);

  for (let index = 0; index < backgroundMask.length; index += 1) {
    if (!backgroundMask[index]) {
      continue;
    }
    const offset = index * 3;
    cleaned[offset] = 255;
    cleaned[offset + 1] = 255;
    cleaned[offset + 2] = 255;
  }

  const contentBounds = findContentBounds(cleaned, width, height);
  const crop = contentBounds
    ? expandBounds(contentBounds, width, height, 0.07)
    : { left: 0, top: 0, width, height };
  const content = await sharp(cleaned, { raw: { width, height, channels: 3 }, limitInputPixels: false })
    .extract(crop)
    .png()
    .toBuffer();
  const padding = Math.max(14, Math.round(Math.max(crop.width, crop.height) * 0.055));

  return sharp({
    create: {
      width: crop.width + padding * 2,
      height: crop.height + padding * 2,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: content, left: padding, top: padding }])
    .png()
    .toBuffer();
}

function estimateImageBackground(data, width, height) {
  const sampleSize = Math.max(3, Math.floor(Math.min(width, height) * 0.06));
  const samples = [];
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
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function notesRequestBackgroundRepair(notes) {
  return /\b(corrupt|corrupted|repair|smooth|smudge|smudges|blemish|blemishes|consistent|clean|shade|shades|background|lower half|bottom half|top half)\b/i.test(String(notes ?? ""));
}

function floodFillBackground(data, width, height, background, { aggressiveBackgroundRepair = false } = {}) {
  const mask = new Uint8Array(width * height);
  const stack = [];

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const index = y * width + x;
    if (mask[index]) {
      return;
    }
    const offset = index * 3;
    if (!isBackgroundPixel(data[offset], data[offset + 1], data[offset + 2], background, { aggressiveBackgroundRepair })) {
      return;
    }
    mask[index] = 1;
    stack.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return mask;
}

function isBackgroundPixel(red, green, blue, background, { aggressiveBackgroundRepair = false } = {}) {
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const saturation = maxChannel - minChannel;
  const distance =
    Math.abs(red - background.red) +
    Math.abs(green - background.green) +
    Math.abs(blue - background.blue);
  const nearWhite = red > 238 && green > 238 && blue > 238;
  const nearBlackChrome = red < 20 && green < 20 && blue < 20;
  const neutralThreshold = aggressiveBackgroundRepair ? 104 : 78;
  const saturationThreshold = aggressiveBackgroundRepair ? 44 : 34;
  const neutralBackground = saturation < saturationThreshold && distance < neutralThreshold;
  const lightGrayUi = red > (aggressiveBackgroundRepair ? 198 : 210) && green > (aggressiveBackgroundRepair ? 198 : 210) && blue > (aggressiveBackgroundRepair ? 198 : 210) && saturation < (aggressiveBackgroundRepair ? 36 : 25);
  return nearWhite || nearBlackChrome || neutralBackground || lightGrayUi;
}

function findContentBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const isWhite = red > 246 && green > 246 && blue > 246;
      const isVeryLightNeutral = red > 235 && green > 235 && blue > 235 && maxChannel - minChannel < 12;
      if (isWhite || isVeryLightNeutral) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }

  if (count < Math.max(20, width * height * 0.003)) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function expandBounds(bounds, width, height, ratio) {
  const paddingX = Math.max(4, Math.round(bounds.width * ratio));
  const paddingY = Math.max(4, Math.round(bounds.height * ratio));
  return normalizeCropToMetadata({
    left: bounds.left - paddingX,
    top: bounds.top - paddingY,
    width: bounds.width + paddingX * 2,
    height: bounds.height + paddingY * 2,
  }, { width, height });
}

function normalizeCropToMetadata(crop, metadata) {
  const left = clamp(crop.left, 0, Math.max(0, metadata.width - 1));
  const top = clamp(crop.top, 0, Math.max(0, metadata.height - 1));
  const right = clamp(crop.left + crop.width, left + 1, metadata.width);
  const bottom = clamp(crop.top + crop.height, top + 1, metadata.height);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function updateQidImageReferences({
  dataset,
  qid,
  questionsDoc,
  rawQuestionsDoc,
  imageTagsDoc,
  currentImagePath,
  finalAssetPath,
  newHash,
  referencedQid = null,
  includeFinalAssetFile = true,
}) {
  const changedFiles = new Set();
  const oldSrc = publicPathToAssetSrc(currentImagePath);
  const newSrc = publicPathToAssetSrc(finalAssetPath);

  if (updateQuestionDocAsset(questionsDoc, qid, oldSrc, newSrc, newHash)) {
    changedFiles.add(`public/qbank/${dataset}/questions.json`);
  }
  if (updateQuestionDocAsset(rawQuestionsDoc, qid, oldSrc, newSrc, newHash)) {
    changedFiles.add(`public/qbank/${dataset}/questions.raw.json`);
  }
  if (imageTagsDoc && updateImageColorTags(imageTagsDoc, qid, oldSrc, newSrc, referencedQid)) {
    changedFiles.add(`public/qbank/${dataset}/image-color-tags.json`);
  }
  if (includeFinalAssetFile) {
    changedFiles.add(finalAssetPath);
  }

  return [...changedFiles];
}

function planQidImageReferenceChanges({
  dataset,
  qid,
  imageTagsDoc,
  oldSrc,
  newSrc,
  referencedQid = null,
  includeFinalAssetFile = true,
  finalAssetPath,
}) {
  const changedFiles = new Set([
    `public/qbank/${dataset}/questions.json`,
    `public/qbank/${dataset}/questions.raw.json`,
  ]);
  if (imageTagsDoc && imageColorTagsWouldChange(imageTagsDoc, qid, oldSrc, newSrc, referencedQid)) {
    changedFiles.add(`public/qbank/${dataset}/image-color-tags.json`);
  }
  if (includeFinalAssetFile && finalAssetPath) {
    changedFiles.add(finalAssetPath);
  }
  return [...changedFiles];
}

function updateQuestionDocAsset(doc, qid, oldSrc, newSrc, newHash) {
  const question = buildQuestionMap(doc).get(qid);
  if (!question || !Array.isArray(question.assets)) {
    return false;
  }

  let changed = false;
  for (const asset of question.assets) {
    if (asset?.kind !== "image") {
      continue;
    }
    if (asset.src === oldSrc || question.assets.filter((candidate) => candidate?.kind === "image").length === 1) {
      asset.src = newSrc;
      asset.hash = newHash;
      changed = true;
      break;
    }
  }

  return changed;
}

function updateImageColorTags(doc, qid, oldSrc, newSrc, referencedQid = null) {
  const entry = doc?.questions?.[qid];
  const referencedEntry = referencedQid ? doc?.questions?.[referencedQid] : null;

  if (referencedEntry) {
    const nextEntry = cloneJson(referencedEntry);
    nextEntry.assetSrcs = [newSrc];
    if (Array.isArray(nextEntry.dominantByAsset)) {
      nextEntry.dominantByAsset = nextEntry.dominantByAsset.map((item) => ({
        ...item,
        assetSrc: newSrc,
      }));
    }
    if (!deepEqual(doc.questions[qid], nextEntry)) {
      doc.questions[qid] = nextEntry;
      return true;
    }
    return false;
  }

  if (!entry) {
    return false;
  }
  let changed = false;
  if (Array.isArray(entry.assetSrcs)) {
    entry.assetSrcs = entry.assetSrcs.map((src) => {
      if (src === oldSrc) {
        changed = true;
        return newSrc;
      }
      return src;
    });
  }
  if (Array.isArray(entry.dominantByAsset)) {
    for (const item of entry.dominantByAsset) {
      if (item?.assetSrc === oldSrc) {
        item.assetSrc = newSrc;
        changed = true;
      }
    }
  }

  return changed;
}

function imageColorTagsWouldChange(doc, qid, oldSrc, newSrc, referencedQid = null) {
  if (!doc?.questions) {
    return false;
  }
  if (referencedQid && doc.questions[referencedQid]) {
    const nextEntry = cloneJson(doc.questions[referencedQid]);
    nextEntry.assetSrcs = [newSrc];
    if (Array.isArray(nextEntry.dominantByAsset)) {
      nextEntry.dominantByAsset = nextEntry.dominantByAsset.map((item) => ({
        ...item,
        assetSrc: newSrc,
      }));
    }
    return !deepEqual(doc.questions[qid], nextEntry);
  }

  const entry = doc.questions[qid];
  if (!entry) {
    return false;
  }
  const hasAssetSrc = Array.isArray(entry.assetSrcs) && entry.assetSrcs.includes(oldSrc) && oldSrc !== newSrc;
  const hasDominant = Array.isArray(entry.dominantByAsset) && entry.dominantByAsset.some((item) => item?.assetSrc === oldSrc && oldSrc !== newSrc);
  return hasAssetSrc || hasDominant;
}

function getImageColorTagsStatus({ imageTagsDoc, qid, referencedQid, oldSrc, newSrc }) {
  if (!imageTagsDoc?.questions) {
    return IMAGE_TAGS_UNCHANGED;
  }
  return imageColorTagsWouldChange(imageTagsDoc, qid, oldSrc, newSrc, referencedQid)
    ? "image-color-tags will reuse referenced qid tags"
    : IMAGE_TAGS_UNCHANGED;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicPathToAssetSrc(value) {
  const text = String(value ?? "").trim().replaceAll(path.sep, "/");
  const publicIndex = text.indexOf("public/");
  if (publicIndex >= 0) {
    return `/${text.slice(publicIndex + "public/".length)}`;
  }
  if (text.startsWith("/qbank/")) {
    return text;
  }
  return `/${text.replace(/^\/+/, "")}`;
}

function assetSrcToPublicPath(value) {
  const text = String(value ?? "").trim().replaceAll(path.sep, "/");
  if (!text) {
    return null;
  }
  if (text.startsWith("public/")) {
    return text;
  }
  if (text.startsWith("/qbank/")) {
    return `public${text}`;
  }
  return text.replace(/^\/+/, "");
}

function buildReport({ decisionsPath, requestedDecisionsPath, dataset, apply, runWarnings, entries, errors }) {
  const qidsWithReviewerNotes = entries
    .filter((entry) => entry.decision === "approve" && entry.notesIncluded)
    .map((entry) => entry.qid);

  return {
    generatedAt: stableNow(),
    dataset,
    apply,
    dryRun: !apply,
    runWarnings,
    requestedDecisionsPath: relativePath(requestedDecisionsPath),
    decisionsPath: relativePath(decisionsPath),
    reportPaths: {
      json: relativePath(APPLY_REPORT_JSON_PATH),
      markdown: relativePath(APPLY_REPORT_MD_PATH),
    },
    counts: {
      total: entries.length,
      approved: entries.filter((entry) => entry.decision === "approve").length,
      needsManualSearch: entries.filter((entry) => entry.decision === "needsManualSearch").length,
      disregard: entries.filter((entry) => entry.decision === "disregard").length,
      unsure: entries.filter((entry) => entry.decision === "unsure").length,
      undecided: entries.filter((entry) => entry.decision === "undecided").length,
      qidsWithReviewerNotes: qidsWithReviewerNotes.length,
      errors: errors.length,
      warnings: entries.reduce((sum, entry) => sum + entry.warnings.length, 0),
      crossQidReferences: entries.filter((entry) => entry.crossQidReferenceDetected).length,
      reuseExistingQidImage: entries.filter((entry) => entry.operation === "reuse-existing-qid-image").length,
      ambiguousReferences: entries.filter((entry) => entry.operation === "ambiguous-reference").length,
    },
    qidsWithReviewerNotes,
    errors,
    entries,
  };
}

async function writeReports(report) {
  await writeJson(APPLY_REPORT_JSON_PATH, report);
  await writeText(APPLY_REPORT_MD_PATH, buildMarkdownReport(report));
}

async function validateRun({
  apply,
  datasetPaths,
  questionsDoc,
  rawQuestionsDoc,
  imageTagsDoc,
  report,
  errors,
}) {
  try {
    JSON.parse(JSON.stringify(questionsDoc));
    JSON.parse(JSON.stringify(rawQuestionsDoc));
  } catch (error) {
    errors.push(`qbank JSON serialization failed: ${error.message}`);
  }

  if (apply) {
    for (const filePath of [datasetPaths.questionsPath, datasetPaths.rawQuestionsPath]) {
      if (!fileExists(filePath)) {
        errors.push(`missing qbank file after apply: ${relativePath(filePath)}`);
        continue;
      }
      try {
        JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (error) {
        errors.push(`${relativePath(filePath)} is not valid JSON after apply: ${error.message}`);
      }
    }
  }

  for (const entry of report.entries) {
    if (
      apply &&
      entry.decision === "approve" &&
      ["extract-enhance-from-approved-source", "reuse-existing-qid-image"].includes(entry.operation)
    ) {
      const finalPath = resolveRepoPath(entry.finalImagePath ?? entry.finalAssetPath);
      if (!finalPath || !fileExists(finalPath)) {
        errors.push(`${entry.qid}: final image path does not exist after apply: ${entry.finalImagePath ?? entry.finalAssetPath}`);
      }
    }
  }

  const badRefs = collectBadProductionRefs(questionsDoc, "questions.json")
    .concat(collectBadProductionRefs(rawQuestionsDoc, "questions.raw.json"));
  if (imageTagsDoc) {
    badRefs.push(...collectBadProductionRefs(imageTagsDoc, "image-color-tags.json"));
  }
  errors.push(...badRefs);
}

function collectBadProductionRefs(value, label, pointer = label, out = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectBadProductionRefs(value[index], label, `${pointer}[${index}]`, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectBadProductionRefs(child, label, `${pointer}.${key}`, out);
    }
    return out;
  }
  if (typeof value === "string" && (value.includes("imports/") || value.includes("qbank-tools/generated/"))) {
    out.push(`${pointer} points to non-production path: ${value}`);
  }
  return out;
}

function syncReportErrorCounts(report, errors) {
  report.errors = errors;
  report.counts.errors = errors.length;
}

function buildMarkdownReport(report) {
  const lines = [
    "# Image Replacement Apply Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Dataset: ${report.dataset}`,
    `Mode: ${report.apply ? "apply" : "dry-run"}`,
    `Decisions: ${report.decisionsPath}`,
    "",
    "## Summary",
    "",
    `- Total: ${report.counts.total}`,
    `- Approved: ${report.counts.approved}`,
    `- Needs manual search: ${report.counts.needsManualSearch}`,
    `- Disregard: ${report.counts.disregard}`,
    `- Unsure: ${report.counts.unsure}`,
    `- Undecided: ${report.counts.undecided}`,
    `- Qids with reviewer notes: ${report.qidsWithReviewerNotes.join(", ") || "none"}`,
    `- Cross-qid references: ${report.counts.crossQidReferences ?? 0}`,
    `- Reuse existing qid image: ${report.counts.reuseExistingQidImage ?? 0}`,
    `- Ambiguous references: ${report.counts.ambiguousReferences ?? 0}`,
    `- Warnings: ${report.counts.warnings}`,
    `- Errors: ${report.counts.errors}`,
    "",
  ];

  if (report.errors.length > 0) {
    lines.push("## Errors", "");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  lines.push("## Entries", "");
  for (const entry of report.entries) {
    lines.push(`### ${entry.qid}`);
    lines.push("");
    lines.push(`- Decision: ${entry.decision}`);
    lines.push(`- Operation: ${entry.operation ?? ""}`);
    lines.push(`- Approved source: ${entry.approvedSourcePath ?? ""}`);
    lines.push(`- Cross-qid reference detected: ${entry.crossQidReferenceDetected === true}`);
    lines.push(`- Referenced qid: ${entry.referencedQid ?? ""}`);
    lines.push(`- Referenced image: ${entry.referencedImagePath ?? ""}`);
    lines.push(`- Previous image: ${entry.previousImagePath ?? entry.currentImagePath ?? ""}`);
    lines.push(`- Current image: ${entry.currentImagePath ?? ""}`);
    lines.push(`- Final image: ${entry.finalImagePath ?? entry.finalAssetPath ?? ""}`);
    lines.push(`- Notes included: ${entry.notesIncluded}`);
    lines.push(`- Validation: ${entry.validationStatus ?? ""}`);
    lines.push(`- Warnings: ${entry.warnings.join("; ") || "none"}`);
    lines.push(`- Changed files: ${entry.changedFiles.join(", ") || "none"}`);
    if (entry.notes) {
      lines.push(`- Notes: ${entry.notes}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function writeFailureReport(error) {
  await ensureDir(REPORTS_DIR);
  const report = {
    generatedAt: stableNow(),
    dataset: null,
    apply: false,
    dryRun: true,
    decisionsPath: null,
    reportPaths: {
      json: relativePath(APPLY_REPORT_JSON_PATH),
      markdown: relativePath(APPLY_REPORT_MD_PATH),
    },
    counts: {
      total: 0,
      approved: 0,
      needsManualSearch: 0,
      disregard: 0,
      unsure: 0,
      undecided: 0,
      qidsWithReviewerNotes: 0,
      errors: 1,
      warnings: 0,
    },
    qidsWithReviewerNotes: [],
    errors: [error.message],
    entries: [],
  };
  await writeReports(report);
}

async function imageDimensionsForPath(filePath) {
  if (!filePath || !fileExists(filePath)) {
    return null;
  }
  const metadata = await sharp(filePath, { limitInputPixels: false }).metadata();
  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    format: metadata.format ?? null,
  };
}

function resolveRepoPath(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return path.isAbsolute(text) ? text : path.resolve(ROOT, text);
}

function hashFile(filePath) {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
