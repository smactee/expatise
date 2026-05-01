# Russian Translation Count Discrepancy Audit

Generated at: 2026-05-01T09:04:13.889Z

Scope: read-only scan of `imports/ru`, generated staging/report/archive artifacts, and current working-tree qbank JSON. The script only wrote this markdown report.

## A. Executive Summary

- Current production Russian translation keys: **811** from `public/qbank/2023-test1/translations.ru.json`.
- Current master question entries: **984** from `public/qbank/2023-test1/questions.json` (82.4% covered by translation-key count). User memory mentioned 985; this working tree currently has 984.
- RU batch folders found: **18** (batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18).
- Screenshot files under literal `imports/ru/batch-*/screenshots/`: **803**. Effective batch image files including legacy direct images in `batch-001` and `batch-002`: **907**.
- Intake items across batches: **907**. Matched/review-needed/unresolved totals: **62/713/132**.
- Workbench decisions found for **18** batches, covering **907** decision items.
- Existing-qid approvals in the current workbench-decision files: **857** decisions across **813** unique approved qids. Duplicate approvals to the same qid account for **44** decision items across all batches (3 of those are duplicated within the same batch).
- Non-existing-qid or non-finalized decisions account for **50** items: **30** create-new, **16** explicit keep-unresolved, **4** delete, and **0** with no approved qid or terminal action in the current decision export.
- Approved qids absent from current production translations: **2** unique qids. These are concentrated in batch-08.

Likely explanation: the 902-ish source count is a screenshot/intake count, not a count of unique existing production qids. The gap to 732 is explained by current decision files as: 91 items not approved to an existing qid, 42 duplicate approved-qid decisions across batches, and 42 unique approved qids that are not in current production translations. Batch-12 is the main missing merge candidate: it has current workbench decisions but no discovered apply-workbench report, full preview, dry-run, or production-merge report. Batch-08 also has two approved qids in the current decision file that are absent from production and absent from the archived/applied full preview, which indicates the current decision export diverges from what was merged.

## B. Batch Inventory

| batch | screenshots | intake | matched | review-needed | unresolved | decisions? | decisions | approve existing qid | create new | keep unresolved | delete | UNKNOWN answer | full preview? | full merge dry-run? | archive? | likely production merged | notes |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|
| batch-001 | 54 | 54 | 8 | 39 | 7 | yes | 54 | 50 | 2 | 2 | 0 | 0 | yes | yes | yes | yes | images are outside screenshots/ dir; 1 within-batch duplicate approved-qid decisions |
| batch-002 | 50 | 50 | 9 | 30 | 11 | yes | 50 | 50 | 0 | 0 | 0 | 0 | yes | yes | yes | yes | images are outside screenshots/ dir |
| batch-03 | 50 | 50 | 0 | 50 | 0 | yes | 50 | 46 | 1 | 3 | 0 | 0 | yes | yes | yes | yes |  |
| batch-04 | 50 | 50 | 4 | 45 | 1 | yes | 50 | 50 | 0 | 0 | 0 | 0 | yes | yes | yes | yes | 1 within-batch duplicate approved-qid decisions |
| batch-05 | 51 | 51 | 6 | 43 | 2 | yes | 51 | 47 | 2 | 2 | 0 | 0 | yes | yes | yes | yes |  |
| batch-06 | 50 | 50 | 2 | 35 | 13 | yes | 50 | 48 | 1 | 1 | 0 | 0 | yes | yes | yes | yes |  |
| batch-07 | 50 | 50 | 8 | 39 | 3 | yes | 50 | 46 | 4 | 0 | 0 | 0 | yes | yes | yes | yes |  |
| batch-08 | 50 | 50 | 0 | 45 | 5 | yes | 50 | 46 | 3 | 1 | 0 | 0 | yes | yes | yes | yes | 2 approved qids missing from production |
| batch-09 | 50 | 50 | 2 | 41 | 7 | yes | 50 | 49 | 0 | 1 | 0 | 0 | yes | yes | yes | yes | 1 within-batch duplicate approved-qid decisions |
| batch-10 | 50 | 50 | 4 | 40 | 6 | yes | 50 | 47 | 2 | 1 | 0 | 0 | yes | yes | yes | yes |  |
| batch-11 | 50 | 50 | 2 | 34 | 14 | yes | 50 | 49 | 1 | 0 | 0 | 2 | yes | yes | yes | yes |  |
| batch-12 | 50 | 50 | 5 | 35 | 10 | yes | 50 | 41 | 7 | 2 | 0 | 2 | yes | yes | yes | yes |  |
| batch-13 | 50 | 50 | 2 | 39 | 9 | yes | 50 | 48 | 1 | 0 | 1 | 0 | yes | yes | yes | yes |  |
| batch-14 | 50 | 50 | 2 | 40 | 8 | yes | 50 | 49 | 0 | 0 | 1 | 2 | yes | yes | yes | yes |  |
| batch-15 | 50 | 50 | 3 | 40 | 7 | yes | 50 | 47 | 1 | 0 | 2 | 1 | yes | yes | yes | yes |  |
| batch-16 | 50 | 50 | 0 | 40 | 10 | yes | 50 | 49 | 1 | 0 | 0 | 0 | yes | yes | yes | yes |  |
| batch-17 | 50 | 50 | 2 | 37 | 11 | yes | 50 | 48 | 2 | 0 | 0 | 0 | yes | yes | yes | yes |  |
| batch-18 | 52 | 52 | 3 | 41 | 8 | yes | 52 | 47 | 2 | 3 | 0 | 0 | yes | yes | yes | yes |  |

