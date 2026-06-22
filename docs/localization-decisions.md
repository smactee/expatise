# QBank localization — decisions log (the "why")

Durable rationale for the qbank matcher + batch pipeline, migrated out of agent
session-memory 2026-06-04. The **execution doctrine** lives in the skill
(`.claude/skills/expatise-qbank-localization/SKILL.md`) and the **standing operating
rules** in the repo `CLAUDE.md` ("Operational quick-reference"); this file records the
*design decisions and their validation verdicts* so they aren't re-litigated. Per-language
progress is state, not history — it lives in `translations.<lang>.json` `meta` and
`qbank-tools/history/`, not here.

## The matching doctrine (where it's documented)

The "policy" is not a doc — it's implemented as: per-QID feature store
(`qbank-tools/history/qid-feature-store.json`) + weighted scoring in
`qbank-tools/lib/pipeline.mjs` + synonym/keyword normalization in
`qbank-tools/lib/tag-intelligence.mjs`. Doctrine: **English gloss = pivot/bridge**; other
languages' glosses = supporting evidence; weighted by question shape (MCQ → option
fingerprint first; image → image tags; ROW → keyword+gloss, the weak class). Written up in
SKILL.md "accuracy doctrine" + `docs/cross-language-row-matching-design.md`.

## Implemented levers + their validation verdicts

Each was validated on a real batch before keeping. **Lesson that recurs: strict overrides
on noisy cross-lingual signals regress — validate ranking changes on a real batch first.**

- **decision-memory → matcher feedback loop (KEPT, the most-valued asset).**
  `npm run refresh-correction-rules` aggregates all `*-workbench-decisions.json` →
  `match-history.jsonl` → `correction-rules.json`, auto-loaded by `process-screenshot-batch`.
  **Open follow-up:** `approved_qid_answer_key_override` rules are *derived but not yet
  consumed* by the answer-key review step.
- **Claimed-qid exclusion / cross-batch dedup (KEPT, ON by default).**
  `process-screenshot-batch` hard-excludes master qids already localized for the language
  (keys in production `translations.<lang>.json`) from the candidate pool, so two
  screenshots can't both map to one master qid. Owner chose HARD exclude over soft-demote;
  the compromise that keeps "handle duplicates as they occur" alive is the diagnostic:
  when the best match was a claimed qid, the item gets reason code
  `claimed-qid-duplicate-suspect`. **That flag is a "verify" signal, NOT a confirmed dup —
  never auto-delete on it** (es batch-006: 42 flagged, QA proved ~all were genuinely NEW
  questions; deleting a new question is unrecoverable). Toggle `--exclude-claimed false`
  when re-matching an already-merged batch. Impl: `loadClaimedQidsForLang` +
  `claimedQids` in `processBatchAgainstIndex`.
