# Decision Memory

Generated: 2026-05-13T08:44:49.630Z

## Summary

- Total records: 25292
- High-risk qids: q0053, q0062, q0064, q0069, q0070, q0162, q0176, q0187, q0208, q0210, q0223, q0234, q0237, q0245, q0262, q0285, q0293, q0316, q0345, q0347, q0647, q0649, q0801, q0921
- Master-data issue qids: q0001, q0003, q0011, q0018, q0025, q0027, q0030, q0034, q0038, q0043, q0044, q0046, q0049, q0057, q0064, q0069, q0070, q0084, q0104, q0105, q0113, q0122, q0123, q0125, q0133, q0136, q0151, q0156, q0161, q0163, q0169, q0170, q0171, q0172, q0173, q0174, q0176, q0181, q0183, q0196, q0209, q0210, q0211, q0219, q0224, q0226, q0234, q0247, q0250, q0251, q0252, q0260, q0261, q0264, q0265, q0273, q0275, q0286, q0291, q0295, q0297, q0298, q0302, q0320, q0325, q0333, q0336, q0337, q0338, q0340, q0346, q0349, q0350, q0351, q0352, q0354, q0358, q0359, q0360, q0361, q0362, q0379, q0382, q0384, q0388, q0393, q0398, q0403, q0411, q0418, q0425, q0431, q0434, q0435, q0437, q0441, q0446, q0458, q0459, q0462, q0468, q0473, q0482, q0488, q0489, q0490, q0492, q0495, q0497, q0505, q0511, q0512, q0514, q0516, q0518, q0521, q0526, q0532, q0534, q0538, q0540, q0542, q0552, q0555, q0567, q0569, q0570, q0575, q0577, q0593, q0596, q0606, q0612, q0621, q0628, q0632, q0638, q0640, q0644, q0646, q0655, q0659, q0668, q0670, q0675, q0687, q0694, q0697, q0702, q0717, q0720, q0721, q0723, q0727, q0735, q0736, q0739, q0747, q0748, q0760, q0785, q0786, q0792, q0799, q0810, q0826, q0829, q0833, q0834, q0851, q0854, q0861, q0863, q0865, q0881, q0897, q0898, q0900, q0901, q0902, q0903, q0904, q0905, q0906, q0907, q0908, q0909, q0910, q0911, q0912, q0913, q0914, q0915, q0916, q0917, q0918, q0919, q0920, q0921, q0922, q0923, q0924, q0925, q0926, q0929, q0930, q0931, q0932, q0933, q0934, q0935, q0936, q0937, q0938, q0940, q0941, q0942, q0943, q0944, q0945, q0946, q0947, q0949, q0950, q0951, q0953, q0954, q0955, q0957, q0958, q0959, q0960, q0961, q0962, q0963, q0965, q0966, q0967, q0968, q0969, q0970, q0971, q0972, q0973, q0976, q0977, q0983, q0984
- Rejected/needs-fix qids: q0062, q0064, q0069, q0070, q0162, q0187, q0204, q0208, q0210, q0223, q0234, q0237, q0248, q0262, q0274, q0285, q0293, q0316, q0323, q0345, q0347, q0367, q0383, q0420, q0442, q0446, q0471, q0474, q0517, q0522, q0525, q0534, q0577, q0635, q0647, q0649, q0720, q0726, q0802, q0921, q0941, q0948, q0950, q0957, q0981

## Records By Decision Type

| key | count |
| --- | --- |
| answer-key | 10520 |
| backfill-generation | 344 |
| duplicate | 9 |
| master-data-fix | 253 |
| match | 4049 |
| merge | 7788 |
| new-question | 2134 |
| quality-review | 37 |
| reject | 88 |
| skip | 70 |

## Records By Source System

| key | count |
| --- | --- |
| ai-review | 37 |
| integrity-audit | 262 |
| manual | 15539 |
| production-merge | 7958 |
| script | 1496 |

## Reusable Matching Lessons

| qid | type | decision | reason |
| --- | --- | --- | --- |
|  | answer-key | new | Valid no-left-turn sign item; no exact master qid found. Closest prohibitory-sign qids are different signs. |
|  | answer-key | new |  |
|  | answer-key | skipped | Codex ultra-strict approveExistingQid: MCQ option rows align; French key C (Slow down and let pass) maps to master C (reduce speed and yield). Prompt and option-row concepts were checked against qbank; answer key follows French order. |
|  | answer-key | new |  |
|  | new-question | approved | Codex medium-risk createNewQuestion: Specific numeric question about minibus safety distance (<100 km/h → at least 50 m). No existing candidate precisely covers 'minibus <100 km/h' distance; recommend creating new localized item. Source indicates option A (50 m). |
|  | skip | skipped | Codex medium-risk keepUnresolved: Statement about opening doors/boarding while not properly stopped is safety-related but available candidates (e.g., q0320) concern starting with open doors—semantics differ; cannot safely approve mapping. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | reject | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | match | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | reject | rejected |  |
|  | reject | rejected |  |
|  | answer-key | new |  |
|  | reject | rejected |  |
|  | reject | rejected | Official qbank rear-tire blowout item is Right; source extracted key B is likely unreliable here. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | new-question | approved | Codex medium-risk createNewQuestion: Statement 'Snow plows or road maintenance trucks in active operation are given priority' is a valid traffic-safety assertion but no close candidate qid in the shortlist matches this exact rule; recommend creating a new localized question. Answer is 'Yes' (A). Rejected top matcher: … |
|  | answer-key | new | Valid source row item about reaching/exceeding 12 penalty points and retaking study/exams. q0312/q0327 are related but cover license detention/refusal consequences, not this exact statement. |
|  | skip | skipped | due to no image, impossible to decide which question this is there are about 6:best potential candidates are 710, 714, 771, 789 |
|  | new-question | approved | Valid source row item about reaching/exceeding 12 penalty points and retaking study/exams. q0312/q0327 are related but cover license detention/refusal consequences, not this exact statement. |
|  | answer-key | approved | answer-key approved |
|  | answer-key | new | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | answer-key | new |  |
|  | new-question | approved | proper-driving:safe-driving |
|  | answer-key | new |  |
|  | answer-key | new |  |

## Recommended Next System Improvements

- Feed `decision-memory.json` into future matcher/reranker prompts as approved/rejected examples.
- Treat master-data issue qids as preflight blockers before starting a new language.
- Keep staging short-lived; promote decision JSON to history after each completed language.

