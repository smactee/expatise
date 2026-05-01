# RU Discrepancy Apply Preview

Generated at: 2026-05-01T13:07:33.710Z
Mode: apply
Production qbank modified: no

## Inputs

- Decisions: `qbank-tools/generated/staging/ru-discrepancy-review-decisions.json`
- Review items: `qbank-tools/generated/staging/ru-discrepancy-review-items.json`
- Production translations checked: `public/qbank/2023-test1/translations.ru.json`

## Counts By Action

| action | count |
|---|---:|
| approve existing qid | 18 |
| create new question | 33 |
| keep unresolved | 0 |
| delete question | 45 |
| ignore/count reconciliation | 0 |

## Validation Summary

- Total items: 96
- Valid items: 96
- Invalid items: 0
- Apply-eligible items: 70
- Skipped items: 26
- Risky/ambiguous items: 85
- Missing-production-qid merge-needed items: 2
- Auto-normalized ROW answers: 35
- Answer-key letter mismatches accepted for review: 21
- Manually confirmed duplicate-label answers: 2
- Corrupted source label items: 47
- Corrupted source label items blocked by selected answer ambiguity/missing source key: 0

## Auto-normalized ROW Answers

| item | source selected key | source selected text | exported locale key |
|---|---|---|---|
| create-new:batch-03:1:screenshots/150.png | A | Правильно | Right |
| create-new:batch-05:50:screenshots/Screenshot 2026-04-19 at 18.50.01.png | A | Correct | Right |
| create-new:batch-07:41:screenshots/350.png | B | Incorrect | Wrong |
| create-new:batch-07:47:screenshots/Screenshot 2026-04-19 at 18.52.16.png | A | Правильно | Right |
| create-new:batch-08:33:screenshots/Screenshot 2026-04-19 at 18.53.08.png | B | Incorrect | Wrong |
| create-new:batch-10:20:screenshots/Screenshot 2026-04-19 at 18.54.28 1.png | B | Incorrect | Wrong |
| create-new:batch-12:43:screenshots/Screenshot 2026-04-19 at 18.56.00.png | B | Incorrect | Wrong |
| create-new:batch-12:44:screenshots/Screenshot 2026-04-19 at 18.56.03.png | B | Incorrect | Wrong |
| create-new:batch-12:22:screenshots/Screenshot 2026-04-19 at 18.56.11.png | A | Правильно | Right |
| create-new:batch-12:47:screenshots/Screenshot 2026-04-19 at 18.56.15.png | B | Incorrect | Wrong |
| create-new:batch-12:31:screenshots/Screenshot 2026-04-19 at 18.56.21 1.png | A | Правильно | Right |
| create-new:batch-12:35:screenshots/Screenshot 2026-04-19 at 18.56.24.png | B | Incorrect | Wrong |
| create-new:batch-12:50:screenshots/Screenshot 2026-04-19 at 18.56.30.png | A | Правильно | Right |
| create-new:batch-13:45:screenshots/Screenshot 2026-04-19 at 18.56.51.png | B | Incorrect | Wrong |
| create-new:batch-18:18:screenshots/Screenshot 2026-04-19 at 19.00.40.png | A | Правильно | Right |
| unresolved:batch-001:14:Screenshot 2026-04-19 at 18.46.34.png | B | Incorrect | Wrong |
| unresolved:batch-03:27:screenshots/Screenshot 2026-04-19 at 18.48.34.png | B | Incorrect | Wrong |
| unresolved:batch-05:37:screenshots/Screenshot 2026-04-19 at 18.50.23 1.png | B | Incorrect | Wrong |
| unresolved:batch-09:45:screenshots/Screenshot 2026-04-19 at 18.53.34.png | A | Правильно | Right |
| unresolved:batch-18:11:screenshots/Screenshot 2026-04-19 at 19.00.34.png | Wrong | Incorrect | Wrong |
| deleted:batch-13:21:screenshots/Screenshot 2026-04-19 at 18.56.57.png | Right | Правильно | Right |
| deleted:batch-15:5:screenshots/Screenshot 2026-04-19 at 18.58.12 1.png | Right | Правильно | Right |
| duplicate-approval:batch-04:27:q0323 | A | Correct | Right |
| duplicate-approval:batch-07:37:q0064 | A | Правильно | Right |
| duplicate-approval:batch-09:37:q0210 | A | Правильно | Right |
| duplicate-approval:batch-09:2:q0187 | A | Правильно | Right |
| duplicate-approval:batch-12:3:q0649 | A | Правильно | Right |
| duplicate-approval:batch-12:49:q0293 | A | Правильно | Right |
| duplicate-approval:batch-15:2:q0223 | A | Правильно | Right |
| duplicate-approval:batch-16:4:q0262 | B | Incorrect | Wrong |
| duplicate-approval:batch-17:44:q0062 | A | Правильно | Right |
| duplicate-approval:batch-17:21:q0347 | A | Правильно | Right |
| duplicate-approval:batch-18:1:q0316 | A | Правильно | Right |
| duplicate-approval:batch-18:38:q0069 | A | Правильно | Right |
| missing-production-qid:batch-08:9:q0245 | Right | Правильно | Right |

