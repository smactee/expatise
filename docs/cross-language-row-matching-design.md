# Design: Cross-Other-Language Support Signal for ROW Matching

Status: **implemented, validated, and REVERTED — did not help.** Written 2026-05-30.

## Validation outcome (read this first)

The signal was implemented exactly as specced (three touch-points, base score untouched)
and validated leave-one-language-out on 30 French ROW items (French's own translation
suppressed to simulate a fresh language). Result: **net-zero — 18/30 baseline, 18/30 with
signal, 0 fixed, 0 broke.** It was reverted (the code added complexity to the core matcher
for no measured benefit).

Why it didn't work (probe evidence):
- The signal *was* available and computed, but its scores were uniformly **low (~0.15–0.35)
  for correct and wrong candidates alike**, favoring the correct qid in only **5/14** wrong
  cases — essentially noise, not discrimination.
- **Root cause: redundancy.** The other languages' stored English glosses are derived from
  the *same* master English, so "agreement with other languages' glosses" ≈ "agreement with
  the master English gloss," which the base score already measures. They are not independent
  observations, so consensus across them adds little.
- The per-language `glossEn` is also **templated** ("traffic rule statement: <topic>"),
  further flattening discrimination.
- Separately, ~20% of ROW items had the correct qid **not even in the top-8 candidates** — a
  recall problem that reranking cannot fix.

**The real levers for ROW accuracy** (where effort should go instead):
1. **Recall** — surface the correct qid into the candidate shortlist more often for ROW.
   See the recall investigation below for the precise breakdown.
2. **Independent, richer per-language glosses** — cross-language would only pay off if other
   languages' glosses captured genuinely *different* phrasings/synonyms rather than templated
   paraphrases of the master. That's a data-generation improvement, not a scoring tweak.
3. **The decision-memory → correction-rules loop** already raises review priority for
   chronically-mismatched ROW qids; that remains the most reliable ROW accuracy lever today.

## Recall investigation (2026-05-30)

Measured on 60 ROW items, fresh-French (source translation suppressed), grading whether the
recorded `approvedQid` appears among the scored candidates:

- **ROW recall@8 ≈ 87%** (52/60); top-1 ≈ 55%.
- **Image-parity is NOT a recall problem: 0/8** losses came from `hasImage` mismatch
  (extraction set image presence correctly). Earlier hypothesis refuted.
- **ROW master data is healthy** (not the cause): 0/426 placeholder glosses, avg ~11 useful
  `masterKeywords` (MCQ avg ~13); only ~3 sparse outliers total.

The 8 recall-loss items break down as:

1. **Paraphrase gap (~3, deeply buried, e.g. rank 46–196)** — the localized→English gloss
   phrases the fact very differently from the master English, so text overlap is low. This is
   the *same* root problem as top-1 accuracy and needs **semantic/embedding similarity**, not
   a filter tweak. `q0089` ("high heels") buried at 196 is an isolated sparse-keyword outlier
   (`masterKeywords: ["heels","right","woman"]`) compounded by a normalization gap
   ("heels" vs "high-heeled shoes").
2. **Crowded semantic family (~3, near-miss rank 8–12)** — dashboard-indicator / ABS /
   accident-penalty families. Recoverable cheaply by **surfacing more ROW candidates** in the
   workbench (e.g. top-12 instead of top-8).
3. **Structural type-drop (2)** — `q0189`, `q0948`: the source was extracted as an MCQ-style
   prompt ("How should you pass…", "What is the meaning of this sign?") but the answer is a
   ROW qid, so the `question-type` severe signal in `evaluateStructuralCompatibility`
   pre-filters the correct candidate before scoring. Fixable by **softening the type-severe
   filter for ambiguous-type sources** (low risk, recall-specific).

Conclusion: recall loss is **mostly ranking** (paraphrase/family), not filtering. Two
safe, recall-specific wins exist (surface more ROW candidates; soften the type pre-filter for
the 2 type-drop cases); the rest is the hard semantic-similarity problem already noted.

The original proposal follows, preserved for the record.

---

Original proposal (2026-05-30):

## Problem