## C. Production Translation Coverage

| metric | count | notes |
|---|---:|---|
| translation qids | 811 | keys in `translations.ru.json.questions` |
| qids with prompt-like field | 811 | `prompt`, `questionText`, or `localizedPrompt` |
| qids with options-like field | 507 | `options` or option-key fields |
| qids with answer-like field | 507 | answer/correct-option fields |
| qids with explanation-like field | 0 | `explanation` or `localizedExplanation` |
| master questions in current `questions.json` | 984 | actual working-tree count |
| coverage vs current master | 811/984 | 82.4% |
| coverage vs user-stated 985 baseline | 811/985 | 82.3% |
| coverage vs effective RU screenshot files | 811/907 | 89.4% |
| coverage vs RU intake items | 811/907 | 89.4% |

## D. Missing Or Suspicious Batches

### Batches with screenshots but no intake

None found.

### Batches with intake but no workbench decisions

None found.

### Batches with decisions but no staged full merge output

None found.

### Batches with staged full merge output but missing qids in production translations

None found.

### Batches with current approved qids missing from production translations

- batch-08: 2 approved qids missing from production

### Batches with current decisions lacking approved qid or terminal action

None found.

### Batches with zero screenshots

None found.

### Duplicate batch numbering or naming inconsistencies

None found.

### Gaps in batch numbering

None found.

## E. Decision-Loss Analysis

| factor | count | interpretation |
|---|---:|---|
| effective screenshot files | 907 | includes direct-image legacy batches and screenshots/ directories |
| intake items | 907 | parsed OCR/localization items |
| decision items | 907 | workbench-exported item decisions found |
| approve existing qid decisions | 857 | decisions expected to map to existing production qid translations |
| unique approved qids | 813 | duplicate screenshots/decisions collapse to fewer production keys |
| non-existing-qid/non-finalized decisions | 50 | decision items that are not current approved existing-qid decisions |
| create-new decisions | 30 | not existing-qid translations unless later question creation/merge occurred |
| keep-unresolved decisions | 16 | intentionally remains untranslated/unmerged |
| delete decisions | 4 | intentionally excluded |
| no approved qid or terminal action | 0 | current decision rows that apply script treats as unsure/review output, not existing-qid approvals |
| duplicate approved-qid decisions across all batches | 44 | approved existing-qid decisions beyond one per unique qid |
| duplicate approved-qid decisions within a single batch | 3 | subset of duplicate approvals visible inside individual batches |
| UNKNOWN answer decisions | 7 | may need manual answer-key review; not necessarily a translation-count loss by itself |
| unique approved qids present in production | 811 | approved existing qids already represented in `translations.ru.json` |
| unique approved qids missing from production | 2 | likely unapplied/missing from current production translations |

Confirmed loss mechanisms from files: create-new, keep-unresolved, delete, and no-approved-qid decision rows are present in workbench exports; duplicate approved qid decisions are present across batches; screenshots are not one-to-one with production qids. The audit cannot prove whether screenshots include questions outside the current master bank from image files alone; that would require manual OCR/source matching for items not mapped to existing qids.

## F. Merge Audit

