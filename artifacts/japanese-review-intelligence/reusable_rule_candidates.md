# Reusable Rule Candidates

Generated at 2026-04-18T07:49:38.662Z.

## Outcome Snapshot

- Reviewed records: 922
- Approved existing qid: 889
- Create new question: 24
- Keep unresolved: 6
- Delete question: 3

## Auto-match Trust Bands

- very-high: 37/43 accepted as the same qid (86%).
- high: 84/108 accepted as the same qid (77.8%).
- medium: 138/208 accepted as the same qid (66.3%).
- low: 163/262 accepted as the same qid (62.2%).
- very-low: 170/290 accepted as the same qid (58.6%).
- none: 0/10 accepted as the same qid (0%).

## Rule Candidates

- Mid-band image-heavy overrides: 294/294 existing-qid overrides still involved image-backed questions. Raise manual review priority for image-backed candidates with scores below 70.
- Sign/marking prompt overrides: 130/294 overrides used sign-like or marking-like prompts. Generic sign prompts should keep a lower auto-trust ceiling unless the candidate gap is strong.
- Answer-key alignment changes: 163 reviewed items changed the local answer key. Preserve explicit reviewer-selected locale keys as a first-class signal for future languages.
- Create-new profile: 16/24 create-new outcomes came from weak or missing top-1 scores. Low-score existing matches should bias toward new-question review instead of forced approval.
- Delete profile: 3 delete outcomes only appeared in the consolidated backlog. Delete is a useful terminal state for incomplete image-only leftovers that should not stay unresolved forever.
- Unresolved profile: 6/6 unresolved outcomes still had images, so missing or insufficient image evidence should remain an explicit fallback class.

## Topic / Subtopic Drift

- traffic-signals -> mcq: 92 item(s).
- driving-operations -> row: 37 item(s).
- road-safety -> mcq: 27 item(s).
- proper-driving -> row: 27 item(s).
- traffic-signals -> road-markings: 27 item(s).
- traffic-signals -> police-hand-signals: 27 item(s).
- road-safety -> row: 25 item(s).
- road-safety -> license: 24 item(s).

## Practical Next Rules

- Keep the score threshold conservative: let very-high and high trust bands pass faster, but force review for mid-band image-backed sign questions.
- Treat locale answer-key confirmations as reusable supervision. They capture the most expensive human correction signal with minimal schema cost.
- When the reviewer creates a new question and a visible local answer key exists, preserve that key as canonical promotion input rather than recomputing it later.
- Keep delete separate from unresolved. Delete is a resolved discard state, while unresolved should remain a limited follow-up bucket.