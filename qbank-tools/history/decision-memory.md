# Decision Memory

Generated: 2026-05-09T10:54:56.140Z

## Summary

- Total records: 18429
- High-risk qids: q0053, q0062, q0064, q0069, q0070, q0162, q0176, q0187, q0208, q0210, q0223, q0234, q0237, q0245, q0262, q0285, q0293, q0316, q0345, q0347, q0647, q0649, q0801, q0921
- Master-data issue qids: q0518
- Rejected/needs-fix qids: q0062, q0064, q0069, q0070, q0162, q0187, q0204, q0208, q0210, q0223, q0234, q0237, q0248, q0262, q0274, q0285, q0293, q0316, q0323, q0345, q0347, q0367, q0383, q0420, q0442, q0446, q0471, q0474, q0517, q0522, q0525, q0534, q0577, q0635, q0647, q0649, q0720, q0726, q0802, q0921, q0941, q0948, q0950, q0957, q0981

## Records By Decision Type

| key | count |
| --- | --- |
| answer-key | 7238 |
| backfill-generation | 344 |
| duplicate | 20 |
| master-data-fix | 2 |
| match | 3754 |
| merge | 5484 |
| new-question | 1423 |
| quality-review | 37 |
| reject | 80 |
| skip | 47 |

## Records By Source System

| key | count |
| --- | --- |
| ai-review | 37 |
| integrity-audit | 22 |
| manual | 11225 |
| production-merge | 5654 |
| script | 1491 |

## Reusable Matching Lessons

| qid | type | decision | reason |
| --- | --- | --- | --- |
|  | answer-key | new | Valid no-left-turn sign item; no exact master qid found. Closest prohibitory-sign qids are different signs. |
|  | answer-key | new |  |
|  | skip | skipped |  |
|  | answer-key | new |  |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | reject | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | match | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | reject | rejected |  |
|  | skip | skipped |  |
|  | reject | rejected |  |
|  | answer-key | approved |  |
|  | answer-key | new |  |
|  | reject | rejected |  |
|  | reject | rejected | Official qbank rear-tire blowout item is Right; source extracted key B is likely unreliable here. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | answer-key | new | Valid source row item about reaching/exceeding 12 penalty points and retaking study/exams. q0312/q0327 are related but cover license detention/refusal consequences, not this exact statement. |
|  | skip | skipped | due to no image, impossible to decide which question this is there are about 6:best potential candidates are 710, 714, 771, 789 |
|  | new-question | approved | Valid source row item about reaching/exceeding 12 penalty points and retaking study/exams. q0312/q0327 are related but cover license detention/refusal consequences, not this exact statement. |
|  | answer-key | approved | answer-key approved |
|  | answer-key | new | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | answer-key | new |  |
|  | skip | skipped |  |
|  | new-question | approved | proper-driving:safe-driving |
|  | answer-key | new |  |
|  | answer-key | new |  |

## Recommended Next System Improvements

- Feed `decision-memory.json` into future matcher/reranker prompts as approved/rejected examples.
- Treat master-data issue qids as preflight blockers before starting a new language.
- Keep staging short-lived; promote decision JSON to history after each completed language.