- Batches with workbench decisions: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.
- Batches with apply-workbench reports: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.
- Batches with full-batch merge review reports: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.
- Batches with production-merge reports found by exact basename: batch-001, batch-002, batch-03, batch-04, batch-05, batch-06, batch-07, batch-08, batch-09, batch-10, batch-11, batch-12, batch-13, batch-14, batch-15, batch-16, batch-17, batch-18.

| batch | decisions path | full preview path | full dry-run path | apply report | production merge report | approved qids | approved qids missing from production | full-preview qids missing from production |
|---|---|---|---|---|---|---:|---:|---:|
| batch-001 | `qbank-tools/generated/staging/ru-batch-001-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-001/staging/translations.ru.batch-001.full.preview.json` | `qbank-tools/generated/archive/ru/batch-001/staging/translations.ru.batch-001.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-001.json` | `qbank-tools/generated/reports/production-merge-ru-batch-001.json` | 49 | 0 | 0 |
| batch-002 | `qbank-tools/generated/staging/ru-batch-002-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-002/staging/translations.ru.batch-002.full.preview.json` | `qbank-tools/generated/archive/ru/batch-002/staging/translations.ru.batch-002.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-002.json` | `qbank-tools/generated/reports/production-merge-ru-batch-002.json` | 50 | 0 | 0 |
| batch-03 | `qbank-tools/generated/staging/ru-batch-03-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-03/staging/translations.ru.batch-03.full.preview.json` | `qbank-tools/generated/archive/ru/batch-03/staging/translations.ru.batch-03.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-03.json` | `qbank-tools/generated/reports/production-merge-ru-batch-03.json` | 46 | 0 | 0 |
| batch-04 | `qbank-tools/generated/staging/ru-batch-04-workbench-decisions.json` | `qbank-tools/generated/staging/translations.ru.batch-04.full.preview.json` | `qbank-tools/generated/staging/translations.ru.batch-04.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-04.json` | `qbank-tools/generated/reports/production-merge-ru-batch-04.json` | 49 | 0 | 0 |
| batch-05 | `qbank-tools/generated/staging/ru-batch-05-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-05/staging/translations.ru.batch-05.full.preview.json` | `qbank-tools/generated/archive/ru/batch-05/staging/translations.ru.batch-05.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-05.json` | `qbank-tools/generated/reports/production-merge-ru-batch-05.json` | 47 | 0 | 0 |
| batch-06 | `qbank-tools/generated/staging/ru-batch-06-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-06/staging/translations.ru.batch-06.full.preview.json` | `qbank-tools/generated/archive/ru/batch-06/staging/translations.ru.batch-06.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-06.json` | `qbank-tools/generated/reports/production-merge-ru-batch-06.json` | 48 | 0 | 0 |
| batch-07 | `qbank-tools/generated/staging/ru-batch-07-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-07/staging/translations.ru.batch-07.full.preview.json` | `qbank-tools/generated/archive/ru/batch-07/staging/translations.ru.batch-07.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-07.json` | `qbank-tools/generated/reports/production-merge-ru-batch-07.json` | 46 | 0 | 0 |
| batch-08 | `qbank-tools/generated/staging/ru-batch-08-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-08/staging/translations.ru.batch-08.full.preview.json` | `qbank-tools/generated/archive/ru/batch-08/staging/translations.ru.batch-08.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-08.json` | `qbank-tools/generated/reports/production-merge-ru-batch-08.json` | 46 | 2 | 0 |
| batch-09 | `qbank-tools/generated/staging/ru-batch-09-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-09/staging/translations.ru.batch-09.full.preview.json` | `qbank-tools/generated/archive/ru/batch-09/staging/translations.ru.batch-09.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-09.json` | `qbank-tools/generated/reports/production-merge-ru-batch-09.json` | 48 | 0 | 0 |
| batch-10 | `qbank-tools/generated/staging/ru-batch-10-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-10/staging/translations.ru.batch-10.full.preview.json` | `qbank-tools/generated/archive/ru/batch-10/staging/translations.ru.batch-10.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-10.json` | `qbank-tools/generated/reports/production-merge-ru-batch-10.json` | 47 | 0 | 0 |
| batch-11 | `qbank-tools/generated/staging/ru-batch-11-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-11/staging/translations.ru.batch-11.full.preview.json` | `qbank-tools/generated/archive/ru/batch-11/staging/translations.ru.batch-11.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-11.json` | `qbank-tools/generated/reports/production-merge-ru-batch-11.json` | 49 | 0 | 0 |
| batch-12 | `qbank-tools/generated/staging/ru-batch-12-workbench-decisions.json` | `qbank-tools/generated/staging/translations.ru.batch-12.full.preview.json` | `qbank-tools/generated/staging/translations.ru.batch-12.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-12.json` | `qbank-tools/generated/reports/production-merge-ru-batch-12.json` | 41 | 0 | 0 |
| batch-13 | `qbank-tools/generated/staging/ru-batch-13-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-13/staging/translations.ru.batch-13.full.preview.json` | `qbank-tools/generated/archive/ru/batch-13/staging/translations.ru.batch-13.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-13.json` | `qbank-tools/generated/reports/production-merge-ru-batch-13.json` | 48 | 0 | 0 |
| batch-14 | `qbank-tools/generated/staging/ru-batch-14-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-14/staging/translations.ru.batch-14.full.preview.json` | `qbank-tools/generated/archive/ru/batch-14/staging/translations.ru.batch-14.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-14.json` | `qbank-tools/generated/reports/production-merge-ru-batch-14.json` | 49 | 0 | 0 |
| batch-15 | `qbank-tools/generated/staging/ru-batch-15-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-15/staging/translations.ru.batch-15.full.preview.json` | `qbank-tools/generated/archive/ru/batch-15/staging/translations.ru.batch-15.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-15.json` | `qbank-tools/generated/reports/production-merge-ru-batch-15.json` | 47 | 0 | 0 |
| batch-16 | `qbank-tools/generated/staging/ru-batch-16-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-16/staging/translations.ru.batch-16.full.preview.json` | `qbank-tools/generated/archive/ru/batch-16/staging/translations.ru.batch-16.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-16.json` | `qbank-tools/generated/reports/production-merge-ru-batch-16.json` | 49 | 0 | 0 |
| batch-17 | `qbank-tools/generated/staging/ru-batch-17-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-17/staging/translations.ru.batch-17.full.preview.json` | `qbank-tools/generated/archive/ru/batch-17/staging/translations.ru.batch-17.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-17.json` | `qbank-tools/generated/reports/production-merge-ru-batch-17.json` | 48 | 0 | 0 |
| batch-18 | `qbank-tools/generated/staging/ru-batch-18-workbench-decisions.json` | `qbank-tools/generated/archive/ru/batch-18/staging/translations.ru.batch-18.full.preview.json` | `qbank-tools/generated/archive/ru/batch-18/staging/translations.ru.batch-18.full.merge-dry-run.json` | `qbank-tools/generated/reports/apply-workbench-decisions-ru-batch-18.json` | `qbank-tools/generated/reports/production-merge-ru-batch-18.json` | 47 | 0 | 0 |

