# Adversarial Evaluation

Generated at 2026-04-18T15:34:22.903Z across 19 Japanese batch(es) for profile `final-targeted`.

## Coverage

- benchmark rows replayed: 92
- hard-risk rows: 92
- warning-risk rows: 92
- live matched risky rows: 11
- final-targeted hard-risk silent passes: 0
- original live matched risky routed/warned/silent: 7/3/1
- final-targeted live matched risky routed/warned/silent: 8/3/0

## Case-Type Flag Coverage

- ambiguous_near_match: original flagged 87/88, final-targeted flagged 88/88, final-targeted hard-risk slips 0.
- override: original flagged 81/82, final-targeted flagged 82/82, final-targeted hard-risk slips 0.
- answer_key_change: original flagged 72/72, final-targeted flagged 72/72, final-targeted hard-risk slips 0.
- image_heavy: original flagged 70/70, final-targeted flagged 70/70, final-targeted hard-risk slips 0.
- topic_drift: original flagged 66/67, final-targeted flagged 67/67, final-targeted hard-risk slips 0.
- structural_risk: original flagged 41/41, final-targeted flagged 41/41, final-targeted hard-risk slips 0.
- create_new: original flagged 11/11, final-targeted flagged 11/11, final-targeted hard-risk slips 0.
- unresolved: original flagged 6/6, final-targeted flagged 6/6, final-targeted hard-risk slips 0.
- delete: original flagged 3/3, final-targeted flagged 3/3, final-targeted hard-risk slips 0.

## Notes

- A hard-risk slip means the calibrated profile produced a silent auto-match pass on a benchmark case that historically needed stronger human intervention.
- A meaningful flag means the profile either kept the item out of auto-match ok or left an explicit warning/signal trail.