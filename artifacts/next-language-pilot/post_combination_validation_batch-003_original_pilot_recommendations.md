# Pilot Recommendations

## Biggest Gains From Preflight

- 6 baseline auto-matches were downgraded before review because Japanese trust-band and risk rules judged them unsafe to trust directly.
- 1 items were rerouted out of generic manual review into create-new or unresolved/delete-style handling.
- Image/sign-heavy items now carry explicit visual mismatch warnings instead of relying on raw score alone.

## Main Failure Modes Still Not Covered

- Source-side image semantics are still inferred from text and existing hidden candidate tags; there is no direct object-tag extraction on the new source screenshots yet.
- Topic drift is lightweight and only uses provisional topic hints plus candidate topic labels. It does not run a deeper semantic classifier.
- Delete routing is intentionally conservative. Without direct asset integrity or OCR quality metrics, only structurally broken items are pushed there.

## Should We Trust This For Full Next-Language Rollout?

- Recommendation: needs one more iteration.
- Downgrade rate on baseline auto-matches: 66.7%.
- Rerouted create-new/unresolved/delete items: 1.
- Biggest remaining risk: sign/image-heavy near-matches can still look semantically close without enough source-side visual evidence.

## Operational Use

- Run the standard batch matcher first, then run the pilot preflight to inspect the before-vs-after CSV and risk bucket summary.
- If the pilot still shows too many high-band downgrades, tune thresholds on the preflight wrapper before scaling to the full language.
- Keep the preflight wrapper non-destructive until one real next-language pilot batch has been reviewed manually.