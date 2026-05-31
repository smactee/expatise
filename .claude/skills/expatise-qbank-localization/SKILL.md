---
name: expatise-qbank-localization
description: >-
  Pick up and run the Expatise question-bank localization pipeline — matching a
  new language's screenshot questions to the English master qbank, marking
  answer keys, categorizing, linking image assets, and merging into the app.
  Use this skill whenever the work touches the Expatise qbank: processing a
  screenshot batch, matching/categorizing localized questions, reviewing a
  workbench, applying batch decisions, the decision-memory or correction-rules
  feedback loop, the new-question promotion gate, or finalizing/shipping a
  language. Trigger it even when the user just names a language ("let's start
  Korean batch 4", "continue the French run", "process the Russian screenshots")
  or refers to qids, master questions, intake.json, workbench-decisions, or the
  qbank-tools scripts — don't try to reconstruct this workflow from scratch.
---

# Expatise QBank Localization

## What this is

Expatise is a Next.js + Capacitor Android app (live on Google Play) that helps
foreigners pass the Chinese driving-license test. The **English question bank is
the master**; every other language is localized by mapping its questions onto
that master so it reuses the same answer keys, categories, and image assets.

The owner works in **batches of ~50 questions captured as screenshots**. Your job
when this skill triggers is to drive the existing `qbank-tools/` pipeline (≈30 npm
scripts) correctly — **not** to invent a new approach. The pipeline is mature and
non-destructive by design; respect that.

**Mental model of one question's journey:**

```
screenshot → intake.json (OCR) → matcher proposes master qid(s)
   → workbench (human + Codex review) → decisions → apply (dry-run merge)
   → production translations.<lang>.json → decision memory
```

## Orient yourself first

Before doing anything, read these — they are the source of truth and stay more
current than this skill:

- `qbank-tools/README.md` — the full command catalog and per-step notes. **This
  is your primary reference.** This skill is the map; the README is the terrain.
- `qbank-tools/PROTECTED_FILES.md` — what you may and may not edit. Read it before
  any write.
- `qbank-tools/history/decision-memory.md` — human-readable summary of every past
  decision, high-risk qids, and reusable matching lessons.

Then take stock of the current run:

```bash
git -C /Users/huni/dev-projects/expatise log --oneline -10   # what was last done
ls imports/                                                  # which languages exist
ls imports/<lang>/                                           # which batches exist
```

The most recent git commits tell you which language/batch is in flight. Continue
from there rather than guessing.

**If no batch is staged** (no `imports/<lang>/<batch>/screenshots/` waiting to be
processed), do not invent one. "Continue the work" might mean committing in-flight
tooling, finishing a half-done language, or starting a fresh batch the user is about
to drop screenshots for — confirm the scope with the user before acting. Also check
`git status --short` for uncommitted work that *is* the thing in flight.

## The canonical per-batch workflow

Run these in order for a batch (example: Japanese, batch-003). Confirm the lang
and batch with the user if it's ambiguous.

```bash
# 0. Fold ALL prior decisions into the matcher BEFORE matching this batch.
#    This is what makes each batch smarter than the last — never skip it.
npm run refresh-correction-rules
```

### Step 1 — Extraction: prefer agent-driven (zero extra cost)

The owner is on Claude Code and migrating off OpenAI. The **primary** way to extract
screenshots → `intake.json` is to do it agent-driven: you (Claude) read the screenshot
images directly with the Read tool and write `imports/<lang>/<batch>/intake.json` in the
exact shape `process-screenshot-batch` consumes. This runs inside the user's Claude Code
subscription with no API key, no per-token bill, and no separate vision model — and
proven on a 5-item French sample (2026-05-30) it produced 5/5 correct answer keys and
matched the locale option ordering directly (no answer-key letter-portability problem,
because you read the displayed French letters live).

Per-item shape to write (matches `intake.json` from the existing extractor — see a
recent `imports/<lang>/batch-*/intake.json` or `scripts/extract-screenshot-intake.mjs`
for the full field list):

```
{
  "itemId": "screenshots/<filename>", "file": "...", "sourceImage": "...",
  "lang": "<lang>", "typeHint": "row"|"mcq", "questionType": "row"|"mcq",
  "hasImage": true|false,
  "promptRaw": "<source-language prompt as displayed>",
  "optionsRaw": ["<A text>", "<B text>", ...],          // [] for ROW
  "correctKeyRaw": "A"|"B"|"C"|"D"|"R"|"W"|null,        // only if visibly selected
  "correctAnswerRaw": "<text>"|null,
  "promptTranslated": "<English gloss>", "translatedPrompt": "<same>",
  "optionsTranslated": ["<English A>", ...], "translatedOptions": [...],
  "correctAnswerTranslated": "<English>"|null,
  "visualObjectTags": [...], "visualColorTags": [...], "visualNumberTags": [...],
  "visualLayoutTags": [...], "visualEvidenceNotes": "...",
  "extractionStatus": "ok"|"partial"|"failed", "extractionConfidence": 0..1,
  "manualReview": false|true, "notes": "...", "extractionNotes": "..."
}
```

After writing the intake, continue with the normal pipeline below
(`validate-screenshot-intake` → `process-screenshot-batch` → workbench). The agent-driven
path replaces *only* the OpenAI vision call; everything downstream is unchanged.

#### Image-dependent items: MANDATORY tag-agreement checklist

Validated on a 20-screenshot French sample (2026-05-31): every wrong match on an
image-dependent question was caused by skipping this step. Text alone can't tell apart
"What's the meaning of this sign?" qids — that's the whole point of the image.

**Hard rule.** For any screenshot whose answer hinges on the embedded image (sign
questions, dashboard indicators, road-scene MCQs, intersection POV diagrams), you may
**not** name a qid until every step below has been completed. If you skip any step, the
match is invalid and must be redone.

```
TAG-AGREEMENT CHECKLIST — image-dependent items
[ ] 1. visualObjectTags written into intake (specific: e.g. arrow,triangle,downhill,slope)
[ ] 2. visualColorTags written into intake
[ ] 3. visualNumberTags / visualLayoutTags written into intake when applicable
[ ] 4. Lexical shortlist of candidate qids built (~top 8)
[ ] 5. For each candidate, fetched stored tags from image-color-tags.json
       AND features.imageObjectTags / features.imageColorTags in qid-feature-store.json
[ ] 6. Scored each candidate by tag overlap: objectTag matches × 2 + colorTag matches × 1
[ ] 7. Picked the highest tag-agreement candidate (not the highest text-overlap one)
[ ] 8. Sanity-checked: does the picked qid's stored master image actually show what the
       screenshot shows? (Read the master image file if any ambiguity remains.)
```

As of 2026-05-31, **all 498 image-bearing master qids have real tags** (zero
`needs-tag-review` placeholders), so step 5 always returns useful evidence — there is no
excuse to skip this checklist for an image question.

Worked example (real miss that this would have prevented): a yellow triangular warning sign
with a downward arrow on a slope ranked q0928 #1 by tag overlap (score 12:
`arrow,downhill,slope,yellow-arrow,triangle` + `yellow,black`). Text-alone matching picked
q0748 (a different sign whose tags were placeholders) — wrong.

