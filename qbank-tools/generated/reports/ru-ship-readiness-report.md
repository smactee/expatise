# RU Ship-Readiness Report

Generated at: 2026-05-02T12:53:37.725Z
Recommendation: **SHIP**

## Executive Summary

- Production RU translations: 984/984 (100%)
- Missing qids vs questions.json: 0
- Extra qids not in questions.json: 0
- Critical issues: none
- Rationale: No critical production-data integrity failures were found. Coverage is partial, and q0245/q0176 remain staged-but-not-production, but those are release caveats rather than corrupt production data.

## Counts

- questions.json master qids: 984
- questions.raw.json qids: 985
- raw-only qids absent from questions.json: q0518
- master type counts: {"row":419,"mcq":565}
- translated type counts: {"row":419,"mcq":565}

## Production Translation Integrity

- Invalid MCQ locale answer keys: 0
- Invalid ROW answer issues: 0
- Translated MCQs missing option objects: 0
- Translated MCQs missing localeCorrectOptionKey: 0
- Locale answer keys not present in source option order: 0
- ROW translations carrying MCQ answer keys: 0

## q0245 / q0176

- q0245: production=yes, batch08 full preview=no, batch08 full dry-run=no, missing-production stage=no
- q0176: production=yes, batch08 full preview=no, batch08 full dry-run=no, missing-production stage=no

## Discrepancy Apply Status

- Apply run marked applied: unknown
- Skipped after conservative apply: 0
- Create-new Right/Wrong staged-only items: 0
- High-risk manually accepted items still skipped by conservative apply: 0
- Manually confirmed duplicate-label answers: null

## Batch-08 Staging

- Apply counts: null
- Full preview qids: 0
- Full dry-run production qids: 0
- Safe to merge next step: unknown
- Blockers: 0

## Image Asset References

- Master qids with images: 498
- Translated qids with master images: 498
- Asset references checked: 498
- Missing asset references: 0

## Remaining Missing QIDs

None

