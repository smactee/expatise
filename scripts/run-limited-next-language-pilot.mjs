#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  fileExists,
  getBatchDir,
  getBatchFiles,
  listBatchScreenshotFiles,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import { parsePilotArgs, runNextLanguagePreflight } from "./next-language-preflight-lib.mjs";

const OUTPUT_DIR = path.join(ROOT, "artifacts", "next-language-pilot");
const DEFAULT_PILOT_SIZE = 40;

const args = parsePilotArgs();
const dataset = args.dataset || "2023-test1";
const pilotSize = Number.isFinite(Number(args.pilotSize)) && Number(args.pilotSize) > 0
  ? Number(args.pilotSize)
  : DEFAULT_PILOT_SIZE;

const selection = selectNextLanguageBatch({
  lang: args.lang || null,
  batchId: args.batchId || null,
  dataset,
});

const artifacts = {
  csvPath: path.join(OUTPUT_DIR, "limited_real_language_pilot.csv"),
  mdPath: path.join(OUTPUT_DIR, "limited_real_language_pilot.md"),
  routeBreakdownPath: path.join(OUTPUT_DIR, "limited_real_language_route_breakdown.json"),
  reviewQueuePath: path.join(OUTPUT_DIR, "limited_real_language_review_queue.csv"),
  recommendationPath: path.join(OUTPUT_DIR, "limited_real_language_recommendation.md"),
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

if (!selection) {
  await writeMissingArtifacts({
    artifacts,
    dataset,
    pilotSize,
    reason: "No non-Japanese import lane exists in the repo yet.",
    batchDir: null,
    lang: args.lang || "",
    batchId: args.batchId || "",
  });
  console.log(JSON.stringify({
    status: "missing-input",
    reason: "No non-Japanese import lane exists in the repo yet.",
    ...relativeArtifactPaths(artifacts),
  }, null, 2));
  process.exit(0);
}

const { lang, batchId, batchDir, screenshots, intakeItems, baselineCounts, selectionReason } = selection;

if (screenshots === 0 || intakeItems === 0) {
  await writeMissingArtifacts({
    artifacts,
    dataset,
    pilotSize,
    reason: screenshots === 0
      ? "The selected next-language batch exists, but it contains no screenshots."
      : "The selected next-language batch has no extracted intake items yet.",
    batchDir,
    lang,
    batchId,
    screenshots,
    intakeItems,
    baselineCounts,
    selectionReason,
  });
  console.log(JSON.stringify({
    status: "missing-input",
    lang,
    batchId,
    screenshots,
    intakeItems,
    selectionReason,
    ...relativeArtifactPaths(artifacts),
  }, null, 2));
  process.exit(0);
}

const run = await runNextLanguagePreflight({
  lang,
  batchId,
  dataset,
  pilotSize,
  runBaseline: args.runBaseline === true || hasAnyBaselineItems(baselineCounts) === false,
  calibrationProfile: "final-targeted",
});

const routeBreakdown = buildRouteBreakdown(run, selectionReason);
const pilotRows = buildPilotRows(run);
const reviewQueueRows = buildReviewQueueRows(run);
const suspiciousPassRows = buildSuspiciousPassRows(run);

await writeCsv(
  artifacts.csvPath,
  [
    "itemId",
    "sourceImage",
    "baselineSection",
    "baselineRoute",
    "finalTargetedRoute",
    "preflightStatus",
    "baselineTrustBand",
    "adjustedTrustBand",
    "suggestedQid",
    "suggestedScore",
    "suggestedScoreGap",
    "sourceType",
    "hasImage",
    "sourceIsSignHeavy",
    "provisionalTopic",
    "candidateTopic",
    "hasSourceAnswerEvidence",
    "triggeredChecks",
    "decisionSignals",
    "reviewExplanation",
  ],
  pilotRows,
);
await writeJson(artifacts.routeBreakdownPath, routeBreakdown);
await writeCsv(
  artifacts.reviewQueuePath,
  [
    "itemId",
    "sourceImage",
    "baselineRoute",
    "finalTargetedRoute",
    "queueReason",
    "preflightStatus",
    "suggestedQid",
    "suggestedScore",
    "baselineTrustBand",
    "sourceType",
    "hasImage",
    "sourceIsSignHeavy",
    "provisionalTopic",
    "candidateTopic",
    "hasSourceAnswerEvidence",
    "triggeredChecks",
    "decisionSignals",
    "reviewExplanation",
  ],
  reviewQueueRows,
);
await writeText(artifacts.mdPath, buildPilotMarkdown({
  run,
  routeBreakdown,
  reviewQueueRows,
  suspiciousPassRows,
  selectionReason,
}));
await writeText(artifacts.recommendationPath, buildRecommendationMarkdown({
  run,
  routeBreakdown,
  reviewQueueRows,
  suspiciousPassRows,
}));

console.log(JSON.stringify({
  status: "executed",
  lang,
  batchId,
  pilotItems: run.pilotItems.length,
  selectionReason,
  ...relativeArtifactPaths(artifacts),
}, null, 2));

function selectNextLanguageBatch({ lang, batchId, dataset }) {
  if (lang && batchId) {
    return describeBatch(lang, batchId, dataset, "Explicitly requested batch.");
  }

  const importsDir = path.join(ROOT, "imports");
  const langDirs = fileExists(importsDir)
    ? fs.readdirSync(importsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "ja")
      .map((entry) => entry.name)
      .sort()
    : [];

  const candidates = [];
  for (const candidateLang of langDirs) {
    const langDir = path.join(importsDir, candidateLang);
    const batchDirs = fs.readdirSync(langDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^batch-\d+$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    for (const candidateBatch of batchDirs) {
      const described = describeBatch(candidateLang, candidateBatch, dataset, "Auto-selected next-language batch.");
      if (described) candidates.push(described);
    }
  }

  const realBatch = candidates.find((candidate) => candidate.screenshots > 0 && candidate.intakeItems > 0);
  if (realBatch) {
    return {
      ...realBatch,
      selectionReason: `${realBatch.lang}/${realBatch.batchId} was chosen because it is the first non-Japanese batch with real screenshots and extracted intake items in the repo.`,
    };
  }

  const fallback = candidates[0] ?? null;
  if (!fallback) return null;
  return {
    ...fallback,
    selectionReason: `${fallback.lang}/${fallback.batchId} was chosen because it is the only non-Japanese batch lane currently present in the repo, even though it has no real pilot items yet.`,
  };
}

function describeBatch(lang, batchId, dataset, fallbackReason) {
  const batchDir = getBatchDir(lang, batchId);
  if (!fileExists(batchDir)) {
    return null;
  }
  const batchFiles = getBatchFiles(lang, batchId);
  const intakeItems = countBatchItems(batchFiles.intakePath, true);
  const baselineCounts = {
    matched: countBatchItems(batchFiles.matchedPath),
    reviewNeeded: countBatchItems(batchFiles.reviewNeededPath),
    unresolved: countBatchItems(batchFiles.unresolvedPath),
  };
  return {
    lang,
    batchId,
    dataset,
    batchDir,
    screenshots: listBatchScreenshotFiles(batchDir).length,
    intakeItems,
    baselineCounts,
    selectionReason: fallbackReason,
  };
}

function countBatchItems(filePath, intake = false) {
  if (!fileExists(filePath)) return 0;
  const doc = readJson(filePath);
  if (intake) {
    return Array.isArray(doc?.items) ? doc.items.length : 0;
  }
  return Array.isArray(doc?.items) ? doc.items.length : 0;
}

function hasAnyBaselineItems(counts) {
  return (counts.matched ?? 0) + (counts.reviewNeeded ?? 0) + (counts.unresolved ?? 0) > 0;
}

function buildRouteBreakdown(run, selectionReason) {
  const counts = {
    autoMatchOk: 0,
    manualReview: 0,
    likelyCreateNewQuestion: 0,
    likelyUnresolved: 0,
    likelyDelete: 0,
    warned: 0,
    routed: 0,
    suspiciousSilentPasses: 0,
  };
  const triggeredChecks = {};
  for (const item of run.pilotItems) {
    if (item.recommendedRoute === "auto-match ok") counts.autoMatchOk += 1;
    if (item.recommendedRoute === "manual review") counts.manualReview += 1;
    if (item.recommendedRoute === "likely create-new-question") counts.likelyCreateNewQuestion += 1;
    if (item.recommendedRoute === "likely unresolved") counts.likelyUnresolved += 1;
    if (item.recommendedRoute === "likely delete") counts.likelyDelete += 1;
    if (item.preflightStatus === "warn") counts.warned += 1;
    if (item.preflightStatus === "downgrade" || item.preflightStatus === "reroute") counts.routed += 1;
    if (isSuspiciousSilentPass(item)) counts.suspiciousSilentPasses += 1;
    for (const signal of item.decisionSignals) {
      triggeredChecks[signal.code] = (triggeredChecks[signal.code] ?? 0) + 1;
    }
  }

  return {
    generatedAt: stableNow(),
    lang: run.lang,
    batchId: run.batchId,
    dataset: run.dataset,
    calibrationProfile: run.calibrationProfile,
    pilotSizeRequested: pilotSize,
    pilotItemsAnalyzed: run.pilotItems.length,
    selectionReason,
    baselineCounts: countBy(run.pilotItems, (item) => item.baselineRoute),
    finalTargetedCounts: countBy(run.pilotItems, (item) => item.recommendedRoute),
    statusCounts: countBy(run.pilotItems, (item) => item.preflightStatus),
    triggeredChecks,
    summary: counts,
  };
}

function buildPilotRows(run) {
  return run.pilotItems.map((item) => ({
    itemId: item.itemId ?? "",
    sourceImage: item.sourceImage ?? "",
    baselineSection: item.baselineSection,
    baselineRoute: item.baselineRoute,
    finalTargetedRoute: item.recommendedRoute,
    preflightStatus: item.preflightStatus,
    baselineTrustBand: item.baselineTrustBand,
    adjustedTrustBand: item.adjustedTrustBand,
    suggestedQid: item.suggestedQid ?? "",
    suggestedScore: item.suggestedScore ?? "",
    suggestedScoreGap: item.suggestedScoreGap ?? "",
    sourceType: item.sourceType ?? "",
    hasImage: item.hasImage ? "true" : "false",
    sourceIsSignHeavy: item.sourceIsSignHeavy ? "true" : "false",
    provisionalTopic: item.provisionalTopic ?? "",
    candidateTopic: item.candidateTopic ?? "",
    hasSourceAnswerEvidence: item.hasSourceAnswerEvidence ? "true" : "false",
    triggeredChecks: item.triggeredChecks.map((signal) => signal.code).join("|"),
    decisionSignals: item.decisionSignals.map((signal) => signal.code).join("|"),
    reviewExplanation: describeItemForReview(item),
  }));
}

function buildReviewQueueRows(run) {
  return run.pilotItems
    .filter((item) => item.preflightStatus !== "pass" || isSuspiciousSilentPass(item))
    .map((item) => ({
      itemId: item.itemId ?? "",
      sourceImage: item.sourceImage ?? "",
      baselineRoute: item.baselineRoute,
      finalTargetedRoute: item.recommendedRoute,
      queueReason: item.preflightStatus !== "pass" ? item.preflightStatus : "suspicious-silent-pass",
      preflightStatus: item.preflightStatus,
      suggestedQid: item.suggestedQid ?? "",
      suggestedScore: item.suggestedScore ?? "",
      baselineTrustBand: item.baselineTrustBand,
      sourceType: item.sourceType ?? "",
      hasImage: item.hasImage ? "true" : "false",
      sourceIsSignHeavy: item.sourceIsSignHeavy ? "true" : "false",
      provisionalTopic: item.provisionalTopic ?? "",
      candidateTopic: item.candidateTopic ?? "",
      hasSourceAnswerEvidence: item.hasSourceAnswerEvidence ? "true" : "false",
      triggeredChecks: item.triggeredChecks.map((signal) => signal.code).join("|"),
      decisionSignals: item.decisionSignals.map((signal) => signal.code).join("|"),
      reviewExplanation: describeItemForReview(item),
    }));
}

function buildSuspiciousPassRows(run) {
  return run.pilotItems.filter((item) => isSuspiciousSilentPass(item));
}

function isSuspiciousSilentPass(item) {
  return (
    item.baselineRoute === "auto-match ok" &&
    item.recommendedRoute === "auto-match ok" &&
    item.decisionSignals.length === 0 &&
    !["high", "very-high"].includes(item.baselineTrustBand)
  );
}

function describeItemForReview(item) {
  if (item.decisionSignals.length > 0) {
    return item.decisionSignals.map((signal) => signal.message).join(" ");
  }
  if (isSuspiciousSilentPass(item)) {
    return "The item still passed silently even though the baseline trust band is below high, so it should be spot-checked in the limited pilot.";
  }
  return "";
}

async function writeMissingArtifacts({
  artifacts,
  dataset,
  pilotSize,
  reason,
  batchDir,
  lang,
  batchId,
  screenshots = 0,
  intakeItems = 0,
  baselineCounts = { matched: 0, reviewNeeded: 0, unresolved: 0 },
  selectionReason = "",
}) {
  await writeCsv(
    artifacts.csvPath,
    [
      "itemId",
      "sourceImage",
      "baselineSection",
      "baselineRoute",
      "finalTargetedRoute",
      "preflightStatus",
      "baselineTrustBand",
      "adjustedTrustBand",
      "suggestedQid",
      "suggestedScore",
      "suggestedScoreGap",
      "sourceType",
      "hasImage",
      "sourceIsSignHeavy",
      "provisionalTopic",
      "candidateTopic",
      "hasSourceAnswerEvidence",
      "triggeredChecks",
      "decisionSignals",
      "reviewExplanation",
    ],
    [],
  );
  await writeCsv(
    artifacts.reviewQueuePath,
    [
      "itemId",
      "sourceImage",
      "baselineRoute",
      "finalTargetedRoute",
      "queueReason",
      "preflightStatus",
      "suggestedQid",
      "suggestedScore",
      "baselineTrustBand",
      "sourceType",
      "hasImage",
      "sourceIsSignHeavy",
      "provisionalTopic",
      "candidateTopic",
      "hasSourceAnswerEvidence",
      "triggeredChecks",
      "decisionSignals",
      "reviewExplanation",
    ],
    [],
  );
  await writeJson(artifacts.routeBreakdownPath, {
    generatedAt: stableNow(),
    status: "missing-input",
    lang,
    batchId,
    dataset,
    calibrationProfile: "final-targeted",
    pilotSizeRequested: pilotSize,
    selectionReason,
    reason,
    batchDir: batchDir ? path.relative(ROOT, batchDir) : "",
    screenshots,
    intakeItems,
    baselineCounts,
    finalTargetedCounts: {
      "auto-match ok": 0,
      "manual review": 0,
      "likely create-new-question": 0,
      "likely unresolved": 0,
      "likely delete": 0,
    },
    statusCounts: {
      pass: 0,
      warn: 0,
      downgrade: 0,
      reroute: 0,
    },
    triggeredChecks: {},
    summary: {
      autoMatchOk: 0,
      manualReview: 0,
      likelyCreateNewQuestion: 0,
      likelyUnresolved: 0,
      likelyDelete: 0,
      warned: 0,
      routed: 0,
      suspiciousSilentPasses: 0,
    },
  });
  await writeText(artifacts.mdPath, [
    "# Limited Real Next-Language Pilot",
    "",
    `Generated at ${stableNow()} using profile \`final-targeted\`.`,
    "",
    "## Status",
    "",
    `- selected lane: ${lang || "(none)"}/${batchId || "(none)"}`,
    `- dataset: ${dataset}`,
    `- target pilot size: ${pilotSize}`,
    `- selection reason: ${selectionReason || reason}`,
    `- batch dir: ${batchDir ? path.relative(ROOT, batchDir) : "(missing)"}`,
    `- screenshots found: ${screenshots}`,
    `- intake items found: ${intakeItems}`,
    `- baseline matched/review-needed/unresolved: ${(baselineCounts.matched ?? 0)}/${(baselineCounts.reviewNeeded ?? 0)}/${(baselineCounts.unresolved ?? 0)}`,
    "",
    "## Result",
    "",
    `- No real next-language pilot was executed. ${reason}`,
    "",
    "## Next Command",
    "",
    batchDir
      ? `- Add screenshots under \`${path.relative(ROOT, batchDir)}\`, then run:`
      : "- Prepare a real non-Japanese batch, then run:",
    batchDir
      ? `  \`node scripts/extract-screenshot-intake.mjs --lang ${lang} --batch ${batchId} --dataset ${dataset}\``
      : `  \`node scripts/extract-screenshot-intake.mjs --lang <lang> --batch <batch-id> --dataset ${dataset}\``,
    batchDir
      ? `  \`node scripts/run-limited-next-language-pilot.mjs --lang ${lang} --batch ${batchId} --dataset ${dataset} --pilot-size ${pilotSize} --run-baseline\``
      : `  \`node scripts/run-limited-next-language-pilot.mjs --lang <lang> --batch <batch-id> --dataset ${dataset} --pilot-size ${pilotSize} --run-baseline\``,
  ].join("\n"));
  await writeText(artifacts.recommendationPath, [
    "# Limited Real Language Recommendation",
    "",
    `Generated at ${stableNow()}.`,
    "",
    "## Decision",
    "",
    "- READY TO EXPAND NEXT-LANGUAGE PILOT: no",
    "- KEEP TO LIMITED PILOT ONLY: yes",
    "- ONE MORE ITERATION BEFORE REAL NEXT-LANGUAGE USE: no",
    "",
    "## Reason",
    "",
    `- ${reason}`,
    "- The repo is ready to run a limited pilot with `final-targeted`, but there is no real non-Japanese pilot data in the selected lane yet.",
  ].join("\n"));
}

function buildPilotMarkdown({ run, routeBreakdown, reviewQueueRows, suspiciousPassRows, selectionReason }) {
  return [
    "# Limited Real Next-Language Pilot",
    "",
    `Generated at ${stableNow()} for \`${run.lang}/${run.batchId}\` on dataset \`${run.dataset}\` using profile \`final-targeted\`.`,
    "",
    "## Selection",
    "",
    `- selection reason: ${selectionReason}`,
    `- pilot items analyzed: ${run.pilotItems.length}`,
    "",
    "## Baseline vs Final-Targeted",
    "",
    `- auto-match ok: ${routeBreakdown.summary.autoMatchOk}`,
    `- manual review: ${routeBreakdown.summary.manualReview}`,
    `- likely create-new-question: ${routeBreakdown.summary.likelyCreateNewQuestion}`,
    `- likely unresolved: ${routeBreakdown.summary.likelyUnresolved}`,
    `- likely delete: ${routeBreakdown.summary.likelyDelete}`,
    `- warned items: ${routeBreakdown.summary.warned}`,
    `- routed items: ${routeBreakdown.summary.routed}`,
    `- suspicious silent passes: ${routeBreakdown.summary.suspiciousSilentPasses}`,
    `- route changes vs baseline: ${run.pilotItems.filter((item) => item.recommendedRoute !== item.baselineRoute).length}`,
    "",
    "## Review Queue",
    "",
    `- warned or routed items queued: ${reviewQueueRows.length}`,
    `- suspicious silent passes queued: ${suspiciousPassRows.length}`,
    "",
    "## New-Language Read",
    "",
    suspiciousPassRows.length > 0
      ? "- There are suspicious silent passes in this limited pilot, so spot-check them before expanding."
      : "- No suspicious silent passes were found by the current limited-pilot heuristic.",
    reviewQueueRows.length > 0
      ? "- Review pressure is concentrated in the warned/routed queue exported alongside this report."
      : "- No items required review in this limited pilot run.",
  ].join("\n");
}

function buildRecommendationMarkdown({ run, routeBreakdown, reviewQueueRows, suspiciousPassRows }) {
  const recommendation =
    suspiciousPassRows.length > 0
      ? "KEEP TO LIMITED PILOT ONLY"
      : routeBreakdown.summary.routed > Math.max(6, Math.round(run.pilotItems.length * 0.2))
        ? "KEEP TO LIMITED PILOT ONLY"
        : routeBreakdown.summary.warned > Math.max(10, Math.round(run.pilotItems.length * 0.3))
          ? "KEEP TO LIMITED PILOT ONLY"
          : "READY TO EXPAND NEXT-LANGUAGE PILOT";

  return [
    "# Limited Real Language Recommendation",
    "",
    `Generated at ${stableNow()}.`,
    "",
    "## Decision",
    "",
    `- READY TO EXPAND NEXT-LANGUAGE PILOT: ${recommendation === "READY TO EXPAND NEXT-LANGUAGE PILOT" ? "yes" : "no"}`,
    `- KEEP TO LIMITED PILOT ONLY: ${recommendation === "KEEP TO LIMITED PILOT ONLY" ? "yes" : "no"}`,
    "- ONE MORE ITERATION BEFORE REAL NEXT-LANGUAGE USE: no",
    "",
    "## Evidence",
    "",
    `- pilot items analyzed: ${run.pilotItems.length}`,
    `- auto-match ok after final-targeted: ${routeBreakdown.summary.autoMatchOk}`,
    `- warned items: ${routeBreakdown.summary.warned}`,
    `- routed items: ${routeBreakdown.summary.routed}`,
    `- likely unresolved: ${routeBreakdown.summary.likelyUnresolved}`,
    `- likely create-new-question: ${routeBreakdown.summary.likelyCreateNewQuestion}`,
    `- likely delete: ${routeBreakdown.summary.likelyDelete}`,
    `- suspicious silent passes: ${routeBreakdown.summary.suspiciousSilentPasses}`,
    `- review queue size: ${reviewQueueRows.length}`,
  ].join("\n");
}

async function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  await writeText(filePath, `${lines.join("\n")}\n`);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function relativeArtifactPaths(artifacts) {
  return Object.fromEntries(
    Object.entries(artifacts).map(([key, value]) => [key, path.relative(ROOT, value)]),
  );
}