If you ever find a qid that *still* has `needs-tag-review`, append the inferred tags to
`image-color-tags.json` (additive only — see `PROTECTED_FILES.md`) so future batches
benefit, and re-run the checklist.

#### MANDATORY review-gate: don't auto-stage anything the system already doubts

The matcher and the agent both produce honest signals when a match is uncertain. None of
them should be ignored. An item **must** route to human review (never auto-stage to
`approvedQid`) when **any** of these holds:

1. **`requires-review` correction rule fires** — the top-1 qid is on the
   chronically-mismatched list in `qbank-tools/history/correction-rules.json` (where
   reviewers historically corrected it ≥75% of the time). This is the system's accumulated
   "we've gotten this wrong before" memory; treat it as authoritative.
2. **Agent self-reported confidence is `low` OR `med`** — calibration data from the
   2026-05-31 20-batch test showed med/low confidence reliably correlated with misses
   and ambiguity. "Medium" is not "good enough"; it means human eyes.
3. **Top-1 qid appears in a known confusion pair** — `candidate_confusion_pair` rules in
   `correction-rules.json` capture historically-confused pairs (e.g. q0903→q0312). If
   you're proposing the demoted side, route to review.
4. **No tag agreement** for an image-dependent item — if the checklist above produced no
   tag overlap with any top-8 candidate, do not pick by text alone. Review.
