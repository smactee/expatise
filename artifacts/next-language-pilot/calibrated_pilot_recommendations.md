# Calibrated Pilot Recommendations

Generated at 2026-04-18T08:35:03.426Z for `ja/batch-020` using calibrated profile `calibrated`.

## Before vs After

- baseline auto-match ok: 9
- original preflight auto-match ok: 1
- calibrated preflight auto-match ok: 9
- original manual review: 33
- calibrated manual review: 25
- original downgraded auto-matches: 8
- calibrated downgraded auto-matches: 0
- recovered downgraded auto-matches: 8
- still downgraded after calibration: 0

## Biggest Gains From Calibration

- 8/8 audited downgrades were human-approved as the original qid, and calibration restores those matches to auto-match ok.
- Topic drift and trust-band caution now stay visible as warnings instead of independently killing a matched candidate.
- Moderate image/sign mismatches still surface in the audit trail, but only severe image-asset conflicts remain blocking.

## Main Failure Modes Still Not Covered

- This pilot batch does not contain any human-proven bad baseline auto-matches, so calibrated recall on truly wrong matched items is still unmeasured.
- Source-side image semantics are still inferred from text plus candidate hidden tags rather than direct screenshot understanding.
- Answer-key risk stayed mostly unexercised in this pilot, so its downgrade behavior still needs a broader sample.

## Should We Trust This For Full Next-Language Rollout?

- Recommendation: limited batch run.
- Biggest gains from preflight: recovered 8 known-correct auto-matches without weakening structural or reroute safety checks.
- Main failure mode still not covered: no adjudicated bad matched examples in this sample, so the calibrated profile needs one more pilot that includes borderline false positives before a full rollout.

## Operational Use

- Keep the calibrated profile optional and non-destructive.
- Run the downgrade audit first on any new pilot batch, then decide whether the calibrated profile should become the default wrapper.
- Use the review sheet whenever the pilot batch has no historical adjudication yet.