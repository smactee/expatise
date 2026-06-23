# Decision Memory

Generated: 2026-06-23T13:59:53.651Z

## Summary

- Total records: 55644
- High-risk qids: q0018, q0025, q0053, q0062, q0064, q0069, q0070, q0084, q0162, q0176, q0187, q0208, q0210, q0223, q0226, q0234, q0237, q0245, q0260, q0261, q0262, q0275, q0285, q0293, q0302, q0316, q0325, q0336, q0345, q0347, q0352, q0358, q0359, q0462, q0488, q0514, q0575, q0640, q0647, q0649, q0801, q0904, q0908, q0913, q0918, q0921, q0945, q0947, q0950, q0973, q0983, q0984, q0991, q1005, q1008, q1011, q1012
- Master-data issue qids: q0431, q0450, q0518, q0730, q0906, q0974, q0975, q0976, q0977, q0978, q0979, q0980, q0981, q0982, q0983, q0984, q0985, q0986, q0987, q0988, q0989, q0991, q0992, q0993, q0994, q0995, q0996, q0998, q0999, q1001, q1002, q1003, q1004, q1005, q1006, q1007, q1008, q1009, q1011, q1012
- Rejected/needs-fix qids: q0018, q0025, q0062, q0064, q0069, q0070, q0084, q0162, q0187, q0204, q0208, q0210, q0223, q0226, q0234, q0237, q0248, q0260, q0261, q0262, q0274, q0275, q0285, q0293, q0294, q0302, q0316, q0323, q0325, q0336, q0345, q0347, q0352, q0358, q0359, q0367, q0383, q0420, q0442, q0446, q0462, q0471, q0474, q0488, q0489, q0514, q0517, q0522, q0525, q0534, q0575, q0577, q0599, q0623, q0635, q0640, q0647, q0649, q0720, q0726, q0802, q0863, q0904, q0908, q0913, q0918, q0921, q0929, q0941, q0945, q0947, q0948, q0950, q0957, q0973, q0981, q0983, q0984, q0991, q0994, q0995, q1005, q1008, q1011, q1012

## Records By Decision Type

| key | count |
| --- | --- |
| answer-key | 22606 |
| backfill-generation | 2561 |
| duplicate | 4 |
| master-data-fix | 42 |
| match | 9165 |
| merge | 15933 |
| new-question | 4578 |
| quality-review | 334 |
| reject | 276 |
| skip | 145 |

## Records By Source System

| key | count |
| --- | --- |
| ai-review | 334 |
| integrity-audit | 46 |
| manual | 30962 |
| production-merge | 16124 |
| script | 8178 |

## Reusable Matching Lessons

