# RU Ship-Readiness Report

Generated at: 2026-05-02T07:58:41.899Z
Recommendation: **SHIP**

## Executive Summary

- Production RU translations: 882/984 (89.63%)
- Missing qids vs questions.json: 102
- Extra qids not in questions.json: 0
- Critical issues: none
- Rationale: No critical production-data integrity failures were found. Coverage is partial, and q0245/q0176 remain staged-but-not-production, but those are release caveats rather than corrupt production data.

## Release Warnings

- 102 master qid(s) do not have Russian production translations
- 20 create-new Right/Wrong items remain staged-only and accepted for this release context
- 6 high-risk discrepancy items remain skipped by the conservative apply script and accepted for this release context

## Counts

- questions.json master qids: 984
- questions.raw.json qids: 985
- raw-only qids absent from questions.json: q0518
- master type counts: {"row":419,"mcq":565}
- translated type counts: {"row":350,"mcq":532}

## Production Translation Integrity

- Invalid MCQ locale answer keys: 0
- Invalid ROW answer issues: 0
- Translated MCQs missing option objects: 0
- Translated MCQs missing localeCorrectOptionKey: 0
- Locale answer keys not present in source option order: 0
- ROW translations carrying MCQ answer keys: 2

## q0245 / q0176

- q0245: production=yes, batch08 full preview=no, batch08 full dry-run=no, missing-production stage=yes
- q0176: production=yes, batch08 full preview=no, batch08 full dry-run=no, missing-production stage=yes

## Discrepancy Apply Status

- Apply run marked applied: yes
- Skipped after conservative apply: 26
- Create-new Right/Wrong staged-only items: 20
- High-risk manually accepted items still skipped by conservative apply: 6
- Manually confirmed duplicate-label answers: 2

## Batch-08 Staging

- Apply counts: {"autoMatched":0,"reviewedFinalized":43,"rescuedUnresolved":2,"newQuestionCandidates":4,"sourceExplanationUpdates":0,"finalMergeReadyTotal":45,"blockerCount":0}
- Full preview qids: 0
- Full dry-run production qids: 0
- Safe to merge next step: yes
- Blockers: 0

## Image Asset References

- Master qids with images: 498
- Translated qids with master images: 435
- Asset references checked: 498
- Missing asset references: 0

## Remaining Missing QIDs

q0264, q0515, q0556, q0562, q0569, q0581, q0582, q0610, q0620, q0633, q0637, q0645, q0679, q0695, q0698, q0723, q0747, q0757, q0769, q0801, q0819, q0833, q0885, q0894, q0898, q0900, q0901, q0902, q0903, q0904, q0905, q0906, q0907, q0908, q0909, q0910, q0911, q0912, q0913, q0914, q0915, q0916, q0917, q0918, q0919, q0920, q0922, q0924, q0925, q0926, q0928, q0930, q0931, q0932, q0933, q0934, q0935, q0936, q0937, q0938, q0939, q0940, q0941, q0942, q0943, q0944, q0945, q0946, q0947, q0948, q0949, q0950, q0951, q0952, q0953, q0954, q0955, q0956, q0957, q0958, q0959, q0960, q0961, q0962, q0963, q0964, q0965, q0966, q0967, q0968, q0969, q0970, q0971, q0972, q0976, q0977, q0979, q0980, q0982, q0983, q0984, q0985