## Answer-key Letter Mismatches Accepted Because Local/Source Option Order Differs

| item | qid | source/local answer | master answer | selected locale answer | meaning check |
|---|---|---|---|---|---|
| create-new:batch-06:25:screenshots/Screenshot 2026-04-19 at 18.51.32.png | q0158 | C / It is not allowed to stop parallel or on the oncoming lane | A / is not allowed to stop in the opposite direction or in parallel | C / It is not allowed to stop parallel or on the oncoming lane | keyword-overlap 0.6667 |
| create-new:batch-17:30:screenshots/Screenshot 2026-04-19 at 19.00.08 1.png | q0695 | A / Left turn prohibited | C / no turning left | A / Left turn prohibited | keyword-overlap 0.3333 |
| unresolved:batch-03:7:screenshots/Screenshot 2026-04-19 at 18.48.21.png | q0801 | C / Warning marking | A / indicative marking | B / Prohibitory marking | keyword-overlap 0.5 |
| unresolved:batch-05:33:screenshots/Screenshot 2026-04-19 at 18.50.20.png | q0506 | B / Imprisonment and a fine | D / a criminal detention and a fine | A / Detention and a fine | keyword-overlap 0.5 |
| unresolved:batch-18:11:screenshots/Screenshot 2026-04-19 at 19.00.34.png | q0300 | Right / Правильно | Wrong / Wrong | Wrong / Incorrect | keyword-overlap 0 |
| deleted:batch-13:21:screenshots/Screenshot 2026-04-19 at 18.56.57.png | q0287 | Wrong / Incorrect | Right / Right | Right / Правильно | keyword-overlap 0 |
| duplicate-approval:batch-001:33:q0670 | q0757 | D / Fork warning | B / intersection ahead | D / Fork warning | keyword-overlap 0 |
| duplicate-approval:batch-002:11:q0666 | q0666 | D / Separation of oncoming traffic flow | B / separate the traffic flow in opposite directions | D / Separation of oncoming traffic flow | keyword-overlap 0.5 |
| duplicate-approval:batch-04:3:q0981 | q0981 | D / 12 points | A / 12 points | D / 12 points | exact 1 |
| duplicate-approval:batch-05:1:q0383 | q0383 | C / Every year | D / every 1 year | C / Every year | keyword-overlap 1 |
| duplicate-approval:batch-07:40:q0442 | q0442 | A / Yield to the oncoming vehicle that is turning left | D / let the opposite car turn left first | A / Yield to the oncoming vehicle that is turning left | keyword-overlap 0.1667 |
| duplicate-approval:batch-08:37:q0162 | q0162 | D / Reduce speed and yield by moving to the right side of the road | B / reduce speed, observe and keep to the right side of the road to yield | D / Reduce speed and yield by moving to the right side of the road | keyword-overlap 0.8571 |
| duplicate-approval:batch-10:33:q0446 | q0446 | B / Drug addict | D / drug injections | B / Drug addict | keyword-overlap 0.5 |
| duplicate-approval:batch-10:36:q0577 | q0577 | B / Front windshield wipers | C / the windshield wiper and washer | B / Front windshield wipers | keyword-overlap 0.3333 |
| duplicate-approval:batch-11:32:q0726 | q0726 | C / : Crossing the boundary of a one-way lane is prohibited | B / same direction lanes dividing line that can not be crossed | C / : Crossing the boundary of a one-way lane is prohibited | keyword-overlap 0 |
| duplicate-approval:batch-12:1:q0367 | q0367 | D / 90 km/h | B / 90 km/hr | D / 90 km/h | containment 0.92 |
| duplicate-approval:batch-13:41:q0517 | q0517 | B / Driver's license | C / driving license | B / Driver's license | keyword-overlap 0.5 |
| duplicate-approval:batch-16:6:q0162 | q0162 | C / Slow down and keep to the right lane of the road | B / reduce speed, observe and keep to the right side of the road to yield | C / Slow down and keep to the right lane of the road | keyword-overlap 0.5 |
| duplicate-approval:batch-16:19:q0474 | q0474 | C / 12 months | B / 12 months | C / 12 months | exact 1 |
| duplicate-approval:batch-17:15:q0720 | q0720 | A / Bus lane | B / special lane for public buses | A / Bus lane | keyword-overlap 0.5 |
| missing-production-qid:batch-08:44:q0176 | q0176 | B / Yield to it | C / voluntarily yield to the other side | B / Yield to it | keyword-overlap 1 |

