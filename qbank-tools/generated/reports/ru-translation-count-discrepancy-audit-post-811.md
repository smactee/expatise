# Russian Translation Count Discrepancy Audit - Post 811

Generated at: 2026-05-01T09:09:44.016Z

Scope: read-only scan of `imports/ru`, generated staging/report/archive artifacts, and current working-tree qbank JSON. The script only wrote this markdown report.

## A. Executive Summary

- Current production Russian translation keys: **811** from `public/qbank/2023-test1/translations.ru.json`.
- Current master counts: **984** entries in `public/qbank/2023-test1/questions.json`; **985** entries in `public/qbank/2023-test1/questions.raw.json`.
- RU import batches found: **18** (batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18).
- Screenshot files under literal `imports/ru/batch-*/screenshots/`: **803**. Effective batch image files including legacy direct images in `batch-001` and `batch-002`: **907**.
- Intake items: **907**. Decision items: **907**. Matched/review-needed/unresolved source counts: **62/713/132**.
- The user-stated 902 -> 811 gap is **91**. The file-backed current source gap is **96** because this scan found 907 effective batch screenshots/intake items, 5 more than 902.
- Current-file reconciliation: **50** decisions are not approved existing qids, **44** approved decisions collapse into already-approved qids, and **2** unique approved qids are still absent from production. That reconciles 907 source items to **811** production qids.
- Likely missing/unmerged batch signal: **batch-08** by current approved-qid-vs-production comparison. Batch-08 is the only batch with current approved qids still missing from production.
- Batch-04 and batch-12 now have production merge reports and no current approved qids missing from production.

## B. Batch Inventory Table

| batch | screenshots | intake | matched | review-needed | unresolved source | decisions? | decisions | approved existing qid | create new | keep unresolved | delete | UNKNOWN answer | blank/no-op | unique approved qids | approved in production | approved missing production | likely merged | notes |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| batch-001 | 54 | 54 | 8 | 39 | 7 | yes | 54 | 50 | 2 | 2 | 0 | 0 | 0 | 49 | 49 | 0 | yes | images outside screenshots/ dir; 1 within-batch duplicate approvals |
| batch-002 | 50 | 50 | 9 | 30 | 11 | yes | 50 | 50 | 0 | 0 | 0 | 0 | 0 | 50 | 50 | 0 | yes | images outside screenshots/ dir |
| batch-03 | 50 | 50 | 0 | 50 | 0 | yes | 50 | 46 | 1 | 3 | 0 | 0 | 0 | 46 | 46 | 0 | yes |  |
| batch-04 | 50 | 50 | 4 | 45 | 1 | yes | 50 | 50 | 0 | 0 | 0 | 0 | 0 | 49 | 49 | 0 | yes | 1 within-batch duplicate approvals |
| batch-05 | 51 | 51 | 6 | 43 | 2 | yes | 51 | 47 | 2 | 2 | 0 | 0 | 0 | 47 | 47 | 0 | yes |  |
| batch-06 | 50 | 50 | 2 | 35 | 13 | yes | 50 | 48 | 1 | 1 | 0 | 0 | 0 | 48 | 48 | 0 | yes |  |
| batch-07 | 50 | 50 | 8 | 39 | 3 | yes | 50 | 46 | 4 | 0 | 0 | 0 | 0 | 46 | 46 | 0 | yes |  |
| batch-08 | 50 | 50 | 0 | 45 | 5 | yes | 50 | 46 | 3 | 1 | 0 | 0 | 0 | 46 | 44 | 2 | partial | 2 current approved qids missing from production; current decisions diverge from applied full preview |
| batch-09 | 50 | 50 | 2 | 41 | 7 | yes | 50 | 49 | 0 | 1 | 0 | 0 | 0 | 48 | 48 | 0 | yes | 1 within-batch duplicate approvals |
| batch-10 | 50 | 50 | 4 | 40 | 6 | yes | 50 | 47 | 2 | 1 | 0 | 0 | 0 | 47 | 47 | 0 | yes |  |
| batch-11 | 50 | 50 | 2 | 34 | 14 | yes | 50 | 49 | 1 | 0 | 0 | 2 | 0 | 49 | 49 | 0 | yes |  |
| batch-12 | 50 | 50 | 5 | 35 | 10 | yes | 50 | 41 | 7 | 2 | 0 | 2 | 0 | 41 | 41 | 0 | yes |  |
| batch-13 | 50 | 50 | 2 | 39 | 9 | yes | 50 | 48 | 1 | 0 | 1 | 0 | 0 | 48 | 48 | 0 | yes |  |
| batch-14 | 50 | 50 | 2 | 40 | 8 | yes | 50 | 49 | 0 | 0 | 1 | 2 | 0 | 49 | 49 | 0 | yes |  |
| batch-15 | 50 | 50 | 3 | 40 | 7 | yes | 50 | 47 | 1 | 0 | 2 | 1 | 0 | 47 | 47 | 0 | yes |  |
| batch-16 | 50 | 50 | 0 | 40 | 10 | yes | 50 | 49 | 1 | 0 | 0 | 0 | 0 | 49 | 49 | 0 | yes |  |
| batch-17 | 50 | 50 | 2 | 37 | 11 | yes | 50 | 48 | 2 | 0 | 0 | 0 | 0 | 48 | 48 | 0 | yes |  |
| batch-18 | 52 | 52 | 3 | 41 | 8 | yes | 52 | 47 | 2 | 3 | 0 | 0 | 0 | 47 | 47 | 0 | yes |  |

