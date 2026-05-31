#!/usr/bin/env node

// Leave-one-language-out validation for the topic-narrowing accuracy lever.
//
// We simulate the source language (default fr) as a FRESH language by deleting
// its own stored translation from every candidate. We then run matching twice
// on the SAME French sample — toggle OFF (baseline) vs ON (with-signal) — and
// grade against the recorded human-approved qid.
//
// We additionally inject a source-side topic via deriveTopicSubtags applied to
// the intake's translated English prompt + options, mimicking what an agent
// would write into intake.provisionalTopic (this is the closest fair proxy we
// can do without an agent-in-the-loop run on every item).
//
// Usage: node scripts/validate-topic-narrowing.mjs [--lang fr] [--n 60] [--seed 7]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync as readFileSyncTmp } from "node:fs";

import {
  loadQbankContext,
  buildQidFeatureStore,
  buildMatchIndex,
  processBatchAgainstIndex,
  setTopicNarrowingEnabled,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs(process.argv.slice(2));
const SRC = (args.lang ?? "fr").toLowerCase();
const N = Number(args.n ?? 60);
const SEED = Number(args.seed ?? 7);
const BUNDLE = "qbank-tools/history/fr-decision-bundle-20260515T164028+0900/files";

main();

function main() {
  const context = loadQbankContext({ referenceLang: "ko" });
  const featureStore = buildQidFeatureStore(context);
  const matchIndex = buildMatchIndex(context, { featureStore });
  const typeByQid = new Map(matchIndex.questions.map((q) => [q.qid, q.type]));

  // Suppress the source language's own stored translation on every candidate.
  let suppressed = 0;
  for (const q of matchIndex.questions) {
    if (q.translations && q.translations[SRC]) {
      delete q.translations[SRC];
      suppressed += 1;
    }
  }

  const groundTruth = loadGroundTruth(SRC);
  const intakeItems = loadIntake(SRC);

  // Filter to items with a known approvedQid and usable text.
  const usable = intakeItems.filter((it) => {
    const key = baseName(it.itemId ?? it.sourceImage);
    const gt = groundTruth.get(key);
    return gt && (it.translatedPrompt || it.promptTranslated || it.translatedOptions?.length);
  });

  // Inject classifier-derived provisionalTopic into each intake item, as a
  // proxy for what an agent would write (per the skill's intake guidance).
  // We invoke the .ts classifier via tsx in one batch call to keep this fast.
  const sourceTopics = classifySourceTopics(usable);
  for (const it of usable) {
    const key = baseName(it.itemId ?? it.sourceImage);
    const t = sourceTopics.get(key);
    if (t?.topic) {
      it.provisionalTopic = t.topic;
      it.provisionalSubtopics = t.subtopics;
      // mark high but not absolute, so confidence-gated thresholds are exercised
      it.topicConfidence = 0.85;
    }
  }

  const nearDup = nearDuplicateRowQids(matchIndex.questions);
  const sample = sampleItems(usable, groundTruth, nearDup, N, SEED);

  console.log(`source lang: ${SRC} | suppressed same-language translations on ${suppressed} candidates`);
  console.log(`usable pool: ${usable.length} | sampling: ${sample.length} (near-dup-qid items prioritized)`);
  console.log(`source-topic injection: ${sample.filter((it) => it.provisionalTopic).length}/${sample.length} items`);
  console.log();

  const baseline = runMatcher(sample, matchIndex, false);
  const withSignal = runMatcher(sample, matchIndex, true);

  reportResults("ALL", sample, groundTruth, baseline, withSignal);
  reportResults("ROW", sample.filter((it) => typeByQid.get(groundTruth.get(baseName(it.itemId ?? it.sourceImage))) === "ROW"), groundTruth, baseline, withSignal);
  reportResults("MCQ", sample.filter((it) => typeByQid.get(groundTruth.get(baseName(it.itemId ?? it.sourceImage))) === "MCQ"), groundTruth, baseline, withSignal);
}

function reportResults(label, sample, gt, baseline, withSignal) {
  if (sample.length === 0) return;
  let baseCorrect = 0, withCorrect = 0, baseInTop8 = 0, withInTop8 = 0;
  let fixed = 0, broke = 0;
  for (const it of sample) {
    const key = baseName(it.itemId ?? it.sourceImage);
    const want = gt.get(key);
    const b = baseline.get(key);
    const w = withSignal.get(key);
    const bOk = b?.top1 === want;
    const wOk = w?.top1 === want;
    if (bOk) baseCorrect += 1;
    if (wOk) withCorrect += 1;
    if (b?.topQids?.includes(want)) baseInTop8 += 1;
    if (w?.topQids?.includes(want)) withInTop8 += 1;
    if (!bOk && wOk) fixed += 1;
    if (bOk && !wOk) broke += 1;
  }
  const n = sample.length;
  console.log(`=== ${label} (n=${n}) ===`);
  console.log(`  top-1 qid:   baseline ${baseCorrect}/${n} (${pct(baseCorrect, n)})  with-signal ${withCorrect}/${n} (${pct(withCorrect, n)})  delta ${withCorrect - baseCorrect}  (fixed ${fixed}, broke ${broke})`);
  console.log(`  recall@8:    baseline ${baseInTop8}/${n} (${pct(baseInTop8, n)})  with-signal ${withInTop8}/${n} (${pct(withInTop8, n)})  delta ${withInTop8 - baseInTop8}`);
  console.log();
}

function runMatcher(items, matchIndex, enabled) {
  setTopicNarrowingEnabled(enabled);
  const res = processBatchAgainstIndex({ items, meta: { lang: SRC } }, matchIndex, { sourceLang: SRC, candidateLimit: 8 });
  const out = new Map();
  for (const [bucket, list] of [["matched", res.matched], ["reviewNeeded", res.reviewNeeded], ["unresolved", res.unresolved]]) {
    for (const r of list ?? []) {
      const cands = r.topCandidates ?? [];
      out.set(baseName(r.itemId ?? r.sourceImage), {
        top1: cands[0]?.qid ?? null,
        topQids: cands.map((c) => c.qid),
        bucket,
      });
    }
  }
  return out;
}

function classifySourceTopics(items) {
  // Call the TS classifier via tsx in a single child process for speed. Input
  // is a JSON array of {itemId, prompt, options}, output is {itemId: {topic, subtopics}}.
  const payload = items.map((it) => ({
    itemId: baseName(it.itemId ?? it.sourceImage),
    prompt: it.translatedPrompt ?? it.promptTranslated ?? "",
    options: (it.translatedOptions ?? []).map((text, index) => ({ id: `o${index}`, text })),
  }));
  const tmp = ".tmp-classify-input.json";
  const out = ".tmp-classify-output.json";
  const scriptPath = ".tmp-classify-runner.ts";
  writeFileSync(tmp, JSON.stringify(payload));
  const scriptBody = `
    import {readFileSync, writeFileSync} from "node:fs";
    import {deriveTopicSubtags} from "./lib/qbank/deriveTopicSubtags";
    const inp = JSON.parse(readFileSync("${tmp}", "utf8"));
    const out: Record<string, {topic: string|null, subtopics: string[]}> = {};
    for (const it of inp) {
      const derived = deriveTopicSubtags({ id: it.itemId, prompt: it.prompt, sourcePrompt: it.prompt, options: it.options, sourceOptions: it.options, tags: [], autoTags: [] } as any);
      const topic = derived[0] ?? null;
      const subtopics = derived.filter((d: string) => d.includes(":"));
      out[it.itemId] = { topic, subtopics };
    }
    writeFileSync("${out}", JSON.stringify(out));
  `.replace(/^\s+/gm, "");
  writeFileSync(scriptPath, scriptBody);
  try {
    execFileSync("npx", ["tsx", scriptPath], { stdio: "ignore" });
    const parsed = JSON.parse(readFileSyncTmp(out, "utf8"));
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.warn("source-topic classifier failed, continuing without injection:", error.message);
    return new Map();
  } finally {
    for (const f of [tmp, out, scriptPath]) try { unlinkSync(f); } catch {}
  }
}

function sampleItems(pool, gt, nearDup, n, seed) {
  const prio = [], rest = [];
  for (const it of pool) {
    const q = gt.get(baseName(it.itemId ?? it.sourceImage));
    (nearDup.has(q) ? prio : rest).push(it);
  }
  const rng = mulberry(seed);
  shuffle(prio, rng); shuffle(rest, rng);
  return [...prio, ...rest].slice(0, n);
}

function nearDuplicateRowQids(questions) {
  const rows = questions.filter((q) => q.type === "ROW");
  const stop = new Set(["should", "when", "driver", "vehicle", "this", "that", "with", "while", "from", "they", "their", "there", "which", "what", "have"]);
  const sig = (q) => new Set(String(q.prompt ?? q.sourcePrompt ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !stop.has(w)));
  const sigs = rows.map((q) => ({ qid: q.qid, s: sig(q) }));
  const out = new Set();
  for (let i = 0; i < sigs.length; i += 1) {
    for (let j = i + 1; j < sigs.length; j += 1) {
      const a = sigs[i].s, b = sigs[j].s;
      if (a.size < 4 || b.size < 4) continue;
      let inter = 0;
      for (const x of a) if (b.has(x)) inter += 1;
      if (inter / (a.size + b.size - inter) >= 0.6) { out.add(sigs[i].qid); out.add(sigs[j].qid); }
    }
  }
  return out;
}

function loadGroundTruth(lang) {
  const dir = "qbank-tools/history/decisions";
  const gt = new Map();
  for (const f of readdirSync(dir).filter((f) => new RegExp(`^${lang}-batch-.*-workbench-decisions\\.json$`).test(f))) {
    const d = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    for (const it of d.items ?? []) if (it.itemId && it.approvedQid) gt.set(baseName(it.itemId), it.approvedQid);
  }
  return gt;
}

function loadIntake(lang) {
  const base = path.join(BUNDLE, "imports", lang);
  const items = [];
  if (!existsSync(base)) return items;
  for (const batch of readdirSync(base)) {
    const f = path.join(base, batch, "intake.json");
    if (existsSync(f)) {
      const d = JSON.parse(readFileSync(f, "utf8"));
      for (const it of d.items ?? d) items.push(it);
    }
  }
  return items;
}

function baseName(p) { return String(p ?? "").replace(/^screenshots\//, ""); }
function pct(a, b) { return b ? `${((a / b) * 100).toFixed(1)}%` : "0%"; }
function mulberry(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
function parseArgs(argv) { const a = {}; for (let i = 0; i < argv.length; i += 1) { if (argv[i].startsWith("--")) { a[argv[i].slice(2)] = argv[i + 1]; i += 1; } } return a; }