5. **Near-duplicate ROW pairs** — when two candidates have nearly identical statement text
   (the `top2SemanticNearDuplicate` situation the matcher detects), route to review.

Routing to review is **free**: the workbench is built for it, the human catches it in
seconds, and the resulting correction feeds back into the correction-rules loop so the
matcher gets smarter for the next language. A wrong auto-staged match, by contrast, must
be hunted down post-merge — far more expensive.

When in doubt, route to review. The skill's bias is correctness over throughput.

**Legacy alternative** — the OpenAI script still works and stays in the repo for
unattended/automated runs (it bills per-token to `OPENAI_API_KEY`):
`npm run extract-screenshot-intake -- --lang ja --batch batch-003`.
Only use it when an interactive agent run isn't possible.

### Step 2 — Validate, match, workbench

```bash
npm run validate-screenshot-intake -- --lang ja --batch batch-003

# Match each item to a master qid (auto-loads correction-rules.json)
npm run process-screenshot-batch -- --lang ja --batch batch-003
npm run validate-localization-batch -- --lang ja --batch batch-003

# Build the single review workbench (HTML the human opens)
npm run generate-batch-workbench -- --lang ja --batch batch-003
```

If an additional model-review pass runs (Codex or Claude in a separate session),
snapshot its recommendations **before** human edits so the model-vs-human comparison
stays honest:

```bash
npm run snapshot-codex-recommendations -- --lang ja --batch batch-003
```

After the human edits the workbench and exports decisions:

```bash
# 4. Apply: stages reviewed items, answer-key confirmations, unresolved rescues,
#    keeps new-question candidates separate, and builds the dry-run merge.
npm run apply-batch-workbench-decisions -- --lang ja --batch batch-003

# 5. Capture this batch's decisions back into memory + refresh rules for next time
npm run build-codex-human-decision-memory -- --lang ja --batch batch-003
npm run build-decision-memory
npm run refresh-correction-rules
```

The exact, current flags and the older multi-page flow are in `qbank-tools/README.md`
— check there rather than trusting these examples blindly if a command errors.

## How the matcher scores (the accuracy doctrine)

The matcher is a **multi-signal, weighted retrieval system**, not raw string matching.
Understanding it lets you judge its proposals and tune accuracy. The design lives in
`qbank-tools/lib/pipeline.mjs` (scoring), `qbank-tools/lib/tag-intelligence.mjs`
(synonym/keyword normalization), and the per-QID **feature store**
`qbank-tools/history/qid-feature-store.json` (rebuilt by `build-match-index` /
`process-screenshot-batch`).

**English is the pivot/bridge language.** Each incoming localized question is glossed to
English and compared against a normalized per-QID feature store that holds, for every
master qid: master English text, question type, option-concept signatures, correct-option
key, keyword tags, image/color tags, **and English glosses of every other localized
language for that qid**. Other languages' glosses are *supporting evidence / confidence
boosts* — never equal anchors to English.

**Scoring is weighted by question shape** (this priority order is the heart of accuracy):

