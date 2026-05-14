#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";

import {
  BACKFILL_SOURCE,
  backfillPaths,
  detectWrongLanguage,
  loadBackfillContext,
  normalizeLang,
  normalizeQid,
  parseLimit,
  questionType,
  targetLanguageConfig,
  validateDraftItems,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";
import {
  DEFAULT_DATASET,
  booleanArg,
  fileExists,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = normalizeLang(args.lang);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const limit = parseLimit(args.limit);
const model = String(args.model ?? "gpt-5-mini").trim() || "gpt-5-mini";
const batchSize = Number(args["batch-size"] ?? 5);
const noAi = booleanArg(args, "no-ai", false);
const resume = booleanArg(args, "resume", false);
const requestTimeoutMs = parsePositiveInteger(args["request-timeout-ms"] ?? 60000, "--request-timeout-ms");
const paths = backfillPaths({ lang, dataset, input: args.input });
const inputPath = args.input ? paths.generatedDraftPath : paths.generatedDraftPath;
const qualityJsonPath = path.join(path.dirname(paths.validationJsonPath), `backfill-quality-review.${lang}.json`);
const qualityMdPath = path.join(path.dirname(paths.validationMdPath), `backfill-quality-review.${lang}.md`);
const needsFixPath = path.join(path.dirname(paths.missingItemsPath), `backfill.${lang}.needs-fix.json`);
const reviewedPath = path.join(path.dirname(paths.missingItemsPath), `backfill.${lang}.reviewed.json`);

if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 20) {
  throw new Error(`Invalid --batch-size: ${args["batch-size"]}. Use 1-20.`);
}

if (!fileExists(inputPath)) {
  throw new Error(`Generated draft input not found: ${relative(inputPath)}. Run generate-missing-localization-draft first.`);
}

const context = loadBackfillContext({ lang, dataset });
const inputDoc = readJson(inputPath);
const sourceItems = Array.isArray(inputDoc?.items) ? inputDoc.items : [];
const items = limit ? sourceItems.slice(0, limit) : sourceItems;
const preflight = validateDraftItems({
  items,
  context,
  requireGeneratedText: false,
  requireApproved: false,
});

const apiKey = noAi ? null : process.env.OPENAI_API_KEY ?? (await readOpenAIKeyFromDotenv());
const client = apiKey ? new OpenAI({ apiKey, timeout: requestTimeoutMs }) : null;
const resumeByQid = resume && fileExists(qualityJsonPath)
  ? reusableQualityReviews(readJson(qualityJsonPath))
  : new Map();
const reviewItems = client
  ? await reviewWithAi({
      client,
      model,
      items,
      context,
      lang,
      batchSize,
      resumeByQid,
      onProgress: async ({ reviewByQid, processedPending, pendingCount }) => {
        const progressReviews = items.map((item) => {
          const qid = normalizeQid(item.qid);
          return reviewByQid.get(qid) ?? pendingQualityReview(item);
        });
        const progressNormalizedReviews = progressReviews.map((review, index) => normalizeQualityReview(review, items[index], context, lang));
        await writeQualityOutputs(buildQualityArtifacts({
          normalizedReviews: progressNormalizedReviews,
          items,
          sourceItems,
          preflight,
          client,
          model,
          lang,
          dataset,
          inputPath,
          qualityJsonPath,
          needsFixPath,
          reviewedPath,
          requestTimeoutMs,
          resume,
          progressDraft: true,
        }));
        console.log(`Progress: ${processedPending}/${pendingCount} pending review item(s) processed.`);
      },
    })
  : items.map((item) => structuralFallbackReview(item, context, "AI reviewer unavailable; set OPENAI_API_KEY or pass a generated review from a trusted reviewer."));

const normalizedReviews = reviewItems.map((review, index) => normalizeQualityReview(review, items[index], context, lang));
const artifacts = buildQualityArtifacts({
  normalizedReviews,
  items,
  sourceItems,
  preflight,
  client,
  model,
  lang,
  dataset,
  inputPath,
  qualityJsonPath,
  needsFixPath,
  reviewedPath,
  requestTimeoutMs,
  resume,
  progressDraft: false,
});

await writeQualityOutputs(artifacts);
const { report } = artifacts;

console.log(`Wrote ${relative(qualityJsonPath)}`);
console.log(`Wrote ${relative(qualityMdPath)}`);
console.log(`Wrote ${relative(needsFixPath)}`);
console.log(`Wrote ${relative(reviewedPath)}`);
console.log(`AI review used: ${client ? "yes" : "no"}`);
console.log(`Approved: ${report.counts.approved}`);
console.log(`Needs fix: ${report.counts.needsFix}`);
console.log(`Reject: ${report.counts.reject}`);
console.log("Production translations modified: no");

function buildQualityArtifacts({
  normalizedReviews,
  items,
  sourceItems,
  preflight,
  client,
  model,
  lang,
  dataset,
  inputPath,
  qualityJsonPath,
  needsFixPath,
  reviewedPath,
  requestTimeoutMs,
  resume,
  progressDraft,
}) {
  const generatedAt = new Date().toISOString();
  const reviewedItems = [];
  const needsFixItems = [];

  for (const [index, item] of items.entries()) {
    const qualityReview = normalizedReviews[index];
    const enriched = {
      ...item,
      qualityReview,
      needsHumanReview: true,
    };

    if (qualityReview.qualityStatus === "approved") {
      reviewedItems.push({
        ...enriched,
        reviewStatus: "approved",
        reviewedBy: "ai-quality-review",
        reviewedAt: qualityReview.reviewedAt,
      });
    } else {
      needsFixItems.push({
        ...enriched,
        reviewStatus: qualityReview.qualityStatus === "reject" ? "rejected" : "needs_fix",
      });
    }
  }

  const report = {
    generatedAt,
    source: `${BACKFILL_SOURCE}_quality_review`,
    lang,
    dataset,
    inputPath: relative(inputPath),
    qualityReviewPath: relative(qualityJsonPath),
    needsFixPath: relative(needsFixPath),
    reviewedPath: relative(reviewedPath),
    model: client ? model : null,
    aiReviewUsed: Boolean(client),
    requestTimeoutMs,
    resume,
    progressDraft,
    productionModified: false,
    counts: {
      inputItems: items.length,
      sourceInputItems: sourceItems.length,
      approved: normalizedReviews.filter((review) => review.qualityStatus === "approved").length,
      needsFix: normalizedReviews.filter((review) => review.qualityStatus === "needs_fix").length,
      reject: normalizedReviews.filter((review) => review.qualityStatus === "reject").length,
      belowConfidenceThreshold: normalizedReviews.filter((review) => review.confidence < 0.92).length,
      answerKeyLogicRisk: normalizedReviews.filter((review) => review.answerKeyLogicMayBeWrong).length,
      wrongLanguageRejects: normalizedReviews.filter((review) => review.issues.some((issue) => issue.code === "wrong-language-heuristic")).length,
      preflightErrors: preflight.counts.errorCount,
      preflightWarnings: preflight.counts.warningCount,
    },
    rules: {
      confidenceApprovalThreshold: 0.92,
      answerKeyLogicRiskRejects: true,
      humanOwnerMustReviewReportBeforeApply: true,
    },
    preflight,
    items: normalizedReviews,
  };

  const needsFixDoc = {
    meta: {
      generatedAt: report.generatedAt,
      source: report.source,
      lang,
      dataset,
      inputPath: relative(inputPath),
      productionModified: false,
      count: needsFixItems.length,
    },
    items: needsFixItems,
  };

  const reviewedDoc = {
    meta: {
      generatedAt: report.generatedAt,
      source: report.source,
      lang,
      dataset,
      inputPath: relative(inputPath),
      productionModified: false,
      requiresHumanOwnerReportReview: true,
      note: "Only AI-approved items are included. Review the quality report before applying to production.",
      count: reviewedItems.length,
    },
    items: reviewedItems,
  };

  return { report, needsFixDoc, reviewedDoc };
}

async function writeQualityOutputs({ report, needsFixDoc, reviewedDoc }) {
  await writeJson(qualityJsonPath, report);
  await writeText(qualityMdPath, renderQualityMarkdown(report));
  await writeJson(needsFixPath, needsFixDoc);
  await writeJson(reviewedPath, reviewedDoc);
}

async function reviewWithAi({ client, model, items, context, lang, batchSize, resumeByQid, onProgress }) {
  const reviewByQid = new Map(resumeByQid);
  const pendingItems = items.filter((item) => !reviewByQid.has(normalizeQid(item.qid)));

  if (reviewByQid.size > 0) {
    console.log(`Resuming from ${reviewByQid.size} reusable quality review item(s).`);
  }

  for (let index = 0; index < pendingItems.length; index += batchSize) {
    const batch = pendingItems.slice(index, index + batchSize);
    const payload = batch.map((item) => reviewPayload(item, context));
    let parsed;
    try {
      parsed = await reviewBatch({ client, model, lang, payload });
    } catch (error) {
      parsed = {
        reviews: batch.map((item) => structuralFallbackReview(
          item,
          context,
          `AI quality review failed for this batch: ${error.message ?? error}`,
        )),
      };
    }
    const byQid = new Map(parsed.reviews.map((review) => [normalizeQid(review.qid), review]));
    for (const item of batch) {
      const qid = normalizeQid(item.qid);
      reviewByQid.set(qid, byQid.get(qid) ?? structuralFallbackReview(item, context, "AI response omitted this qid."));
    }

    if (onProgress) {
      await onProgress({
        reviewByQid,
        processedPending: Math.min(index + batch.length, pendingItems.length),
        pendingCount: pendingItems.length,
      });
    }
  }

  return items.map((item) => reviewByQid.get(normalizeQid(item.qid)) ?? pendingQualityReview(item));
}

async function reviewBatch({ client, model, lang, payload }) {
  const language = targetLanguageConfig(lang);
  const userPrompt = [
    `Target language code: ${language.code}`,
    `Target language label: ${language.outputLabel}`,
    `Target language requirement: generated output must be ${language.englishName} (${language.nativeName}) only.`,
    language.scriptInstruction,
    "Review these generated translations.",
    "Return this exact JSON shape:",
    '{ "reviews": [ { "qid": "q0001", "qualityStatus": "approved|needs_fix|reject", "confidence": 0.0, "answerKeyLogicMayBeWrong": false, "issues": [ { "severity": "warning|error", "code": "short-code", "message": "brief issue" } ], "suggestedFix": { "prompt": "", "options": { "optionId": "" }, "explanation": "" } | null, "reviewerReasoningSummary": "brief auditable summary" } ] }',
    "",
    JSON.stringify({ items: payload }, null, 2),
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: reviewSystemPrompt(language) }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
      });
      const parsed = parseJsonObject(String(response.output_text ?? "").trim());
      if (!parsed || !Array.isArray(parsed.reviews)) {
        throw new Error("AI response JSON is missing reviews array");
      }
      return parsed;
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(1200 * attempt);
    }
  }

  throw new Error("Unreachable review retry state");
}

