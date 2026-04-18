# Japanese Review Intelligence Extraction Summary

Generated at 2026-04-18T07:49:38.665Z for dataset `2023-test1`.

## Discovery

- imports/ja files: 1022
- active staging files: 185
- active report files: 96
- archived JA files: 308
- workflow scripts indexed: 18

## Extracted Outputs

- review_ground_truth rows: 922
- automatch_eval rows: 921
- benchmark_set rows: 117

## Final Human Decisions

- approve-existing-qid: 889
- create-new-question: 24
- keep-unresolved: 6
- delete-question: 3

## Review Flows

- retro-auto-workbench: 21
- legacy-review-decisions: 24
- legacy-unresolved-decisions: 4
- consolidated-backlog-workbench: 19
- batch-workbench: 854

## Trust-Band Snapshot

- very-high: 37/43 accepted as top-1.
- high: 84/108 accepted as top-1.
- medium: 138/208 accepted as top-1.
- low: 163/262 accepted as top-1.
- very-low: 170/290 accepted as top-1.
- none: 0/10 accepted as top-1.

## Limitations

- Early batches do not always preserve unified workbench decisions for every section, so the extractor falls back to legacy review and unresolved decision exports where needed.
- Final topic and subtopic labels are only available when the approved qid appears inside the stored candidate set. Otherwise those fields are left blank instead of guessed.
- Reviewer rationale is only explicit when reviewer notes or sourceExplanation text exists. No extra rationale is invented.
- 92 approved-existing records could not recover a confident final topic from the stored candidate metadata.