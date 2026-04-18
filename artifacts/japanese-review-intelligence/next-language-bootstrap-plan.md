# Next Language Bootstrap Plan

## Goal

Use the completed Japanese review history as a supervision layer before launching the next language workflow.

## 1. Auto-match Trust Thresholds

- very-high: 37/43 accepted the top-1 qid.
- high: 84/108 accepted the top-1 qid.
- medium: 138/208 accepted the top-1 qid.
- low: 163/262 accepted the top-1 qid.
- very-low: 170/290 accepted the top-1 qid.
- none: 0/10 accepted the top-1 qid.
- Practical rule: allow faster acceptance only in the high-confidence bands, but keep image-backed sign and marking questions on manual review unless the score and candidate gap are both strong.
- Reuse the benchmark set to compare future matcher revisions before changing review thresholds.

## 2. Answer-key Validation Rules

- Preserve manual locale answer-key corrections as explicit supervision. Japanese produced 163 answer-key changes that should feed future language QA.
- If a reviewer changes the approved qid or confirms a locale key manually, store that as a stronger signal than the staged key.
- Require a visible local answer key for create-new questions whenever options are present, and keep the confirmed key through promotion.

## 3. Topic / Subtopic Suggestions

- Keep provisional topic suggestions, but treat them as soft hints until an approved qid or promoted question confirms the final class.
- Use repeated topic drift pairs from the Japanese archive to down-rank misleading topic priors in the next language.

## 4. New-question / Delete / Unresolved Heuristics

- Create-new outcomes: 24 total, 24 image-backed. Weak or missing top-1 candidates should bias toward create-new review instead of forced approval.
- Delete outcomes: 3. Keep delete as a terminal discard option for incomplete image leftovers.
- Unresolved outcomes: 6. Keep unresolved narrow and evidence-driven; it should be smaller than the delete bucket once delete is available.

## 5. Visual Signal Reuse

- Join hidden image tags into future matching features. Image-backed sign questions are overrepresented in manual overrides, so symbol and object tags can help route them correctly.
- Reuse clear visual tags such as sign, road-marking, traffic-light, arrow, crosswalk, bus, train, mountain, railroad, rain, and intersection as candidate-ranking features instead of only search metadata.

## 6. Workflow Changes To Reuse Immediately

- Preload the next language review UI with the Japanese-derived trust bands and benchmark set so matcher changes are measurable before rollout.
- Surface answer-key risk early when the top candidate qid changes but the source-side option meaning is still ambiguous.
- Preserve source screenshots, OCR prompt text, top candidates, and the final manual state in the same normalized package for every future language from day one.

## 7. Immediate Reuse Assets

- review_ground_truth.jsonl: 922 normalized reviewer outcomes.
- automatch_eval.csv: 921 auto-vs-human comparison rows.
- benchmark_set.jsonl: 117 clean benchmark rows for regression checks.