#!/usr/bin/env npx tsx

// Run the same topic/subtopic classifier the app uses (deriveTopicSubtags) on
// every master qid, and write the result to a small JSON map the matcher reads.
// This gives the matcher a single, authoritative topic/subtopic per qid that is
// kept in sync with the app's classifier, without porting the .ts rules into .mjs.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { deriveTopicSubtags } from "../lib/qbank/deriveTopicSubtags";

const QUESTIONS_PATH = "public/qbank/2023-test1/questions.json";
const TAGS_PATCH_PATH = "public/qbank/2023-test1/tags.patch.json";
const OUT_PATH = "qbank-tools/history/qid-topics.json";

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

interface MasterQuestion {
  id: string;
  type?: string;
  prompt?: string;
  options?: Array<{ id?: string; originalKey?: string; text?: string }>;
  tags?: { auto?: string[]; user?: string[]; suggested?: Array<{ tag: string }> };
}

const questionsDoc = loadJson<MasterQuestion[] | { questions?: MasterQuestion[] }>(QUESTIONS_PATH);
const questions: MasterQuestion[] = Array.isArray(questionsDoc) ? questionsDoc : (questionsDoc.questions ?? []);
const tagsPatch = loadJson<Record<string, string[]>>(TAGS_PATCH_PATH);

const byQid: Record<string, { topic: string | null; subtopics: string[] }> = {};
let withTopic = 0;
let withSubtopic = 0;

for (const q of questions) {
  // Feed the classifier the same shape it expects: explicit tags first (user/patch),
  // auto tags second, plus prompt+options for keyword fallback.
  const explicit = tagsPatch[q.id] ?? [];
  const auto = q.tags?.auto ?? [];
  const item = {
    ...q,
    tags: explicit,
    autoTags: auto,
    sourcePrompt: q.prompt,
    sourceOptions: q.options,
  };
  const derived = deriveTopicSubtags(item as any);
  const topic = derived[0] ?? null;
  const subtopics = derived.filter((d: string) => d.includes(":"));
  byQid[q.id] = { topic, subtopics };
  if (topic) withTopic += 1;
  if (subtopics.length > 0) withSubtopic += 1;
}

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
const out = {
  generatedAt: new Date().toISOString(),
  sourceQuestionsPath: QUESTIONS_PATH,
  sourceTagsPatchPath: TAGS_PATCH_PATH,
  classifier: "lib/qbank/deriveTopicSubtags",
  counts: { total: questions.length, withTopic, withSubtopic },
  byQid,
};
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

console.log(`classified ${questions.length} qids: topic=${withTopic}, subtopic=${withSubtopic}`);
console.log(`wrote ${OUT_PATH}`);
