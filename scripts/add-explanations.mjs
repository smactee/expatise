import fs from "fs";
import path from "path";

const args = parseArgs();
const apply = booleanArg(args, "apply", false);
const allowDangerousProductionEdit = booleanArg(args, "allow-dangerous-production-edit", false);
const productionWriteAllowed = apply && allowDangerousProductionEdit;
const filePath = path.join(
  process.cwd(),
  "public",
  "qbank",
  "2023-test1",
  "questions.json"
);
const reportJsonPath = path.join(process.cwd(), "qbank-tools", "generated", "reports", "add-explanations-report.json");
const reportMdPath = path.join(process.cwd(), "qbank-tools", "generated", "reports", "add-explanations-report.md");

const raw = fs.readFileSync(filePath, "utf8");
const data = JSON.parse(raw);

// Supports either:
// 1) Array format: [ {..}, {..} ]
// 2) Object format: { questions: [ {..}, {..} ] }
const isArray = Array.isArray(data);
const questions = isArray ? data : data?.questions;

if (!Array.isArray(questions)) {
  throw new Error(
    "Expected an array of questions. Either make the JSON an array, or use { questions: [...] }"
  );
}

let addedExplanationCount = 0;
const updatedQuestions = questions.map((q) => {
  if (!q || typeof q !== "object") return q;

  // only add if missing
  if (!("explanation" in q)) {
    addedExplanationCount += 1;
    return { ...q, explanation: "" };
  }
  return q;
});

const updatedData = isArray ? updatedQuestions : { ...data, questions: updatedQuestions };

const report = {
  generatedAt: new Date().toISOString(),
  script: "scripts/add-explanations.mjs",
  mode: productionWriteAllowed ? "apply" : "dry-run",
  productionPath: path.relative(process.cwd(), filePath),
  applyRequested: apply,
  dangerousProductionEditAllowed: allowDangerousProductionEdit,
  productionWriteAllowed,
  productionModified: false,
  questionCount: updatedQuestions.length,
  addedExplanationCount,
  requiredFlags: [
    "--apply true",
    "--allow-dangerous-production-edit true",
  ],
};

if (addedExplanationCount > 0 && productionWriteAllowed) {
  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2) + "\n", "utf8");
  report.productionModified = true;
} else if (addedExplanationCount > 0) {
  report.blockedProductionWrite = true;
  report.message = "Dry-run only. Production questions.json was not modified. Re-run with --apply true --allow-dangerous-production-edit true to write changes.";
}

writeReport(report);

if (report.productionModified) {
  console.log(`Added explanation field where missing. Updated ${addedExplanationCount} question(s).`);
  console.log(`Production file modified: ${filePath}`);
} else {
  console.log("Dry-run/no-op: production questions.json was not modified.");
  console.log("Required flags to modify production: --apply true --allow-dangerous-production-edit true");
  console.log(`Questions that would receive explanation: ${addedExplanationCount}`);
}
console.log(`Report: ${path.relative(process.cwd(), reportJsonPath)}`);

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    index += 1;
  }
  return out;
}

function booleanArg(parsedArgs, key, fallback = false) {
  if (!(key in parsedArgs)) return fallback;
  const value = parsedArgs[key];
  if (value === true) return true;
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function writeReport(reportValue) {
  fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(reportValue, null, 2)}\n`, "utf8");
  fs.writeFileSync(reportMdPath, renderMarkdown(reportValue), "utf8");
}

function renderMarkdown(reportValue) {
  return [
    "# Add Explanations Report",
    "",
    `Generated: ${reportValue.generatedAt}`,
    `Mode: ${reportValue.mode}`,
    `Production modified: ${reportValue.productionModified ? "yes" : "no"}`,
    `Questions scanned: ${reportValue.questionCount}`,
    `Explanation fields to add: ${reportValue.addedExplanationCount}`,
    "",
    "Required production flags:",
    "- --apply true",
    "- --allow-dangerous-production-edit true",
    "",
  ].join("\n");
}