## C. Missing Batch/Gaps Analysis

Existing batch-like folders: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.

Valid import batch folders in order: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.

Missing batch numbers between first and last import batch: none.

Duplicate numeric batch folders: none.

Padding styles present: 2-digit, 3-digit (mixed padding style is present).

Generated artifact batch ids without exact import-folder names: batch-003, batch-19.

Generated artifact ids with numeric-equivalent import folders: batch-003 -> import batch number 3.

Generated artifact ids with no numeric-equivalent import folder: batch-19 (decisions=0).

Images outside `imports/ru/batch-*/`: 0.

`imports/ru/raw`: exists; files=0; image files=0.

## D. Production Missing Approved QIDs

| batch | approved qid | source screenshot/file | answer key |
|---|---|---|---|
| batch-08 | q0245 | screenshots/Screenshot 2026-04-19 at 18.52.47.png |  |
| batch-08 | q0176 | screenshots/Screenshot 2026-04-19 at 18.53.17.png | B |

## E. Non-production Terminal Decisions

### Create New Question Decisions

| batch | count | source screenshots / qids |
|---|---:|---|
| batch-001 | 2 | Screenshot 2026-04-19 at 18.46.46.png answer=C<br>Screenshot 2026-04-19 at 18.46.51.png answer=A |
| batch-03 | 1 | screenshots/150.png answer=A |
| batch-05 | 2 | screenshots/Screenshot 2026-04-19 at 18.50.07.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.50.01.png answer=A |
| batch-06 | 1 | screenshots/Screenshot 2026-04-19 at 18.51.32.png answer=C |
| batch-07 | 4 | screenshots/Screenshot 2026-04-19 at 18.51.55.png answer=C<br>screenshots/350.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.52.13 1.png answer=A<br>screenshots/Screenshot 2026-04-19 at 18.52.16.png answer=A |
| batch-08 | 3 | screenshots/Screenshot 2026-04-19 at 18.52.55 1.png answer=C<br>screenshots/Screenshot 2026-04-19 at 18.53.08.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.53.08 1.png answer=C |
| batch-10 | 2 | screenshots/Screenshot 2026-04-19 at 18.54.28 1.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.54.38 1.png answer=D |
| batch-11 | 1 | screenshots/Screenshot 2026-04-19 at 18.55.26 1.png answer=B |
| batch-12 | 7 | screenshots/Screenshot 2026-04-19 at 18.56.11.png answer=A<br>screenshots/Screenshot 2026-04-19 at 18.56.21 1.png answer=A<br>screenshots/Screenshot 2026-04-19 at 18.56.24.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.56.00.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.56.03.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.56.15.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.56.30.png answer=A |
| batch-13 | 1 | screenshots/Screenshot 2026-04-19 at 18.56.51.png answer=B |
| batch-15 | 1 | screenshots/Screenshot 2026-04-19 at 18.58.25.png answer=A |
| batch-16 | 1 | screenshots/800.png answer=C |
| batch-17 | 2 | screenshots/Screenshot 2026-04-19 at 18.59.49.png answer=A<br>screenshots/Screenshot 2026-04-19 at 19.00.08 1.png answer=A |
| batch-18 | 2 | screenshots/Screenshot 2026-04-19 at 19.00.40.png answer=A<br>screenshots/Screenshot 2026-04-19 at 19.00.51.png answer=C |

