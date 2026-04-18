# Combination Rule Candidates

These promotions are intentionally narrow. They strengthen recurring risky survivor patterns without turning single weak warnings back into blanket downgrades.

- combo-image-sign-context-risk: catches 7 current risky survivors. Promote image/sign mismatch back to a soft downgrade only when the source is an image-backed MCQ with stronger prompt context and either explicit answer evidence, weaker topic confidence, or a present candidate topic label.
- combo-trust-option-dominant-risk: catches 2 current risky survivors. Promote trust-band caution only for option-dominant near-matches that have no candidate topic metadata and a very confident source topic.
- combo-trust-answer-context-risk: catches 4 current risky survivors. Promote trust-band caution when the item is image-backed and has explicit answer context, which keeps the binary safety rule narrow and avoids ROW false positives.
- combo-topic-option-dominant-risk: catches 1 current risky survivors. Promote topic drift only for option-dominant near-matches with missing candidate topic metadata and very confident source topic inference.
- combo-silent-option-dominant-risk: catches 1 current risky survivors. Catch the lone silent pass by promoting a no-signal context combination: missing candidate topic, very confident source topic, and option-dominant near-match characteristics.