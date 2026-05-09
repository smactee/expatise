# QBank Integrity Audit

Generated: 2026-05-08T13:47:49.458Z

## Executive Summary

- Master qids: 984
- Raw qids: 985
- Translation languages audited: 3
- Critical blockers: 0
- Warnings: 26
- Duplicate candidates: 22

## Critical Blockers

None.

## Warnings

| type | qid | reason |
| --- | --- | --- |
| raw-only-qid | q0518 | qid exists in questions.raw.json but not questions.json |
| tags-patch-qid-not-in-master | q0518 | tags.patch.json has qid not in questions.json |
| image-tags-without-image | q0001 | question has image tags but no master image asset |
| image-tags-without-image | q0003 | question has image tags but no master image asset |
| duplicate-candidate | q0369,q0431 | medium confidence duplicate candidate |
| duplicate-candidate | q0417,q0439 | medium confidence duplicate candidate |
| duplicate-candidate | q0577,q0581 | medium confidence duplicate candidate |
| duplicate-candidate | q0583,q0620 | medium confidence duplicate candidate |
| duplicate-candidate | q0586,q0613 | medium confidence duplicate candidate |
| duplicate-candidate | q0599,q0609 | medium confidence duplicate candidate |
| duplicate-candidate | q0658,q0712 | medium confidence duplicate candidate |
| duplicate-candidate | q0660,q0847 | medium confidence duplicate candidate |
| duplicate-candidate | q0668,q0748 | medium confidence duplicate candidate |
| duplicate-candidate | q0677,q0727,q0806 | medium confidence duplicate candidate |
| duplicate-candidate | q0679,q0787 | medium confidence duplicate candidate |
| duplicate-candidate | q0683,q0769 | medium confidence duplicate candidate |
| duplicate-candidate | q0685,q0730,q0756 | medium confidence duplicate candidate |
| duplicate-candidate | q0686,q0793 | medium confidence duplicate candidate |
| duplicate-candidate | q0694,q0782 | medium confidence duplicate candidate |
| duplicate-candidate | q0711,q0818 | medium confidence duplicate candidate |
| duplicate-candidate | q0741,q0798,q0800,q0815,q0854,q0892 | medium confidence duplicate candidate |
| duplicate-candidate | q0747,q0792 | medium confidence duplicate candidate |
| duplicate-candidate | q0767,q0788 | medium confidence duplicate candidate |
| duplicate-candidate | q0776,q0848 | medium confidence duplicate candidate |
| duplicate-candidate | q0838,q0845 | medium confidence duplicate candidate |
| duplicate-candidate | q0880,q0896 | medium confidence duplicate candidate |

## Language Coverage

| lang | translated | coverage | placeholders | missing | extra | invalidLocaleKeys | rowMcqKeys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ja | 984 | 100% | 0 | 0 | 0 | 0 | 0 |
| ko | 984 | 100% | 0 | 0 | 0 | 0 | 0 |
| ru | 984 | 100% | 0 | 0 | 0 | 0 | 0 |

## Raw/Master Mismatch

- qids in questions.json only: 0
- qids in questions.raw.json only: 1 (q0518)
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
| medium | q0586, q0613 | A | It lights to indicate that ______. |
| medium | q0599, q0609 | A | What is this instrument? |
| medium | q0658, q0712 | A | What’s the meaning of this sign? |
| medium | q0660, q0847 | D | What’s the meaning of this sign? |
| medium | q0668, q0748 | D | What’s the meaning of this sign? |
| medium | q0677, q0727, q0806 | C | This set of the hand signals of the traffic police indicates that the vehicles should ____ . |
| medium | q0679, q0787 | A | What’s the meaning of this sign? |
| medium | q0683, q0769 | B | What’s the meaning of this sign? |
| medium | q0685, q0730, q0756 | A | What’s the meaning of this sign? |
| medium | q0686, q0793 | D | What’s the meaning of this sign? |
| medium | q0694, q0782 | A | What’s the meaning of this sign? |
| medium | q0711, q0818 | C | What’s the meaning of this sign? |
| medium | q0741, q0798, q0800, q0815, q0854, q0892 | A | What’s the meaning of this sign? |
| medium | q0747, q0792 | C | What’s the meaning of this sign? |
| medium | q0767, q0788 | B | What’s the meaning of this sign? |
| medium | q0776, q0848 | C | What’s the meaning of this guide arrow? |
| medium | q0838, q0845 | D | What’s the meaning of this sign? |
| medium | q0880, q0896 | D | This set of the hand signals of the traffic police indicates that the vehicles should ___ . |

## Image Asset Issues

- Master qids with images: 498
- Image asset references: 498
- Missing asset references: 0

## Tag Consistency

- tags.patch qids not in master: 1
- image-color-tags qids not in master: 0
- image questions missing image tags: 0
- questions without images but with image tags: 2
- image questions missing objectTags: 0

## Recommended Next Actions

- Review raw-only qids and decide whether each is intentional source retention or should be removed/backfilled into questions.json.
- Review warning tables before the next language run, especially tag/image mismatches.

