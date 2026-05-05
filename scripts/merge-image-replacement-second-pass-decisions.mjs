#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";

import {
  DEFAULT_DATASET,
  ensureDir,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const ROOT = process.cwd();
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");
const DEFAULT_ORIGINAL_PATH = path.join(STAGING_DIR, "image-replacement-decisions.json");
const DEFAULT_SECOND_PASS_PATH = path.join(STAGING_DIR, "image-replacement-second-pass-decisions.json");
const DEFAULT_OUTPUT_PATH = path.join(STAGING_DIR, "image-replacement-decisions.merged.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs();
  const dataset = String(args.dataset ?? DEFAULT_DATASET);
  const originalPath = await resolveOriginalPath(String(args.original ?? args.decisions ?? DEFAULT_ORIGINAL_PATH), dataset);
  const secondPassPath = path.resolve(ROOT, String(args["second-pass"] ?? DEFAULT_SECOND_PASS_PATH));
  const outputPath = path.resolve(ROOT, String(args.output ?? DEFAULT_OUTPUT_PATH));
  const apply = parseBoolean(args.apply, false);

  if (!(await fileExists(secondPassPath))) {
    throw new Error(`Second-pass decisions file not found: ${relativePath(secondPassPath)}`);
  }

  const questionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
  const questionsDoc = readJson(questionsPath);
  const qidSet = buildQidSet(questionsDoc);
  const original = readJson(originalPath);
  const secondPass = readJson(secondPassPath);

  if (!original?.decisions || typeof original.decisions !== "object") {
    throw new Error(`Original decisions file has no decisions object: ${relativePath(originalPath)}`);
  }
  if (!secondPass?.decisions || typeof secondPass.decisions !== "object") {
    throw new Error(`Second-pass decisions file has no decisions object: ${relativePath(secondPassPath)}`);
  }

  const summary = {
    originalDecisionsCount: Object.keys(original.decisions).length,
    secondPassDecisionsCount: Object.keys(secondPass.decisions).length,
    updatedQids: [],
    skippedQids: [],
    approvedAdded: [],
    stillNeedsManualSearch: [],
    warnings: [],
  };

  await validateSecondPassApprovals(secondPass.decisions, qidSet);

  const merged = structuredClone(original);
  merged.mergedAt = stableNow();
  merged.mergeSource = relativePath(secondPassPath);
  merged.mergeMode = "second-pass-allowed-statuses-with-approved-override";
  merged.mergeSummary = summary;

  for (const [rawQid, secondDecision] of Object.entries(secondPass.decisions)) {
    const qid = normalizeQid(rawQid);
    const originalDecision = merged.decisions[qid];
    if (!originalDecision) {
      skip(summary, qid, "not present in original decisions");
      continue;
    }

    const originalStatus = normalizeDecision(originalDecision.decision);
    const secondStatus = normalizeDecision(secondDecision.decision);
    const canReplace =
      isReplaceableOriginalStatus(originalStatus) ||
      (originalStatus === "approve" && secondStatus === "approve" && isValidApprovedDecisionShape(secondDecision));

    if (!canReplace) {
      skip(summary, qid, `original decision ${originalDecision.decision ?? "undecided"} is not replaceable`);
      continue;
    }

    const nextDecision = normalizeSecondPassDecisionForMerge(secondDecision);
    merged.decisions[qid] = {
      ...nextDecision,
      decision: secondDecision.decision ?? "undecided",
      mergedFrom: "image-replacement-second-pass",
      previousDecision: originalDecision.decision ?? null,
      previousNotes: originalDecision.notes ?? originalDecision.reviewerNotes ?? "",
    };
    summary.updatedQids.push(qid);
    if (secondStatus === "approve") {
      summary.approvedAdded.push(qid);
    }
    if (isNeedsManualSearch(secondStatus)) {
      summary.stillNeedsManualSearch.push(qid);
    }
  }

  await ensureDir(path.dirname(outputPath));
  await writeJson(outputPath, merged);
  if (apply) {
    await writeJson(originalPath, merged);
  }

  printSummary({
    originalPath,
    outputPath,
    apply,
    summary,
  });
}

async function validateSecondPassApprovals(decisions, qidSet) {
  for (const [rawQid, decision] of Object.entries(decisions)) {
    const qid = normalizeQid(rawQid);
    const normalized = normalizeSecondPassDecisionForMerge(decision);
    if (normalizeDecision(normalized?.decision) !== "approve") {
      continue;
    }
    if (!normalized.operation) {
      throw new Error(`${qid}: approved second-pass decision is missing operation`);
    }

    const approvedSourcePath = stringOrNull(normalized.approvedSourcePath);
    const referencedQid = stringOrNull(normalized.referencedQid) ? normalizeQid(normalized.referencedQid) : null;
    const referencedImagePath = stringOrNull(normalized.referencedImagePath);

    if (normalized.operation === "extract-enhance-from-approved-source") {
      if (!approvedSourcePath) {
        throw new Error(`${qid}: extract-enhance approve decision has no approvedSourcePath`);
      }
      if (!(await fileExists(resolveRepoPath(approvedSourcePath)))) {
        throw new Error(`${qid}: approvedSourcePath does not exist: ${approvedSourcePath}`);
      }
      continue;
    }

    if (normalized.operation === "reuse-existing-qid-image") {
      if (!referencedQid || !referencedImagePath) {
        throw new Error(`${qid}: reuse-existing-qid-image approve decision has no referencedQid/referencedImagePath`);
      }
      if (!qidSet.has(referencedQid)) {
        throw new Error(`${qid}: referencedQid does not exist in questions.json: ${referencedQid}`);
      }
      if (!(await fileExists(resolveRepoPath(referencedImagePath)))) {
        throw new Error(`${qid}: referencedImagePath does not exist: ${referencedImagePath}`);
      }
      continue;
    }

    throw new Error(`${qid}: unsupported approved operation: ${normalized.operation}`);
  }
}

function isValidApprovedDecisionShape(decision) {
  const normalized = normalizeSecondPassDecisionForMerge(decision);
  if (normalized.operation === "extract-enhance-from-approved-source") {
    return Boolean(stringOrNull(normalized.approvedSourcePath));
  }
  if (normalized.operation === "reuse-existing-qid-image") {
    return Boolean(stringOrNull(normalized.referencedQid) && stringOrNull(normalized.referencedImagePath));
  }
  return false;
}

function normalizeSecondPassDecisionForMerge(decision) {
  const approvedSourcePath = stringOrNull(decision?.approvedSourcePath)
    ?? stringOrNull(decision?.sourcePath)
    ?? stringOrNull(decision?.originalSourcePath)
    ?? stringOrNull(decision?.candidate?.sourcePath);
  return {
    ...decision,
    operation: stringOrNull(decision?.operation),
    approvedSourcePath: approvedSourcePath ?? null,
    approvedPreviewPath: stringOrNull(decision?.approvedPreviewPath) ?? null,
    sourcePath: stringOrNull(decision?.sourcePath) ?? null,
    referencedQid: stringOrNull(decision?.referencedQid) ? normalizeQid(decision.referencedQid) : null,
    referencedImagePath: stringOrNull(decision?.referencedImagePath) ?? null,
    candidateIndex: decision?.candidateIndex ?? null,
    score: decision?.score ?? null,
    box: decision?.box ?? null,
    cropMode: stringOrNull(decision?.cropMode) ?? null,
    notes: decision?.notes ?? decision?.reviewerNotes ?? "",
    secondPass: decision?.secondPass ?? null,
  };
}

function isReplaceableOriginalStatus(status) {
  return ["needsmanualsearch", "unsure", "undecided", "disregard"].includes(status);
}

function isNeedsManualSearch(status) {
  return normalizeDecision(status) === "needsmanualsearch";
}

function normalizeDecision(value) {
  const normalized = String(value ?? "undecided").toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "needsmanualsearch") return "needsmanualsearch";
  if (normalized === "approve" || normalized === "approved") return "approve";
  if (normalized === "disregard" || normalized === "noreplacement") return "disregard";
  if (normalized === "unsure") return "unsure";
  if (normalized === "undecided" || normalized === "") return "undecided";
  return normalized;
}

