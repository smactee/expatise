# Topic-Narrowing Lever — Validation & Decision

Status: **implemented, validated, default OFF.** Written 2026-05-31.

## What was built

Per the user's idea ("use predicted topic to narrow candidates during ranking"):

1. **`scripts/derive-qid-topics.ts`** — runs the app's `deriveTopicSubtags`
   classifier on all 1006 master qids and writes `qbank-tools/history/qid-topics.json`
   (single source of truth). 997/1006 qids cleanly classified.
2. **Matcher integration** in `qbank-tools/lib/pipeline.mjs`:
   - `loadQidTopicsMap()` + `candidateTopicFor(question)` use the classified topic
     when the toggle is on (otherwise fall back to existing tag-derived topic).
   - `inferProvisionalTopicMetadata` respects an explicit `item.provisionalTopic`
     from the intake (so an agent reading the screenshot can write its own
     classification directly).
   - `provisionalTopicAgreement` weight raised 0.12 → 0.20 when toggle on.
   - Topic-disagreement severe-signal threshold tightened 0.82 → 0.65 when toggle on.
   - Toggle: `setTopicNarrowingEnabled(bool)` / `isTopicNarrowingEnabled()`.
3. **`scripts/validate-topic-narrowing.mjs`** — leave-one-language-out harness
   that injects classifier-derived `provisionalTopic` into each French intake
   item (proxy for what an agent would write) and runs the matcher twice.

## Validation outcome (read this first)

60 French items, fresh-language (French's own translation suppressed),
classifier-derived source topics injected on 52/60 items:

| Subset (n) | Top-1 baseline | Top-1 with-signal | Δ top-1 | Δ recall@8 |
|---|---|---|---|---|
| ALL (60) | 56.7% | 56.7% | 0 (fixed 2, broke 2) | −1 |
| ROW (45) | 60.0% | 62.2% | +1 (within noise) | 0 |
| MCQ (15) | 46.7% | 40.0% | −1 | −1 |

**Net: no measurable lift; small regression on MCQ.** Per the rule from the
cross-language experiment ("validated no-op or regression gets reverted"), the
toggle defaults to **OFF**.

## Why it didn't move the needle

- The source-side topic in this test came from `deriveTopicSubtags` applied to
  the **translated English intake text**, not the screenshot. That classifier is
  designed for the master English text and may be noisier on translated phrasing.
- The 12 subtopics are coarse (avg ~80 qids per subtopic). Even when correct, a
  topic narrows the pool from 1006 → ~80, not enough to break a top-1 near-tie
  the matcher already had at rank 1–3.
- MCQ accuracy depends heavily on the option-fingerprint signal; adding more
  topic weight dilutes that. The single MCQ regression case was a confused
  option-set situation, not a topic-fixable miss.

## Why the wiring is kept (not deleted)

The infrastructure is correct and tested; only the **default** is off. It can
be opted in via `setTopicNarrowingEnabled(true)` or by setting `topicNarrowingEnabled = true` in `pipeline.mjs`. There are two future paths where it could pay off:

- **Agent-derived source topic from the screenshot.** An agent looking at the
  actual image (not the OCR'd translated text) can classify topic with much
  higher confidence — especially on image-dependent questions where the topic
  is obvious visually ("traffic-signals:road-signs" the moment you see a sign).
  When the source-topic comes in confidently and correctly, the wiring already
  in place uses it without further changes.
- **Finer-grained subtopics** would shrink the candidate pool further and make
  narrowing more useful. Today's 12 subtopics are coarse; that's a data
  question, not a matcher question.

## What did NOT regress

- The qid-topics.json artifact is a useful resource regardless of the matcher
  toggle (any downstream report or agent can read it for a confident per-qid
  topic). `npm run derive-qid-topics` is now part of `refresh-correction-rules`.
- The agent-driven workflow already documented in the skill (the agent reads
  the screenshot, writes intake fields including visualObjectTags etc.) can
  start writing `provisionalTopic` and `provisionalSubtopics` too — at no risk,
  since the matcher only consults them when the toggle is on.