<details><summary>batch-001: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-002: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-03: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-04: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-05: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-06: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-07: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-08: approved qids missing from production (2)</summary>

q0176, q0245

</details>

<details><summary>batch-09: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-10: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-11: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-12: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-13: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-14: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-15: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-16: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-17: approved qids missing from production (0)</summary>

None.

</details>

<details><summary>batch-18: approved qids missing from production (0)</summary>

None.

</details>

## G. Exact Discrepancy Math

A fully exact historical equation is not provable from file counts alone because screenshots do not carry a guaranteed unique production-qid identity, and current workbench-decision files can diverge from the artifacts that were previously applied to production. The current-file reconciliation is:

```text
907 effective RU screenshot image files
- 0 screenshot files not represented as intake items
= 907 intake items
- 0 intake items without discovered workbench decisions
= 907 workbench decision items
- 50 decisions not approved to an existing qid
  (30 create-new, 16 explicit keep-unresolved, 4 delete, 0 no approved qid/terminal action, plus any overlapping flags)
= 857 approved existing-qid decision items
- 44 duplicate approved-qid decisions across batches
= 813 unique approved existing qids
- 2 unique approved qids absent from production translations
= 811 production qids explained by current decision files
current production translations.ru.json = 811 qids
```

This exact current-file equation reconciles to 811, matching the 811 production translation keys. It is exact for the current decision files, but it is not proof that every current decision file is the historical file used for production merges; batch-08 already shows divergence between current approved qids and the archived/applied full preview.

## Validation

- Script: `scripts/audit-ru-translation-discrepancy.mjs`
- Report output: `qbank-tools/generated/reports/ru-translation-count-discrepancy-audit.md`
- Re-run command: `node scripts/audit-ru-translation-discrepancy.mjs`

