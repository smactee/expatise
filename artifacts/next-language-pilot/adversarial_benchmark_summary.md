# Adversarial Benchmark Summary

Generated at 2026-04-18T09:05:39.484Z.

## Composition

- benchmark rows: 92
- currently risky matched cases kept explicitly: 11
- ambiguous_near_match: 88
- override: 82
- answer_key_change: 72
- image_heavy: 70
- topic_drift: 67
- structural_risk: 41
- create_new: 11
- unresolved: 6
- delete: 3

## Batch Coverage

- batch-005: 10
- batch-020: 8
- batch-015: 7
- batch-016: 7
- batch-009: 6
- batch-011: 6
- batch-003: 5
- batch-007: 5
- batch-008: 5
- batch-010: 5
- batch-017: 5
- batch-006: 4
- batch-014: 4
- batch-019: 4
- batch-001: 3
- batch-018: 3
- batch-012: 2
- batch-013: 2
- batch-002: 1

## Selection Policy

- Always keep terminal-risk cases: create-new, unresolved, and delete.
- Then keep the highest-hardness override, answer-key-change, and ambiguous-near-match cases.
- Then add sign-heavy, topic-drift, and structural-risk cases until the benchmark includes the hardest remaining risky patterns.

## Notes

- Rows are deduplicated by underlying batch source item so consolidated backlog follow-ups collapse onto the latest terminal state.
- This benchmark is intentionally adversarial, not representative. It is biased toward historically difficult Japanese review cases.