### Keep Unresolved Decisions

| batch | count | source screenshots / qids |
|---|---:|---|
| batch-001 | 2 | Screenshot 2026-04-19 at 18.46.34.png<br>Screenshot 2026-04-19 at 18.46.59.png answer=A |
| batch-03 | 3 | screenshots/Screenshot 2026-04-19 at 18.48.21.png answer=B<br>screenshots/Screenshot 2026-04-19 at 18.48.34.png<br>screenshots/Screenshot 2026-04-19 at 18.48.44.png answer=D |
| batch-05 | 2 | screenshots/Screenshot 2026-04-19 at 18.50.20.png answer=A<br>screenshots/Screenshot 2026-04-19 at 18.50.23 1.png |
| batch-06 | 1 | screenshots/Screenshot 2026-04-19 at 18.51.11 1.png answer=C |
| batch-08 | 1 | screenshots/Screenshot 2026-04-19 at 18.52.41.png answer=D |
| batch-09 | 1 | screenshots/Screenshot 2026-04-19 at 18.53.34.png |
| batch-10 | 1 | screenshots/Screenshot 2026-04-19 at 18.54.24 1.png answer=D |
| batch-12 | 2 | screenshots/Screenshot 2026-04-19 at 18.56.08.png answer=UNKNOWN<br>screenshots/Screenshot 2026-04-19 at 18.56.27 1.png answer=UNKNOWN |
| batch-18 | 3 | screenshots/Screenshot 2026-04-19 at 19.00.34.png<br>screenshots/Screenshot 2026-04-19 at 19.00.35.png<br>screenshots/Screenshot 2026-04-19 at 19.00.53.png answer=D |

### Delete Question Decisions

| batch | count | source screenshots / qids |
|---|---:|---|
| batch-13 | 1 | screenshots/Screenshot 2026-04-19 at 18.56.57.png |
| batch-14 | 1 | screenshots/Screenshot 2026-04-19 at 18.57.40.png |
| batch-15 | 2 | screenshots/Screenshot 2026-04-19 at 18.58.12 1.png<br>screenshots/Screenshot 2026-04-19 at 18.58.20.png answer=UNKNOWN |

### UNKNOWN Answer Key Decisions

| batch | count | source screenshots / qids |
|---|---:|---|
| batch-11 | 2 | screenshots/Screenshot 2026-04-19 at 18.55.41.png qid=q0234 answer=UNKNOWN<br>screenshots/Screenshot 2026-04-19 at 18.55.05 1.png qid=q0921 answer=UNKNOWN |
| batch-12 | 2 | screenshots/Screenshot 2026-04-19 at 18.56.08.png answer=UNKNOWN<br>screenshots/Screenshot 2026-04-19 at 18.56.27 1.png answer=UNKNOWN |
| batch-14 | 2 | screenshots/Screenshot 2026-04-19 at 18.57.46.png qid=q0281 answer=UNKNOWN<br>screenshots/Screenshot 2026-04-19 at 18.57.54.png qid=q0240 answer=UNKNOWN |
| batch-15 | 1 | screenshots/Screenshot 2026-04-19 at 18.58.20.png answer=UNKNOWN |

