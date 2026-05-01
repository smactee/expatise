#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const LANG = "ru";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;

const applyPreviewPath = args["apply-preview-path"]
  ? path.resolve(String(args["apply-preview-path"]))
  : path.join(REPORTS_DIR, "ru-discrepancy-apply-preview.json");
const reviewItemsPath = args["items-path"]
  ? path.resolve(String(args["items-path"]))
  : path.join(STAGING_DIR, "ru-discrepancy-review-items.json");
const decisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, "ru-discrepancy-review-decisions.json");

const outputItemsPath = path.join(STAGING_DIR, "ru-discrepancy-blockers-review-items.json");
const outputHtmlPath = path.join(REPORTS_DIR, "ru-discrepancy-blockers-review.html");
const outputMdPath = path.join(REPORTS_DIR, "ru-discrepancy-blockers-review.md");

for (const inputPath of [applyPreviewPath, reviewItemsPath, decisionsPath]) {
  if (!fileExists(inputPath)) {
    throw new Error(`Required input not found: ${rel(inputPath)}`);
  }
}

const generatedAt = stableNow();
const applyPreview = readJson(applyPreviewPath);
const reviewItemsDoc = readJson(reviewItemsPath);
const decisionsDoc = readJson(decisionsPath);
const reviewItems = Array.isArray(reviewItemsDoc.items) ? reviewItemsDoc.items : [];
const decisions = Array.isArray(decisionsDoc.items) ? decisionsDoc.items : [];
const reviewItemById = new Map(reviewItems.map((item) => [String(item.id ?? ""), item]));
const decisionById = new Map(decisions.map((item) => [String(item.id ?? ""), item]));

const datasetPaths = getDatasetPaths(dataset, LANG);
const masterQuestions = extractQuestionList(readJson(datasetPaths.questionsPath));
const masterByQid = new Map(masterQuestions.map((question) => [normalizeQid(question.id ?? question.qid), question]));
const productionTranslations = fileExists(datasetPaths.translationPath)
  ? readJson(datasetPaths.translationPath)
  : { questions: {} };
const productionQuestions = productionTranslations.questions && typeof productionTranslations.questions === "object"
  ? productionTranslations.questions
  : {};

const blockerMap = new Map();

for (const skipped of applyPreview.skippedItems ?? []) {
  const item = upsertBlocker(skipped.id, skipped);
  item.blockerKinds.push(...classifySkipKinds(skipped));
}

for (const missing of applyPreview.missingProductionQidMergeNeeded ?? []) {
  const item = upsertBlocker(missing.id, missing);
  item.blockerKinds.push("missing-production-qid");
}

const blockers = [...blockerMap.values()].map(finalizeBlocker).sort((a, b) => {
  const rank = (item) => item.blockerKinds.includes("missing-production-qid")
    ? 0
    : item.blockerKinds.includes("invalid-answer-key")
      ? 1
      : item.blockerKinds.includes("staged-only-create-new-row")
        ? 2
        : 3;
  return rank(a) - rank(b) || a.batch.localeCompare(b.batch) || a.id.localeCompare(b.id);
});

const missingProductionQids = blockers
  .filter((item) => item.blockerKinds.includes("missing-production-qid"))
  .map((item) => buildMissingProductionAudit(item));

const outputDoc = {
  generatedAt,
  lang: LANG,
  dataset,
  sourcePaths: {
    applyPreviewPath: rel(applyPreviewPath),
    reviewItemsPath: rel(reviewItemsPath),
    decisionsPath: rel(decisionsPath),
    productionTranslationsPath: rel(datasetPaths.translationPath),
    masterQuestionsPath: rel(datasetPaths.questionsPath),
  },
  summary: {
    uniqueBlockerItems: blockers.length,
    highRiskItems: blockers.filter((item) => item.blockerKinds.includes("high-risk")).length,
    invalidAnswerKeyItems: blockers.filter((item) => item.blockerKinds.includes("invalid-answer-key")).length,
    stagedOnlyCreateNewRowItems: blockers.filter((item) => item.blockerKinds.includes("staged-only-create-new-row")).length,
    missingProductionQidItems: blockers.filter((item) => item.blockerKinds.includes("missing-production-qid")).length,
  },
  blockers,
  missingProductionQids,
};

await writeJson(outputItemsPath, outputDoc);
await writeText(outputMdPath, renderMarkdown(outputDoc));
await writeText(outputHtmlPath, renderHtml(outputDoc));

console.log(`Wrote ${rel(outputItemsPath)}`);
console.log(`Wrote ${rel(outputHtmlPath)}`);
console.log(`Wrote ${rel(outputMdPath)}`);
console.log(`Collected ${blockers.length} unique blocker item(s).`);

function upsertBlocker(id, previewItem) {
  const key = String(id ?? "").trim();
  if (!blockerMap.has(key)) {
    blockerMap.set(key, {
      id: key,
      previewItem,
      blockerKinds: [],
    });
  }
  return blockerMap.get(key);
}

