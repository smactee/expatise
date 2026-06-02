#!/usr/bin/env node

// One-off builder: turns a compact per-screenshot manifest into the full
// intake.json shape the matcher expects, filling in boilerplate fields and
// confidence/extractionStatus per the agent-driven path documented in the
// expatise-qbank-localization skill.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const MANIFEST_PATH = "scripts/es-batch-001-manifest.json";
const OUT_PATH = "imports/es/batch-001/intake.json";
const LANG = "es";
const BATCH = "batch-001";

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

const items = manifest.items.map((entry) => {
  const typeUpper = String(entry.type).toUpperCase();
  const file = `screenshots/${entry.file}`;
  const optionsRaw = (entry.options ?? []).map((opt, idx) => `${String.fromCharCode(65 + idx)} ${opt.es}`);
  const optionsTranslated = (entry.options ?? []).map((opt) => opt.en);
  const correctKeyRaw = entry.correctKey ?? null;
  const correctAnswerRaw = entry.correctAnswer ?? null;
  return {
    itemId: file,
    file,
    sourceImage: file,
    lang: LANG,
    typeHint: typeUpper,
    questionType: typeUpper,
    hasImage: Boolean(entry.hasImage),
    promptRaw: entry.promptEs,
    optionsRaw,
    correctKeyRaw,
    correctAnswerRaw,
    promptTranslated: entry.promptEn,
    translatedPrompt: entry.promptEn,
    optionsTranslated,
    translatedOptions: optionsTranslated,
    correctAnswerTranslated: entry.correctAnswerEn ?? null,
    translatedCorrectAnswer: entry.correctAnswerEn ?? null,
    localizedPrompt: entry.promptEs,
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
    "Low-confidence and visibly-ambiguous items will route to the review-gate.",
  ],
  extractionSummary: { total: items.length, success: items.filter((i) => i.extractionStatus === "success").length },
  items,
};

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`wrote ${OUT_PATH} (${items.length} items)`);