- **MCQ** — option-concept similarity is the **highest** weight: the option *set* is the
  strongest fingerprint, and rare/distinctive option combinations + exact correct-answer
  semantic alignment are rewarded. Then gloss similarity vs master English → image-tag
  similarity (if image) → keyword overlap → supporting glosses from other languages. The
  intuition you've proven in practice: most MCQs are uniquely identifiable by their unique
  options alone; only when options are similar/identical does question-text keyword overlap
  decide.
- **Image-based** — lead with extracted image object/color tags compared against
  `image-color-tags.json`, then gloss similarity, then option similarity. Generic sign
  prompts ("What's the meaning of this sign?") carry *reduced* prompt-text weight because
  the image, not the text, disambiguates.
- **ROW / true-false / no-image** — the weakest class: with no options to fingerprint, it
  leans on **unique keyword overlap + gloss similarity** (plus other-language gloss
  support). Binary yes/no screenshots are treated as ROW-like.

**Disambiguation aids already in place:** synonym normalization (expressway/highway,
phone/telephone, yield/give way, no entry/no entering, watch for/beware of,
lane change/changing lane, …) and **contrast pairs** that separate near-opposites
(left↔right, max↔min, stop↔go, allowed↔prohibited, before↔after, increase↔reduce). Missing
correct answers are scored *neutral*, not negative.

**Known weak spot → ROW + generic-sign questions.** Without a distinctive option set, near-
duplicate ROW statements are the hardest to separate (e.g. "changes lane" vs "changes to
the *right* lane"), which is why these dominate the `requires-review` correction rules.
When matching a ROW item, weight *unique* keywords and any contrast-pair signal heavily,
and prefer routing to human review over a low-margin auto-match.

What actually moves ROW accuracy (validated 2026-05-30, see
`docs/cross-language-row-matching-design.md`):
- **It's a ranking problem, not a filtering or data problem.** ROW recall@8 ≈ 87%
  (fresh-language). Recall loss is NOT from image-parity (0 cases) and NOT from sparse master
  data (ROW glosses/keywords are healthy). It's mostly the correct ROW statement being
  *scored but buried* below near-identical competitors — the same text-only-separation
  problem as top-1 accuracy, which ultimately needs semantic/embedding similarity.
- **The decision-memory → correction-rules loop** (`requires-review` rules) is the most
  reliable ROW lever today — it learns the chronically-confused ROW qids from your
  corrections.
- **Two cheap recall wins** (not yet applied): surface more ROW candidates in the workbench
  (near-misses sit at rank 8–12), and soften the `question-type` severe pre-filter when the
  source's detected type is ambiguous (it currently drops correct ROW qids whose source was
  extracted as MCQ-style, e.g. "What is the meaning of this sign?").
- **Cross-other-language gloss consensus does NOT help** (tested and reverted): the other
  languages' stored English glosses are derived from the same master English, so agreeing
  with them is redundant with master-English agreement the matcher already scores. Don't
  re-attempt this without first making per-language glosses genuinely independent/richer.

## The review decision vocabulary

A workbench item's decision is one of these. Understanding them is the heart of the
review, so don't paper over a hard case — surface it.

- **`approvedQid: "qXXXX"`** — this localized question maps to that master question.
  It inherits that qid's answer key, category, and image asset.
- **`createNewQuestion: true`** — a genuinely new item with no good master match.
  It is **staged** for a future master superset, never written into `questions.json`
  directly (the master is human-locked — see guardrails).
- **`keepUnresolved` / `noneOfThese`** — can't safely decide; leave it for a human.
  Better an honest unresolved than a wrong mapping.
- **`unsure`** — flag for a second look.
- **`confirmedCorrectOptionKey` / `useCurrentStagedAnswerKey`** — the answer key
  (A/B/C/D, or R/W for true-false rows) for this item.

When proposing a decision, cite evidence (prompt similarity, options meaning,
image, decision memory). The matcher proposes; the human disposes.

