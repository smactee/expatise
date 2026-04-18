# Validation Recommendation

Generated at 2026-04-18T15:34:22.907Z.

## Second-Batch Validation

- validation batch: batch-003
- final-targeted route changes vs original on batch-003: 6
- final-targeted matched risky auto-match exposures on batch-003: 0
- final-targeted matched known-correct auto-match retention on batch-003: 9/9
- batch-003 final-targeted auto-match ok: 9
- batch-003 final-targeted manual review: 24
- batch-003 final-targeted likely create-new-question: 1
- batch-003 final-targeted likely unresolved: 6
- batch-003 final-targeted likely delete: 0
- batch-003 final-targeted downgraded: 0
- batch-003 final-targeted rerouted: 1

## Adversarial Benchmark

- replayed batches: batch-001, batch-002, batch-003, batch-005, batch-006, batch-007, batch-008, batch-009, batch-010, batch-011, batch-012, batch-013, batch-014, batch-015, batch-016, batch-017, batch-018, batch-019, batch-020
- hard-risk benchmark rows: 92
- final-targeted hard-risk silent passes: 0
- warning-risk rows without any calibrated flag: 0
- live matched risky rows routed/warned/silent under original: 7/3/1
- live matched risky rows routed/warned/silent under final-targeted: 8/3/0

## Decision

- Does final-targeted generalize beyond batch-020? Yes on batch-003 strictness/retention, with no new adjudicated risky matched exposure.
- Does final-targeted still show defensive value on adversarial cases? Yes, but mostly through warnings on live matched risks rather than route blocks.
- Rollout recommendation: limited pilot.

## Fully Tested vs Partial

- Fully tested: batch-003 full-batch baseline/original/calibrated comparison against stored Japanese adjudication.
- Fully tested: adversarial replay against real historical benchmark cases using current batch outputs and the current preflight wrapper.
- Partial: answer-key risk remains under-exercised because only a small fraction of replayed cases exposed explicit answer evidence to the current preflight logic.
- Partial: source-side visual semantics are still inferred from translated text plus candidate hidden tags, not from direct screenshot understanding.
- Partial: explicit combination promotions are now live, but 3 live matched risky cases still resolve as warnings rather than route blocks.