### Blank / No-op / Unfinished Decisions

None found.

## F. Duplicate/Collision Analysis

Duplicate approved qids across all RU batches: **41 qids**, accounting for **44** extra screenshot/decision items that collapse into already-approved qids.

| qid | approvals | duplicate items | batches/screenshots |
|---|---:|---:|---|
| q0053 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.47.29 1.png<br>batch-002:Screenshot 2026-04-19 at 18.47.29 1.png |
| q0062 | 2 | 1 | batch-06:screenshots/Screenshot 2026-04-19 at 18.51.39.png<br>batch-17:screenshots/Screenshot 2026-04-19 at 19.00.00 1.png answer=A |
| q0064 | 2 | 1 | batch-06:screenshots/Screenshot 2026-04-19 at 18.51.13 1.png<br>batch-07:screenshots/Screenshot 2026-04-19 at 18.52.28 1.png |
| q0069 | 2 | 1 | batch-06:screenshots/Screenshot 2026-04-19 at 18.51.20 1.png<br>batch-18:screenshots/Screenshot 2026-04-19 at 19.01.09.png |
| q0070 | 2 | 1 | batch-11:screenshots/Screenshot 2026-04-19 at 18.55.25.png<br>batch-18:screenshots/Screenshot 2026-04-19 at 19.00.48.png |
| q0162 | 3 | 2 | batch-05:screenshots/Screenshot 2026-04-19 at 18.50.04.png answer=A<br>batch-08:screenshots/Screenshot 2026-04-19 at 18.53.12.png answer=D<br>batch-16:screenshots/Screenshot 2026-04-19 at 18.59.03.png answer=C |
| q0187 | 2 | 1 | batch-04:screenshots/Screenshot 2026-04-19 at 18.49.24.png answer=A<br>batch-09:screenshots/Screenshot 2026-04-19 at 18.53.59 1.png |
| q0208 | 2 | 1 | batch-04:screenshots/Screenshot 2026-04-19 at 18.49.20.png answer=A<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.30.png |
| q0210 | 2 | 1 | batch-09:screenshots/Screenshot 2026-04-19 at 18.53.42.png<br>batch-09:screenshots/Screenshot 2026-04-19 at 18.53.58.png |
| q0223 | 2 | 1 | batch-06:screenshots/Screenshot 2026-04-19 at 18.51.23.png<br>batch-15:screenshots/Screenshot 2026-04-19 at 18.58.21.png |
| q0234 | 2 | 1 | batch-04:screenshots/Screenshot 2026-04-19 at 18.49.13.png answer=A<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.41.png answer=UNKNOWN |
| q0237 | 2 | 1 | batch-07:screenshots/Screenshot 2026-04-19 at 18.52.13.png<br>batch-14:screenshots/Screenshot 2026-04-19 at 18.57.26 1.png |
| q0262 | 2 | 1 | batch-10:screenshots/Screenshot 2026-04-19 at 18.54.46 1.png<br>batch-16:screenshots/Screenshot 2026-04-19 at 18.59.01.png answer=B |
| q0285 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.46.36.png<br>batch-10:screenshots/Screenshot 2026-04-19 at 18.54.18 1.png |
| q0293 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.47.41.png<br>batch-12:screenshots/Screenshot 2026-04-19 at 18.56.22.png |
| q0316 | 3 | 2 | batch-001:Screenshot 2026-04-19 at 18.46.58.png<br>batch-13:screenshots/Screenshot 2026-04-19 at 18.56.50.png<br>batch-18:screenshots/Screenshot 2026-04-19 at 19.00.29.png |
| q0323 | 2 | 1 | batch-04:screenshots/Screenshot 2026-04-19 at 18.49.19.png answer=A<br>batch-04:screenshots/Screenshot 2026-04-19 at 18.49.24 1.png answer=A |
| q0345 | 2 | 1 | batch-04:screenshots/Screenshot 2026-04-19 at 18.49.35.png answer=B<br>batch-14:screenshots/Screenshot 2026-04-19 at 18.58.01.png |
| q0347 | 2 | 1 | batch-16:screenshots/Screenshot 2026-04-19 at 18.59.27 1.png answer=A<br>batch-17:screenshots/Screenshot 2026-04-19 at 19.00.00.png answer=A |
| q0367 | 2 | 1 | batch-03:screenshots/Screenshot 2026-04-19 at 18.48.48 1.png answer=B<br>batch-12:screenshots/Screenshot 2026-04-19 at 18.56.00 1.png answer=D |
| q0383 | 2 | 1 | batch-04:screenshots/200.png answer=C<br>batch-05:screenshots/200.png answer=C |
| q0420 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.47.47.png answer=C<br>batch-10:screenshots/Screenshot 2026-04-19 at 18.54.20.png answer=C |
| q0442 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.47.28.png answer=D<br>batch-07:screenshots/Screenshot 2026-04-19 at 18.52.30 1.png answer=A |
| q0446 | 2 | 1 | batch-07:screenshots/Screenshot 2026-04-19 at 18.52.19 1.png answer=B<br>batch-10:screenshots/Screenshot 2026-04-19 at 18.54.40.png answer=B |
| q0471 | 2 | 1 | batch-05:screenshots/Screenshot 2026-04-19 at 18.50.26.png answer=A<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.31.png answer=D |
| q0474 | 2 | 1 | batch-14:screenshots/Screenshot 2026-04-19 at 18.57.43.png answer=B<br>batch-16:screenshots/Screenshot 2026-04-19 at 18.59.13.png answer=C |
| q0517 | 2 | 1 | batch-10:screenshots/Screenshot 2026-04-19 at 18.54.20 1.png answer=A<br>batch-13:screenshots/Screenshot 2026-04-19 at 18.57.15.png answer=B |
| q0522 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.46.51 1.png<br>batch-13:screenshots/Screenshot 2026-04-19 at 18.56.44 1.png |
| q0525 | 2 | 1 | batch-03:screenshots/Screenshot 2026-04-19 at 18.48.47.png<br>batch-09:screenshots/Screenshot 2026-04-19 at 18.53.54.png |
| q0577 | 2 | 1 | batch-05:screenshots/Screenshot 2026-04-19 at 18.50.29.png answer=B<br>batch-10:screenshots/Screenshot 2026-04-19 at 18.54.43.png answer=B |
| q0600 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.47.45 1.png answer=D<br>batch-10:screenshots/Screenshot 2026-04-19 at 18.54.17.png answer=D |
| q0635 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.47.29.png<br>batch-002:Screenshot 2026-04-19 at 18.47.29.png |
| q0647 | 2 | 1 | batch-07:screenshots/Screenshot 2026-04-19 at 18.51.56.png<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.06.png |
| q0649 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.47.56.png<br>batch-12:screenshots/Screenshot 2026-04-19 at 18.56.12.png |
| q0666 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.47.27.png answer=D<br>batch-002:Screenshot 2026-04-19 at 18.47.27.png answer=D |
| q0670 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.46.45 1.png answer=D<br>batch-001:Screenshot 2026-04-19 at 18.46.56.png answer=D |
| q0720 | 2 | 1 | batch-002:Screenshot 2026-04-19 at 18.48.03.png answer=A<br>batch-17:screenshots/Screenshot 2026-04-19 at 18.59.55.png answer=A |
| q0726 | 2 | 1 | batch-10:screenshots/Screenshot 2026-04-19 at 18.54.25.png answer=B<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.37 1.png answer=C |
| q0802 | 2 | 1 | batch-07:screenshots/Screenshot 2026-04-19 at 18.52.07.png answer=C<br>batch-15:screenshots/Screenshot 2026-04-19 at 18.58.31.png answer=D |
| q0921 | 2 | 1 | batch-001:Screenshot 2026-04-19 at 18.46.54 1.png<br>batch-11:screenshots/Screenshot 2026-04-19 at 18.55.05 1.png answer=UNKNOWN |
| q0981 | 3 | 2 | batch-002:Screenshot 2026-04-19 at 18.47.38 1.png answer=A<br>batch-04:screenshots/Screenshot 2026-04-19 at 18.49.26.png answer=D<br>batch-15:screenshots/Screenshot 2026-04-19 at 18.58.16.png answer=A |