ROW (right/wrong, true/false) questions have **no options**, so the matcher's
strongest MCQ signal — the option fingerprint — is unavailable. ROW matching leans on
statement text (English gloss + keywords) alone, which makes near-duplicate ROW
statements (e.g. `q0004` "when a vehicle changes lane…" vs `q0104` "changes to the
**right** lane…") the hardest class to separate. This is the known ROW weakness.

The existing matcher already has strong ROW machinery:

- `rowDistinctiveKeywordScore` + `distinctiveKeywordMargin` (top-1 vs top-2 distinctive
  keyword separation) — [pipeline.mjs:7192](../qbank-tools/lib/pipeline.mjs).
- `top2SemanticNearDuplicate` → `contrastUnclear` → review routing, plus polarity,
  negation, action-conflict, context-mismatch guards — [pipeline.mjs:7237](../qbank-tools/lib/pipeline.mjs).

So specificity scoring and the near-duplicate guard already exist; they should **not** be
reimplemented.

## The actual gap

The policy intent ("look at the other linked languages in their own language and their
gross-translated English to gather synonyms") is **not** implemented. The existing
`multilingualSupportScore` / `localizedAgreement` (`fullLocalizedAgreement`,
[pipeline.mjs:8583](../qbank-tools/lib/pipeline.mjs)) is built only from `localized*`
signals that compare the incoming item against the candidate qid's stored translation **in
the same source language** (`localizedCandidateSignalsForMatch(question, sourceLang)`,
[pipeline.mjs:5835](../qbank-tools/lib/pipeline.mjs)).

Consequences:
1. For a **brand-new language**, the candidate has no stored translation in that language,
   so this signal is neutral — the new language gets **no help** from the four languages
   already localized.
2. The signal is **absent from the discriminative layer** (`uniqueSupportCount`,
   [pipeline.mjs:7224](../qbank-tools/lib/pipeline.mjs)), so even when present it never
   helps break a ROW near-duplicate tie.

The feature store already stores everything needed: each qid has
`translations.{fr,ja,ko,ru}.{glossEn, keywords, conceptKeywords, promptFamily}`
(`qbank-tools/history/qid-feature-store.json`).

## Proposed signal: `crossLanguageSupportScore`

For a candidate qid and an incoming item in `sourceLang`:

1. Collect every language `L` in `candidate.translations` where `L !== sourceLang` **and**
   `L` has a usable `glossEn`/`keywords`. (Excluding `sourceLang` is what prevents the
   same-language leak; it also means a new language draws on all already-done languages.)
2. For each such `L`, score agreement between the **incoming item's English gloss +
   keywords** and `candidate.translations[L].glossEn + keywords`, reusing the existing
   gloss/keyword comparison helpers (`promptSimilarityForMatch`,
   `scoreFeatureKeywordSignal`) so scoring stays consistent with the rest of the pipeline.
3. Aggregate across the other languages with a **consensus bonus**: the score is the mean
   of the per-language agreements, lifted when ≥2 other languages independently agree
   (multiple independent translations converging on the same qid is strong evidence — the
   "gather synonyms from linked languages" intent). Concretely:
   `score = mean(perLang) ; if (countAgreeing(perLang >= 0.6) >= 2) score = min(1, score + 0.1)`.
4. `available` only when at least one other language has a gloss; otherwise the signal is
   omitted (neutral), so the **very first** language ever localized is unaffected.

This is a *supporting* signal, never an anchor — consistent with the policy's "English is
the bridge; other languages are supporting evidence."

## Where it plugs in (three surgical touch-points)

1. **Base scorer** (next to `fullLocalizedAgreement`, ~[pipeline.mjs:8583](../qbank-tools/lib/pipeline.mjs)):
   compute `crossLanguageSupportScore` and add it to the candidate `breakdown`. Do **not**
   fold it into `signalComposite`/`baseTotal` initially — keep base scoring unchanged to
   limit blast radius; introduce it only in rerank + discriminative (below). This makes the
   change additive and easy to A/B.

2. **Rerank** (`applyWeightedReranking`, [pipeline.mjs:6589](../qbank-tools/lib/pipeline.mjs)):
   add, for non-MCQ entries only, a modest adjustment
   `((breakdown.crossLanguageSupportScore ?? 0.5) - 0.5) * W` with a conservative
   `W ≈ 6`, and gate it to `available` so it never nudges when there's no cross-language
   evidence. ROW leans on it more because ROW lacks option evidence.

3. **Discriminative layer** (`computeDiscriminativeSeparation`, ~[pipeline.mjs:7224](../qbank-tools/lib/pipeline.mjs)):
   - add `crossLanguageMargin = top.crossLanguageSupportScore - runner.crossLanguageSupportScore`;
   - include `crossLanguageMargin >= 0.12` as a member of `uniqueSupportCount`;
   - add a **rescue clause** to `top2SemanticNearDuplicate`: a near-duplicate is *resolved*
     (not forced to review) when `crossLanguageMargin >= 0.18` **and**
     `top.crossLanguageSupportScore >= 0.6` — i.e. other languages decisively back the top
     candidate. This is the tie-breaker that turns "route to review" into a confident
     auto-match for the genuinely-correct near-duplicate.

## Validation: leave-one-language-out (LOLO)

French cannot validate this naively: re-matching French leaks via the same-language
`fullLocalizedAgreement` (the candidate's stored French text is the very text being
matched). To measure honestly, simulate French as a *fresh* language:

1. Build a ROW-only French eval set from `imports`/recorded decisions (filter to
   `type==="row"` master qids; the recorded `approvedQid` is ground truth).
2. Run matching for these items with **French's own stored translation suppressed** (a
   validation flag, e.g. `--exclude-source-translation`, or a harness that deletes
   `question.translations.fr` before scoring). This removes the same-language leak; the new
   cross-language signal then draws only on en+ru+ja+ko, exactly as it would for a real new
   language.
3. Compare two runs on this held-out set:
   - **baseline**: current matcher, French suppressed.
   - **with-signal**: + `crossLanguageSupportScore`.
4. Metrics: ROW top-1 qid accuracy vs recorded `approvedQid`; review-routing rate;
   top-1/top-2 margin on the known near-duplicate pairs.
5. **Keep only if** ROW qid accuracy improves (or review rate drops with accuracy held),
   **and** there is no regression on a control — re-run a second language's ROW sample
   (e.g. Korean, suppressed) the same way and confirm accuracy doesn't drop.

## Risks & safeguards

- **New-language safety**: signal is `available`-gated; with no other-language glosses it is
  omitted → zero effect. The first-ever language is unaffected.
- **No double-counting**: `crossLanguageSupportScore` is kept distinct from the
  same-language `fullLocalizedAgreement`; the rescue clause requires a *margin*, not just a
  high absolute score, so two equally-supported candidates still route to review.
- **Conservative weights** (`W≈6`, margins ≥0.12/0.18) and base scoring left untouched, so
  the change is easy to bound and revert.
- **Discard criterion** is explicit (LOLO regression check) per the agreed plan.

## Out of scope

- Reimplementing specificity (`rowDistinctiveKeywordScore`) or the near-duplicate guard —
  both already exist and are well-tuned.
- Answer-key (Right/Wrong) polarity — handled separately by existing polarity/negation
  checks and the answer-key correction-rule follow-up.