## Manually Confirmed Duplicate-label Answers

| item | action | selected | detected labels | validation |
|---|---|---|---|---|
| unresolved:batch-08:46:screenshots/Screenshot 2026-04-19 at 18.52.41.png | new | D | A, A, D, D | manually confirmed duplicate-label answer accepted for localeAnswerKey D; corrupted source option labels require manual confirmation for new: detected A, A, D, D |
| unresolved:batch-18:50:screenshots/Screenshot 2026-04-19 at 19.00.53.png | approve | D | D, B, D, D | manually confirmed duplicate-label answer accepted for localeAnswerKey D; corrupted source option labels require manual confirmation for approve: detected D, B, D, D |

## Corrupted Source Labels Requiring Manual Confirmation

| item | selected | manual confirmation | detected labels | duplicate | missing | validation |
|---|---|---|---|---|---|---|
| create-new:batch-03:1:screenshots/150.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-07:41:screenshots/350.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-07:46:screenshots/Screenshot 2026-04-19 at 18.52.13 1.png | A | no | A, D, D, D | D | B, C | corrupted source option labels require manual confirmation for new: detected A, D, D, D |
| create-new:batch-07:47:screenshots/Screenshot 2026-04-19 at 18.52.16.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-08:33:screenshots/Screenshot 2026-04-19 at 18.53.08.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-10:20:screenshots/Screenshot 2026-04-19 at 18.54.28 1.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:43:screenshots/Screenshot 2026-04-19 at 18.56.00.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:44:screenshots/Screenshot 2026-04-19 at 18.56.03.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:22:screenshots/Screenshot 2026-04-19 at 18.56.11.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:47:screenshots/Screenshot 2026-04-19 at 18.56.15.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:31:screenshots/Screenshot 2026-04-19 at 18.56.21 1.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-12:50:screenshots/Screenshot 2026-04-19 at 18.56.30.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-13:45:screenshots/Screenshot 2026-04-19 at 18.56.51.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| create-new:batch-18:18:screenshots/Screenshot 2026-04-19 at 19.00.40.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| unresolved:batch-001:14:Screenshot 2026-04-19 at 18.46.34.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| unresolved:batch-03:40:screenshots/Screenshot 2026-04-19 at 18.48.44.png | D | no | A, B, B, D | B | C |  |
| unresolved:batch-08:46:screenshots/Screenshot 2026-04-19 at 18.52.41.png | D | yes | A, A, D, D | A, D | B, C | manually confirmed duplicate-label answer accepted for localeAnswerKey D; corrupted source option labels require manual confirmation for new: detected A, A, D, D |
| unresolved:batch-09:45:screenshots/Screenshot 2026-04-19 at 18.53.34.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| unresolved:batch-18:11:screenshots/Screenshot 2026-04-19 at 19.00.34.png | Wrong | no | C, B |  | A | corrupted source option labels require manual confirmation for approve: detected C, B; answer-key letter mismatch accepted for review: source Right / Правильно vs master Wrong / Wrong; meaning alignment requires manual confirmation; auto-normalized ROW answer accepted: source selected key Wrong -> exported Wrong |
| unresolved:batch-18:12:screenshots/Screenshot 2026-04-19 at 19.00.35.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for new: detected C, B |
| unresolved:batch-18:50:screenshots/Screenshot 2026-04-19 at 19.00.53.png | D | yes | D, B, D, D | D | A, C | manually confirmed duplicate-label answer accepted for localeAnswerKey D; corrupted source option labels require manual confirmation for approve: detected D, B, D, D |
| deleted:batch-13:21:screenshots/Screenshot 2026-04-19 at 18.56.57.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for approve: detected C, B; answer-key letter mismatch accepted for review: source Wrong / Incorrect vs master Right / Right; meaning alignment requires manual confirmation; auto-normalized ROW answer accepted: source selected key Right -> exported Right |
| deleted:batch-15:5:screenshots/Screenshot 2026-04-19 at 18.58.12 1.png | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for approve: detected C, B; auto-normalized ROW answer accepted: source selected key Right -> exported Right |
| duplicate-approval:batch-002:13:q0053 | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for approve: detected C, B |
| duplicate-approval:batch-07:37:q0064 | Right | no | C, B |  | A | delete decision carries approvedQid q0064; apply will clear it in batch decisions |
| duplicate-approval:batch-08:37:q0162 | D | no | C, B, C, D | C | A | delete decision carries approvedQid q0162; apply will clear it in batch decisions |
| duplicate-approval:batch-09:37:q0210 | Right | no | C, B |  | A | delete decision carries approvedQid q0210; apply will clear it in batch decisions |
| duplicate-approval:batch-09:2:q0187 | Right | no | C, B |  | A | delete decision carries approvedQid q0187; apply will clear it in batch decisions |
| duplicate-approval:batch-10:8:q0285 |  | no | C, B |  | A | delete decision carries approvedQid q0285; apply will clear it in batch decisions |
| duplicate-approval:batch-11:37:q0921 | UNKNOWN | no | C, B |  | A | delete decision carries approvedQid q0921; apply will clear it in batch decisions |
| duplicate-approval:batch-11:7:q0647 |  | no | C, B |  | A | delete decision carries approvedQid q0647; apply will clear it in batch decisions |
| duplicate-approval:batch-11:25:q0208 |  | no | C, B |  | A | delete decision carries approvedQid q0208; apply will clear it in batch decisions |
| duplicate-approval:batch-11:36:q0234 | UNKNOWN | no | C, B |  | A | delete decision carries approvedQid q0234; apply will clear it in batch decisions |
| duplicate-approval:batch-12:3:q0649 | Right | no | C, B |  | A | delete decision carries approvedQid q0649; apply will clear it in batch decisions |
| duplicate-approval:batch-12:49:q0293 | Right | no | C, B |  | A | delete decision carries approvedQid q0293; apply will clear it in batch decisions |
| duplicate-approval:batch-13:43:q0316 |  | no | C, B |  | A | delete decision carries approvedQid q0316; apply will clear it in batch decisions |
| duplicate-approval:batch-14:43:q0237 |  | no | C, B |  | A | delete decision carries approvedQid q0237; apply will clear it in batch decisions |
| duplicate-approval:batch-14:41:q0345 |  | no | C, B |  | A | delete decision carries approvedQid q0345; apply will clear it in batch decisions |
| duplicate-approval:batch-15:2:q0223 | Right | no | C, B |  | A | delete decision carries approvedQid q0223; apply will clear it in batch decisions |
| duplicate-approval:batch-16:4:q0262 | Wrong | no | C, B |  | A | delete decision carries approvedQid q0262; apply will clear it in batch decisions |
| duplicate-approval:batch-17:44:q0062 | Right | no | C, B |  | A | delete decision carries approvedQid q0062; apply will clear it in batch decisions |
| duplicate-approval:batch-17:21:q0347 | Right | no | C, B |  | A | delete decision carries approvedQid q0347; apply will clear it in batch decisions |
| duplicate-approval:batch-18:1:q0316 | Right | no | C, B |  | A | delete decision carries approvedQid q0316; apply will clear it in batch decisions |
| duplicate-approval:batch-18:27:q0070 |  | no | C, B |  | A | delete decision carries approvedQid q0070; apply will clear it in batch decisions |
| duplicate-approval:batch-18:38:q0069 | Right | no | C, B |  | A | delete decision carries approvedQid q0069; apply will clear it in batch decisions |
| missing-production-qid:batch-08:9:q0245 | Right | no | C, B |  | A | corrupted source option labels require manual confirmation for approve: detected C, B; auto-normalized ROW answer accepted: source selected key Right -> exported Right |
| missing-production-qid:batch-08:44:q0176 | B | no | D, B, C, D | D | A | corrupted source option labels require manual confirmation for approve: detected D, B, C, D; answer-key letter mismatch accepted for review: source B / Yield to it vs master C / voluntarily yield to the other side; meaning appears aligned |

