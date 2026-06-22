# Expatise — agent notes

Next.js app (Chinese driving-test qbank) + a bespoke localization toolchain under
`qbank-tools/` and `scripts/`. This file summarizes the files agents tend to re-read
in full — **read the summary here first and grep the source for the one symbol you
need instead of opening the whole file.**

## qbank-tools/lib/pipeline.mjs (~9.8k lines — do NOT read end-to-end)

Shared ES module backing the ~70 `qbank:*` / localization npm scripts in
`package.json`. ~58 exports plus a large block of **internal** matching/scoring
helpers (MCQ fingerprinting, numeric-intent parsing, prompt-family detection,
JA/RU semantic-replacement tables). To use it, grep for the export name:
`grep -n "export .*<name>" qbank-tools/lib/pipeline.mjs`.

Exports by area:
- **Paths/constants**: `ROOT`, `DEFAULT_DATASET` (`"2023-test1"`), `DEFAULT_REFERENCE_LANG` (`"ko"`), `QBANK_TOOLS_DIR`, `GENERATED_DIR`, `REPORTS_DIR`, `STAGING_DIR`, `HISTORY_DIR`, `DEFAULT_FEATURE_STORE_PATH`, `IMPORTS_DIR`, `CURRENT_FEATURE_SCHEMA_VERSION` (=3).
- **Arg parsing**: `parseArgs`, `stringArg`, `booleanArg`, `batchOptionsFromArgs`, `normalizeLang`, `normalizeBatchId`.
- **Dataset/path resolution**: `getDatasetPaths`, `getBatchDir`, `getBatchFiles`, `getReviewArtifactPaths`, `getNewQuestionFiles`, `discoverKnownLanguages`, `loadClaimedQidsForLang`.
- **IO helpers**: `ensureDir`, `ensurePipelineDirs`, `fileExists`, `readJson`, `writeJson`, `writeText`, `writeCsv`, `csvEscape`, `loadCorrectionRulesFile`, `stableNow`.
- **Normalization**: `normalizeWhitespace`, `normalizeQuestionType`, `normalizeTag`, `unique`, `textSimilarity`.
- **Images/assets**: `IMAGE_EXTENSIONS`, `isImageFile`, `listBatchScreenshotFiles`, `buildAssetRenamePlan`.
- **Matching core / feature store**: `loadQbankContext`, `loadFeatureStoreFile`, `buildQidFeatureStore`, `buildMatchIndex`, `buildSyntheticMatchIndex`.
- **Batch pipeline**: `readBatchIntake`, `processBatchAgainstIndex`, `emptyBatchOutput`, `reportSummary`, `buildMergePreview`, `approvedBatchItems`, `writeBatchOutputs`, `summarizeExtractionItems`.

