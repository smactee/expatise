# Risky Survivor Summary

Generated from the current calibrated adversarial replay with 11 live risky matched survivors.

## Survivor Outcomes

- warning-only: 10
- silent-pass: 1

## Recurring Warning Sets

- image-sign-symbol-mismatch-risk|trust-band-caution: 4
- image-sign-symbol-mismatch-risk: 3
- trust-band-caution: 2
- topic-subtopic-drift-risk: 1
- (silent): 1

## Silent Pass Distinction

- batch-008:screenshots/Screenshot 2026-04-07 at 18.04.32.png survived with no live warning despite being a historical override and ambiguous near-match.

## Observations

- The dominant recurring pattern is `image-sign-symbol-mismatch-risk + trust-band-caution` on image-heavy override cases.
- Single warning survivors fall into three buckets: image/sign mismatch only, trust-band caution only, and topic drift only.
- The silent survivor is not image-heavy and has no live warning signal, so it needs a separate narrow context-combination catch rather than a generic warning promotion.