function reviewSystemPrompt(language) {
  return `
You review generated ${language.englishName} (${language.nativeName}) translations of Chinese-driving-test-style English master questions.

Target language: ${language.outputLabel}.
Reject any output that is not in ${language.englishName} (${language.nativeName}).
${language.scriptInstruction}

English master is the source of truth. The generated translation must preserve exact meaning, answer logic, option ordering, option key mapping, numeric values, signs, penalties, distances, speeds, dates, and image-dependent semantics.

Question type handling:
- "row" means a Right/Wrong true-false statement. For row questions, generated options are intentionally empty. Never reject a row item for missing MCQ options, and never request Right/Wrong option rows.
- For row questions, review only whether the French statement preserves the same true/false proposition as the English master and whether the Right/Wrong answer metadata still makes sense.
- MCQ questions must preserve each option's meaning and option id/key mapping.

Translation-fidelity rule:
- Some English master ROW statements and MCQ distractors are intentionally false, unsafe, illegal, or bad advice because the correct answer is "Wrong" or a different MCQ option.
- Do not reject a translation merely because the statement/distractor is false in the real world.
- Approve when the ${language.englishName} text faithfully preserves the same false claim, bad advice, legal detail, and answer metadata from the English master.
- Mark answer-key logic risky only when the translation reverses or changes the English meaning, not when it accurately translates an intentionally false source statement.

Review standards:
- prompt meaning matches English
- all options match English option meanings
- correct answer logic is preserved
- option keys are not remapped incorrectly
- ${language.englishName} is natural and exam-appropriate
- traffic/driving/legal terminology is consistent
- no hallucinated details
- no missing warnings/explanations when source requires them
- image-dependent wording is not mistranslated
- true/false questions remain true/false equivalent
- numeric values, signs, penalties, distances, speeds, and dates are preserved exactly

Rules:
- If the generated text is in the wrong language, qualityStatus must be "reject".
- If confidence is below 0.92, qualityStatus must be "needs_fix".
- If any answer-key logic may be wrong, qualityStatus must be "reject" and answerKeyLogicMayBeWrong must be true.
- Do not approve ambiguous legal, traffic, penalty, right-of-way, or numeric wording.
- Do not approve empty or English-only fields.
- Return JSON only. Do not include markdown.
`.trim();
}

