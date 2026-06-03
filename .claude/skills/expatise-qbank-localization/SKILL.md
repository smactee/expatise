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

#### MANDATORY: never mix up sequential sibling captures (`" 1.png"`)

**Hard rule, validated by a real failure (es batch-002, 2026-06-01).** Files like
`Screenshot … 13.02.54.png` and `Screenshot … 13.02.54 1.png` are *distinct* sequential
questions, not duplicates — and they are the #1 swap hazard in agent-driven extraction.
In that batch the content of two adjacent siblings (a sign question and a road-POV
question) was **swapped** between the files: prompt, options, AND visual tags all went to
the wrong sibling. The matcher then faithfully matched the wrong content and the Step-2.5
pre-fill compounded it. The screenshot is ALWAYS ground truth; extracted text is corrected
to match the image, never the reverse.

To prevent it:
- Attribute each item's content to **the specific file you are reading at that moment** —
  don't read a group of siblings and then write their intake entries from memory.
- After writing intake, **self-verify image items**: for each `hasImage:true` entry, glance
  back at *its own* screenshot and confirm `promptRaw` + `optionsRaw[0]` + `visualObjectTags`
  actually describe that image. Pay special attention to every `" N.png"` sibling pair.
- A mismatch found later is fixed at the **intake** (swap the content fields back, keeping
  `itemId`/`file`/`sourceImage`/`lang`), then re-run `process-screenshot-batch` for the
  affected items and refresh the workbench — do not just edit the qid in the decisions file.

#### Image-dependent items: MANDATORY tag-agreement checklist

Validated on a 20-screenshot French sample (2026-05-31): every wrong match on an
image-dependent question was caused by skipping this step. Text alone can't tell apart
"What's the meaning of this sign?" qids — that's the whole point of the image.

**Hard rule.** For any screenshot whose answer hinges on the embedded image (sign
questions, dashboard indicators, road-scene MCQs, intersection POV diagrams), you may
**not** name a qid until every step below has been completed. If you skip any step, the
match is invalid and must be redone.

