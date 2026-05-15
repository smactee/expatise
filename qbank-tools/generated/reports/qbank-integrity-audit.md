# QBank Integrity Audit

Generated: 2026-05-15T07:41:33.372Z

## Executive Summary

- Master qids: 1006
- Raw qids: 1008
- Translation languages audited: 4
- Critical blockers: 0
- Warnings: 19
- Duplicate candidates: 8

## Critical Blockers

None.

## Warnings

| type | qid | reason |
| --- | --- | --- |
| raw-only-qid | q0518 | qid exists in questions.raw.json but not questions.json |
| raw-only-qid | q0906 | qid exists in questions.raw.json but not questions.json |
| translation-extra-qid | q0906 | ja: translation qid is not in questions.json |
| translation-extra-qid | q0906 | ko: translation qid is not in questions.json |
| translation-extra-qid | q0906 | ru: translation qid is not in questions.json |
| tags-patch-qid-not-in-master | q0518 | tags.patch.json has qid not in questions.json |
| tags-patch-qid-not-in-master | q0906 | tags.patch.json has qid not in questions.json |
| image-question-missing-tags | q1008 | question has image assets but no image color/object tag entry |
| image-tags-without-image | q0001 | question has image tags but no master image asset |
| image-tags-without-image | q0003 | question has image tags but no master image asset |
| image-question-missing-object-tags | q1008 | question has image assets but no objectTags |
| duplicate-candidate | q0369,q0431 | medium confidence duplicate candidate |
| duplicate-candidate | q0417,q0439 | medium confidence duplicate candidate |
| duplicate-candidate | q0577,q0581 | medium confidence duplicate candidate |
| duplicate-candidate | q0583,q0620 | medium confidence duplicate candidate |
| duplicate-candidate | q0677,q0727 | medium confidence duplicate candidate |
| duplicate-candidate | q0695,q0711 | medium confidence duplicate candidate |
| duplicate-candidate | q0747,q0792 | medium confidence duplicate candidate |
| duplicate-candidate | q0752,q0842 | medium confidence duplicate candidate |

## Language Coverage

| lang | translated | coverage | placeholders | missing | extra | invalidLocaleKeys | rowMcqKeys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fr | 1006 | 100% | 0 | 0 | 0 | 0 | 0 |
| ja | 1007 | 100.1% | 0 | 0 | 1 | 0 | 0 |
| ko | 1007 | 100.1% | 0 | 0 | 1 | 0 | 0 |
| ru | 1007 | 100.1% | 0 | 0 | 1 | 0 | 0 |

## Raw/Master Mismatch

- qids in questions.json only: 0
- qids in questions.raw.json only: 2 (q0518, q0906)
- type mismatches: 0
- option count mismatches: 0

## Invalid Answer Tables

### Master ROW/MCQ
None.

### Translation Answer Issues
None.

## Duplicate Candidate Table

| confidence | qids | answerLogic | prompt |
| --- | --- | --- | --- |
| medium | q0369, q0431 | A | The police can detain the vehicle if one drives a vehicle without a ______. |
| medium | q0417, q0439 | C | Which of the following vehicle in front in the same lane is not allowed to be overtaken? |
| medium | q0577, q0581 | C | What device does the switch of this symbol control? |
| medium | q0583, q0620 | B | It lights to indicate that ______. |
| medium | q0677, q0727 | C | This set of the hand signals of the traffic police indicates that the vehicles should ____. |
| medium | q0695, q0711 | C | What’s the meaning of this sign? |
| medium | q0747, q0792 | C | What’s the meaning of this sign? |
| medium | q0752, q0842 | D | What’s the meaning of this sign? |

## Image Asset Issues

- Master qids with images: 499
- Image asset references: 499
- Missing asset references: 0

## Tag Consistency

- tags.patch qids not in master: 2
- image-color-tags qids not in master: 0
- image questions missing image tags: 1
- questions without images but with image tags: 2
- image questions missing objectTags: 1

## Recommended Next Actions

- Review raw-only qids and decide whether each is intentional source retention or should be removed/backfilled into questions.json.
- Review warning tables before the next language run, especially tag/image mismatches.