## The decision-memory → matcher feedback loop

This is the project's accuracy flywheel and the part most likely to be skipped.

- Every reviewed `<lang>-<batch>-workbench-decisions.json` records what the matcher
  *guessed* (`initialSuggestedQid`) vs. what the human *chose* (`approvedQid`),
  plus answer-key corrections.
- `npm run build-match-history` aggregates **all** of those into
  `qbank-tools/history/match-history.jsonl` (one winning file per `(lang, batchId)`).
- `npm run derive-correction-rules` turns that into
  `qbank-tools/history/correction-rules.json`.
- `npm run refresh-correction-rules` does both in one step.
- `process-screenshot-batch` **auto-loads** `correction-rules.json`, so future
  matching is biased by past human corrections (demote confusion-prone qids, force
  review on chronically-wrong ones, etc.).

**Run `refresh-correction-rules` before each batch and after applying one.** A batch
matched without fresh rules throws away everything earlier batches taught the matcher.

Note: `correction-rules.json` (and `match-history.jsonl`) embed a `generatedAt`
timestamp, so a re-run always produces at least a one-line diff even when nothing
substantive changed. Don't mistake that timestamp-only diff for real drift.

Known follow-up: `approved_qid_answer_key_override` rules are derived but not yet
consumed by the answer-key step (option-letter ordering differs per language, so the
consumer must scope per-language or match on option meaning). Don't assume answer-key
rules are auto-applied yet.

## Guardrails — read before any write

`public/qbank/2023-test1/questions.json` is **HUMAN-LOCKED** (the English master).
Read it for matching; never rewrite prompts, answer keys, tags, or regenerate it as a
side effect of localization. Suspected master issues get **reported in an audit or
decision note**, not fixed inline.

`public/qbank/2023-test1/image-color-tags.json` is **additive-only** (append entries
and tags; never delete/rename/reorder existing values).

Always run the guard before committing localization work:

```bash
npm run guard-protected-qbank-files
```

Master or tag edits require explicit human approval and the corresponding
`--allow-*` flag. The full policy (allowed/disallowed examples, the master-edit
workflow) is in `qbank-tools/PROTECTED_FILES.md` — read it; the rules are strict for
good reason.

## Hard-won lessons (the gotchas)

- **Image/sign questions are the matcher's weak spot.** Questions with generic
  prompts like "What's the meaning of this sign?" or "What does this symbol
  indicate?" can't be told apart by text — the image disambiguates. The matcher
  routinely gets these wrong; they dominate the "requires-review" correction rules.
  Lean on the image and the image-color-tags, not the prompt text.
- **Don't double-count history.** A batch can exist as base + `.merged` + a
  `manual-reviews/` copy. `build-match-history` already dedups by `(lang, batchId)`
  keeping the latest export — don't defeat that by hand-merging files.
- **Decision memory is evidence, not a question source.** Use it to inform matches
  and reviewer prompts; never treat its records as new master questions.
- **The new-question promotion gate is mandatory** before any
  language-discovered question could ever reach the master:
  `npm run review-new-question-promotions -- --lang <lang> --batch <batch>`. It only
  writes reports; promotion into `questions.json` is a separate human-approved step.
- **Stay non-destructive.** Staging is scratch; promote completed decisions to
  `qbank-tools/history/decisions/`. When unsure whether a file has decision value,
  archive it — don't delete it.

## Finishing a language

```bash
npm run audit-qbank-integrity                      # zero critical blockers
npm run build-decision-memory
npm run finalize-localization-run -- --lang <lang> --apply false   # dry-run first
npm run finalize-localization-run -- --lang <lang> --apply true
npm run build
git status --short
```

See the "Finalizing a Localization Run" and "Completed-batch cleanup" sections of
`qbank-tools/README.md` for the full checklist (it verifies zero missing qids,
ship-readiness, and zero tracked screenshots before moving anything).