**Constrain inferred tags to the controlled vocabulary — don't invent.** When you read an
image and assign `visualObjectTags`/`visualColorTags`, infer them from the existing
controlled vocabulary, not free-form. The canonical lists live in
`public/qbank/2023-test1/image-color-tags.json` under `meta.objectVocabulary` (343 object
tags), `meta.colorVocabulary` (12 colors), and `meta.pinyinVocabulary` /
`meta.chineseTextVocabulary` (for any OCR'd in-image text). A tag you coin that isn't in the
vocabulary can never agree with a master tag, so it's dead weight; pick the closest
vocabulary term instead. (`tag-intelligence.mjs` flags `tagsOutsideVocabulary` for exactly
this reason.) If the image genuinely shows something with no vocabulary term, that's a signal
to add it to the vocabulary deliberately (additive-only, see `PROTECTED_FILES.md`) — not to
sprinkle ad-hoc tags into one item's intake.

```
TAG-AGREEMENT CHECKLIST — image-dependent items
[ ] 1. visualObjectTags written into intake (from meta.objectVocabulary; e.g. arrow,triangle,slope)
[ ] 2. visualColorTags written into intake (from meta.colorVocabulary)
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

#### MANDATORY: never leave a question unresolved — always assign the closest qid + closest answer key

**Hard rule (owner directive, 2026-06-03, during es batch-005 review).** The Step-2.5
pre-fill must **never** hand the human a `keepUnresolved` / blank verdict. Every item gets
a best-effort `approvedQid` (the closest available master question) **and** a best-effort
`confirmedCorrectOptionKey` derived from that qid's master correct answer (see the
answer-key mapping in Step 2.5). When no match is clean, you still pick the closest one and
**do your best** on the answer key — an approximate, clearly-flagged match the human can
confirm in one glance beats a blank that forces them to choose from scratch. The matcher is
~80–90% accurate in practice, so the closest candidate is usually right or one click away.

This does **not** mean stage blindly. The signals below no longer route an item to
*unresolved* — instead they set the **risk level** you record in `reviewerNotes`, so the
human knows exactly which pre-fills to scrutinize. The item still appears in the workbench
for review; it just arrives with a proposed qid + answer key instead of empty. Bump an item
to **`high`-risk** (still with a closest-qid pick) when **any** of these holds:

1. **`requires-review` correction rule fires** — the top-1 qid is on the
   chronically-mismatched list in `qbank-tools/history/correction-rules.json` (where
   reviewers historically corrected it ≥75% of the time). This is the system's accumulated
   "we've gotten this wrong before" memory; treat it as authoritative.
2. **Agent self-reported confidence is `low` OR `med`** — calibration data from the
   2026-05-31 20-batch test showed med/low confidence reliably correlated with misses
   and ambiguity. Still assign the closest qid; mark it medium/high-risk.
3. **Top-1 qid appears in a known confusion pair** — `candidate_confusion_pair` rules in
   `correction-rules.json` capture historically-confused pairs (e.g. q0903→q0312). If
   you're proposing the demoted side, flag it and name the confusion partner in the note.
4. **No tag agreement** for an image-dependent item — if the checklist above produced no
   tag overlap with any top-8 candidate, pick the closest by combined evidence and mark
   high-risk; do not silently trust text alone.
5. **Near-duplicate ROW pairs** — when two candidates have nearly identical statement text
   (the `top2SemanticNearDuplicate` situation the matcher detects), pick the better of the
   two, name both in the note, and mark high-risk.

A high-risk **flagged** pre-fill is **free**: the workbench surfaces it, the human confirms
or corrects it in seconds, and the correction feeds back into the correction-rules loop so
the matcher gets smarter for the next language. The only thing that's expensive is a blank
the human has to research from zero — which is exactly what this rule eliminates.

**Sole exception — genuine duplicates.** A `claimed-qid-duplicate-suspect` item's closest
qid is already localized for this language, so forcing it would collide at ship time
(`ship-batch` pre-flight aborts on intra-language dup). For those, use `deleteQuestion`
(true app-side duplicate) — not `keepUnresolved`. Everything else gets a closest-qid pick.

**Legacy alternative** — the OpenAI script still works and stays in the repo for
unattended/automated runs (it bills per-token to `OPENAI_API_KEY`):
`npm run extract-screenshot-intake -- --lang ja --batch batch-003`.
Only use it when an interactive agent run isn't possible.

### Step 2 — Validate, match, workbench

```bash
npm run validate-screenshot-intake -- --lang ja --batch batch-003

# Match each item to a master qid (auto-loads correction-rules.json AND
# excludes qids already localized for this language by a prior batch — see below)
npm run process-screenshot-batch -- --lang ja --batch batch-003
npm run validate-localization-batch -- --lang ja --batch batch-003

# Build the single review workbench (HTML the human opens)
npm run generate-batch-workbench -- --lang ja --batch batch-003
```

#### Claimed-qid exclusion (deduplication across batches of the same language)

`process-screenshot-batch` **hard-excludes** any master qid that has already been
localized for this language (i.e. it's a key under `.questions` in production
`public/qbank/<dataset>/translations.<lang>.json`, written by a prior merged batch).
This stops two screenshots in the same language from both mapping onto one master
question. It is **per-language** (Spanish's claimed set never affects French) and
**ON by default**.

Crucially it is *not silent*: an excluded qid is still recorded on the item as
`analysis.claimedQidExclusion.topExcludedClaimed`, and when the best-scoring match
*was* a claimed qid the item is flagged with the `claimed-qid-duplicate-suspect`
reason code. That is the signal that the screenshot may be a **genuine
target-language duplicate** (the foreign app showing the same question twice) — disposition
it with `deleteQuestion` and a duplicate note (the never-unresolved policy forbids
`keepUnresolved`; `deleteQuestion` is the correct call for a true app-side duplicate) rather
than forcing it onto the fresh fallback qid. So: duplicates can no longer be auto-created,
and real duplicates surface for you to handle as they occur.

- The claimed set is read from **production** `translations.<lang>.json`, so it
  reflects every batch already merged. **Merge each batch to production before
  matching the next** (the normal flow already does) for the dedup to see prior work.
- **Re-matching an already-merged batch?** Every one of its qids is now "claimed", so
  the matcher would exclude its own correct answers. Disable the layer for that run:
  `npm run process-screenshot-batch -- --lang <lang> --batch <batch> --exclude-claimed false`.
- The run report (`generated/reports/process-screenshot-batch-<lang>-<batch>.json`)
  lists `claimedQidExclusion.duplicateSuspectItems` for quick triage.

### Step 2.5 — MANDATORY verdict pre-fill (replaces what Codex used to do)

Don't hand the human a workbench with empty decisions and 40+ review-needed items to
choose from blank. Fill in a best-effort verdict for **every** item BEFORE the human
opens the HTML, so they confirm or override instead of choosing from scratch. This is
the standard Codex pattern from earlier languages and is non-negotiable in the
agent-driven flow.

For each of the 50 items in
`qbank-tools/generated/staging/<lang>-<batch>-workbench-decisions.json`, pick an action and
set the corresponding fields. **Default to `approveExistingQid` for every item** — the
owner directive above forbids leaving anything unresolved, so `approveExistingQid` (closest
qid + best-effort answer key) is the expected verdict unless the item is a genuine
duplicate (`deleteQuestion`) or a genuinely novel question with no plausible analog
(`createNewQuestion`, rare):

| Action | Fields to set |
|---|---|
| **approveExistingQid** *(default — use for essentially every item)* | `approvedQid: "qXXXX"` (closest available qid), `confirmedCorrectOptionKey: "A/B/C/D"` (locale letter — see mapping below, **always derive it**), or `useCurrentStagedAnswerKey: true` if matcher's `currentStagedLocaleCorrectOptionKey` is already right; `reviewerNotes` with honest risk level |
| **deleteQuestion** | `deleteQuestion: true`, `reviewerNotes` — **only** for a genuine app-side duplicate (`claimed-qid-duplicate-suspect` whose closest qid is already localized this language) |
| **createNewQuestion** *(rare)* | `createNewQuestion: true`, `newQuestionLocalAnswerKey`, `newQuestionProvisionalTopic` (one of the 4 topics), `newQuestionProvisionalSubtopics` (e.g. `["traffic-signals:road-signs"]`), `reviewerNotes` — only when no master question is even plausibly close |
| ~~**keepUnresolved**~~ *(forbidden in pre-fill)* | Do **not** pre-fill this. The owner directive bans handing the human a blank/unresolved verdict. The field still exists for the human to choose during review, but you must always propose a closest-qid pick instead. |

**Answer-key locale mapping** (the trickiest part — do NOT just copy the master letter).
Required for **every** item, including approximate closest-match picks:
1. Look up the master qid's options + `correctOptionId` in `public/qbank/2023-test1/questions.json`. The master correct option has a meaning (e.g. "reduce speed and stop").
2. Look at the localized options for this item (`intake.json`). Find which localized option means the same thing as the master's correct option.
3. The localized letter (A/B/C/D) of that option is the `confirmedCorrectOptionKey`. For ROW/true-false items the master `correctRow` (R/W) carries straight over.
4. If the matcher's `currentStagedLocaleCorrectOptionKey` already equals your derived letter, set `useCurrentStagedAnswerKey: true` and leave `confirmedCorrectOptionKey: null`.
5. **Closest-answer fallback (do your best).** When the match is approximate and the master's correct option has no exact local twin, pick the localized option whose meaning is *closest* to the master's correct option, and record the uncertainty in `reviewerNotes` (e.g. "Claude high-risk approveExistingQid: closest qid q0xxx; answer key B = nearest local option to master's 'reduce speed', verify"). Never leave the answer key blank on the grounds that the match was imperfect.

**reviewerNotes style** (matches the Codex convention so decision-memory aggregates cleanly):

```
Claude <low|medium|high>-risk <action>: <one-sentence rationale>
```

Risk is *your* confidence: low = clear answer / strong evidence, medium = some
ambiguity, high = uncertain. When in doubt, **still assign the closest `approvedQid` + a
best-effort answer key** and mark it `high`-risk — never fall back to `keepUnresolved`
(owner directive, 2026-06-03). A clearly-flagged high-risk closest-match delegates the
*verification* to the human (one glance to confirm/correct) while sparing them a blank they
must research from scratch; that is the review-gate doing its job under the new policy.

**Inputs you have to draw on:** `imports/<lang>/<batch>/intake.json` (the source
items you wrote), `imports/<lang>/<batch>/{matched,review-needed,unresolved}.json`
(the matcher's surfaced candidates with scores + master prompts + answer keys per
qid), `public/qbank/2023-test1/questions.json` (master), `public/qbank/2023-test1/image-color-tags.json` (tags), `qbank-tools/history/qid-topics.json` (topic per qid),
`qbank-tools/history/correction-rules.json` (requires-review / confusion pairs to heed).

**After filling**, re-run `npm run generate-batch-workbench` — it MERGES with your
filled decisions (does not overwrite them) and refreshes the HTML so the reviewer sees
your pre-fills.

If an additional model-review pass runs (Codex or Claude in a separate session),
snapshot its recommendations **before** human edits so the model-vs-human comparison
stays honest:

```bash
npm run snapshot-codex-recommendations -- --lang ja --batch batch-003
```

After the human edits the workbench and exports decisions:

**Preferred — one command (`ship-batch`).** Once the reviewed decisions are exported
(default location `/Users/huni/Downloads/Expatise/<lang>-<batch>-workbench-decisions.json`),
this runs the entire post-review chain and **aborts before touching production** if
anything is unsafe (missing decisions, intra-batch duplicate qids, or qids already shipped
for this language, or a non-clean dry-run gate):

```bash
npm run ship-batch -- --lang es --batch batch-003
# add --export-dir <path> if the reviewed JSON is elsewhere
```

It does: locate export → pre-flight safety → copy onto staging (backing up the old one)
→ `apply-batch-workbench-decisions` → **enforce** the `full-batch-merge-review` gate
(`safeToMergeNextStep` && 0 blockers) → `apply-production-localization-merge` (with the
correct explicit `.full.*` paths) → `build-decision-memory` → `refresh-correction-rules`,
then prints the new production count. It deliberately skips the vestigial
`build-codex-human-decision-memory` step. Verify after with
`npm run guard-protected-qbank-files && npm run build`.

**Manual / step-by-step equivalent** (use when debugging or when a step needs inspection):

```bash
# 4. Apply: stages reviewed items, answer-key confirmations, unresolved rescues,
#    keeps new-question candidates separate, and builds the dry-run merge.
npm run apply-batch-workbench-decisions -- --lang ja --batch batch-003
#    GATE: confirm generated/reports/full-batch-merge-review-<lang>-<batch>.json has
#    safeToMergeNextStep:true and 0 blockers BEFORE the next step (it writes production
#    directly — no --apply flag, no rollback).
npm run apply-production-localization-merge -- --lang ja --batch batch-003 \
  --preview-path qbank-tools/generated/staging/translations.ja.batch-003.full.preview.json \
  --dry-run-path qbank-tools/generated/staging/translations.ja.batch-003.full.merge-dry-run.json \
  --dry-run-review-path qbank-tools/generated/reports/full-batch-merge-review-ja-batch-003.json

# 5. Capture this batch's decisions back into memory + refresh rules for next time
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
  - **Option-row priority cascade (implemented 2026-06-01).** For MCQ, this intuition is
    enforced as an explicit, *gated* tie-break cascade rather than a flat blend:
    1. **Option row stack** — when a candidate's option set is a **near-exact** match
       (`optionSetScore ≥ 0.9` / `optionConceptExactSet ≥ 0.85` / `optionSignatureScore ≥
       0.72`), the option stack is the decisive fingerprint and that candidate is boosted to
       the top (`optionRowPriorityBoost` in the score breakdown, in `applyWeightedReranking`).
    2. **Tie → question text** — when option rows are *not* near-exact (or several candidates
       tie on options), the override does **not** fire; ranking falls through to the calibrated
       blend, which is led by question-text keyword overlap + prompt similarity.
    3. **→ image tags** — for image items the blend then leans on image object/color tag
       agreement (see image-based profile below).
    Why gated, not a blind override: cross-lingual option similarity is **weak and noisy**
    (correct matches often score only ~0.1–0.4 after Spanish→English glossing). A strict
    "option always wins" was built, validated, and **reverted** (2026-06-01) because tiny
    noise differences overrode the correct calibrated pick (e.g. it broke a verified q0415
    match). Only *near-exact* option matches (≈1.0 set score) are confident enough to override;
    everything below is a tie that defers to text/image. Don't loosen the gate without
    re-validating on a real batch.
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
  directly (the master is human-locked — see guardrails). Rare: under the
  never-unresolved policy, prefer the closest existing qid unless nothing is plausibly close.
- **`keepUnresolved` / `noneOfThese`** — **not allowed as a pre-fill verdict** (owner
  directive, 2026-06-03). The agent must always propose the closest `approvedQid` + a
  best-effort answer key instead. The field remains only so the *human* can choose it during
  review; you never set it.
- **`unsure`** — flag for a second look (via `high`-risk `reviewerNotes`), but still carry a
  closest-qid pick — don't blank the verdict.
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

### MANDATORY first: clear the unresolved backlog as a final re-run batch

Before finalizing, **the human reviewer's deferred items must be re-run** (owner directive,
2026-06-03). Across the language's batches, every item the human left `keepUnresolved` (or
flagged `createNewQuestion`) is accumulated — with its **reviewer notes** — in a committed
backlog: `qbank-tools/history/<lang>-unresolved-backlog.json`, sourced from the reviewed
workbench-decisions exports archived under `qbank-tools/history/decisions/`.

**Do NOT trust the pipeline's `follow-up-review.<lang>.<batch>.unresolved.json`** for this —
it is lossy (es batch-005: it captured only 2 of 12 held-back items). The backlog file
(rebuilt from the reviewed exports) is the source of truth.

To clear it: assemble the backlog's screenshots into one final batch (e.g. `batch-final`),
run the normal pipeline (`process-screenshot-batch` → workbench), and **pre-fill using the
preserved reviewer notes** (they often already state the answer, e.g. "match to q0866 but
fix the local answer key", "duplicate of q0166", "MCQ version reusing q0528's image"). The
fresh matcher (now carrying all the language's correction rules) plus the human notes should
resolve most. Only after the backlog is cleared/dispositioned do you finalize:

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