function reviewPayload(item, context) {
  const qid = normalizeQid(item.qid);
  const master = context.masterByQid.get(qid);
  return {
    qid,
    number: item.number,
    type: item.type ?? questionType(master),
    englishMaster: {
      prompt: item.englishPrompt ?? master?.prompt ?? "",
      options: item.englishOptions ?? [],
      correctOptionKey: item.correctOptionKey,
    },
    imageContext: {
      image: item.image ?? null,
      imageAssets: item.imageAssets ?? [],
      objectTags: item.objectTags ?? [],
      imageTags: item.imageTags ?? null,
    },
    generatedTranslation: item.generatedTranslation ?? {},
    generationStatus: item.generationStatus ?? "",
    warnings: item.warnings ?? [],
  };
}

function pendingQualityReview(item) {
  return {
    qid: normalizeQid(item.qid),
    qualityStatus: "needs_fix",
    confidence: 0,
    answerKeyLogicMayBeWrong: false,
    issues: [
      {
        severity: "warning",
        code: "quality-review-pending",
        message: "Quality review is pending in this progress draft.",
      },
    ],
    suggestedFix: null,
    reviewerReasoningSummary: "Quality review pending; not approved.",
    reviewer: "ai-localization-quality-review",
  };
}

function structuralFallbackReview(item, context, reason) {
  const qid = normalizeQid(item.qid);
  const master = context.masterByQid.get(qid);
  const issues = [];
  const generated = item.generatedTranslation ?? {};
  const type = item.type ?? questionType(master);

  if (item.generationStatus === "not_generated") {
    issues.push({ severity: "error", code: "not-generated", message: "No generated translation is available to review." });
  }
  if (!String(generated.prompt ?? "").trim()) {
    issues.push({ severity: "error", code: "missing-prompt", message: "Generated prompt is empty." });
  }
  if (type !== "row") {
    const expectedOptions = Array.isArray(item.englishOptions) ? item.englishOptions : [];
    const generatedOptions = generated.options && typeof generated.options === "object" ? generated.options : {};
    for (const option of expectedOptions) {
      const text = String(generatedOptions[option.id] ?? generatedOptions[option.key] ?? "").trim();
      if (!text) {
        issues.push({ severity: "error", code: "missing-option", message: `Generated option text is missing for ${option.id}.` });
      }
    }
  }
  issues.push({ severity: "error", code: "ai-review-unavailable", message: reason });

  return {
    qid,
    qualityStatus: "needs_fix",
    confidence: 0,
    answerKeyLogicMayBeWrong: false,
    issues,
    suggestedFix: null,
    reviewerReasoningSummary: "Failed closed because no reliable AI quality review was completed.",
  };
}

