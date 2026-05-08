# QBank Workflow Command Index

Generated: 2026-05-06T11:10:03.660Z
Scripts audited: 109
Package commands audited: 48

## Summary

| status | count |
| --- | --- |
| active-production | 7 |
| active-review-workflow | 43 |
| active-memory-intelligence | 13 |
| active-validation | 25 |
| cleanup/archive | 10 |
| legacy-compatible | 6 |
| deprecated-candidate | 1 |
| dangerous-production-edit | 4 |
| unknown-review-needed | 0 |

## Dangerous Production Edit Scripts

| path | purpose | phase | dryRunSupport | requiresGuardFlags |
| --- | --- | --- | --- | --- |
| scripts/add-explanations.mjs | Legacy direct questions.json explanation editor. | 2. English master source-of-truth | yes | yes |
| scripts/apply-retro-auto-review-corrections.mjs | Apply retro auto-review corrections to localization production data. | 7. Tag intelligence | yes | yes |
| scripts/generate-qbank-ko-translations.mjs | Legacy OpenAI-assisted Korean production translation generator. | 3. Missing-qid backfill | yes | yes |
| scripts/postprocess-qbank.mjs | Legacy raw-to-master qbank postprocessor. | 2. English master source-of-truth | yes | yes |

## Deprecated Candidates

| path | purpose | phase | dryRunSupport | requiresGuardFlags |
| --- | --- | --- | --- | --- |
| scripts/dry-run-asset-rename.mjs | Dry Run Asset Rename | General app/repo workflow | yes | no |

## Script Index

