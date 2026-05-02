# QBank Localization Pipeline

This folder contains the non-destructive screenshot-to-localization tooling scaffold for the qbank.

What was created:

- `qbank-tools/generated/match-index.json` builds a match-ready lookup index from `questions.json`, `questions.raw.json`, `tags.patch.json`, and `translations.ko.json`.
- `qbank-tools/generated/asset-rename-map.json` and `qbank-tools/generated/asset-rename-preview.csv` are dry-run previews only. They do not rename any production assets.
- `imports/<lang>/batch-###/` holds one screenshot batch at a time with raw screenshots, `intake.json`, `extraction-report.json`, `matched.json`, `review-needed.json`, and `unresolved.json`.
- `qbank-tools/generated/staging/` is the temporary active workspace for the current batch or release-critical apply inputs only.
- `qbank-tools/history/decisions/` preserves completed human/Codex/Notebook/script decision JSON so old batch intelligence remains available without crowding active staging.
- `qbank-tools/generated/archive/` holds old regenerated artifacts, previews, dry-runs, diagnostics, and bulky cleanup outputs that are not active inputs.

Run this first:

```bash
npm run build-match-index
npm run dry-run-asset-rename
```

Extract screenshot intake from a batch directory:

```bash
npm run extract-screenshot-intake -- --lang ko --batch batch-001
```

Start the next Japanese batch after adding screenshots to `imports/ja/batch-002/screenshots/`:

```bash
npm run extract-screenshot-intake -- --lang ja --batch batch-002
```

Notes:

- Put the temporary screenshot files directly inside `imports/ko/batch-001/` or a subfolder under that batch.
- The extractor uses the OpenAI Responses API image-input flow and writes both raw OCR-style fields and the translated matcher fields into `imports/ko/batch-001/intake.json`.
- Low-confidence screenshots are kept in the batch with `extractionStatus: "partial"` or `"failed"` instead of being forced into a bad parse.
- The batch report is written to `imports/<lang>/batch-###/extraction-report.json`.

Validate the extracted intake:

```bash
npm run validate-screenshot-intake -- --lang ko --batch batch-001
```

Run matching after extraction:

```bash
npm run process-screenshot-batch -- --lang ko --batch batch-001
```

Generate the self-contained review artifact:

```bash
npm run generate-batch-review-artifact -- --lang ja --batch batch-001
```

Preferred compressed workflow for new batches:

```bash
npm run extract-screenshot-intake -- --lang ja --batch batch-003
npm run validate-screenshot-intake -- --lang ja --batch batch-003
npm run process-screenshot-batch -- --lang ja --batch batch-003
npm run validate-localization-batch -- --lang ja --batch batch-003
npm run generate-batch-workbench -- --lang ja --batch batch-003
```

After reviewing the single workbench HTML and exporting the unified decisions JSON:

```bash
npm run apply-batch-workbench-decisions -- --lang ja --batch batch-003
```

Notes:

- The preferred workbench page is written to `qbank-tools/generated/reports/<lang>-<batch>-workbench.html`.
- The unified editable/exported decisions file is `qbank-tools/generated/staging/<lang>-<batch>-workbench-decisions.json`.
- One apply command stages reviewed items, applies answer-key confirmations, applies unresolved rescues, keeps new-question candidates separate, and rebuilds the full existing-qid dry-run merge set.
- The final dry-run outputs remain:
  - `qbank-tools/generated/staging/translations.<lang>.<batch>.full.preview.json`
  - `qbank-tools/generated/staging/translations.<lang>.<batch>.full.merge-dry-run.json`
  - `qbank-tools/generated/reports/full-batch-merge-review-<lang>-<batch>.json`
  - `qbank-tools/generated/reports/full-batch-merge-review-<lang>-<batch>.md`
- The older multi-page flow remains available for compatibility, but the unified workbench is the preferred path for new batches.

New-question candidate workflow:

```bash
npm run stage-new-question-candidates -- --lang ja --batch batch-001
npm run prepare-new-question-promotion-preview -- --lang ja --batch batch-001
npm run build-localization-coverage-report -- --lang ja --batch batch-001
```

Notes:

- Review decisions now support `createNewQuestion: true` alongside `approvedQid`, `noneOfThese`, and `unsure`.
- The self-contained review page is written to `qbank-tools/generated/reports/<lang>-<batch>-review.html`.
- Edit `qbank-tools/generated/staging/<lang>-<batch>-review-decisions.template.json` after review, or export decisions from the HTML page and replace that staged file.
- Running `stage-new-question-candidates` writes:
  - `qbank-tools/generated/staging/new-question-decisions.<lang>.<batch>.json`
  - `qbank-tools/generated/staging/new-question-candidates.<lang>.<batch>.json`
- Running `prepare-new-question-promotion-preview` writes `qbank-tools/generated/staging/new-question-promotion-preview.<lang>.<batch>.json` with preview-only `qx....` ids and appended master numbers.
- Running `build-localization-coverage-report` writes `qbank-tools/generated/reports/localization-coverage-matrix.<lang>.<batch>.json`.

Missing-qid backfill workflow:

Use this when a shipped language is valid but incomplete. The English master `questions.json` remains the source of truth; missing target-language qids are generated from that master, reviewed, validated, then merged only after explicit approval.

```bash
npm run build-missing-localization-backfill -- --lang ru
npm run generate-missing-localization-draft -- --lang ru --limit 20
npm run review-generated-localization-quality -- --lang ru --input qbank-tools/generated/staging/backfill.ru.generated-draft.json
npm run validate-missing-localization-backfill -- --lang ru
npm run apply-reviewed-missing-localization-backfill -- --lang ru --input qbank-tools/generated/staging/backfill.ru.reviewed.json
npm run apply-reviewed-missing-localization-backfill -- --lang ru --input qbank-tools/generated/staging/backfill.ru.reviewed.json --apply true
```

Notes:

- `build-missing-localization-backfill` writes `qbank-tools/generated/staging/backfill.<lang>.missing-qids.json` with English prompt/options, correct answer metadata, tags, and image metadata for each qid missing from `translations.<lang>.json`.
- `generate-missing-localization-draft` writes `qbank-tools/generated/staging/backfill.<lang>.generated-draft.json`. With `OPENAI_API_KEY` available it generates review-only draft translations; with `--no-ai true` or no key it fails closed with `generationStatus: "not_generated"`. It must not invent production translations or bypass review.
- `review-generated-localization-quality` writes `qbank-tools/generated/reports/backfill-quality-review.<lang>.json` and `.md`, plus `qbank-tools/generated/staging/backfill.<lang>.needs-fix.json` and `qbank-tools/generated/staging/backfill.<lang>.reviewed.json`. It reviews generated target-language text against English master meaning, option mapping, answer logic, numeric/legal/traffic terminology, and image context. If no OpenAI key is available or confidence is below `0.92`, it fails closed into `needs_fix`; answer-key risk is always `reject`.
- `validate-missing-localization-backfill` writes `qbank-tools/generated/reports/backfill-validation.<lang>.json` and `.md`, checking qid existence, production-missing status, duplicate qids, option coverage, answer mapping, and human-review requirements.
- `apply-reviewed-missing-localization-backfill` is dry-run by default and writes `qbank-tools/generated/reports/backfill-production-merge.<lang>.json` and `.md`. It refuses unapproved items and refuses to overwrite existing production qids unless explicitly allowed.
- Reviewed backfill files should keep `reviewStatus: "approved"` only after human review; do not merge generated draft output directly.

QBank Integrity Audit:

Run this before starting a new language and after any master/backfill merge:

```bash
npm run audit-qbank-integrity
npm run audit-qbank-integrity -- --strict true
```

Notes:

- The audit writes `qbank-tools/generated/reports/qbank-integrity-audit.json` and `.md`.
- It checks `questions.json`, `questions.raw.json`, `tags.patch.json`, `image-color-tags.json`, image assets, and every `translations.<lang>.json`.
- Critical blockers include invalid ROW/MCQ answer schema, malformed translation entries, ROW translations carrying MCQ-only answer-key fields, and missing referenced image assets.
- Warnings include raw/master qid drift such as raw-only qids, missing/extra translation qids, tag inconsistencies, and conservative duplicate candidates.
- The default audit is report-only. `--strict true` exits nonzero when critical blockers are present.

Decision Memory System:

After a language run, normalize reusable decision intelligence into history:

```bash
npm run build-decision-memory
```

Notes:

- The memory builder writes `qbank-tools/history/decision-memory.json` and `.md`.
- It extracts decisions from `qbank-tools/history/decisions/`, generated reports, active staging, archives, relevant imports, and final production translation state.
- It preserves human decisions, AI quality reviews, rejected/needs-fix records, answer-key fixes, duplicate decisions, master-data issues, and backfill merge evidence.
- It does not include screenshots or image blobs.
- Future matchers and reviewer prompts should use this memory as reusable examples, not as an independent question source.

Finalizing a Localization Run:

Use the finalizer after a language is fully merged, audited, and ship-ready:

```bash
npm run finalize-localization-run -- --lang ru --apply false
npm run finalize-localization-run -- --lang ru --apply true
```

Notes:

- The finalizer is dry-run by default. It only moves files with `--apply true`.
- It verifies zero missing qids for the language, ship-readiness `ship`, zero qbank-integrity critical blockers, and zero tracked screenshots.
- Decision-like staging/report JSON is moved into `qbank-tools/history/decisions/`.
- Regenerable staging/report clutter is moved into `qbank-tools/generated/archive/finalized-runs/<lang>/<timestamp>/`.
- It keeps active reports limited to the latest ship-readiness report and qbank integrity audit.
- It writes a manifest to `qbank-tools/history/finalized-runs/<lang>-finalization-<timestamp>.json` and `.md`.

Rules for staging/history/archive:

- `qbank-tools/generated/staging/` is temporary active workspace only.
- `qbank-tools/history/decisions/` stores reusable decision intelligence after a batch or language is complete.
- `qbank-tools/history/decision-memory.json` is normalized memory generated from preserved decisions and reports.
- `qbank-tools/generated/archive/` stores old regenerated artifacts, previews, dry-runs, report clutter, and bulky outputs.
- Production should only contain app-needed qbank files and translations.
- Screenshots and raw intake artifacts should not be tracked by Git.
- If unsure whether a file contains decision value, preserve it in history or archive rather than deleting it.

Recommended sequence before starting a new language:

```bash
npm run audit-qbank-integrity -- --strict true
npm run build-decision-memory
```

Recommended sequence after completing a language:

```bash
npm run audit-qbank-integrity
npm run build-decision-memory
npm run finalize-localization-run -- --lang ru --apply false
npm run finalize-localization-run -- --lang ru --apply true
npm run build
git status --short
```

Completed-batch cleanup:

```bash
npm run cleanup-localization-batch -- --lang ja --batch batch-001 --apply true
```

To archive raw batch inputs/screenshots after a production merge:

```bash
npm run cleanup-localization-batch -- --lang ja --batch batch-001 --archive-imports true --apply true
```

Notes:

- Active audit/source files stay in place under `imports/<lang>/<batch>/`.
- With `--archive-imports true`, active audit/source files and screenshots are moved to `qbank-tools/generated/archive/<lang>/<batch>/imports/`.
- Final review decisions, final answer-key decisions, final production merge reports, and `public/qbank/.../translations.<lang>.json` are preserved.
- After a batch/release is no longer active, promote completed decision JSON from `qbank-tools/generated/staging/` to `qbank-tools/history/decisions/`; keep staging limited to the current batch/release apply inputs.
- Regenerable review HTML, templates, dry-run previews, and intermediate batch reports are archived to `qbank-tools/generated/archive/<lang>/<batch>/`.
- Screenshot folders and other heavy raw intake assets are local/generated artifacts and should not be tracked in Git.
- Only obvious junk such as `.DS_Store` is deleted.

Manual review before Phase 2:

- Review `imports/<lang>/batch-###/extraction-report.json` for failed or partial OCR items.
- Review `imports/<lang>/batch-###/intake.json` for any screenshot where `manualReview` is true.
- Review `qbank-tools/generated/asset-rename-preview.csv` for naming quality and any unexpected semantic slugs.
- Review `imports/<lang>/batch-###/review-needed.json` and `imports/<lang>/batch-###/unresolved.json`.
- Only add `reviewDecision: "approve"` and `approvedLocalization` after confirming the matched qid and translation-key mapping.
- Use `createNewQuestion: true` when a screenshot appears to represent a genuinely new item that should be staged for a future superset master bank instead of forced into an existing qid.
- Do not apply asset renames or write to `public/qbank/.../translations.<lang>.json` from this pass.