function reusableQualityReviews(doc) {
  const out = new Map();
  const reviews = Array.isArray(doc?.items) ? doc.items : [];
  for (const review of reviews) {
    if (!isReusableQualityReview(review)) continue;
    out.set(normalizeQid(review.qid), review);
  }
  return out;
}

function isReusableQualityReview(review) {
  const qid = normalizeQid(review?.qid);
  if (!qid) return false;
  if (!["approved", "needs_fix", "reject"].includes(String(review?.qualityStatus ?? ""))) return false;
  const issueCodes = Array.isArray(review?.issues)
    ? review.issues.map((issue) => String(issue?.code ?? "").toLowerCase())
    : [];
  if (issueCodes.includes("quality-review-pending") || issueCodes.includes("ai-review-unavailable")) {
    return false;
  }
  return !String(review?.reviewerReasoningSummary ?? "").toLowerCase().includes("quality review pending");
}

function normalizeQualityReview(review, item, context, lang) {
  const qid = normalizeQid(review?.qid ?? item?.qid);
  const master = context.masterByQid.get(qid);
  const type = item?.type ?? questionType(master);
  let issues = Array.isArray(review?.issues)
    ? review.issues.map((issue) => ({
        severity: ["info", "warning", "error"].includes(String(issue?.severity ?? "").toLowerCase())
          ? String(issue.severity).toLowerCase()
          : "warning",
        code: String(issue?.code ?? "unspecified").trim() || "unspecified",
        message: String(issue?.message ?? issue ?? "").trim(),
      })).filter((issue) => issue.message)
    : [];

  if (type === "row") {
    issues = issues.filter((issue) => !isMissingOptionIssue(issue));
  }

  const confidence = Math.max(0, Math.min(1, Number(review?.confidence ?? 0)));
  const answerKeyLogicMayBeWrong = review?.answerKeyLogicMayBeWrong === true
    || issues.some((issue) => isAnswerKeyLogicIssue(issue) && issue.severity === "error");
  let qualityStatus = ["approved", "needs_fix", "reject"].includes(review?.qualityStatus)
    ? review.qualityStatus
    : "needs_fix";
  const languageCheck = detectWrongLanguage(generatedLanguageCheckText(item?.generatedTranslation), lang);

  if (languageCheck.wrong && !issues.some((issue) => issue.code === "wrong-language-heuristic")) {
    issues.push({
      severity: "error",
      code: "wrong-language-heuristic",
      message: languageCheck.reason,
    });
  }

  if (languageCheck.wrong) {
    qualityStatus = "reject";
  } else if (answerKeyLogicMayBeWrong) {
    qualityStatus = "reject";
  } else if (confidence < 0.92 && qualityStatus === "approved") {
    qualityStatus = "needs_fix";
    issues.push({
      severity: "warning",
      code: "below-confidence-threshold",
      message: `Confidence ${confidence.toFixed(2)} is below the 0.92 approval threshold.`,
    });
  }

  if (qualityStatus === "approved" && issues.some((issue) => issue.severity === "error")) {
    qualityStatus = "needs_fix";
  }

  return {
    qid,
    number: item?.number ?? master?.number ?? null,
    qualityStatus,
    confidence,
    answerKeyLogicMayBeWrong,
    issues,
    suggestedFix: normalizeSuggestedFix(review?.suggestedFix),
    reviewerReasoningSummary: String(review?.reviewerReasoningSummary ?? "").trim() || "No reasoning summary provided.",
    reviewedAt: new Date().toISOString(),
    reviewer: review?.reviewer ?? "ai-localization-quality-review",
  };
}

