import fs from "fs";
import path from "path";

const filePath = path.join(
  process.cwd(),
  "public",
  "qbank",
  "2023-test1",
  "questions.json"
);

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

const updatedQuestions = questions.map((q) => {
  if (!q || typeof q !== "object") return q;

  // only add if missing
  if (!("explanation" in q)) {
    return { ...q, explanation: "" };
  }
  return q;
});

const updatedData = isArray ? updatedQuestions : { ...data, questions: updatedQuestions };

fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2) + "\n", "utf8");
console.log(`✅ Added explanation field where missing. Updated ${updatedQuestions.length} questions.`);
console.log(`📄 ${filePath}`);
