# QBank System Phase Status

Generated: 2026-05-06T11:10:03.559Z
Dataset: 2023-test1
Critical blockers: 0
Recommended next phase: 8. Repo cleanup / workflow hygiene

## Phase Statuses

| Phase | Status | Blockers | Warnings | Recommended next action |
| --- | --- | ---: | ---: | --- |
| 1. Russian ship-readiness | complete | 0 | 0 | Keep Russian in regression audit before future qbank changes. |
| 2. English master source-of-truth | mostly-complete | 0 | 2 | Resolve or explicitly document raw-only qids so master/raw drift is intentional. |
| 3. Missing-qid backfill | mostly-complete | 0 | 1 | Add propagation to the standard master-edit workflow and regenerate the backfill audit after any language change. |
| 4. New-question promotion | mostly-complete | 0 | 1 | Manually resolve remaining new-question promotion review items before applying promotions. |
| 5. Duplicate detection | mostly-complete | 0 | 2 | Work down needs-human-review duplicate pairs and export decisions to memory. |
| 6. Decision memory | complete | 0 | 0 | Keep updating decision memory after duplicate, promotion, and localization decisions. |
| 7. Tag intelligence | partial | 0 | 3 | Backfill the remaining image qid object tags and rerun tag intelligence. |
| 8. Repo cleanup / workflow hygiene | partial | 0 | 2 | Continue cleanup in planned archive-only passes, then rerun the qbank-tools file audit. |

## Production Language Coverage

| Language | Coverage | Production qids | Missing | Extra | Placeholders |
| --- | ---: | ---: | ---: | ---: | ---: |
| ru | 100% | 984 | 0 | 0 | 0 |
| ko | 100% | 984 | 0 | 0 | 0 |
| ja | 100% | 984 | 0 | 0 | 0 |

## Decision Memory Counts By Type

| decisionType | count |
| --- | ---: |
| answer-key | 7041 |
| backfill-generation | 174 |
| master-data-fix | 500 |
| match | 3480 |
| merge | 5346 |
| new-question | 1371 |
| quality-review | 1 |
| reject | 80 |
| skip | 30 |

## Phase Details

### 1. Russian ship-readiness

- Status: complete
- Evidence: public/qbank/2023-test1/translations.ru.json, qbank-tools/generated/reports/qbank-integrity-audit.json
- Blockers: none
- Warnings: none
- Next action: Keep Russian in regression audit before future qbank changes.

### 2. English master source-of-truth

- Status: mostly-complete
- Evidence: public/qbank/2023-test1/questions.json, public/qbank/2023-test1/questions.raw.json, qbank-tools/generated/reports/qbank-integrity-audit.json
- Blockers: none
- Warnings: 1 raw-only qids remain: q0518; 266 raw/master prompt mismatches are tracked as non-critical warnings.
- Next action: Resolve or explicitly document raw-only qids so master/raw drift is intentional.

### 3. Missing-qid backfill

- Status: mostly-complete
- Evidence: qbank-tools/generated/reports/missing-qid-backfill-system-audit.json
- Blockers: none
- Warnings: No package-level hook automatically runs propagation; the propagation command must be part of the workflow.
- Next action: Add propagation to the standard master-edit workflow and regenerate the backfill audit after any language change.

### 4. New-question promotion

- Status: mostly-complete
- Evidence: qbank-tools/generated/reports/new-question-promotion-review.ru.all.json, scripts/prepare-new-question-promotion-preview.mjs, scripts/review-new-question-promotions.mjs, scripts/apply-new-question-promotion.mjs
- Blockers: none
- Warnings: 3 new-question candidates still need human review.
- Next action: Manually resolve remaining new-question promotion review items before applying promotions.

### 5. Duplicate detection

- Status: mostly-complete
- Evidence: qbank-tools/generated/reports/duplicate-candidate-audit.json, qbank-tools/generated/reports/qbank-integrity-audit.json
- Blockers: none
- Warnings: 49 duplicate candidate pairs need human review.; 22 medium-confidence duplicate candidates remain in integrity audit.
- Next action: Work down needs-human-review duplicate pairs and export decisions to memory.

### 6. Decision memory

- Status: complete
- Evidence: qbank-tools/history/decision-memory.json, qbank-tools/history/decision-memory.schema.json
- Blockers: none
- Warnings: none
- Next action: Keep updating decision memory after duplicate, promotion, and localization decisions.

### 7. Tag intelligence

- Status: partial
- Evidence: qbank-tools/generated/reports/tag-intelligence-report.json, public/qbank/2023-test1/image-color-tags.json
- Blockers: none
- Warnings: 1 image qids are missing object tags.; 69 qids have low-confidence tags.; 485 master qids have no object tags; many may be non-image questions.
- Next action: Backfill the remaining image qid object tags and rerun tag intelligence.

### 8. Repo cleanup / workflow hygiene

- Status: partial
- Evidence: qbank-tools/generated/reports/qbank-tools-file-audit.json, qbank-tools/generated/reports/qbank-tools-medium-archive-apply-report.json
- Blockers: none
- Warnings: 4006 archive candidates remain in file audit.; 148 files still need manual cleanup classification.
- Next action: Continue cleanup in planned archive-only passes, then rerun the qbank-tools file audit.

