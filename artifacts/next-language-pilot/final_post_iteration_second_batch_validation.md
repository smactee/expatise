# Second Batch Validation

Generated at 2026-04-18T15:34:11.054Z for `ja/batch-003` on dataset `2023-test1` comparing `original` vs `final-targeted`.

## Batch Choice

- validation batch: batch-003
- reason: it has diverse adjudicated outcomes including overrides, create-new, unresolved, and delete, so it is a better generalization check than batch-020 alone.

## Route Counts

- baseline auto-match ok: 9
- baseline manual review: 24
- baseline likely create-new-question: 0
- baseline likely unresolved: 7
- baseline likely delete: 0
- baseline downgraded: 0
- baseline rerouted: 0
- original preflight auto-match ok: 3
- original preflight manual review: 30
- original preflight likely create-new-question: 1
- original preflight likely unresolved: 6
- original preflight likely delete: 0
- original preflight downgraded: 6
- original preflight rerouted: 1
- final-targeted preflight auto-match ok: 9
- final-targeted preflight manual review: 24
- final-targeted preflight likely create-new-question: 1
- final-targeted preflight likely unresolved: 6
- final-targeted preflight likely delete: 0
- final-targeted preflight downgraded: 0
- final-targeted preflight rerouted: 1

## Profile Difference

- items with different routes between original and calibrated: 6
- matched items in batch: 9
- adjudicated matched auto-correct items: 9
- adjudicated matched risky items: 0
- original kept matched auto-correct items as auto-match ok: 3
- final-targeted kept matched auto-correct items as auto-match ok: 9
- original exposed matched risky items as auto-match ok: 0
- final-targeted exposed matched risky items as auto-match ok: 0

## Triggered Signals

- original image-sign-symbol-mismatch-risk: 20
- original topic-subtopic-drift-risk: 11
- original trust-band-caution: 5
- original choice-shape-mismatch: 1
- original likely-create-new-question: 1
- final-targeted image-sign-symbol-mismatch-risk: 20
- final-targeted topic-subtopic-drift-risk: 11
- final-targeted trust-band-caution: 5
- final-targeted combo-image-sign-context-risk: 4
- final-targeted choice-shape-mismatch: 1
- final-targeted likely-create-new-question: 1

## Judgment

- No adjudicated bad matched items were present in this batch, so this validation mainly measures strictness, not false-positive protection.