function generatedLanguageCheckText(generatedTranslation) {
  const generated = generatedTranslation && typeof generatedTranslation === "object" ? generatedTranslation : {};
  const optionText = generated.options && typeof generated.options === "object"
    ? Object.values(generated.options).join("\n")
    : "";
  return [
    generated.prompt,
    optionText,
    generated.explanation,
  ].map((value) => String(value ?? "").trim()).filter(Boolean).join("\n");
}

function isAnswerKeyLogicIssue(issue) {
  const code = String(issue?.code ?? "").toLowerCase();
  const message = String(issue?.message ?? "").toLowerCase();
  const text = `${code} ${message}`;
  return [
    "answer-key",
    "answer_logic",
    "answer-logic",
    "correct-option",
    "correct_answer",
    "correct-answer",
    "option-key",
    "option-mapping",
    "option mapping",
  ].some((needle) => text.includes(needle));
}

function isMissingOptionIssue(issue) {
  const code = String(issue?.code ?? "").toLowerCase().replaceAll("_", "-");
  const message = String(issue?.message ?? "").toLowerCase();
  return code.includes("missing-option")
    || code.includes("missing-options")
    || code.includes("option-missing")
    || message.includes("options are missing")
    || message.includes("options manquent")
    || message.includes("options sont absentes");
}

function normalizeSuggestedFix(value) {
  if (!value || typeof value !== "object") return null;
  return {
    prompt: typeof value.prompt === "string" ? value.prompt : undefined,
    options: value.options && typeof value.options === "object" ? value.options : undefined,
    explanation: typeof value.explanation === "string" ? value.explanation : undefined,
  };
}

function renderQualityMarkdown(report) {
  const lines = [
    `# Backfill Quality Review (${report.lang})`,
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- AI review used: ${report.aiReviewUsed ? "yes" : "no"}`,
    `- Model: ${report.model ?? "none"}`,
    `- Input items: ${report.counts.inputItems}`,
    `- Approved: ${report.counts.approved}`,
    `- Needs fix: ${report.counts.needsFix}`,
    `- Reject: ${report.counts.reject}`,
    `- Below confidence threshold: ${report.counts.belowConfidenceThreshold}`,
    `- Answer-key logic risk: ${report.counts.answerKeyLogicRisk}`,
    `- Wrong-language heuristic rejects: ${report.counts.wrongLanguageRejects}`,
    `- Production modified: no`,
    "",
    "## Rejected",
    "",
    ...report.items.filter((item) => item.qualityStatus === "reject").map(renderReviewLine),
    "",
    "## Needs Fix",
    "",
    ...report.items.filter((item) => item.qualityStatus === "needs_fix").slice(0, 120).map(renderReviewLine),
    "",
    "## Approved",
    "",
    ...report.items.filter((item) => item.qualityStatus === "approved").map((item) => `- ${item.qid}: confidence ${item.confidence.toFixed(2)}; ${item.reviewerReasoningSummary}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function renderReviewLine(item) {
  const issueText = item.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ") || "no issue details";
  return `- ${item.qid}: ${item.qualityStatus}, confidence ${item.confidence.toFixed(2)}; ${issueText}`;
}

async function readOpenAIKeyFromDotenv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), fileName), "utf8");
      const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Try the next conventional env file.
    }
  }
  return null;
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}. Use a positive integer.`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relative(filePath) {
  return filePath.replace(`${process.cwd()}/`, "");
}