## Missing Production QIDs

| batch | qid | answer | source preview | status |
|---|---|---|---|---|
| batch-08 | q0245 | Right | qbank-tools/generated/staging/translations.ru.batch-08.full.preview.json | approved qid is missing from production and a staging/archive preview entry was found |
| batch-08 | q0176 | B | qbank-tools/generated/staging/translations.ru.batch-08.full.preview.json | approved qid is missing from production and a staging/archive preview entry was found |

## Skipped Items

| item | action | reason |
|---|---|---|
| create-new:batch-03:1:screenshots/150.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-05:50:screenshots/Screenshot 2026-04-19 at 18.50.01.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-07:41:screenshots/350.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-07:47:screenshots/Screenshot 2026-04-19 at 18.52.16.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-08:33:screenshots/Screenshot 2026-04-19 at 18.53.08.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-10:20:screenshots/Screenshot 2026-04-19 at 18.54.28 1.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:43:screenshots/Screenshot 2026-04-19 at 18.56.00.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:44:screenshots/Screenshot 2026-04-19 at 18.56.03.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:22:screenshots/Screenshot 2026-04-19 at 18.56.11.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:47:screenshots/Screenshot 2026-04-19 at 18.56.15.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:31:screenshots/Screenshot 2026-04-19 at 18.56.21 1.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:35:screenshots/Screenshot 2026-04-19 at 18.56.24.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-12:50:screenshots/Screenshot 2026-04-19 at 18.56.30.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-13:45:screenshots/Screenshot 2026-04-19 at 18.56.51.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| create-new:batch-17:1:screenshots/Screenshot 2026-04-19 at 18.59.49.png | new | high-risk item requires --allow-risky true for apply |
| create-new:batch-18:18:screenshots/Screenshot 2026-04-19 at 19.00.40.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| unresolved:batch-001:14:Screenshot 2026-04-19 at 18.46.34.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| unresolved:batch-03:7:screenshots/Screenshot 2026-04-19 at 18.48.21.png | approve | high-risk item requires --allow-risky true for apply |
| unresolved:batch-03:27:screenshots/Screenshot 2026-04-19 at 18.48.34.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| unresolved:batch-09:45:screenshots/Screenshot 2026-04-19 at 18.53.34.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| unresolved:batch-12:38:screenshots/Screenshot 2026-04-19 at 18.56.27 1.png | delete | high-risk item requires --allow-risky true for apply |
| unresolved:batch-18:12:screenshots/Screenshot 2026-04-19 at 19.00.35.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| deleted:batch-14:19:screenshots/Screenshot 2026-04-19 at 18.57.40.png | new | create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only |
| deleted:batch-15:14:screenshots/Screenshot 2026-04-19 at 18.58.20.png | delete | high-risk item requires --allow-risky true for apply |
| missing-production-qid:batch-08:9:q0245 | approve | high-risk item requires --allow-risky true for apply |
| missing-production-qid:batch-08:44:q0176 | approve | high-risk item requires --allow-risky true for apply |

