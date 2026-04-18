# Adversarial Evaluation

Generated at 2026-04-18T15:19:23.910Z across 19 Japanese batch(es) for profile `calibrated`.

## Coverage

- benchmark rows replayed: 92
- hard-risk rows: 92
- warning-risk rows: 92
- live matched risky rows: 11
- calibrated hard-risk silent passes: 1
- original live matched risky routed/warned/silent: 7/3/1
- calibrated live matched risky routed/warned/silent: 0/10/1

## Case-Type Flag Coverage

- ambiguous_near_match: original flagged 87/88, calibrated flagged 87/88, calibrated hard-risk slips 1.
- override: original flagged 81/82, calibrated flagged 81/82, calibrated hard-risk slips 1.
- answer_key_change: original flagged 72/72, calibrated flagged 72/72, calibrated hard-risk slips 0.
- image_heavy: original flagged 70/70, calibrated flagged 70/70, calibrated hard-risk slips 0.
- topic_drift: original flagged 66/67, calibrated flagged 66/67, calibrated hard-risk slips 1.
- structural_risk: original flagged 41/41, calibrated flagged 41/41, calibrated hard-risk slips 0.
- create_new: original flagged 11/11, calibrated flagged 11/11, calibrated hard-risk slips 0.
- unresolved: original flagged 6/6, calibrated flagged 6/6, calibrated hard-risk slips 0.
- delete: original flagged 3/3, calibrated flagged 3/3, calibrated hard-risk slips 0.

## Notes

- A hard-risk slip means the calibrated profile produced a silent auto-match pass on a benchmark case that historically needed stronger human intervention.
- A meaningful flag means the profile either kept the item out of auto-match ok or left an explicit warning/signal trail.