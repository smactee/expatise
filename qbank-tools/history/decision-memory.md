# Decision Memory

Generated: 2026-06-09T13:25:37.615Z

## Summary

- Total records: 38257
- High-risk qids: q0018, q0025, q0053, q0062, q0064, q0069, q0070, q0084, q0162, q0176, q0187, q0208, q0210, q0223, q0226, q0234, q0237, q0245, q0260, q0261, q0262, q0275, q0285, q0293, q0302, q0316, q0325, q0336, q0345, q0347, q0352, q0358, q0359, q0462, q0488, q0514, q0575, q0640, q0647, q0649, q0801, q0904, q0908, q0913, q0918, q0921, q0945, q0947, q0950, q0973, q0983, q0984, q0991, q1005, q1008, q1011, q1012
- Master-data issue qids: q0431, q0450, q0518, q0906, q0974, q0975, q0976, q0977, q0978, q0979, q0980, q0981, q0982, q0983, q0984, q0985, q0986, q0987, q0988, q0989, q0991, q0992, q0993, q0994, q0995, q0996, q0998, q0999, q1001, q1002, q1003, q1004, q1005, q1006, q1007, q1008, q1009, q1011, q1012
- Rejected/needs-fix qids: q0018, q0025, q0062, q0064, q0069, q0070, q0084, q0162, q0187, q0204, q0208, q0210, q0223, q0226, q0234, q0237, q0248, q0260, q0261, q0262, q0274, q0275, q0285, q0293, q0302, q0316, q0323, q0325, q0336, q0345, q0347, q0352, q0358, q0359, q0367, q0383, q0420, q0442, q0446, q0462, q0471, q0474, q0488, q0489, q0514, q0517, q0522, q0525, q0534, q0575, q0577, q0599, q0623, q0635, q0640, q0647, q0649, q0720, q0726, q0802, q0863, q0904, q0908, q0913, q0918, q0921, q0929, q0941, q0945, q0947, q0948, q0950, q0957, q0973, q0981, q0983, q0984, q0991, q0994, q0995, q1005, q1008, q1011, q1012

## Records By Decision Type

| key | count |
| --- | --- |
| answer-key | 14129 |
| backfill-generation | 1679 |
| duplicate | 4 |
| master-data-fix | 42 |
| match | 8276 |
| merge | 10590 |
| new-question | 2991 |
| quality-review | 334 |
| reject | 106 |
| skip | 106 |

## Records By Source System

| key | count |
| --- | --- |
| ai-review | 334 |
| integrity-audit | 46 |
| manual | 21261 |
| production-merge | 10781 |
| script | 5835 |

## Reusable Matching Lessons

| qid | type | decision | reason |
| --- | --- | --- | --- |
|  | answer-key | new | Valid no-left-turn sign item; no exact master qid found. Closest prohibitory-sign qids are different signs. |
|  | answer-key | new |  |
|  | answer-key | rejected | Claude low-risk approveExistingQid: oncoming vehicle in your lane -> let them pass = B 'ceder el paso' |
|  | answer-key | new |  |
|  | new-question | approved | Codex medium-risk createNewQuestion: No close candidate match found. Source is a valid road-accident rule (mark original position if you moved evidence while assisting); not represented in top candidates — create new question. Local correct option is Yes=A. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | reject | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | match | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | reject | rejected |  |
|  | reject | rejected |  |
|  | reject | rejected | Codex high-risk keepUnresolved: Potential new question but local answer key is unknown; kept unresolved for human review. Rejected top matcher: Potential new question but local answer key is unknown; kept unresolved for human review. |
|  | skip | skipped | Claude low-risk approveExistingQid: low tyre pressure at high speed; q0179 option-set 0.57. Answer key = matcher staged (verify). |
|  | answer-key | new |  |
|  | new-question | approved | Codex medium-risk createNewQuestion: Specific numeric question about minibus safety distance (<100 km/h → at least 50 m). No existing candidate precisely covers 'minibus <100 km/h' distance; recommend creating new localized item. Source indicates option A (50 m). |
|  | reject | rejected |  |
|  | reject | rejected | Official qbank rear-tire blowout item is Right; source extracted key B is likely unreliable here. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | match | skipped | Codex medium-risk keepUnresolved: Legal-statement item about sentencing (3–7 years) after fleeing and victims dying. Top candidates differ and legal specifics are unclear from source alone; insufficient confidence to approve an existing qid mapping. Rejected top matcher: Top matcher (q0196) asserts 'Wrong' but legal w… |
|  | answer-key | skipped |  |
|  | skip | skipped | Claude medium-risk approveExistingQid: dashboard open-compartment indicator; q0617 symbol-indicator, score 111. Answer key = matcher staged (verify). |
|  | answer-key | new | Valid source row item about reaching/exceeding 12 penalty points and retaking study/exams. q0312/q0327 are related but cover license detention/refusal consequences, not this exact statement. |
|  | reject | rejected | Claude high-risk keepUnresolved: source says "drive on the LEFT" while top candidate q0093 says "drive on the RIGHT" (correctRow R/true), a polarity-flipping discrepancy that makes the answer key indeterminate despite same mountain-road/slow-down/horn scenario. if this is the actual correct translation, |
|  | skip | skipped | due to no image, impossible to decide which question this is there are about 6:best potential candidates are 710, 714, 771, 789 |
|  | reject | rejected | Owner approved to already-localized q0500; flipped to deleteQuestion (target-language duplicate of shipped q0500) per ship dedup policy [Claude, batch-007 precedent] |
|  | skip | skipped | Owner: keep unresolved (2026-06-09). Entry/exit pair collision with 12.03.20 on q0802; #47 is likely the ENTRY variant (q0723) but deferred to de backlog for a later look rather than adjudicate now. |

## Recommended Next System Improvements

- Feed `decision-memory.json` into future matcher/reranker prompts as approved/rejected examples.
- Treat master-data issue qids as preflight blockers before starting a new language.
- Keep staging short-lived; promote decision JSON to history after each completed language.