Approved qids outside current `questions.json`: none.

Approved qids outside current `questions.raw.json`: none.

## G. Exact Gap Math

The exact historical 902 baseline cannot be proven from the current filesystem because the current import folders contain 907 effective batch image/intake items. The current-file math is exact:

```text
907 effective RU screenshot/intake items found now
- 0 screenshots/intake items without discovered decisions
= 907 workbench decision items
- 50 decisions not approved to an existing qid
  (30 create-new, 16 keep-unresolved, 4 delete, 0 blank/no-op; flags may overlap only if the source data is inconsistent)
= 857 approved existing-qid decision items
- 44 duplicate approved-qid decision items
= 813 unique approved existing qids
- 2 unique approved qids still missing from production
= 811 production translated qids explained by current decisions
current translations.ru.json = 811 qids
```

Against the user-stated 902 baseline, the gap is 91. This scan found 907, so five current source items are outside that remembered baseline. No approved existing qids are outside `questions.raw.json`; screenshots outside the current master qbank cannot be proven from image files alone, but create-new decisions (30) are the strongest file-backed candidate for source screenshots that do not map to an existing production qid.

## H. Next Actions

1. Inspect `batch-08` first. It is the only current batch with approved qids missing from production (`q0176`, `q0245`).
2. Open the current or archived `ru-batch-08-workbench.html` and verify whether `q0176` and `q0245` should still be approved, or whether the current decision export is newer than the already-merged preview.
3. If those approvals are valid, regenerate/apply staging for batch-08 before any production merge. Do not merge until the full preview/dry-run shows those qids and the diff is reviewed.