function finalizeBlocker(entry) {
  const previewItem = entry.previewItem;
  const reviewItem = reviewItemById.get(entry.id) ?? {};
  const decision = decisionById.get(entry.id) ?? {};
  const workbenchAnchorId = itemAnchorId(entry.id);
  const batch = text(previewItem.batch ?? decision.batch ?? reviewItem.batch);
  const screenshotPath = text(previewItem.screenshotPath ?? decision.screenshotPath ?? reviewItem.sourceScreenshotPath);
  const approvedQid = normalizeQid(previewItem.approvedQid ?? decision.approvedQid ?? reviewItem.approvedQid);
  const candidateQids = unique([
    ...(reviewItem.candidateQids ?? []),
    ...(reviewItem.bestMatches ?? []).map((candidate) => candidate.qid),
    ...(reviewItem.candidateDetails ?? []).map((candidate) => candidate.qid),
    approvedQid,
  ]);
  const masterQuestion = approvedQid ? masterByQid.get(approvedQid) ?? null : null;
  const blockerKinds = unique(entry.blockerKinds);
  const skippedReasons = unique(previewItem.skipReasons ?? []);
  const validationNotes = unique([
    ...(previewItem.validationErrors ?? []),
    ...(previewItem.validationWarnings ?? []),
  ].filter((reason) => !skippedReasons.includes(reason)));

  return {
    id: entry.id,
    workbenchAnchorId,
    workbenchHref: `./ru-discrepancy-review-workbench.html#${workbenchAnchorId}`,
    blockerKinds,
    batch,
    screenshotPath,
    screenshotPreviewPath: reviewItem.sourceScreenshotPreviewPath ?? screenshotPreviewPath(batch, screenshotPath),
    sourcePrompt: text(reviewItem.sourcePrompt),
    sourcePromptEnglish: text(reviewItem.sourcePromptEnglish),
    sourceOptions: reviewItem.sourceOptions ?? [],
    sourceOptionsEnglish: reviewItem.sourceOptionsEnglish ?? [],
    currentExportedDecision: {
      finalDecision: text(decision.finalDecision ?? previewItem.finalDecision),
      approvedQid,
      rawLocaleAnswerKey: text(previewItem.rawLocaleAnswerKey ?? decision.localeAnswerKey),
      localeAnswerKey: text(previewItem.localeAnswerKey ?? decision.localeAnswerKey),
      createNewQuestion: decision.createNewQuestion === true,
      keepUnresolved: decision.keepUnresolved === true,
      deleteQuestion: decision.deleteQuestion === true,
      ignoreReconciliation: decision.ignoreReconciliation === true,
      confirmAmbiguousDuplicateLabel: decision.confirmAmbiguousDuplicateLabel === true || previewItem.confirmAmbiguousDuplicateLabel === true,
      newQuestionTopic: text(decision.newQuestionTopic),
      newQuestionSubtopics: decision.newQuestionSubtopics ?? [],
      reviewerNotes: text(decision.reviewerNotes),
    },
    skippedReasons,
    validationNotes,
    answerKeyAlignment: previewItem.answerKeyAlignment ?? reviewItem.answerKeyAlignment ?? null,
    candidateQids,
    candidates: summarizeCandidates(reviewItem),
    masterQuestion: masterQuestion
      ? {
          qid: approvedQid,
          type: text(masterQuestion.type),
          number: masterQuestion.number ?? null,
          prompt: text(masterQuestion.prompt),
          answerRaw: text(masterQuestion.answerRaw ?? masterQuestion.correctRow),
          options: masterQuestion.options ?? [],
        }
      : null,
    aiReview: previewItem.aiReview ?? decision.aiReview ?? {},
    recommendedNextAction: recommendedNextAction({ blockerKinds, previewItem, reviewItem, decision, approvedQid }),
    likelyRepairFiles: likelyRepairFiles({ blockerKinds, batch }),
    sourceFiles: sourceFiles({ batch }),
  };
}

function classifySkipKinds(item) {
  const reasons = (item.skipReasons ?? []).join(" | ");
  const kinds = [];
  if (/high-risk/u.test(reasons) || item.requiresRiskOverride === true) kinds.push("high-risk");
  if (/invalid .*ROW|invalid answer|localeAnswerKey .* invalid|ROW source item|ROW approval|MCQ source item|ambiguous because the selected source label/u.test(reasons)) kinds.push("invalid-answer-key");
  if (/create-new Right\/Wrong items cannot be safely represented|staged separately only/u.test(reasons)) kinds.push("staged-only-create-new-row");
  return kinds.length ? kinds : ["blocked"];
}

function recommendedNextAction({ blockerKinds, previewItem, reviewItem, decision, approvedQid }) {
  if (blockerKinds.includes("missing-production-qid")) {
    return "Rebuild/re-apply batch-08 staging from the current batch-08 workbench decisions, then rerun the RU discrepancy apply dry run. Do not manually patch translations.ru.json until a staging/full preview contains this qid.";
  }
  if (blockerKinds.includes("invalid-answer-key")) {
    const masterType = previewItem.masterQuestion?.type ?? "";
    return `Fix the exported decision answer key in the discrepancy workbench. ${approvedQid || "Approved qid"} is ${masterType || "ROW"}; use Right/Wrong for ROW or choose a different MCQ qid, then export decisions again.`;
  }
  if (blockerKinds.includes("staged-only-create-new-row")) {
    return "Decide whether this should approve an existing ROW qid, stay unresolved, or enter the separate new-question promotion flow. The current batch apply pipeline cannot safely create a new Right/Wrong production question directly.";
  }
  if (blockerKinds.includes("high-risk")) {
    return text(previewItem.aiReview?.suggestedNextAction ?? decision.aiReview?.suggestedNextAction ?? reviewItem.suggestedNextAction)
      || "Manually verify the screenshot/source against candidates, then either edit the discrepancy decision or rerun apply with --allow-risky true after review.";
  }
  return "Review the exported discrepancy decision and rerun the apply dry run after edits.";
}