| qid | type | decision | reason |
| --- | --- | --- | --- |
|  | answer-key | new | Valid no-left-turn sign item; no exact master qid found. Closest prohibitory-sign qids are different signs. |
|  | answer-key | rejected | Claude low-risk approve (backlog-clear): backlogNote named q0107 (driving through slightly flooded road with bicycles/non-motorized vehicles on both sides, matcher 60.6); q0107 still UNCLAIMED, clearly best. Master answer 'reduce speed and go slowly' = Arabic C (reduce speed and drive slowly). |
|  | new-question | rejected | Claude medium-risk approveExistingQid: statement says signal AT THE SAME MOMENT as changing lanes (wrong, should signal in advance) = false; closest is q0013 (signal then rapidly enter, W) mapping master W to local B=错误; near-dup ROW family with q0097/q0004 (advance-signal variants). |
|  | match | rejected | Cross-batch DUPLICATE: owner approved q0037 (neutral-coast downhill = false), but q0037 is already localized for zh in batch-1 (11.35.24 1). Same question => delete (zh app showed it twice). |
|  | answer-key | new |  |
|  | answer-key | rejected | Claude medium-risk approveExistingQid: local options {纵向减速=longitudinal/vertical decel, 道路施工=construction, 车道变少=lane-reduction/fewer lanes, 横向减速=transverse/horizontal decel} exactly match q0778's set {road construction, horizontal deceleration, vertical deceleration, fewer lanes} (optSetScore 0.27, prompt 'meaning of … |
|  | answer-key | rejected | Claude low-risk approveExistingQid: oncoming vehicle in your lane -> let them pass = B 'ceder el paso' |
|  | answer-key | new |  |
|  | answer-key | rejected | Claude high-risk approveExistingQid: AR is a 'which case' registration-change question forced into Yes/No; closest master q0985 (vehicle registration reissue), weak option overlap. based on the question it seems it must be a mcq but it is a row. just delete the question. |
|  | new-question | approved | Codex medium-risk createNewQuestion: No close candidate match found. Source is a valid road-accident rule (mark original position if you moved evidence while assisting); not represented in top candidates — create new question. Local correct option is Yes=A. |
|  | new-question | approved | Valid MCQ asking the maximum continuous driving time; no exact master qid found. Related q0445 asks the required rest time after more than four hours. |
|  | answer-key | skipped | Claude med-risk approveExistingQid: Fuel-pump warning symbol (low fuel). ROW statement claims it means refill engine OIL = false. Image exact match q0542 (matcher #1, imageNN 0.889; same img as q1008 fuel/q0621). q0542 'add lubricating oil' correct=Wrong -> No=B. |
|  | answer-key | skipped | Claude low-risk approveExistingQid: ROW about breakdown warning-sign distance behind vehicle; q0243 is closest by meaning+keywords (kwScore 0.31, matcher 25.73, 'place a warning sign within 50 meters behind') and is false (correct distance differs). master W => local 错误 = B. The zh 50-150m statement is likewise wrong … |
|  | answer-key | rejected | Claude low-risk approveExistingQid: MCQ 'what marking is the yellow road surface at the center of the intersection' is a prompt+option-set match to q0804 (matcherScore 67.75, optSetScore 0.29, kwScore 0.53; masterImageTags yellow-grid/yellow-square). masterCorrectAnswerText 'cross-hatched marking' = local A 网状线 'Yello… |
|  | match | rejected | Claude medium-risk approveExistingQid: matcher top-1 q0011 (score 42.6) |
|  | reject | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | match | rejected | Same defogger/defroster control image, but the localized source options do not include defogger; answer key needs human correction. |
|  | reject | rejected |  |
|  | reject | rejected | Claude high-risk createNewQuestion: local option set {expressway parking-area / parking-lot / service-area / escape-ramp(refuge) advance notice} has no twin. Candidate sign sets (q0663, q0895, q0884: parking-area/shelter/car-park/service-area/bus-station/toll-station 'ahead') overlap loosely (optSetScore <=0.20) but n… |
|  | reject | rejected | Auto-flagged POTENTIAL DELETE (image/text mismatch): embedded image = A green line-art icon of a headlight projecting beam, does not match the text. Closest text match q0802 retained. |
|  | reject | rejected |  |
|  | new-question | rejected | Auto-flagged POTENTIAL DELETE (image/text mismatch): embedded image = A white bicycle silhouette on a gray square backgrou, does not match the question text. Closest text match q0451 retained — confirm delete or click Approve. |
|  | skip | skipped | [DUP-SUSPECT: top global match was already-localized q0216 (score 32.5) — approved to closest UNCLAIMED qid; verify not a re-capture of q0216] Claude high-risk approveExistingQid: matcher top-1 q0293 (score 31.3) |
|  | reject | rejected | Codex high-risk keepUnresolved: Potential new question but local answer key is unknown; kept unresolved for human review. Rejected top matcher: Potential new question but local answer key is unknown; kept unresolved for human review. |
|  | reject | rejected | Auto-flagged POTENTIAL DELETE (image/text mismatch): embedded image = A white pictogram of a seated person with a white ar, does not match the text. Closest text match q0864 retained. |

## Recommended Next System Improvements

- Feed `decision-memory.json` into future matcher/reranker prompts as approved/rejected examples.
- Treat master-data issue qids as preflight blockers before starting a new language.
- Keep staging short-lived; promote decision JSON to history after each completed language.