Suggested commands to run manually next, in order:

```bash
npm run generate-batch-workbench -- --lang ru --batch batch-08
npm run apply-batch-workbench-decisions -- --lang ru --batch batch-08
npm run apply-production-localization-merge -- --lang ru --batch batch-08
```

Merge commands above are listed for manual follow-up only; this audit did not run them.

## Production Coverage Snapshot

| metric | count | notes |
|---|---:|---|
| translation qids | 811 | keys in `translations.ru.json.questions` |
| qids with prompt-like field | 811 | `prompt`, `questionText`, or `localizedPrompt` |
| qids with options-like field | 507 | `options` or option-key fields |
| qids with answer-like field | 507 | answer/correct-option fields |
| qids with non-empty explanation | 0 | `explanation` or `localizedExplanation` |
| master questions in questions.json | 984 | current working tree |
| master questions in questions.raw.json | 985 | current working tree |
| coverage vs questions.json | 811/984 | 82.4% |
| coverage vs questions.raw.json | 811/985 | 82.3% |

## Merge Artifact Audit

Batches with screenshots/intake but no decisions: none.

Batches with screenshots but no intake: none.

Batches with decisions but missing full preview or full merge dry-run: none.

Batches with staging/merge outputs not reflected in production by full-preview qid comparison: none.

Batches not clearly merged by current decision-vs-production status: batch-08 (partial).

Batches with zero screenshots: none.