function likelyRepairFiles({ blockerKinds, batch }) {
  const files = [
    rel(decisionsPath),
    rel(path.join(STAGING_DIR, `${LANG}-${batch}-workbench-decisions.json`)),
  ];

  if (blockerKinds.includes("missing-production-qid")) {
    files.push(
      rel(path.join(STAGING_DIR, `${LANG}-${batch}-review-decisions.json`)),
      rel(path.join(STAGING_DIR, `${LANG}-${batch}-unresolved-decisions.json`)),
      rel(path.join(STAGING_DIR, `translations.${LANG}.${batch}.full.preview.json`)),
      rel(path.join(REPORTS_DIR, `apply-workbench-decisions-${LANG}-${batch}.json`)),
      rel(path.join(REPORTS_DIR, `production-merge-${LANG}-${batch}.json`)),
    );
  }

  if (blockerKinds.includes("staged-only-create-new-row")) {
    files.push(rel(path.join(STAGING_DIR, `new-question-candidates.${LANG}.${batch}.json`)));
  }

  return unique(files);
}

function buildMissingProductionAudit(item) {
  const qid = item.currentExportedDecision.approvedQid;
  const batch = item.batch;
  const screenshotPath = item.screenshotPath;
  const exactPaths = {
    intake: path.join(ROOT, "imports", LANG, batch, "intake.json"),
    matched: path.join(ROOT, "imports", LANG, batch, "matched.json"),
    reviewNeeded: path.join(ROOT, "imports", LANG, batch, "review-needed.json"),
    unresolved: path.join(ROOT, "imports", LANG, batch, "unresolved.json"),
    workbenchDecisions: path.join(STAGING_DIR, `${LANG}-${batch}-workbench-decisions.json`),
    reviewDecisions: path.join(STAGING_DIR, `${LANG}-${batch}-review-decisions.json`),
    existingQidDecisions: path.join(STAGING_DIR, `${LANG}-${batch}-existing-qid-decisions.json`),
    unresolvedDecisions: path.join(STAGING_DIR, `${LANG}-${batch}-unresolved-decisions.json`),
    answerKeyDecisions: path.join(STAGING_DIR, `${LANG}-${batch}-answer-key-decisions.json`),
    applyWorkbenchReport: path.join(REPORTS_DIR, `apply-workbench-decisions-${LANG}-${batch}.json`),
    applyUnresolvedReport: path.join(REPORTS_DIR, `apply-unresolved-decisions-${LANG}-${batch}.json`),
    productionMergeReport: path.join(REPORTS_DIR, `production-merge-${LANG}-${batch}.json`),
    currentFullPreview: path.join(STAGING_DIR, `translations.${LANG}.${batch}.full.preview.json`),
    archiveFullPreview: path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging", `translations.${LANG}.${batch}.full.preview.json`),
    archiveExistingPreview: path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging", `translations.${LANG}.${batch}.existing.preview.json`),
    archivePreview: path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging", `translations.${LANG}.${batch}.preview.json`),
    archiveRescuedPreview: path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging", `translations.${LANG}.${batch}.rescued.preview.json`),
    archiveFullDryRun: path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging", `translations.${LANG}.${batch}.full.merge-dry-run.json`),
  };

  const evidence = Object.fromEntries(
    Object.entries(exactPaths).map(([label, filePath]) => [
      label,
      inspectJsonFile(filePath, { qid, screenshotPath }),
    ]),
  );

  const currentTranslationPresent = Boolean(productionQuestions[qid]);
  const masterQuestion = masterByQid.get(qid) ?? null;
  const productionMergeQids = readJsonIfExists(exactPaths.productionMergeReport)?.qidsMerged ?? [];
  const unresolvedIssues = readJsonIfExists(exactPaths.applyUnresolvedReport)?.decisionIssues ?? [];

  return {
    qid,
    batch,
    screenshotPath,
    productionTranslationPresent: currentTranslationPresent,
    masterQuestionPresent: Boolean(masterQuestion),
    masterQuestionType: masterQuestion?.type ?? null,
    currentWorkbenchApprovesQid: evidence.workbenchDecisions.matchesBySource.some((match) => normalizeQid(match.approvedQid) === qid),
    reviewDecisionsContainQid: evidence.reviewDecisions.containsQid,
    unresolvedDecisionsContainQid: evidence.unresolvedDecisions.containsQid,
    anyPreviewContainsQid: [
      evidence.currentFullPreview,
      evidence.archiveFullPreview,
      evidence.archiveExistingPreview,
      evidence.archivePreview,
      evidence.archiveRescuedPreview,
    ].some((entry) => entry.containsQid || entry.questionKeyPresent),
    productionMergeReportContainsQid: productionMergeQids.includes(qid),
    unresolvedDecisionIssuesForSource: unresolvedIssues.filter((issue) => text(issue.itemId ?? issue.sourceImage) === screenshotPath),
    conclusion: missingProductionConclusion({ qid, evidence, productionMergeQids, unresolvedIssues, screenshotPath }),
    recommendedRepair: missingProductionRepair({ qid, evidence, unresolvedIssues, screenshotPath }),
    evidence,
  };
}

