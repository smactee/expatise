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