**Hot internals — jump straight to these line ranges (don't scan):**
- `loadClaimedQidsForLang` L912 · `loadDuplicateExclusionsForLang` L940 (`duplicateExclusionsPath` L936) — cross-batch dedup + verbatim-dup exclusion inputs.
- MCQ scoring cluster L2504–2960: `compareMcqTextPair` L2504, `compareMcqOptionSets` L2564, `compareMcqAnswerFingerprints` L2757, `scoreMcqKeywordOverlap` L2823, `scoreMcqPrior` L2917, `scoreMcqStageAShortlist` L2937.
- `buildQidFeatureStore` L4100 · `buildMatchIndex` L4191 — index build.
- `candidateTopicFor` L6379 (topic-narrowing, default OFF via `setTopicNarrowingEnabled` L747).
- `applyWeightedReranking` L6925 — the calibrated blend; `optionRowPriorityBoost` gated tie-break at L6979.
- `processBatchAgainstIndex` L9479 — the matcher entry point; `claimedQids` handling L9489, `claimed-qid-duplicate-suspect` flag L9730.
- (Anchors as of file len ~10,133 lines; they drift as the file grows — if off, grep the symbol.)

Sibling libs in `qbank-tools/lib/`: `tag-intelligence.mjs` (synonym/keyword normalization),
`feature-bridge.mjs`, `new-question-promotion-gate.mjs`, `missing-localization-backfill.mjs`,
`image-replacement-memory.mjs`.

## public/qbank/2023-test1/questions.json (~58k lines / 1.3 MB — query, don't read)

The extracted master qbank for the `2023-test1` dataset. Shape:
`{ meta, questions }`.
- `meta`: `{ slug, pdf, extractedAt, questionCount }` (currently 1006).
- `questions[]`: `{ id ("q0001"…), number, type, prompt, options[], correctRow, correctOptionId, answerRaw, regions[{page,colIndex,bbox}], source{pdf}, tags{auto[],user[],suggested[{tag,score}]} }`.
- `type` distribution: `row` (true/false-style, ~426) and `mcq` (~580). `row` items have empty `options` and use `correctRow` (`"R"`/`"L"`); `mcq` items use `options` + `correctOptionId`.

Inspect a single record with `node -e` instead of opening the file, e.g.:
`node -e 'console.log(JSON.stringify(require("./public/qbank/2023-test1/questions.json").questions.find(q=>q.id==="q0527"),null,1))'`
(note: `.questions` is an **array** here; some sibling files like `translations.<lang>.json`
and `image-color-tags.json` key questions by qid object instead — check shape first).

**It's a human-locked master file** (see the firm operating agreement below): edits go
through `npm run master-edit`; never `jq` a whole-file rewrite (it churns the owner's
formatting); use surgical string edits only, and never auto-revert apparent
"pipeline side-effects" — many are the owner's intentional edits flowing through.

**Derived master indexes** (e.g. a compact `{qid,type,prompt,options,correct}` jsonl for a
triage/dedup pass): build them ONCE to `qbank-tools/generated/` and `grep` them — don't write
them to `/tmp` and re-Read the whole 200KB+ blob each step (a `/tmp/triage/master-ref.jsonl` got
re-opened 15× in one session).

## public/qbank/2023-test1/image-color-tags.json (~21.5k lines / 510 KB — query, don't read)

Per-question image analysis for `2023-test1`. Shape `{ meta, questions }`, **keyed by qid
object** (unlike questions.json's array — `questions["q0189"]`, not `.find()`).
- `meta`: `dataset`, `generatedAt`, `questionCount` (985), `imageQuestionCount` /
  `analyzedAssets` (498), `missingAssets`, the controlled-vocab lists
  (`colorVocabulary` ~12, `objectVocabulary` ~343, `pinyinVocabulary` ~69,
  `chineseTextVocabulary`), and `thresholds` / `imageHandling` tuning.
- `questions[qid]`: `{ assetSrcs[], colorTags[], objectTags[], … }` — tags constrained to
  the `meta.*Vocabulary` lists.

Inspect one record with node instead of opening the file:
`node -e 'console.log(JSON.stringify(require("./public/qbank/2023-test1/image-color-tags.json").questions["q0189"],null,1))'`.
**Additive, human-curated** — same firm operating agreement as questions.json: never
auto-edit or auto-revert, and constrain inferred tags to `meta.*Vocabulary` (don't invent tags).

## app/**/results.module.css + app/profile/profile.module.css (grep the class, don't read whole)

Large CSS-module files for the results and profile screens — repeatedly re-read in full when
only one class was needed. Grep `\.<className>` to jump straight to a rule.
- `app/test/[mode]/results/results.module.css` (~696 lines) and
  `app/(premium)/all-test/results/results.module.css` (~641 lines) are **near-identical
  siblings** (free vs premium results — keep them in sync). Class groups: score ring
  (`scoreBox`/`ring`/`ringWrap`/`ringCenterText`/`scoreValue`), question-review carousel
  (`carousel`/`slide`/`viewport`/`viewToggle`/`reviewArea[Carousel]`/`slideCounter`),
  answer options (`option`/`optionCorrect`/`optionWrong`/`optionNeutral`), and the
  back/bookmark/continue chrome.
- `app/profile/profile.module.css` (~839 lines): avatar (`avatar*`), settings list
  (`settingsRow`/`settingsList`/`settingsMenuBlock[Open]`/`toggle`/`toggleKnob[On]`),
  email edit (`email*`), language dropdown (`language*`), premium card (`premium*`/`crown*`),
  toast (`toast*`).

## components/Globe.client.tsx (~605 lines — interactive 3D globe)

A `globe.gl` + `three` (WebGL) interactive globe, `forwardRef` exposing a
`GlobeHandle` imperative API. **Static-export safety: globe.gl/three are browser/WebGL
only** — this is the `.client` half, dynamically imported so SSR/`output:'export'`
never touches WebGL. Renders an Earth (textures from the three-globe jsDelivr CDN; swap
`DAY_TEXTURE_8K_URL` to a vendored `/globe/earth-day-8k.jpg` later) with auto-rotation,
clickable admin-0 countries (`/globe/countries-50m.geojson`, Natural Earth 50m) and, for
`PROVINCE_COUNTRIES` (KR/CN), province-level selection. Types: `CountrySelection` /
`ProvinceSelection` / `GlobeHandle` / `GlobeProps`. Tuning constants live at the top
(`AUTO_ROTATE_SPEED`, `BUMP_SCALE`, `SHININESS`, ISO-prop fallbacks `ISO_A2`/`ISO_A2_EH`).
Grep a const/handler; don't read all 605 lines. The standalone reference prototype is
`prototypes/globe/index.html` (~765 lines, a `globe.gl` 4K-globe spike; sibling
`threejs-version.html` + `data/`) — the source the component was extracted from; skim it for
behavior, don't re-read it whole.

## .claude/skills/expatise-qbank-localization/SKILL.md

Source of truth for the per-batch localization workflow (extraction → validate/match →
workbench → verdict pre-fill → apply → capture decisions). It auto-loads when the skill
triggers; read it **once per session** when doing localization work and follow it rather
than re-deriving the steps. Key gates live under "Guardrails" and "Hard-won lessons".

See also `README.md`, `AGENTS.md` (gstack/Codex workflow), and `expatise-snapshot.md`.

## Spanish (es) batch screenshots location

When preparing a new Spanish batch, screenshots are sourced from:
```
/Users/huni/Documents/Screenshots/Expatise/Laowai Drive Screenshots/Spanish
```

The workflow for each batch is:
1. Copy/link screenshots → `imports/es/batch-NNN/screenshots/`
2. Extract intake.json (agent-driven)
3. Validate, match, build workbench
4. Pre-fill verdicts
5. Human review and export
6. Ship to production

When you say "prepare batch N", check this location for the next ~50 screenshots.

## Operational quick-reference (durable facts — so you don't re-read session memory)

These are the standing rules for qbank work. The blow-by-blow history lives in the
auto-memory file `project_expatise_localization.md`; the durable rules are here.

- **Zero-API-cost by default.** Use agent-driven extraction (read screenshots with the
  Read tool, write `intake.json`) — do NOT call the OpenAI `extract-screenshot-intake`
  script or bill `OPENAI_API_KEY` unless explicitly told. Owner is migrating off OpenAI.
- **Ship a reviewed batch in one command:** `npm run ship-batch -- --lang <lang> --batch batch-NNN`
  (`scripts/ship-batch.mjs`) — finds the export in `/Users/huni/Downloads/Expatise/`,
  runs the pre-flight gates, applies to production, refreshes decision-memory + correction-rules.
  Use this instead of the manual chain. Aborts safely if already merged.
- **Master/tags operating agreement (firm).** `questions.json` (human-locked) and
  `image-color-tags.json` (additive) were repeatedly corrupted by automated edits.
  Never edit OR revert them unless the owner asked or you asked first. Constrain inferred
  image tags to the controlled vocab in `image-color-tags.json` `meta.*Vocabulary` — don't invent tags.
- **Pre-fill per question while fresh**, never leave unresolved: assign closest qid + best-effort
  answer key + a risk note in `reviewerNotes`; `deleteQuestion` ONLY for a CONFIRMED duplicate
  (text AND image identical) — a wrongly-deleted new question is unrecoverable.
  `claimed-qid-duplicate-suspect` is a flag to verify, NOT a confirmed dup.
- **Decision-memory → matcher loop** is the most valued asset: `npm run refresh-correction-rules`
  aggregates all `*-workbench-decisions.json` → `match-history.jsonl` → `correction-rules.json`,
  auto-loaded by `process-screenshot-batch`.
- **Duplicate sweep** (per-language verbatim-dup detection) lives partly in `scripts/`
  (`apply-duplicate-decisions.mjs`, `export-duplicate-review-decisions.mjs`). The per-language
  OCR→group→workbench *builder* is `scripts/dup-screenshot-sweep.mjs`
  (`<lang> <screenshotDir> <ocrTsv> <outDir>`). Sandbox gotcha: tesseract/`magick compare`
  intermittently can't read `/tmp`; write scratch crops into a project-dir folder (`.ocrtmp/`).
  Full method in `docs/localization-decisions.md`. (Note: `build-duplicate-candidate-review.mjs`
  is a *different* tool — it finds dups within the English master qbank, not screenshots.)