function inspectJsonFile(filePath, { qid, screenshotPath }) {
  if (!fileExists(filePath)) {
    return {
      path: rel(filePath),
      exists: false,
      containsQid: false,
      containsSourceScreenshot: false,
      questionKeyPresent: false,
      itemCount: null,
      questionCount: null,
      matchesBySource: [],
      matchesByQid: [],
    };
  }

  const raw = readFileText(filePath);
  const doc = readJson(filePath);
  const items = Array.isArray(doc.items) ? doc.items : [];
  const questions = doc.questions && typeof doc.questions === "object" ? doc.questions : {};
  const matchesBySource = items
    .filter((entry) => text(entry.itemId ?? entry.sourceImage ?? entry.file) === screenshotPath)
    .map(compactDecisionLike);
  const matchesByQid = items
    .filter((entry) => normalizeQid(entry.qid ?? entry.approvedQid) === qid)
    .map(compactDecisionLike);

  return {
    path: rel(filePath),
    exists: true,
    containsQid: raw.includes(qid),
    containsSourceScreenshot: raw.includes(screenshotPath),
    questionKeyPresent: Boolean(questions[qid]),
    itemCount: items.length || null,
    questionCount: Object.keys(questions).length || null,
    qidsMergedContains: Array.isArray(doc.qidsMerged) ? doc.qidsMerged.includes(qid) : null,
    blockerCount: Array.isArray(doc.blockers) ? doc.blockers.length : null,
    safeToMergeNextStep: typeof doc.safeToMergeNextStep === "boolean" ? doc.safeToMergeNextStep : null,
    decisionIssues: Array.isArray(doc.decisionIssues) ? doc.decisionIssues.filter((issue) => text(issue.itemId ?? issue.sourceImage) === screenshotPath) : [],
    matchesBySource,
    matchesByQid,
  };
}

function missingProductionConclusion({ qid, evidence, productionMergeQids, unresolvedIssues, screenshotPath }) {
  const currentApproves = evidence.workbenchDecisions.matchesBySource.some((match) => normalizeQid(match.approvedQid) === qid);
  const previewMissing = ![
    evidence.currentFullPreview,
    evidence.archiveFullPreview,
    evidence.archiveExistingPreview,
    evidence.archivePreview,
    evidence.archiveRescuedPreview,
  ].some((entry) => entry.questionKeyPresent);

  if (currentApproves && previewMissing && !productionMergeQids.includes(qid)) {
    if (unresolvedIssues.some((issue) => text(issue.itemId ?? issue.sourceImage) === screenshotPath)) {
      return "Current workbench approves this qid, but the derived staging route is stale/misclassified: apply-unresolved reported unresolved-source-item-not-found, no preview contains the qid, and the production merge report did not merge it.";
    }
    return "Current workbench approves this qid, but derived review decisions/full preview/production merge outputs do not contain it. Batch-08 staging is stale or was not rebuilt from the current workbench decision.";
  }

  return "Production translation is missing and no current full preview entry was found; manual inspection is required before any production patch.";
}

function missingProductionRepair({ qid, evidence, unresolvedIssues, screenshotPath }) {
  if (unresolvedIssues.some((issue) => text(issue.itemId ?? issue.sourceImage) === screenshotPath)) {
    return `Re-apply/rebuild batch-08 from the current workbench decisions so ${qid} routes through review-needed decisions, not the stale unresolved path. Do not manually patch translations.ru.json unless a rebuilt full preview still cannot include it.`;
  }
  if (evidence.workbenchDecisions.matchesBySource.some((match) => normalizeQid(match.approvedQid) === qid)) {
    return `Re-run batch-08 workbench apply/staging from current decisions, then rerun the discrepancy dry run. Manual production patch is not recommended because no preview currently contains ${qid}.`;
  }
  return `First repair the batch-08 decision source for ${qid}; current evidence is insufficient for production patching.`;
}

function summarizeCandidates(reviewItem) {
  const byQid = new Map();
  for (const candidate of [...(reviewItem.bestMatches ?? []), ...(reviewItem.candidateDetails ?? [])]) {
    const qid = normalizeQid(candidate.qid);
    if (!qid || byQid.has(qid)) continue;
    byQid.set(qid, {
      qid,
      number: candidate.number ?? null,
      type: text(candidate.type),
      score: typeof candidate.score === "number" ? candidate.score : null,
      answerKey: text(candidate.answerKey ?? candidate.correctAnswer),
      prompt: text(candidate.prompt),
      hasImage: candidate.hasImage === true,
    });
  }
  return [...byQid.values()].slice(0, 8);
}