## Risky Or Ambiguous Items

| item | action | risk/recommendation |
|---|---|---|
| create-new:batch-001:23:Screenshot 2026-04-19 at 18.46.46.png | new | medium / needs human review |
| create-new:batch-03:1:screenshots/150.png | new | low / keep current decision |
| create-new:batch-05:17:screenshots/Screenshot 2026-04-19 at 18.50.07.png | new | medium / needs human review |
| create-new:batch-06:25:screenshots/Screenshot 2026-04-19 at 18.51.32.png | approve | low / keep current decision |
| create-new:batch-07:41:screenshots/350.png | new | low / keep current decision |
| create-new:batch-07:5:screenshots/Screenshot 2026-04-19 at 18.51.55.png | new | medium / needs human review |
| create-new:batch-07:46:screenshots/Screenshot 2026-04-19 at 18.52.13 1.png | new | low / keep current decision |
| create-new:batch-07:47:screenshots/Screenshot 2026-04-19 at 18.52.16.png | new | low / keep current decision |
| create-new:batch-08:50:screenshots/Screenshot 2026-04-19 at 18.53.08 1.png | new | medium / needs human review |
| create-new:batch-08:33:screenshots/Screenshot 2026-04-19 at 18.53.08.png | new | low / keep current decision |
| create-new:batch-10:20:screenshots/Screenshot 2026-04-19 at 18.54.28 1.png | new | low / keep current decision |
| create-new:batch-12:43:screenshots/Screenshot 2026-04-19 at 18.56.00.png | new | low / keep current decision |
| create-new:batch-12:44:screenshots/Screenshot 2026-04-19 at 18.56.03.png | new | low / keep current decision |
| create-new:batch-12:22:screenshots/Screenshot 2026-04-19 at 18.56.11.png | new | low / keep current decision |
| create-new:batch-12:47:screenshots/Screenshot 2026-04-19 at 18.56.15.png | new | low / keep current decision |
| create-new:batch-12:31:screenshots/Screenshot 2026-04-19 at 18.56.21 1.png | new | low / keep current decision |
| create-new:batch-12:50:screenshots/Screenshot 2026-04-19 at 18.56.30.png | new | low / keep current decision |
| create-new:batch-13:45:screenshots/Screenshot 2026-04-19 at 18.56.51.png | new | low / keep current decision |
| create-new:batch-17:1:screenshots/Screenshot 2026-04-19 at 18.59.49.png | new | high / possible better qid: q0981 |
| create-new:batch-17:30:screenshots/Screenshot 2026-04-19 at 19.00.08 1.png | approve | medium / needs human review |
| create-new:batch-18:18:screenshots/Screenshot 2026-04-19 at 19.00.40.png | new | low / keep current decision |
| unresolved:batch-001:14:Screenshot 2026-04-19 at 18.46.34.png | new | medium / change to keep unresolved |
| unresolved:batch-001:36:Screenshot 2026-04-19 at 18.46.59.png | delete | medium / needs human review |
| unresolved:batch-03:7:screenshots/Screenshot 2026-04-19 at 18.48.21.png | approve | high / possible better qid: q0801 |
| unresolved:batch-05:33:screenshots/Screenshot 2026-04-19 at 18.50.20.png | approve | medium / change to keep unresolved |
| unresolved:batch-05:37:screenshots/Screenshot 2026-04-19 at 18.50.23 1.png | approve | medium / change to keep unresolved |
| unresolved:batch-06:39:screenshots/Screenshot 2026-04-19 at 18.51.11 1.png | approve | medium / needs human review |
| unresolved:batch-08:46:screenshots/Screenshot 2026-04-19 at 18.52.41.png | new | medium / change to keep unresolved |
| unresolved:batch-09:45:screenshots/Screenshot 2026-04-19 at 18.53.34.png | new | medium / change to keep unresolved |
| unresolved:batch-10:45:screenshots/Screenshot 2026-04-19 at 18.54.24 1.png | new | medium / needs human review |
| unresolved:batch-12:19:screenshots/Screenshot 2026-04-19 at 18.56.08.png | delete | medium / needs human review |
| unresolved:batch-12:38:screenshots/Screenshot 2026-04-19 at 18.56.27 1.png | delete | high / possible better qid: q0719 |
| unresolved:batch-18:11:screenshots/Screenshot 2026-04-19 at 19.00.34.png | approve | medium / change to keep unresolved |
| unresolved:batch-18:12:screenshots/Screenshot 2026-04-19 at 19.00.35.png | new | medium / change to keep unresolved |
| unresolved:batch-18:50:screenshots/Screenshot 2026-04-19 at 19.00.53.png | approve | medium / change to keep unresolved |
| deleted:batch-13:21:screenshots/Screenshot 2026-04-19 at 18.56.57.png | approve | medium / needs human review |
| deleted:batch-14:19:screenshots/Screenshot 2026-04-19 at 18.57.40.png | new | medium / needs human review |
| deleted:batch-15:5:screenshots/Screenshot 2026-04-19 at 18.58.12 1.png | approve | medium / needs human review |
| deleted:batch-15:14:screenshots/Screenshot 2026-04-19 at 18.58.20.png | delete | high / possible better qid: q0592 |
| duplicate-approval:batch-001:33:q0670 | approve | low / duplicate is harmless |
| duplicate-approval:batch-002:11:q0666 | approve | low / duplicate is harmless |
| duplicate-approval:batch-002:13:q0053 | approve | medium / needs human review |
| duplicate-approval:batch-002:14:q0635 | delete | medium / needs human review |
| duplicate-approval:batch-04:27:q0323 | delete | low / duplicate is harmless |
| duplicate-approval:batch-04:3:q0981 | delete | low / duplicate is harmless |
| duplicate-approval:batch-05:1:q0383 | delete | low / duplicate is harmless |
| duplicate-approval:batch-07:37:q0064 | delete | medium / needs human review |
| duplicate-approval:batch-07:40:q0442 | delete | low / duplicate is harmless |
| duplicate-approval:batch-08:37:q0162 | delete | low / duplicate is harmless |
| duplicate-approval:batch-09:33:q0525 | delete | low / duplicate is harmless |
| duplicate-approval:batch-09:37:q0210 | delete | medium / needs human review |
| duplicate-approval:batch-09:2:q0187 | delete | medium / needs human review |
| duplicate-approval:batch-10:7:q0600 | approve | medium / needs human review |
| duplicate-approval:batch-10:8:q0285 | delete | low / duplicate is harmless |
| duplicate-approval:batch-10:1:q0420 | delete | low / duplicate is harmless |
| duplicate-approval:batch-10:33:q0446 | delete | low / duplicate is harmless |
| duplicate-approval:batch-10:36:q0577 | delete | medium / needs human review |
| duplicate-approval:batch-11:37:q0921 | delete | medium / needs human review |
| duplicate-approval:batch-11:7:q0647 | delete | low / duplicate is harmless |
| duplicate-approval:batch-11:25:q0208 | delete | low / duplicate is harmless |
| duplicate-approval:batch-11:2:q0471 | delete | low / duplicate is harmless |
| duplicate-approval:batch-11:32:q0726 | delete | medium / needs human review |
| duplicate-approval:batch-11:36:q0234 | delete | low / duplicate is harmless |
| duplicate-approval:batch-12:1:q0367 | delete | low / duplicate is harmless |
| duplicate-approval:batch-12:3:q0649 | delete | low / duplicate is harmless |
| duplicate-approval:batch-12:49:q0293 | delete | low / duplicate is harmless |
| duplicate-approval:batch-13:1:q0522 | delete | medium / needs human review |
| duplicate-approval:batch-13:43:q0316 | delete | low / duplicate is harmless |
| duplicate-approval:batch-13:41:q0517 | delete | medium / needs human review |
| duplicate-approval:batch-14:43:q0237 | delete | medium / needs human review |
| duplicate-approval:batch-14:41:q0345 | delete | medium / needs human review |
| duplicate-approval:batch-15:1:q0981 | delete | low / duplicate is harmless |
| duplicate-approval:batch-15:2:q0223 | delete | low / duplicate is harmless |
| duplicate-approval:batch-15:25:q0802 | delete | low / duplicate is harmless |
| duplicate-approval:batch-16:4:q0262 | delete | low / duplicate is harmless |
| duplicate-approval:batch-16:6:q0162 | delete | low / duplicate is harmless |
| duplicate-approval:batch-16:19:q0474 | delete | low / duplicate is harmless |
| duplicate-approval:batch-17:15:q0720 | delete | low / duplicate is harmless |
| duplicate-approval:batch-17:44:q0062 | delete | low / duplicate is harmless |
| duplicate-approval:batch-17:21:q0347 | delete | low / duplicate is harmless |
| duplicate-approval:batch-18:1:q0316 | delete | low / duplicate is harmless |
| duplicate-approval:batch-18:27:q0070 | delete | low / duplicate is harmless |
| duplicate-approval:batch-18:38:q0069 | delete | low / duplicate is harmless |
| missing-production-qid:batch-08:9:q0245 | approve | high / production merge missing, apply merge only |
| missing-production-qid:batch-08:44:q0176 | approve | high / production merge missing, apply merge only |

## Apply Result

- Anything applied: yes
- Files changed: 20
  - `qbank-tools/generated/staging/ru-batch-001-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-05-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-06-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-07-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-08-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-10-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-11-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-15-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-16-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-17-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-18-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-03-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-12-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-13-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-002-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-04-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-09-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-14-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-discrepancy-create-new-candidates.json`
  - `qbank-tools/generated/staging/ru-discrepancy-missing-production-merge-candidates.json`
- Backups:
  - `qbank-tools/generated/staging/ru-batch-001-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-001-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-05-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-05-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-06-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-06-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-07-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-07-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-08-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-08-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-10-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-10-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-11-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-11-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-15-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-15-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-16-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-16-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-17-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-17-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-18-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-18-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-03-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-03-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-12-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-12-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-13-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-13-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-002-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-002-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-04-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-04-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-09-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-09-workbench-decisions.json`
  - `qbank-tools/generated/staging/ru-batch-14-workbench-decisions.json` -> `qbank-tools/generated/archive/ru/discrepancy-review-apply-2026-05-01T13-07-33-710Z/qbank-tools/generated/staging/ru-batch-14-workbench-decisions.json`
- Note: Production qbank files were not modified. Existing batch workbench decision files were backed up before updates.