| path | status | phase | production | dryRun | guard |
| --- | --- | --- | --- | --- | --- |
| qbank-tools/lib/feature-bridge.mjs | active-memory-intelligence | 6. Decision memory | no | no | no |
| qbank-tools/lib/image-replacement-memory.mjs | active-memory-intelligence | 6. Decision memory | no | no | no |
| qbank-tools/lib/missing-localization-backfill.mjs | active-review-workflow | 3. Missing-qid backfill | no | yes | no |
| qbank-tools/lib/new-question-promotion-gate.mjs | active-review-workflow | 4. New-question promotion | no | no | no |
| qbank-tools/lib/pipeline.mjs | active-review-workflow | General app/repo workflow | no | yes | yes |
| qbank-tools/lib/tag-intelligence.mjs | active-memory-intelligence | 7. Tag intelligence | no | no | no |
| scripts/add-explanations.mjs | dangerous-production-edit | 2. English master source-of-truth | yes | yes | yes |
| scripts/apply-answer-key-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/apply-approved-image-replacements.mjs | active-production | 2. English master source-of-truth | yes | yes | no |
| scripts/apply-batch-workbench-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/apply-consolidated-backlog-workbench-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/apply-manual-decisions.mjs | legacy-compatible | 7. Tag intelligence | no | no | no |
| scripts/apply-new-question-promotion.mjs | active-production | 4. New-question promotion | yes | no | no |
| scripts/apply-production-localization-merge.mjs | active-production | 1. Russian ship-readiness | yes | yes | no |
| scripts/apply-release-cleanup.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/apply-retro-auto-review-corrections.mjs | dangerous-production-edit | 7. Tag intelligence | yes | yes | yes |
| scripts/apply-reviewed-missing-localization-backfill.mjs | active-production | 3. Missing-qid backfill | yes | yes | yes |
| scripts/apply-ru-discrepancy-review-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/apply-unresolved-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/audit-missing-qid-backfill-system.mjs | active-validation | 3. Missing-qid backfill | no | yes | yes |
| scripts/audit-preflight-downgrades.mjs | active-validation | Cross-phase validation | no | yes | no |
| scripts/audit-qbank-integrity.mjs | active-validation | 7. Tag intelligence | no | yes | no |
| scripts/audit-qbank-system-phase-status.mjs | active-validation | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/audit-qbank-tools-files.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/audit-qbank-workflow-commands.mjs | active-validation | 8. Repo cleanup / workflow hygiene | no | yes | yes |
| scripts/audit-ru-translation-discrepancy.mjs | active-validation | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/backfill-missing-image-object-tags.mjs | active-production | 7. Tag intelligence | yes | yes | no |
| scripts/build-adversarial-benchmark.mjs | active-validation | Cross-phase validation | no | yes | no |
| scripts/build-decision-memory.mjs | active-memory-intelligence | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/build-duplicate-candidate-audit.mjs | active-memory-intelligence | 7. Tag intelligence | no | yes | no |
| scripts/build-full-batch-staging-preview.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/build-localization-coverage-report.mjs | active-validation | General app/repo workflow | no | yes | no |
| scripts/build-match-index.mjs | active-memory-intelligence | 6. Decision memory | no | yes | no |
| scripts/build-missing-localization-backfill.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/build-qid-feature-store.mjs | active-memory-intelligence | 6. Decision memory | no | yes | no |
| scripts/build-ru-discrepancy-blockers-review.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/build-ru-discrepancy-review-workbench.mjs | active-review-workflow | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/build-ru-ship-readiness-report.mjs | active-validation | 7. Tag intelligence | no | yes | no |
| scripts/calibrate-preflight-rules.mjs | active-validation | Cross-phase validation | no | no | no |
| scripts/cleanup-localization-batch.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/complete-ko-ja-qid-sync.mjs | active-production | 6. Decision memory | no | yes | no |
| scripts/derive-correction-rules.mjs | active-memory-intelligence | 6. Decision memory | no | no | no |
| scripts/dry-run-asset-rename.mjs | deprecated-candidate | General app/repo workflow | no | yes | no |
| scripts/evaluate-adversarial-benchmark.mjs | active-validation | Cross-phase validation | no | no | no |
| scripts/export-duplicate-review-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/export-match-history.mjs | active-memory-intelligence | 6. Decision memory | no | no | no |
| scripts/extract-japanese-review-intelligence.mjs | active-review-workflow | 8. Repo cleanup / workflow hygiene | no | no | no |
| scripts/extract-manual-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/extract-screenshot-intake.mjs | active-review-workflow | General app/repo workflow | no | no | yes |
| scripts/finalize-localization-run.mjs | active-review-workflow | 8. Repo cleanup / workflow hygiene | no | yes | yes |
| scripts/generate-answer-key-review.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/generate-batch-review-artifact.mjs | active-review-workflow | General app/repo workflow | no | yes | no |
| scripts/generate-batch-workbench.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/generate-consolidated-backlog-workbench.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/generate-curated-snapshot.mjs | active-review-workflow | General app/repo workflow | no | yes | no |
| scripts/generate-image-color-tags.mjs | active-memory-intelligence | 7. Tag intelligence | no | yes | no |
| scripts/generate-image-replacement-second-pass-workbench.mjs | active-review-workflow | 7. Tag intelligence | no | yes | yes |
| scripts/generate-image-replacement-workbench.mjs | active-review-workflow | 6. Decision memory | no | yes | no |
| scripts/generate-image-tag-review-workbench.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/generate-ja-beta-enablement-report.mjs | active-validation | General app/repo workflow | no | yes | no |
| scripts/generate-missing-localization-draft.mjs | active-review-workflow | 3. Missing-qid backfill | no | yes | no |
| scripts/generate-qbank-ko-translations.mjs | dangerous-production-edit | 3. Missing-qid backfill | yes | yes | yes |
| scripts/generate-single-answer-key-review.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/generate-unresolved-review-artifact.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/guard-protected-qbank-files.mjs | active-validation | 2. English master source-of-truth | no | no | yes |
| scripts/japanese-review-intelligence-lib.mjs | active-review-workflow | 8. Repo cleanup / workflow hygiene | no | yes | yes |
| scripts/merge-image-replacement-second-pass-decisions.mjs | active-review-workflow | 2. English master source-of-truth | no | no | no |
| scripts/merge-reviewed-localizations.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/merge-workbench-decisions.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/next-language-preflight-audit-lib.mjs | active-validation | Cross-phase validation | no | no | no |
| scripts/next-language-preflight-config.mjs | active-validation | Cross-phase validation | no | no | no |
| scripts/next-language-preflight-lib.mjs | active-validation | Cross-phase validation | no | no | yes |
| scripts/next-language-validation-lib.mjs | legacy-compatible | 4. New-question promotion | no | no | no |
| scripts/notebooklm-rerank-workbench.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/notebooklm-suggest-batch.mjs | active-review-workflow | 7. Tag intelligence | no | yes | yes |
| scripts/plan-japanese-cleanup.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | no | no |
| scripts/plan-release-cleanup.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | no | no |
| scripts/postprocess-qbank.mjs | dangerous-production-edit | 2. English master source-of-truth | yes | yes | yes |
| scripts/prepare-dry-run-merge-review.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/prepare-new-question-promotion-preview.mjs | active-review-workflow | 7. Tag intelligence | no | yes | no |
| scripts/prepare-qbank-tools-archive-plan.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/prepare-qbank-tools-cache-only-cleanup.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | yes |
| scripts/prepare-qbank-tools-medium-archive-plan.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/prepare-qbank-tools-safe-first-archive.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | no |
| scripts/process-screenshot-batch.mjs | active-review-workflow | General app/repo workflow | no | no | no |
| scripts/propagate-new-master-qids.mjs | active-production | 3. Missing-qid backfill | yes | no | no |
| scripts/qbank-health-check.mjs | active-validation | 8. Repo cleanup / workflow hygiene | no | no | no |
| scripts/query-decision-memory.mjs | active-memory-intelligence | 6. Decision memory | no | no | no |
| scripts/release-cleanup-lib.mjs | cleanup/archive | 8. Repo cleanup / workflow hygiene | no | yes | yes |
| scripts/replay-revenuecat-webhook.mjs | legacy-compatible | General app/repo workflow | no | no | no |
| scripts/report-production-localization-counts.mjs | active-validation | General app/repo workflow | no | no | no |
| scripts/review-generated-localization-quality.mjs | active-review-workflow | 3. Missing-qid backfill | no | no | no |
| scripts/review-new-question-promotions.mjs | active-review-workflow | 6. Decision memory | no | no | no |
| scripts/run-combination-rule-promotion.mjs | active-review-workflow | 4. New-question promotion | no | no | no |
| scripts/run-final-targeted-pass.mjs | legacy-compatible | Cross-phase validation | no | no | yes |
| scripts/run-limited-next-language-pilot.mjs | legacy-compatible | Cross-phase validation | no | no | no |
| scripts/run-next-language-pilot.mjs | legacy-compatible | Cross-phase validation | no | no | no |
| scripts/run-next-language-preflight.mjs | active-validation | Cross-phase validation | no | no | no |
| scripts/run-second-batch-validation.mjs | active-review-workflow | Cross-phase validation | no | no | no |
| scripts/stage-new-question-candidates.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/stage-reviewed-batch.mjs | active-review-workflow | 7. Tag intelligence | no | no | no |
| scripts/tag-dictionary.mjs | active-memory-intelligence | 7. Tag intelligence | no | no | no |
| scripts/update-decision-memory.mjs | active-memory-intelligence | 7. Tag intelligence | no | yes | no |
| scripts/validate-localization-batch.mjs | active-validation | 5. Duplicate detection | no | yes | no |
| scripts/validate-missing-localization-backfill.mjs | active-validation | 3. Missing-qid backfill | no | yes | no |
| scripts/validate-qbank.mjs | active-validation | 7. Tag intelligence | no | yes | no |
| scripts/validate-renamed-assets.mjs | active-validation | 5. Duplicate detection | no | yes | no |
| scripts/validate-screenshot-intake.mjs | active-validation | Cross-phase validation | no | yes | no |
| scripts/verify-release-readiness.mjs | active-validation | 8. Repo cleanup / workflow hygiene | no | no | no |