function compactDecisionLike(entry) {
  return {
    itemId: text(entry.itemId),
    sourceImage: text(entry.sourceImage),
    sourceSection: text(entry.sourceSection ?? entry.section),
    approvedQid: normalizeQid(entry.approvedQid),
    initialSuggestedQid: normalizeQid(entry.initialSuggestedQid),
    createNewQuestion: entry.createNewQuestion === true,
    keepUnresolved: entry.keepUnresolved === true,
    deleteQuestion: entry.deleteQuestion === true,
    confirmedCorrectOptionKey: text(entry.confirmedCorrectOptionKey),
    newQuestionLocalAnswerKey: text(entry.newQuestionLocalAnswerKey),
    currentStagedLocaleCorrectOptionKey: text(entry.currentStagedLocaleCorrectOptionKey),
  };
}

function renderMarkdown(doc) {
  const lines = [];
  lines.push("# RU Discrepancy Blockers Review");
  lines.push("");
  lines.push(`Generated at: ${doc.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Unique blocker items: ${doc.summary.uniqueBlockerItems}`);
  lines.push(`- High-risk items: ${doc.summary.highRiskItems}`);
  lines.push(`- Invalid answer-key items: ${doc.summary.invalidAnswerKeyItems}`);
  lines.push(`- Staged-only Right/Wrong create-new items: ${doc.summary.stagedOnlyCreateNewRowItems}`);
  lines.push(`- Missing-production qids: ${doc.summary.missingProductionQidItems}`);
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  lines.push("| item | batch | action | qid | key | blocker | workbench link | next action |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const item of doc.blockers) {
    lines.push(`| ${md(item.id)} | ${md(item.batch)} | ${md(item.currentExportedDecision.finalDecision)} | ${md(item.currentExportedDecision.approvedQid)} | ${md(item.currentExportedDecision.localeAnswerKey)} | ${md(item.blockerKinds.join(", "))} | [Fix](${md(item.workbenchHref)}) | ${md(item.recommendedNextAction)} |`);
  }
  lines.push("");
  lines.push("## Missing Production QID Audit");
  lines.push("");
  for (const audit of doc.missingProductionQids) {
    lines.push(`### ${audit.qid}`);
    lines.push("");
    lines.push(`- Source: ${audit.batch} / \`${audit.screenshotPath}\``);
    lines.push(`- Master qid exists: ${audit.masterQuestionPresent ? "yes" : "no"} (${audit.masterQuestionType ?? "unknown"})`);
    lines.push(`- Current production translation exists: ${audit.productionTranslationPresent ? "yes" : "no"}`);
    lines.push(`- Current workbench approves qid: ${audit.currentWorkbenchApprovesQid ? "yes" : "no"}`);
    lines.push(`- Review decisions contain qid: ${audit.reviewDecisionsContainQid ? "yes" : "no"}`);
    lines.push(`- Unresolved decisions contain qid: ${audit.unresolvedDecisionsContainQid ? "yes" : "no"}`);
    lines.push(`- Any staging/archive preview contains qid: ${audit.anyPreviewContainsQid ? "yes" : "no"}`);
    lines.push(`- Production merge report contains qid: ${audit.productionMergeReportContainsQid ? "yes" : "no"}`);
    lines.push(`- Conclusion: ${audit.conclusion}`);
    lines.push(`- Recommended repair: ${audit.recommendedRepair}`);
    if (audit.unresolvedDecisionIssuesForSource.length) {
      lines.push(`- Unresolved issue evidence: ${md(JSON.stringify(audit.unresolvedDecisionIssuesForSource))}`);
    }
    lines.push("");
  }
  lines.push("## Recommended Next Command");
  lines.push("");
  lines.push("After manual edits in the discrepancy workbench, rerun:");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run apply-ru-discrepancy-review-decisions");
  lines.push("```");
  lines.push("");
  lines.push("For q0245/q0176 specifically, after the discrepancy decisions are applied to batch-08 staging decisions, rebuild batch-08 staging before any production merge:");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run apply-batch-workbench-decisions -- --lang ru --batch batch-08");
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderHtml(doc) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RU Discrepancy Blockers Review</title>
<style>
  :root { --bg:#f6efe4; --paper:#fffdf8; --ink:#1f1a17; --muted:#6d6257; --line:#d8cec1; --accent:#165d52; --warn:#8c4f16; --warn-soft:#f8ead7; --note:#4f3b96; --note-soft:#ece8ff; --danger:#9f2a1f; --danger-soft:#fbe7e4; --shadow:0 12px 28px rgba(38,25,10,.08); --mono:"SFMono-Regular", Menlo, Consolas, monospace; --sans:"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif; }
  * { box-sizing:border-box; }
  body { margin:0; background:radial-gradient(circle at top left, rgba(22,93,82,.10), transparent 32%), radial-gradient(circle at top right, rgba(140,79,22,.10), transparent 28%), var(--bg); color:var(--ink); font-family:var(--sans); }
  .page { width:min(1560px, calc(100vw - 28px)); margin:22px auto 44px; }
  .hero, .card, .audit { background:var(--paper); border:1px solid var(--line); border-radius:22px; box-shadow:var(--shadow); }
  .hero { padding:24px 28px; margin-bottom:18px; }
  h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1; }
  .hero p, .muted { color:var(--muted); }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-top:18px; }
  .stat { border:1px solid var(--line); border-radius:16px; padding:12px 14px; background:#fcf8f1; }
  .stat span, .label { display:block; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
  .stat strong { display:block; margin-top:6px; font-size:24px; }
  .list { display:grid; gap:14px; }
  .card { display:grid; grid-template-columns:minmax(300px,380px) minmax(420px,1fr) minmax(280px,360px); gap:14px; padding:14px; align-items:start; }
  .col { min-width:0; display:grid; gap:10px; }
  .eyebrow { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
  .item-id { color:var(--muted); font-family:var(--mono); font-size:11px; line-height:1.35; user-select:text; word-break:break-word; }
  .path { font-family:var(--mono); font-size:10pt; color:var(--muted); word-break:break-word; user-select:text; }
  .fix-link { display:inline-flex; align-items:center; justify-content:center; width:max-content; border-radius:999px; padding:10px 14px; background:var(--accent); color:#fff; text-decoration:none; font-weight:700; }
  .fix-link:focus, .fix-link:hover { box-shadow:0 0 0 3px rgba(22,93,82,.18); }
  .image-frame { min-height:170px; border:1px solid var(--line); border-radius:16px; overflow:hidden; background:#f1ebdf; display:flex; align-items:center; justify-content:center; }
  .image-frame img { display:block; width:100%; height:auto; }
  .prompt { font-size:17px; line-height:1.45; margin:0; }
  .gloss { color:var(--muted); font-size:14px; line-height:1.45; }
  .options { display:grid; gap:7px; margin:0; padding:0; }
  .option { border:1px solid var(--line); border-radius:12px; padding:8px 10px; background:#fbf7f0; }
  .option-key { display:inline-flex; min-width:24px; color:var(--accent); font-family:var(--mono); font-weight:700; }
  .fact { border:1px solid var(--line); border-radius:12px; background:#faf5ee; padding:10px 12px; }
  .warn { border-color:rgba(140,79,22,.28); background:var(--warn-soft); color:var(--warn); }
  .danger { border-color:rgba(159,42,31,.24); background:var(--danger-soft); color:var(--danger); }
  .note { border-color:rgba(79,59,150,.22); background:var(--note-soft); color:var(--note); }
  .answer-alignment { border:1px solid rgba(22,93,82,.22); border-radius:14px; background:#e4f2ef; padding:12px; display:grid; gap:10px; }
  .answer-alignment.medium { border-color:rgba(140,79,22,.35); background:var(--warn-soft); }
  .answer-alignment.high { border-color:rgba(159,42,31,.32); background:var(--danger-soft); }
  .alignment-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .alignment-fact { border:1px solid rgba(255,255,255,.62); border-radius:12px; background:rgba(255,255,255,.48); padding:9px 10px; font-size:13px; line-height:1.4; }
  .alignment-fact strong { display:block; margin-bottom:4px; font-family:var(--mono); font-size:14px; }
  .alignment-warning { border:1px solid rgba(159,42,31,.24); border-radius:10px; background:rgba(255,255,255,.52); color:var(--danger); padding:8px 10px; font-size:13px; line-height:1.45; }
  .alignment-info { border:1px solid rgba(22,93,82,.24); border-radius:10px; background:rgba(255,255,255,.58); color:var(--accent); padding:8px 10px; font-size:13px; line-height:1.45; }
  .pillrow { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .pill { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border:1px solid var(--line); border-radius:999px; font-size:12px; background:#f3ede4; color:var(--muted); font-weight:700; }
  .pill.kind { background:var(--note-soft); color:var(--note); border-color:rgba(79,59,150,.18); }
  .pill.high, .pill.invalid, .pill.missing-production-qid { background:var(--danger-soft); color:var(--danger); border-color:rgba(159,42,31,.2); }
  .candidate { border:1px solid var(--line); border-radius:14px; background:#fcf8f1; padding:10px; display:grid; gap:6px; }
  .audit { margin-top:18px; padding:18px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { border:1px solid var(--line); padding:7px 8px; text-align:left; vertical-align:top; }
  th { background:#f8f1e6; }
  code { font-family:var(--mono); }
  @media (max-width:1100px) { .card, .alignment-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="page">
  <section class="hero">
    <h1>RU Discrepancy Blockers Review</h1>
    <p>Focused manual-fix report for skipped discrepancy apply items and missing production qids. Inspection only; no production qbank files are modified.</p>
    <div class="stats">
      <div class="stat"><span>Unique blockers</span><strong>${doc.summary.uniqueBlockerItems}</strong></div>
      <div class="stat"><span>High risk</span><strong>${doc.summary.highRiskItems}</strong></div>
      <div class="stat"><span>Invalid answer key</span><strong>${doc.summary.invalidAnswerKeyItems}</strong></div>
      <div class="stat"><span>Staged-only row create-new</span><strong>${doc.summary.stagedOnlyCreateNewRowItems}</strong></div>
      <div class="stat"><span>Missing production qids</span><strong>${doc.summary.missingProductionQidItems}</strong></div>
    </div>
  </section>
  <main class="list">
    ${doc.blockers.map(renderBlockerCard).join("\n")}
  </main>
  <section class="audit">
    <h2>Missing Production QID Audit</h2>
    ${doc.missingProductionQids.map(renderMissingAudit).join("\n")}
  </section>
</div>
</body>
</html>`;
}

function renderBlockerCard(item) {
  const options = item.sourceOptionsEnglish?.length ? item.sourceOptionsEnglish : item.sourceOptions;
  return `<article id="blocker-${attr(item.workbenchAnchorId)}" class="card">
    <div class="col">
      <div class="eyebrow">${html(item.batch)}</div>
      <div class="item-id"><span class="label">Blocker / Item ID</span><code>${html(item.id)}</code></div>
      <div class="path">${html(item.screenshotPath)}</div>
      <div class="image-frame">${item.screenshotPreviewPath ? `<img src="${attr(item.screenshotPreviewPath)}" alt="${attr(item.screenshotPath)}">` : '<span class="muted">No screenshot preview</span>'}</div>
      <div><span class="label">Source Prompt</span><p class="prompt">${html(item.sourcePrompt || item.sourcePromptEnglish || "")}</p>${item.sourcePromptEnglish ? `<div class="gloss">${html(item.sourcePromptEnglish)}</div>` : ""}</div>
      <div><span class="label">Source Options</span>${renderOptions(options)}</div>
    </div>
    <div class="col">
      <div class="pillrow">${item.blockerKinds.map((kind) => `<span class="pill kind ${attr(kind)}">${html(kind)}</span>`).join("")}</div>
      <div class="fact danger"><span class="label">Skipped Because</span>${item.skippedReasons.map((reason) => `<div>${html(reason)}</div>`).join("")}</div>
      ${item.validationNotes?.length ? `<div class="fact warn"><span class="label">Validation / Alignment Notes</span>${item.validationNotes.map((reason) => `<div>${html(reason)}</div>`).join("")}</div>` : ""}
      <div class="fact"><span class="label">Current Exported Decision</span><div>${html(item.currentExportedDecision.finalDecision)} ${html(item.currentExportedDecision.approvedQid)} ${html(item.currentExportedDecision.localeAnswerKey)}</div>${item.answerKeyAlignment?.selectedIsAmbiguous ? `<div class="muted">Duplicate-label manual confirmation: ${item.currentExportedDecision.confirmAmbiguousDuplicateLabel ? "yes" : "no"}</div>` : ""}</div>
      ${renderAnswerKeyAlignment(item.answerKeyAlignment)}
      <div class="fact note"><span class="label">Recommended Next Action</span><div>${html(item.recommendedNextAction)}</div></div>
      <div><span class="label">Candidate QIDs</span><div class="pillrow">${item.candidateQids.map((qid) => `<span class="pill">${html(qid)}</span>`).join("")}</div></div>
      <div class="col">${item.candidates.slice(0, 5).map(renderCandidate).join("")}</div>
    </div>
    <div class="col">
      <a class="fix-link" href="${attr(item.workbenchHref)}">Fix in main workbench</a>
      <div class="fact"><span class="label">Approved / Master</span>${item.masterQuestion ? `<div><strong>${html(item.masterQuestion.qid)}</strong> #${html(item.masterQuestion.number ?? "")} ${html(item.masterQuestion.type)}</div><div>${html(item.masterQuestion.prompt)}</div><div class="muted">Answer: ${html(item.masterQuestion.answerRaw)}</div>` : '<div class="muted">No approved qid</div>'}</div>
      <div class="fact"><span class="label">Likely Repair Files</span>${item.likelyRepairFiles.map((filePath) => `<div><code>${html(filePath)}</code></div>`).join("")}</div>
    </div>
  </article>`;
}

function renderAnswerKeyAlignment(alignment) {
  if (!alignment) return "";
  const warningClass = alignment.warningLevel === "high" ? " high" : alignment.warningLevel === "medium" ? " medium" : "";
  const warnings = Array.isArray(alignment.warnings) ? alignment.warnings : [];
  const labelSummary = [
    alignment.detectedSourceLabels?.length ? `detected ${alignment.detectedSourceLabels.join(", ")}` : "",
    alignment.missingSourceLabels?.length ? `missing ${alignment.missingSourceLabels.join(", ")}` : "",
    alignment.duplicateSourceLabels?.length ? `duplicate ${alignment.duplicateSourceLabels.join(", ")}` : "",
  ].filter(Boolean).join(" | ");
  return `<div class="answer-alignment${warningClass}">
    <div class="pillrow"><span class="label">Answer Key Alignment</span><span class="pill ${attr(alignment.warningLevel || "low")}">${html(alignment.warningLevel || "low")} risk</span></div>
    <div class="alignment-grid">
      <div class="alignment-fact"><span class="label">Source / Local Answer</span><strong>${html(alignment.sourceAnswerKey || alignment.sourceRawAnswerKey || "not set")}</strong><div>${html(alignment.sourceCorrectText || "not found")}</div>${alignment.sourceQuestionType === "ROW" && alignment.sourceRawAnswerKey && alignment.sourceRawAnswerKey !== alignment.sourceAnswerKey ? `<div class="muted">Source label ${html(alignment.sourceRawAnswerKey)} maps to ${html(alignment.sourceAnswerKey)}</div>` : ""}</div>
      <div class="alignment-fact"><span class="label">Master QID Answer</span><strong>${html(alignment.masterAnswerKey || "not set")}</strong><div>${html(alignment.masterCorrectText || "not found")}</div>${alignment.masterQuestionType ? `<div class="muted">Master type: ${html(alignment.masterQuestionType)}</div>` : ""}</div>
      <div class="alignment-fact"><span class="label">Selected Locale Answer</span><strong>${html(alignment.selectedRawLocaleAnswerKey && alignment.selectedRawLocaleAnswerKey !== alignment.selectedLocaleAnswerKey ? `${alignment.selectedRawLocaleAnswerKey} -> ${alignment.selectedLocaleAnswerKey}` : alignment.selectedLocaleAnswerKey || "not set")}</strong><div>${html(alignment.selectedLocaleCorrectText || "not found")}</div></div>
      <div class="alignment-fact"><span class="label">Meaning Check</span><strong>${alignment.sourceMasterMeaning?.matches ? "meaning appears aligned" : "needs confirmation"}</strong><div>${html(alignment.sourceMasterMeaning?.method || "not compared")} ${alignment.sourceMasterMeaning?.score == null ? "" : html(alignment.sourceMasterMeaning.score)}</div></div>
    </div>
    ${warnings.length ? `<div class="alignment-warning">${warnings.map((warning) => `<div>${html(warning)}</div>`).join("")}</div>` : ""}
    ${alignment.autoNormalizedRowAnswer ? `<div class="alignment-info"><strong>Auto-normalized ROW answer</strong><br>Source selected key: ${html(alignment.selectedRawLocaleAnswerKey || alignment.sourceRawAnswerKey || "unknown")}<br>Source selected text: ${html(alignment.selectedLocaleCorrectText || alignment.sourceCorrectText || "not found")}<br>Exported locale key: ${html(alignment.selectedLocaleAnswerKey || alignment.sourceAnswerKey || "unknown")}</div>` : ""}
    ${labelSummary ? `<div class="muted">Source label check: ${html(labelSummary)}</div>` : ""}
  </div>`;
}

function renderCandidate(candidate) {
  return `<div class="candidate">
    <div class="pillrow">
      <span class="pill">${html(candidate.qid)}</span>
      ${candidate.number ? `<span class="pill">#${html(candidate.number)}</span>` : ""}
      ${candidate.type ? `<span class="pill">${html(candidate.type)}</span>` : ""}
      ${candidate.score != null ? `<span class="pill">score ${html(formatScore(candidate.score))}</span>` : ""}
      ${candidate.answerKey ? `<span class="pill">answer ${html(candidate.answerKey)}</span>` : ""}
    </div>
    <div>${html(candidate.prompt)}</div>
  </div>`;
}

function renderMissingAudit(audit) {
  const rows = Object.entries(audit.evidence).map(([label, entry]) => `<tr>
    <td>${html(label)}</td>
    <td><code>${html(entry.path)}</code></td>
    <td>${entry.exists ? "yes" : "no"}</td>
    <td>${entry.containsQid || entry.questionKeyPresent ? "yes" : "no"}</td>
    <td>${entry.containsSourceScreenshot ? "yes" : "no"}</td>
    <td>${entry.itemCount ?? entry.questionCount ?? ""}</td>
  </tr>`).join("");
  return `<section>
    <h3>${html(audit.qid)}</h3>
    <div class="fact note"><span class="label">Conclusion</span><div>${html(audit.conclusion)}</div></div>
    <div class="fact warn"><span class="label">Recommended Repair</span><div>${html(audit.recommendedRepair)}</div></div>
    <table>
      <thead><tr><th>file</th><th>path</th><th>exists</th><th>contains qid</th><th>contains screenshot</th><th>count</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return '<div class="muted">No options</div>';
  return `<div class="options">${options.map((option) => `<div class="option"><span class="option-key">${html(option.key ?? "")}.</span>${html(option.text ?? option)}</div>`).join("")}</div>`;
}

function sourceFiles({ batch }) {
  return [
    rel(path.join(ROOT, "imports", LANG, batch, "intake.json")),
    rel(path.join(ROOT, "imports", LANG, batch, "review-needed.json")),
    rel(path.join(ROOT, "imports", LANG, batch, "unresolved.json")),
    rel(path.join(ROOT, "imports", LANG, batch, "matched.json")),
  ];
}

function screenshotPreviewPath(batch, screenshotPath) {
  if (!batch || !screenshotPath) return "";
  return path.relative(REPORTS_DIR, path.join(ROOT, "imports", LANG, batch, screenshotPath));
}

function extractQuestionList(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function readJsonIfExists(filePath) {
  return fileExists(filePath) ? readJson(filePath) : null;
}

function readFileText(filePath) {
  return fileExists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^q?(\d{1,4})$/iu);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function text(value) {
  return String(value ?? "").trim();
}

function formatScore(score) {
  return Number(score) > 1 ? Number(score).toFixed(1) : Number(score).toFixed(2);
}

function md(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, " ").replace(/\s+/gu, " ").trim();
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attr(value) {
  return html(value);
}

function shortHash(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function itemAnchorId(itemId) {
  const slug = String(itemId ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "item";
  return `item-${slug}-${shortHash(itemId)}`;
}

function rel(targetPath) {
  return path.relative(ROOT, targetPath);
}
