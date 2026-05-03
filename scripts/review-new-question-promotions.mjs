#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  loadDecisionMemory,
  loadMasterQuestions,
  loadNewQuestionCandidates,
  reviewNewQuestionCandidates,
} from "../qbank-tools/lib/new-question-promotion-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");

const args = parseArgs();
const lang = normalizeLang(args.lang ?? "ru");
const batch = args.batch ? String(args.batch).trim() : null;
const input = args.input ? path.resolve(String(args.input)) : null;
const limit = parseLimit(args.limit);
const strict = booleanArg(args, "strict", false);
const dataset = String(args.dataset ?? "2023-test1").trim() || "2023-test1";

const inputPaths = input ? [input] : discoverCandidateFiles({ lang, batch });
const master = loadMasterQuestions({ root: ROOT, dataset });
const memory = loadDecisionMemory({ root: ROOT });
const candidates = loadNewQuestionCandidates(inputPaths, { lang, batch });
const reviewedItems = reviewNewQuestionCandidates({
  candidates,
  masterQuestions: master.questions,
  decisionMemory: memory.records,
  limit,
});
const scoped = batch ?? "all";
const jsonPath = path.join(REPORTS_DIR, `new-question-promotion-review.${lang}.${scoped}.json`);
const mdPath = path.join(REPORTS_DIR, `new-question-promotion-review.${lang}.${scoped}.md`);

const counts = {
  inputFiles: inputPaths.length,
  candidatesDiscovered: candidates.length,
  candidatesReviewed: reviewedItems.length,
  likely_duplicate: reviewedItems.filter((item) => item.recommendation === "likely_duplicate").length,
  needs_human_review: reviewedItems.filter((item) => item.recommendation === "needs_human_review").length,
  safe_to_promote: reviewedItems.filter((item) => item.recommendation === "safe_to_promote").length,
};

const report = {
  generatedAt: new Date().toISOString(),
  lang,
  batch,
  dataset,
  strict,
  sourcePaths: {
    masterQuestions: path.relative(ROOT, master.questionsPath),
    imageColorTags: path.relative(ROOT, master.imageTagsPath),
    decisionMemory: path.relative(ROOT, memory.memoryPath),
    inputs: inputPaths.map((filePath) => path.relative(ROOT, filePath)),
  },
  counts,
  items: reviewedItems,
};

await fsp.mkdir(REPORTS_DIR, { recursive: true });
await fsp.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await fsp.writeFile(mdPath, renderMarkdown(report));

console.log(`Wrote ${path.relative(ROOT, jsonPath)}`);
console.log(`Wrote ${path.relative(ROOT, mdPath)}`);
console.log(`Candidates reviewed: ${counts.candidatesReviewed}`);
console.log(`likely_duplicate: ${counts.likely_duplicate}`);
console.log(`needs_human_review: ${counts.needs_human_review}`);
console.log(`safe_to_promote: ${counts.safe_to_promote}`);

if (strict && counts.likely_duplicate > 0) {
  process.exitCode = 1;
}

function discoverCandidateFiles({ lang, batch }) {
  const exactNames = batch
    ? [
        path.join(ROOT, "qbank-tools", "generated", "staging", `new-question-candidates.${lang}.${batch}.json`),
        path.join(ROOT, "qbank-tools", "history", "decisions", `new-question-candidates.${lang}.${batch}.json`),
      ]
    : [];
  const globbed = [
    ...findFiles(path.join(ROOT, "qbank-tools", "generated", "staging")),
    ...findFiles(path.join(ROOT, "qbank-tools", "history", "decisions")),
  ].filter((filePath) => {
    const name = path.basename(filePath).toLowerCase();
    if (!name.includes("new-question-candidates")) return false;
    if (!name.includes(lang.toLowerCase())) return false;
    if (batch && !name.includes(batch.toLowerCase())) return false;
    return true;
  });
  return [...new Set([...exactNames, ...globbed].filter((filePath) => fs.existsSync(filePath)))].sort();
}

function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(filePath));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(filePath);
  }
  return out;
}

function renderMarkdown(data) {
  const lines = [];
  lines.push(`# New Question Promotion Review: ${data.lang}${data.batch ? ` ${data.batch}` : ""}`, "");
  lines.push(`Generated: ${data.generatedAt}`, "");
  lines.push("## Executive Summary", "");
  lines.push(`- Candidate files: ${data.counts.inputFiles}`);
  lines.push(`- Candidates discovered: ${data.counts.candidatesDiscovered}`);
  lines.push(`- Candidates reviewed: ${data.counts.candidatesReviewed}`);
  lines.push(`- likely_duplicate: ${data.counts.likely_duplicate}`);
  lines.push(`- needs_human_review: ${data.counts.needs_human_review}`);
  lines.push(`- safe_to_promote: ${data.counts.safe_to_promote}`);
  lines.push("");
  lines.push("## High-Risk Likely Duplicates", "");
  const likelyDuplicates = data.items.filter((item) => item.recommendation === "likely_duplicate");
  lines.push(...table(likelyDuplicates.map(summaryRow), ["candidateId", "batch", "risk", "topMatch", "score", "reason", "action"]));
  lines.push("");
  lines.push("## Candidates Needing Human Review", "");
  const humanReview = data.items.filter((item) => item.recommendation === "needs_human_review");
  lines.push(...table(humanReview.map(summaryRow), ["candidateId", "batch", "risk", "topMatch", "score", "reason", "action"]));
  lines.push("");
  lines.push("## Candidates Safe To Promote", "");
  const safe = data.items.filter((item) => item.recommendation === "safe_to_promote");
  lines.push(...table(safe.map(summaryRow), ["candidateId", "batch", "risk", "topMatch", "score", "reason", "action"]));
  lines.push("");
  lines.push("## Top Duplicate Evidence", "");
  for (const item of data.items.filter((entry) => entry.topMatches.length > 0).slice(0, 30)) {
    const top = item.topMatches[0];
    lines.push(`- ${item.candidateId}: ${top.qid} score ${top.score}; ${top.reasonCodes.join(", ")}`);
  }
  if (!data.items.some((entry) => entry.topMatches.length > 0)) lines.push("None.");
  lines.push("");
  lines.push("## Next Recommended Action", "");
  if (data.counts.likely_duplicate > 0) {
    lines.push("- Reject likely duplicates or attach them to existing qids; do not prepare promotion preview until resolved.");
  } else if (data.counts.needs_human_review > 0) {
    lines.push("- Inspect medium/low-risk candidates manually before preparing promotion preview.");
  } else {
    lines.push("- Candidates marked safe can proceed to a human-reviewed promotion preview. Do not edit `questions.json` directly.");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summaryRow(item) {
  const top = item.topMatches[0] ?? {};
  return {
    candidateId: item.candidateId,
    batch: item.batch ?? "",
    risk: item.risk,
    topMatch: top.qid ?? "",
    score: top.score ?? "",
    reason: item.reasoningSummary,
    action: item.requiredHumanAction,
  };
}

function table(rows, columns) {
  if (!rows.length) return ["None."];
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escape(row[column])).join(" | ")} |`),
  ];
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

function parseLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error(`Invalid --limit value: ${value}`);
  return limit;
}

function normalizeLang(value) {
  return String(value ?? "").trim().toLowerCase() || "ru";
}