function skip(summary, qid, reason) {
  summary.skippedQids.push(qid);
  summary.warnings.push(`${qid}: ${reason}; skipped`);
}

function buildQidSet(doc) {
  const questions = Array.isArray(doc) ? doc : Array.isArray(doc?.questions) ? doc.questions : [];
  return new Set(
    questions
      .map((question) => question?.id ?? question?.qid)
      .filter(Boolean)
      .map(normalizeQid),
  );
}

async function resolveOriginalPath(requested, dataset) {
  const requestedPath = path.resolve(ROOT, requested);
  if (await fileExists(requestedPath)) {
    return requestedPath;
  }
  const datasetPath = path.join(STAGING_DIR, `image-replacement-decisions-${dataset}.json`);
  if (await fileExists(datasetPath)) {
    return datasetPath;
  }
  throw new Error(`Original decisions file not found: ${relativePath(requestedPath)}`);
}

function normalizeQid(value) {
  const digits = String(value ?? "").replace(/^q/i, "").replace(/\D/g, "");
  if (!digits) {
    throw new Error(`Invalid qid: ${value}`);
  }
  return `q${digits.padStart(4, "0")}`;
}

function resolveRepoPath(value) {
  const text = String(value ?? "");
  return path.isAbsolute(text) ? text : path.join(ROOT, text.replace(/^\/+/, ""));
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseBoolean(value, fallback) {
  if (value == null) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printSummary({ originalPath, outputPath, apply, summary }) {
  console.log(`original decisions count: ${summary.originalDecisionsCount}`);
  console.log(`second-pass decisions count: ${summary.secondPassDecisionsCount}`);
  console.log(`merged/updated qids: ${summary.updatedQids.join(", ") || "none"}`);
  console.log(`skipped qids: ${summary.skippedQids.join(", ") || "none"}`);
  console.log(`approved added: ${summary.approvedAdded.join(", ") || "none"}`);
  console.log(`still needs manual search: ${summary.stillNeedsManualSearch.join(", ") || "none"}`);
  console.log(`warnings: ${summary.warnings.join(" | ") || "none"}`);
  console.log(`wrote merged output: ${relativePath(outputPath)}`);
  if (apply) {
    console.log(`updated main decisions: ${relativePath(originalPath)}`);
  }
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}
