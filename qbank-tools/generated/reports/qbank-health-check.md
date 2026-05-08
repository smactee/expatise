# QBank Health Check

Generated: 2026-05-06T11:10:03.099Z
Finished: 2026-05-06T11:10:10.454Z
Final status: passed
Duration: 7355 ms
Stopped early: no

## Checks

| Check | Exit | Duration ms | Blockers | Warnings |
| --- | ---: | ---: | ---: | ---: |
| QBank integrity audit | 0 | 194 | 0 | 1 |
| Missing-QID backfill system audit | 0 | 157 | 0 | 1 |
| QBank phase status audit | 0 | 108 | 0 | 11 |
| QBank workflow command index | 0 | 98 | 0 | 1 |
| Production build | 0 | 6789 | 0 | 0 |

## Blockers

None.

## Warnings

- qbank-integrity: QBank integrity warnings: 591
- missing-qid-backfill: No package-level hook automatically runs propagation; the propagation command must be part of the workflow.
- phase-status: 2. English master source-of-truth: 1 raw-only qids remain: q0518
- phase-status: 2. English master source-of-truth: 266 raw/master prompt mismatches are tracked as non-critical warnings.
- phase-status: 3. Missing-qid backfill: No package-level hook automatically runs propagation; the propagation command must be part of the workflow.
- phase-status: 4. New-question promotion: 3 new-question candidates still need human review.
- phase-status: 5. Duplicate detection: 49 duplicate candidate pairs need human review.
- phase-status: 5. Duplicate detection: 22 medium-confidence duplicate candidates remain in integrity audit.
- phase-status: 7. Tag intelligence: 1 image qids are missing object tags.
- phase-status: 7. Tag intelligence: 69 qids have low-confidence tags.
- phase-status: 7. Tag intelligence: 485 master qids have no object tags; many may be non-image questions.
- phase-status: 8. Repo cleanup / workflow hygiene: 4006 archive candidates remain in file audit.
- phase-status: 8. Repo cleanup / workflow hygiene: 148 files still need manual cleanup classification.
- workflow-command-index: Dangerous production-edit scripts tracked: 4

