#!/usr/bin/env node

// Generalized agent-driven intake builder. Turns a compact per-screenshot
// manifest (produced by the agent reading the screenshots) into the full
// intake.json shape the matcher expects, filling in boilerplate fields and
// confidence/extractionStatus per the agent-driven path in the
// expatise-qbank-localization skill.
//
// Usage:
//   node scripts/build-batch-intake-from-manifest.mjs --lang es --batch batch-002 \
//     [--manifest scripts/es-batch-002-manifest.json]
//
// Manifest shape: { "items": [ { file, questionNumber, type, hasImage,
//   promptEs/promptLocalized, promptEn, options:[{es|localized,en}], correctKey,
//   correctAnswer, visualObjectTags, visualColorTags, visualNumberTags,
//   visualLayoutTags, visualNotes, confidence, notes }, ... ] }

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) { args[argv[i].slice(2)] = argv[i + 1]; i += 1; }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const LANG = args.lang;
const BATCH = args.batch;
if (!LANG || !BATCH) {
  throw new Error("Required: --lang <lang> --batch <batch>. Optional: --manifest <path>");
}
const MANIFEST_PATH = args.manifest ?? `scripts/${LANG}-${BATCH}-manifest.json`;
const OUT_PATH = `imports/${LANG}/${BATCH}/intake.json`;

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

// Localized-text field is named per-language in some manifests (promptEs, promptJa…);
// accept a generic `promptLocalized`/`optionsLocalized` too.
function localizedPrompt(entry) {
  return entry.promptLocalized ?? entry.promptEs ?? entry.promptJa ?? entry.promptRaw ?? entry.prompt ?? "";
}
function optionLocalized(opt) {
  return opt.localized ?? opt.es ?? opt.ja ?? opt.raw ?? opt.text ?? "";
}

const items = manifest.items.map((entry) => {
  const typeUpper = String(entry.type).toUpperCase();
  const file = `screenshots/${entry.file}`;
  const optionsRaw = (entry.options ?? []).map((opt, idx) => `${String.fromCharCode(65 + idx)} ${optionLocalized(opt)}`);
  const optionsTranslated = (entry.options ?? []).map((opt) => opt.en);
  return {
    itemId: file,
    file,
    sourceImage: file,
    lang: LANG,
    typeHint: typeUpper,
    questionType: typeUpper,
    hasImage: Boolean(entry.hasImage),
    promptRaw: localizedPrompt(entry),
    optionsRaw,
    correctKeyRaw: entry.correctKey ?? null,
    correctAnswerRaw: entry.correctAnswer ?? null,
    promptTranslated: entry.promptEn,
    translatedPrompt: entry.promptEn,
    optionsTranslated,
    translatedOptions: optionsTranslated,
    correctAnswerTranslated: entry.correctAnswerEn ?? null,
    translatedCorrectAnswer: entry.correctAnswerEn ?? null,
    localizedPrompt: localizedPrompt(entry),
    localizedOptions: optionsRaw,
    localizedCorrectAnswer: entry.correctAnswer ?? null,
    localizedExplanation: "",
    productionAssetHints: [],
    topicHints: [],
    visualObjectTags: entry.visualObjectTags ?? [],
    visualColorTags: entry.visualColorTags ?? [],
    visualNumberTags: entry.visualNumberTags ?? [],
    visualLayoutTags: entry.visualLayoutTags ?? [],
    visualEvidenceNotes: entry.visualNotes ? [entry.visualNotes] : [],
    extractionStatus: entry.status ?? "success",
    extractionConfidence: entry.confidence ?? 0.9,
    manualReview: Boolean(entry.manualReview),
    notes: entry.notes ?? "",
    extractionNotes: entry.extractionNotes ?? "",
  };
});

const doc = {
  lang: LANG,
  batchId: BATCH,
  dataset: "2023-test1",
  createdAt: new Date().toISOString(),
  extractionRunAt: new Date().toISOString(),
  extractionModel: "claude-code-agent-driven",
  extractionSourceDir: `imports/${LANG}/${BATCH}/screenshots`,
  extractionNotes: [
    "Agent-driven extraction (Claude Code reading the screenshots directly — no OpenAI/Anthropic API call).",
    "Mandatory tag-agreement checklist applied for image-dependent items per .claude/skills/expatise-qbank-localization/SKILL.md.",
    "Low-confidence and visibly-ambiguous items route to the review-gate.",
  ],
  extractionSummary: { total: items.length, success: items.filter((i) => i.extractionStatus === "success").length },
  items,
};

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`wrote ${OUT_PATH} (${items.length} items)`);
