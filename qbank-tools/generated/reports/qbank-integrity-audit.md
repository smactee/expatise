# QBank Integrity Audit

Generated: 2026-06-07T09:34:15.222Z

## Executive Summary

- Master qids: 1004
- Raw qids: 1008
- Translation languages audited: 6
- Critical blockers: 0
- Warnings: 46
- Duplicate candidates: 4

## Critical Blockers

None.

## Warnings

| type | qid | reason |
| --- | --- | --- |
| raw-only-qid | q0431 | qid exists in questions.raw.json but not questions.json |
| raw-only-qid | q0450 | qid exists in questions.raw.json but not questions.json |
| raw-only-qid | q0518 | qid exists in questions.raw.json but not questions.json |
| raw-only-qid | q0906 | qid exists in questions.raw.json but not questions.json |
| translation-missing-qid | q0974 | en-orig: missing production translation |
| translation-missing-qid | q0975 | en-orig: missing production translation |
| translation-missing-qid | q0976 | en-orig: missing production translation |
| translation-missing-qid | q0977 | en-orig: missing production translation |
| translation-missing-qid | q0978 | en-orig: missing production translation |
| translation-missing-qid | q0979 | en-orig: missing production translation |
| translation-missing-qid | q0980 | en-orig: missing production translation |
| translation-missing-qid | q0981 | en-orig: missing production translation |
| translation-missing-qid | q0982 | en-orig: missing production translation |
| translation-missing-qid | q0983 | en-orig: missing production translation |
| translation-missing-qid | q0984 | en-orig: missing production translation |
| translation-missing-qid | q0985 | en-orig: missing production translation |
| translation-missing-qid | q0986 | en-orig: missing production translation |
| translation-missing-qid | q0987 | en-orig: missing production translation |
| translation-missing-qid | q0988 | en-orig: missing production translation |
| translation-missing-qid | q0989 | en-orig: missing production translation |
| translation-missing-qid | q0991 | en-orig: missing production translation |
| translation-missing-qid | q0992 | en-orig: missing production translation |
| translation-missing-qid | q0993 | en-orig: missing production translation |
| translation-missing-qid | q0994 | en-orig: missing production translation |
| translation-missing-qid | q0995 | en-orig: missing production translation |
| translation-missing-qid | q0996 | en-orig: missing production translation |
| translation-missing-qid | q0998 | en-orig: missing production translation |
| translation-missing-qid | q0999 | en-orig: missing production translation |
| translation-missing-qid | q1001 | en-orig: missing production translation |
| translation-missing-qid | q1002 | en-orig: missing production translation |
| translation-missing-qid | q1003 | en-orig: missing production translation |
| translation-missing-qid | q1004 | en-orig: missing production translation |
| translation-missing-qid | q1005 | en-orig: missing production translation |
| translation-missing-qid | q1006 | en-orig: missing production translation |
| translation-missing-qid | q1007 | en-orig: missing production translation |
| translation-missing-qid | q1008 | en-orig: missing production translation |
| translation-missing-qid | q1009 | en-orig: missing production translation |
| translation-missing-qid | q1011 | en-orig: missing production translation |
| translation-missing-qid | q1012 | en-orig: missing production translation |
| tags-patch-qid-not-in-master | q0431 | tags.patch.json has qid not in questions.json |
| image-question-missing-tags | q1008 | question has image assets but no image color/object tag entry |
| image-question-missing-object-tags | q1008 | question has image assets but no objectTags |
| duplicate-candidate | q0417,q0439 | medium confidence duplicate candidate |
| duplicate-candidate | q0577,q0581 | medium confidence duplicate candidate |
| duplicate-candidate | q0695,q0711 | medium confidence duplicate candidate |
| duplicate-candidate | q0752,q0842 | medium confidence duplicate candidate |

## Language Coverage

| lang | translated | coverage | placeholders | missing | extra | invalidLocaleKeys | rowMcqKeys |
| --- | --- | --- | --- | --- | --- | --- | --- |
| en-orig | 969 | 96.51% | 0 | 35 | 0 | 0 | 0 |
| es | 1004 | 100% | 0 | 0 | 0 | 0 | 0 |
| fr | 1004 | 100% | 0 | 0 | 0 | 0 | 0 |
| ja | 1004 | 100% | 0 | 0 | 0 | 0 | 0 |
| ko | 1004 | 100% | 0 | 0 | 0 | 0 | 0 |
| ru | 1004 | 100% | 0 | 0 | 0 | 0 | 0 |

## Raw/Master Mismatch

- qids in questions.json only: 0
- qids in questions.raw.json only: 4 (q0431, q0450, q0518, q0906)
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
| medium | q0417, q0439 | C | Which of the following vehicle in front in the same lane is not allowed to be overtaken? |
| medium | q0577, q0581 | C | What device does the switch of this symbol control? |
| medium | q0695, q0711 | C | What’s the meaning of this sign? |
| medium | q0752, q0842 | D | What’s the meaning of this sign? |

## Image Asset Issues

- Master qids with images: 499
- Image asset references: 499
- Missing asset references: 0

## Tag Consistency

- tags.patch qids not in master: 1
- image-color-tags qids not in master: 0
- image questions missing image tags: 1
- questions without images but with image tags: 0
- image questions missing objectTags: 1

## Recommended Next Actions

- Review raw-only qids and decide whether each is intentional source retention or should be removed/backfilled into questions.json.
- Review warning tables before the next language run, especially tag/image mismatches.

