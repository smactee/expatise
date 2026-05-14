# French Backfill Final Report

Generated: 2026-05-14T06:25:19.074Z

## Summary

- Missing/placeholder qids before: 228
- Generated translations: 228
- AI quality approved: 197
- Codex manual overrides after inspection: 31
- Applied translations: 228
- Skipped: 0
- French usable coverage: 778 -> 1006
- French placeholders after: 0
- Critical blockers after: 0
- Warning count after: 88
- Ship-readiness recommendation: ship-with-warnings

## Warning Types

- raw-only-qid: 2
- translation-missing-qid: 69
- translation-extra-qid: 3
- tags-patch-qid-not-in-master: 2
- image-question-missing-tags: 1
- image-tags-without-image: 2
- image-question-missing-object-tags: 1
- duplicate-candidate: 8

## Ship Warning Reasons

- integrity warnings: 88
- unresolved promotion candidates: 3
- skipped unreviewed promotion candidates: 1

## Notes

- Dry-run apply validation passed before applying.
- Manual overrides are documented in qbank-tools/generated/reports/backfill-fr-codex-review-overrides.json.
- English master files were not edited by this backfill apply step.

