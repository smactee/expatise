// scripts/postprocess-qbank.mjs
import fs from "node:fs";
import path from "node:path";
import {
  RANGE_RULES,
  inRange,
  suggestTagsForText,
} from "./tag-dictionary.mjs";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : null;
  };
  const bool = (k) => {
    const value = get(k);
    if (value === null) return a.includes(k);
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
  };
  return {
    input: get("--in"),
    output: get("--out"),
    apply: bool("--apply"),
    allowDangerousProductionEdit: bool("--allow-dangerous-production-edit"),
  };
}

function autoRangeTags(number) {
  const out = [];
  for (const r of RANGE_RULES) {
    if (inRange(number, r)) out.push(...(r.add || []));
  }
  return Array.from(new Set(out));
}

function buildSearchText(q) {
  const parts = [q.prompt];
  if (q.type === "mcq") {
    for (const o of q.options || []) parts.push(o.text);
  }
  return parts.join(" ");
}

const { input, output, apply, allowDangerousProductionEdit } = parseArgs();
if (!input || !output) {
  console.error("Usage: node scripts/postprocess-qbank.mjs --in <questions.raw.json> --out <questions.json> [--apply true --allow-dangerous-production-edit true]");
  process.exit(1);
}

const raw = readJson(input);
const questions = raw.questions || [];

const processed = questions.map((q) => {
  const auto = new Set();

  // structural tags (always)
  auto.add(q.type === "mcq" ? "#mcq" : "#row");
  if ((q.assets || []).length > 0) auto.add("#pic");

  // range-based topic tags
  for (const t of autoRangeTags(q.number)) auto.add(t);

  // dictionary suggestions (NOT auto-applied; shown to you later)
  const text = buildSearchText(q);
  const suggested = suggestTagsForText(text, { maxTags: 6 });

  return {
    ...q,
    tags: {
      auto: Array.from(auto),
      user: [],                  // you’ll fill later
      suggested: suggested,       // [{tag, score}]
    }
  };
});

const out = {
  meta: raw.meta,
  questions: processed,
};

const productionWriteAllowed = apply && allowDangerousProductionEdit;
const reportJsonPath = path.join(process.cwd(), "qbank-tools", "generated", "reports", "postprocess-qbank-report.json");
const reportMdPath = path.join(process.cwd(), "qbank-tools", "generated", "reports", "postprocess-qbank-report.md");
const report = {
  generatedAt: new Date().toISOString(),
  script: "scripts/postprocess-qbank.mjs",
  mode: productionWriteAllowed ? "apply" : "dry-run",
  input,
  output,
  applyRequested: apply,
  dangerousProductionEditAllowed: allowDangerousProductionEdit,
  productionWriteAllowed,
  productionModified: false,
  processedQuestionCount: processed.length,
  requiredFlags: [
    "--apply true",
    "--allow-dangerous-production-edit true",
  ],
};

if (productionWriteAllowed) {
  writeJson(output, out);
  report.productionModified = true;
} else {
  report.blockedOutputWrite = true;
  report.message = "Dry-run only. Output was not written. Re-run with --apply true --allow-dangerous-production-edit true to write changes.";
}

writeJson(reportJsonPath, report);
fs.writeFileSync(reportMdPath, renderMarkdown(report), "utf-8");

if (report.productionModified) {
  console.log(`Postprocessed ${processed.length} questions -> ${output}`);
} else {
  console.log("Dry-run/no-op: output was not written.");
  console.log("Required flags to write output: --apply true --allow-dangerous-production-edit true");
  console.log(`Questions that would be postprocessed: ${processed.length}`);
}
console.log(`Report: ${path.relative(process.cwd(), reportJsonPath)}`);

function renderMarkdown(reportValue) {
  return [
    "# Postprocess QBank Report",
    "",
    `Generated: ${reportValue.generatedAt}`,
    `Mode: ${reportValue.mode}`,
    `Input: ${reportValue.input}`,
    `Output: ${reportValue.output}`,
    `Output written: ${reportValue.productionModified ? "yes" : "no"}`,
    `Questions processed: ${reportValue.processedQuestionCount}`,
    "",
    "Required output flags:",
    "- --apply true",
    "- --allow-dangerous-production-edit true",
    "",
  ].join("\n");
}