| batch | decisions path | full preview | full dry-run | apply report | production merge report | workbench report | full-preview qids missing production |
|---|---|---|---|---|---|---|---:|
| batch-001 | `qbank-tools/generated/staging/ru-batch-001-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-001/staging/translations.ru.batch-001.full.preview.json` | `qbank-tools/generated/archive/ru/batch-001/staging/translations.ru.batch-001.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-001.json` | `qbank-tools/generated/reports/production-merge-ru-batch-001.json` | `qbank-tools/generated/archive/ru/batch-001/reports/ru-batch-001-workbench.html` | 0 |
| batch-002 | `qbank-tools/generated/staging/ru-batch-002-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-002/staging/translations.ru.batch-002.full.preview.json` | `qbank-tools/generated/archive/ru/batch-002/staging/translations.ru.batch-002.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-002.json` | `qbank-tools/generated/reports/production-merge-ru-batch-002.json` | `qbank-tools/generated/archive/ru/batch-002/reports/ru-batch-002-workbench.html` | 0 |
| batch-03 | `qbank-tools/generated/staging/ru-batch-03-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-03/staging/translations.ru.batch-03.full.preview.json` | `qbank-tools/generated/archive/ru/batch-03/staging/translations.ru.batch-03.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-03.json` | `qbank-tools/generated/reports/production-merge-ru-batch-03.json` | `qbank-tools/generated/archive/ru/batch-03/reports/ru-batch-03-workbench.html` | 0 |
| batch-04 | `qbank-tools/generated/staging/ru-batch-04-workbench-decisions.json` | `qbank-tools/generated/staging/translations.ru.batch-04.full.preview.json` | `qbank-tools/generated/staging/translations.ru.batch-04.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-04.json` | `qbank-tools/generated/reports/production-merge-ru-batch-04.json` | `qbank-tools/generated/reports/ru-batch-04-workbench.html` | 0 |
| batch-05 | `qbank-tools/generated/staging/ru-batch-05-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-05/staging/translations.ru.batch-05.full.preview.json` | `qbank-tools/generated/archive/ru/batch-05/staging/translations.ru.batch-05.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-05.json` | `qbank-tools/generated/reports/production-merge-ru-batch-05.json` | `qbank-tools/generated/archive/ru/batch-05/reports/ru-batch-05-workbench.html` | 0 |
| batch-06 | `qbank-tools/generated/staging/ru-batch-06-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-06/staging/translations.ru.batch-06.full.preview.json` | `qbank-tools/generated/archive/ru/batch-06/staging/translations.ru.batch-06.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-06.json` | `qbank-tools/generated/reports/production-merge-ru-batch-06.json` | `qbank-tools/generated/archive/ru/batch-06/reports/ru-batch-06-workbench.html` | 0 |
| batch-07 | `qbank-tools/generated/staging/ru-batch-07-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-07/staging/translations.ru.batch-07.full.preview.json` | `qbank-tools/generated/archive/ru/batch-07/staging/translations.ru.batch-07.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-07.json` | `qbank-tools/generated/reports/production-merge-ru-batch-07.json` | `qbank-tools/generated/archive/ru/batch-07/reports/ru-batch-07-workbench.html` | 0 |
| batch-08 | `qbank-tools/generated/staging/ru-batch-08-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-08/staging/translations.ru.batch-08.full.preview.json` | `qbank-tools/generated/archive/ru/batch-08/staging/translations.ru.batch-08.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-08.json` | `qbank-tools/generated/reports/production-merge-ru-batch-08.json` | `qbank-tools/generated/archive/ru/batch-08/reports/ru-batch-08-workbench.html` | 0 |
| batch-09 | `qbank-tools/generated/staging/ru-batch-09-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-09/staging/translations.ru.batch-09.full.preview.json` | `qbank-tools/generated/archive/ru/batch-09/staging/translations.ru.batch-09.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-09.json` | `qbank-tools/generated/reports/production-merge-ru-batch-09.json` | `qbank-tools/generated/archive/ru/batch-09/reports/ru-batch-09-workbench.html` | 0 |
| batch-10 | `qbank-tools/generated/staging/ru-batch-10-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-10/staging/translations.ru.batch-10.full.preview.json` | `qbank-tools/generated/archive/ru/batch-10/staging/translations.ru.batch-10.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-10.json` | `qbank-tools/generated/reports/production-merge-ru-batch-10.json` | `qbank-tools/generated/reports/ru-batch-10-workbench.html` | 0 |
| batch-11 | `qbank-tools/generated/staging/ru-batch-11-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-11/staging/translations.ru.batch-11.full.preview.json` | `qbank-tools/generated/archive/ru/batch-11/staging/translations.ru.batch-11.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-11.json` | `qbank-tools/generated/reports/production-merge-ru-batch-11.json` | `qbank-tools/generated/archive/ru/batch-11/reports/ru-batch-11-workbench.html` | 0 |
| batch-12 | `qbank-tools/generated/staging/ru-batch-12-workbench-decisions.json` | `qbank-tools/generated/staging/translations.ru.batch-12.full.preview.json` | `qbank-tools/generated/staging/translations.ru.batch-12.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-12.json` | `qbank-tools/generated/reports/production-merge-ru-batch-12.json` | `qbank-tools/generated/reports/ru-batch-12-workbench.html` | 0 |
| batch-13 | `qbank-tools/generated/staging/ru-batch-13-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-13/staging/translations.ru.batch-13.full.preview.json` | `qbank-tools/generated/archive/ru/batch-13/staging/translations.ru.batch-13.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-13.json` | `qbank-tools/generated/reports/production-merge-ru-batch-13.json` | `qbank-tools/generated/reports/ru-batch-13-workbench.html` | 0 |
| batch-14 | `qbank-tools/generated/staging/ru-batch-14-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-14/staging/translations.ru.batch-14.full.preview.json` | `qbank-tools/generated/archive/ru/batch-14/staging/translations.ru.batch-14.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-14.json` | `qbank-tools/generated/reports/production-merge-ru-batch-14.json` | `qbank-tools/generated/archive/ru/batch-14/reports/ru-batch-14-workbench.html` | 0 |
| batch-15 | `qbank-tools/generated/staging/ru-batch-15-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-15/staging/translations.ru.batch-15.full.preview.json` | `qbank-tools/generated/archive/ru/batch-15/staging/translations.ru.batch-15.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-15.json` | `qbank-tools/generated/reports/production-merge-ru-batch-15.json` | `qbank-tools/generated/archive/ru/batch-15/reports/ru-batch-15-workbench.html` | 0 |
| batch-16 | `qbank-tools/generated/staging/ru-batch-16-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-16/staging/translations.ru.batch-16.full.preview.json` | `qbank-tools/generated/archive/ru/batch-16/staging/translations.ru.batch-16.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-16.json` | `qbank-tools/generated/reports/production-merge-ru-batch-16.json` | `qbank-tools/generated/archive/ru/batch-16/reports/ru-batch-16-workbench.html` | 0 |
| batch-17 | `qbank-tools/generated/staging/ru-batch-17-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-17/staging/translations.ru.batch-17.full.preview.json` | `qbank-tools/generated/archive/ru/batch-17/staging/translations.ru.batch-17.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-17.json` | `qbank-tools/generated/reports/production-merge-ru-batch-17.json` | `qbank-tools/generated/archive/ru/batch-17/reports/ru-batch-17-workbench.html` | 0 |
| batch-18 | `qbank-tools/generated/staging/ru-batch-18-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-18/staging/translations.ru.batch-18.full.preview.json` | `qbank-tools/generated/archive/ru/batch-18/staging/translations.ru.batch-18.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-18.json` | `qbank-tools/generated/reports/production-merge-ru-batch-18.json` | `qbank-tools/generated/archive/ru/batch-18/reports/ru-batch-18-workbench.html` | 0 |

## Validation

- Script: `scripts/audit-ru-translation-discrepancy.mjs`
- Report output: `qbank-tools/generated/reports/ru-translation-count-discrepancy-audit-post-811.md`
- Re-run command: `node scripts/audit-ru-translation-discrepancy.mjs`

