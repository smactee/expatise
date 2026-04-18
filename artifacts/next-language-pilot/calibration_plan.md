# Calibration Plan

Generated at 2026-04-18T08:35:03.426Z for `ja/batch-020`.

## Audit Outcome

- Original downgraded items: 8.
- Audited too_conservative downgrades: 8.
- Audited correct_catch downgrades: 0.

## Reclassification

- hard block: choice-shape mismatch, structural unresolved/delete routing, likely create-new-question routing, and any severe image-mismatch caused by a missing candidate image asset.
- soft downgrade: answer-key consistency risk when explicit answer evidence exists.
- warning only: topic/subtopic drift risk, moderate image/sign/symbol mismatch risk, and Japanese trust-band caution.

## Explicit Changes Applied

- trust-band-caution: warning only.
- topic-subtopic-drift-risk: warning only.
- image-sign-symbol-mismatch-risk: warning only for moderate cases; keep hard block for severe no-image conflicts.
- answer-key-consistency-risk: soft downgrade.

## Count Shift

- baseline auto-match ok: 9
- original preflight auto-match ok: 1
- calibrated preflight auto-match ok: 9
- original downgrades: 8
- calibrated downgrades: 0

## Limits

- This pilot batch exposes only human-approved baseline auto-matches, so the calibration reduces false-positive downgrade pressure but does not yet validate recall against a known bad matched set.
- The calibrated profile keeps severe structural mismatches strong and does not weaken reroute logic for create-new, unresolved, or delete paths.