- **Option-row priority boost for MCQ (KEPT, as a GATED tie-break only).** Owner wanted
  option-set similarity to dominate for MCQ. First attempt = strict lexicographic
  option-override sort → REGRESSED (cross-lingual option similarity is weak/noisy, ~0.1–0.4
  even for correct matches; tiny noise overrode the calibrated blend). Reverted. Correct
  design = `optionRowPriorityBoost` in `applyWeightedReranking`, fires only on near-EXACT
  option matches (optionSetScore≥0.9 / optionConceptExactSet≥0.85 / optionSignatureScore≥0.72)
  → boosts +~40 to lead; below the gate it's a tie and the calibrated total decides.
  Validated: fires for exactly the near-exact matches, zero regression. **This is also the
  disambiguator for sign questions** that share a generic prompt ("¿Qué significa esta
  señal?") + coarse tags — use the option-set fingerprint, not prompt/tag text.
- **Topic-narrowing (BUILT, validated, default OFF).** `setTopicNarrowingEnabled` toggle +
  `candidateTopicFor` in pipeline.mjs, `qid-topics.json` artifact. LOLO validation was
  net-zero/slight-regression because classifier-derived source topics from translated text
  are noisy and subtopics are coarse. Wiring kept for future re-validation with
  agent-derived (screenshot-based) source topics. See `docs/topic-narrowing-validation.md`.
- **Cross-language gloss-consensus for ROW (TESTED + REVERTED).** Net-zero on
  leave-one-language-out — other languages' English glosses derive from the same master
  English (redundant, not independent) and are templated. ROW remains the matcher's hardest
  class (no options to fingerprint); recall@8 ≈ 87% fresh-language. Cheap unbuilt wins:
  surface more ROW near-misses (rank 8–12); soften the question-type pre-filter for
  ambiguous-type sources. Detail in `docs/cross-language-row-matching-design.md`.

## Image-tag controlled vocabulary

Agent-inferred `visualObjectTags` / `visualColorTags` MUST be constrained to the controlled
vocab in `image-color-tags.json` `meta.objectVocabulary` (343) / `colorVocabulary` (12) /
`pinyinVocabulary` / `chineseTextVocabulary` — don't invent tags.

## Verbatim-duplicate sweep (per-language) — engineering notes

Owner suspects the foreign apps repeat questions (same question at two app#s), "especially
Chinese." A `$0` detection pipeline (no API):

1. **Crop** each screenshot to the question region (e.g. `magick -crop 3840x1814+0+448`) —
   removes the varying top number-strip + bottom `N/902` counter, the ONLY differing parts
   between two positions of the same question.
2. **OCR** every crop with local **tesseract** (`-l <code> --psm 3` — NOT psm 4, whose
   single-column assumption garbles questions with an illustration above the text). Consistent
   OCR → identical questions yield identical text even if OCR is imperfect. Reading from a
   saved file works; stdin piping does NOT.
3. **Group** by normalized prompt+option tokens (strict + shuffled-option tiers).
4. **Image-diff** each candidate group (`magick compare -metric RMSE` on the crop band) +
   build side-by-side montages.

**CRITICAL rule (owner cares about this): only text AND image agreement = a real duplicate.**
~8 es pairs had identical prompt + identical options but a DIFFERENT image (mirrored arrow
L/R, route plate G105 vs S203, plain-phone vs rescue-1212, green vs amber fog symbol) —
text-only dedup would wrongly merge them. So: image-band Δ < 0.02 = text-only → `dup`;
Δ ≥ 0.02 = has an image → `unsure`, never auto-dup. Default to KEEP; signs can differ
subtly. RMSE conflates sign-diff with option-reorder, so a human/montage glance is required.

**Wiring:** reviewed export → `npm run apply-duplicate-decisions -- --lang <lang> --path <export>`
→ registry `qbank-tools/history/duplicate-exclusions.<lang>.json` (only `verdict:"dup"`
contributes deletions; idempotent, `--dry-run`). `process-screenshot-batch` then drops any
intake item whose screenshot basename is in the registry BEFORE matching
(`loadDuplicateExclusionsForLang`; `--exclude-duplicates false` to disable; ON by default).
Exclusion is future-only — it won't un-ship a question already merged to production.

**The reusable builder** (OCR → group → RMSE → montages → self-contained review-workbench
HTML that exports `<lang>-duplicates-decisions.json`) is `scripts/dup-screenshot-sweep.mjs`
(promoted from the `/tmp/dup-build.mjs` scratch script 2026-06-04 so it stops being
re-created/re-read; takes `<lang> <screenshotDir> <ocrTsv> <outDir>`).
**Sandbox gotcha:** leptonica (tesseract / `magick compare`) intermittently can't open files
under `/tmp` (silent empty OCR / "image file not found") — ALWAYS write the scratch crops the
OCR/compare tools read into a project-dir folder (`.ocrtmp/`), not `/tmp`.

es result (owner-reviewed, conservative): 7 dup groups = 8 redundant screenshots, all
text/dashboard; every sign/image group kept. Next target: **zh** (owner's main suspicion).

## Unresolved backlog → final re-run batch

Owner wants every unresolved/deferred item re-run as the LAST batch per language, with the
reviewer's notes as authoritative guidance. **Source of truth =
`qbank-tools/history/es-unresolved-backlog.json`** (committed), compiled from the reviewed
workbench-decisions exports (archived in `qbank-tools/history/decisions/`). The pipeline's
own `follow-up-review.<lang>.<batch>.unresolved.json` is **lossy** (captured 2 of 12
keepUnresolved items for batch-005) — never rely on it; rebuild from the reviewed export.

## App topic taxonomy

Lives in `lib/qbank/deriveTopicSubtags.ts` + `syllabusKeywords.ts` + `tagTaxonomy.ts`
(4 topics × 12 subtopics: road-safety, traffic-signals, proper-driving, driving-operations).
The classifier covers ~99% of master qids at runtime even though `tags.patch.json` has
explicit user tags for only ~16%.

## Matcher recall & ranking — shipped optimizations (2026-06)

The matcher diagnosis on es 005–007 was **recall@8 ~90% but top-1 only ~55%** → a *re-ranking*
problem (right qid in the top-8, just not #1), later refined to also be a *recall* problem for
image/generic-prompt items (the right qid never entered the text-built candidate pool). Four
layers, all shipped, all reusable for any new language:

1. **Semantic text re-ranker (bge-small-en-v1.5).** Re-ranks each item's top-8 by cosine
   (incoming gloss vs candidate master prompt) blended with the matcher score, **gated to
   content-rich prompts** (generic/image-disambiguated prompts keep matcher order — they regress
   under embeds because options/image discriminate, not the prompt). +11.5pt top-1. Impl:
   `applyEmbeddingRerank` in `pipeline.mjs` via `options.embedRerank` (safe no-op without vectors);
   sidecar `scripts/qbank-embed.py` (fastembed/ONNX — the model runs ONLY there; pipeline just does
   dot-products). `process-screenshot-batch` is default-on, auto-runs the sidecar (mtime-gated),
   `--embed-rerank false` to disable. Vector artifacts gitignored. *Rejected: per-qid gloss-bank
   doc-expansion (−6.8pt) — cross-language glosses are redundant, inflate wrong candidates.*
2. **Image-content re-ranker (CLIP `clip-ViT-B-32`).** The matcher's `imageScore` was tag-overlap
   only (never pixels). Added a CLIP discriminator: source screenshot → **`crop_question_image`**
   (de-letterbox, keep the tallest contiguous band of COLORFUL or densely-non-white rows — robust
   across signs/icons/diagrams/scenes) → embed → cosine vs candidate master images. **Cropping was
   the unlock** (uncropped full screenshots = 49% on image items, UI noise). Image items blend
   image(0.5)+text(0.3)+matcher(0.2). Full stack (cascade+text+image) took es 005–007 from 55% →
   **77.7% top-1**. Also fixed a tag-cascade bug: `inferExpectedObjectTagsFromText` pushed
   `car-icon` on any "car"/"vehicle" → fabricated dashboard-indicator matches; now requires a
   car-PART cue (door/hood/engine…).
3. **Recall rescue — image-NN + prompt-NN candidate seeding (the big one).** Re-rankers only help
   if the right qid is in the pool; for generic-prompt image questions ("What does this sign mean?")
   the text-built pool filters out image-only-distinguishable qids *before* re-ranking. Fix =
   **prefill-stage helpers that seed the pool from embeddings the matcher already produced** (they do
   NOT touch `pipeline.mjs`, which is owner WIP):
   - `node scripts/image-nn-candidates.mjs --lang <l> --batch <b>` → top-K CLIP image-NN per image
     item → `imports/<lang>/<batch>/_image-nn.json`. Tuned default **topK 14**, merge **top-5
     unclaimed** into the image-verify briefing.
   - `node scripts/prompt-nn-candidates.mjs --lang <l> --batch <b>` → bge text-NN (mirror) →
     `_prompt-nn.json`. Used to trigger a TARGETED text-verify re-check where a high-cos (≥~0.80)
     unclaimed prompt-NN qid ≠ matcher top-1.
   Impact on German: qid-agreement trajectory **86.1 → 91.6 → 96.9 → 97.8 → 100%** across batches as
   the dual-rescue + accumulated correction-rules matured.
4. **decision-consistency guardrail** (`qbank-tools/lib/decision-consistency.mjs`,
   `npm run check-decision-consistency`). HARD-gates two reliable signals (wired into `ship-batch`
   pre-flight, override `--allow-consistency-mismatch`): **(a) type mismatch** (source
   `effectiveQuestionType` ≠ master `type`); **(b) numeric-option mismatch** (both option sets
   numeric & numeric-Jaccard < 0.5). Prose option-overlap is deliberately NOT gated (cross-lingual
   noise → false aborts). **Comma-decimal FP fix:** `extractNumbers` now collapses decimal commas
   (`3,5`→`3.5`) so German/es/fr decimals stop false-firing — no more `--allow` for decimals.

## Per-batch verify workflow (apply every batch)

After the matcher runs, for each screenshot batch:
1. `image-nn-candidates.mjs` + `prompt-nn-candidates.mjs`.
2. **Image-verify briefing** for image items (merge top-5 unclaimed image-NN); agents read the
   screenshot + candidate **master images**, pick the image-true qid, derive the key.
3. **Targeted text-verify** for text items where prompt-NN (cos≥0.80) ≠ matcher top-1; agents
   compare German/locale prompt + **OPTION SET** (the fingerprint) vs candidate masters.
4. Resolve collisions, run the consistency gate + production-claim `comm` check, flag dup-suspects.

The consolidated matching **lessons** (extraction ROW-vs-MCQ type defect; option-set is the
fingerprint; never auto-delete a `claimed-qid-duplicate-suspect`; image items default to
medium-risk minimum; the footer `N/902` is ground truth — never write intake from memory) live in
SKILL.md "Hard-won lessons"; this doc records why each shipped.

## Recurring batch-ship gotchas

- **`pipeline.mjs` / `process-screenshot-batch.mjs` are owner WIP** — don't edit. To run the matcher
  on the committed version, do the **stash-dance** as ONE command prefixed `cd <repo> &&`:
  `git stash push -- <those files>` → run → `git stash pop`. Verify `git stash list` is empty after
  (a cwd reset once made the push a no-op and a later pop dropped a *pre-existing* stash).
- **Owner workbench exports land in `~/Downloads/` directly**, not `~/Downloads/Expatise/` — search both.
- **Exports DROP ROW answer keys** (`confirmedCorrectOptionKey:null`, `useStaged:false`) — restore by
  deriving from the EXPORT qid's master `correctRow`, NOT by copying staging. Check every approve+ROW.
- **Production-claim conflict:** if the owner re-points to a qid already localized in production, flip
  to `deleteQuestion` (one-claim-per-qid; `ship-batch` pre-flight aborts otherwise). Run
  `comm -12 <approved qids> <production qids>` before ship.
- **Backlog file is an OBJECT** (`{lang,count,...,items}`) — `jq '.items|length'`, not `jq length`.
- **fastembed model-cache corruption:** ONNX `NoSuchFile` → `rm -rf` the broken `models--*` dirs under
  the fastembed_cache temp dir, re-run (re-downloads weights; master vectors survive).
- **`finalize-localization-run --lang <l> --apply true`** consolidates decision exports into
  `history/decisions/` and archives generated scratch to the gitignored `generated/archive/` → ~90
  tracked report files show as git DELETIONS (intended) and `history/decisions/` gains untracked files.
  Always pass `--lang` (no-arg defaults to `ru`).

## Backfill (English-master parity)

When a language's screenshots cover only part of the 1004 masters, `finalize` blocks on
`missingBackfillQids`; backfill the rest agent-driven ($0). `build-missing-localization-backfill
--lang <l>` emits the missing masters → translate EN→locale via parallel $0 Claude agents (options in
**MASTER ORDER** so the key auto-derives) → `scripts/backfill-<lang>-translations.py` writes
draft+reviewed → validate → apply. **Gotchas:** `validateDraftItems` requires `needsHumanReview:true`
on EVERY reviewed item (the committed `backfill-es-translations.py` set it False — the current lib
would reject that; the de script sets it true) + `reviewStatus:"approved"`; ROW entries carry
`localeCorrectOptionKey/correctRow/options = null` (runtime drives ROW from master `correctRow` — not
a bug); `finalize --apply true` archives the just-committed `backfill.<lang>.agent-translations.json`
(restore with `git checkout HEAD --`). Both **es and de are COMPLETE at 1004/1004** via this path.
