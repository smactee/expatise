# Adversarial Evaluation

Generated at 2026-04-18T15:19:33.526Z across 19 Japanese batch(es) for profile `combination-promoted`.

## Coverage

- benchmark rows replayed: 92
- hard-risk rows: 92
- warning-risk rows: 92
- live matched risky rows: 11
- combination-promoted hard-risk silent passes: 0
- original live matched risky routed/warned/silent: 7/3/1
- combination-promoted live matched risky routed/warned/silent: 5/6/0

## Case-Type Flag Coverage

- ambiguous_near_match: original flagged 87/88, combination-promoted flagged 88/88, combination-promoted hard-risk slips 0.
- override: original flagged 81/82, combination-promoted flagged 82/82, combination-promoted hard-risk slips 0.
- answer_key_change: original flagged 72/72, combination-promoted flagged 72/72, combination-promoted hard-risk slips 0.
- image_heavy: original flagged 70/70, combination-promoted flagged 70/70, combination-promoted hard-risk slips 0.
- topic_drift: original flagged 66/67, combination-promoted flagged 67/67, combination-promoted hard-risk slips 0.
- structural_risk: original flagged 41/41, combination-promoted flagged 41/41, combination-promoted hard-risk slips 0.
- create_new: original flagged 11/11, combination-promoted flagged 11/11, combination-promoted hard-risk slips 0.
- unresolved: original flagged 6/6, combination-promoted flagged 6/6, combination-promoted hard-risk slips 0.
- delete: original flagged 3/3, combination-promoted flagged 3/3, combination-promoted hard-risk slips 0.

## Notes

- A hard-risk slip means the calibrated profile produced a silent auto-match pass on a benchmark case that historically needed stronger human intervention.
- A meaningful flag means the profile either kept the item out of auto-match ok or left an explicit warning/signal trail.