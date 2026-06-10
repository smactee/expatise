// Answer-key ↔ master consistency check.
//
// THE INVARIANT: every localized MCQ question is matched to a master qid and
// REUSES that master qid's correct answer. The local answer LETTER differs per
// language (option order differs), so correctness is defined by MEANING: the
// local option marked correct (`localeCorrectOptionKey`) must be the option that
// was meaning-aligned to the master's correct option (`correctOptionId`). The
// per-question `optionMeaningMap` records that alignment: each entry maps a
// local `sourceKey` (A/B/C/D) → the `canonicalOptionId` whose English text it
// best matches. So the expected local key is the `sourceKey` whose
// `canonicalOptionId === master.correctOptionId`.
//
// WHY THIS CHECK IS NEEDED: the matcher can pick the right qid yet the staged /
// confirmed local answer key can still point at the wrong option (a reviewer or
// pre-fill confirms the wrong letter; an OCR'd `correctKeyRaw` seeds a bad key).
// Worse, `apply-answer-key-decisions.mjs#applyConfirmedMapping` OVERWRITES the
// confirmed key's meaning-map entry so its `canonicalOptionId` becomes the
// master's correct id — making the existing self-consistency validation pass
// trivially. That hides the error from every downstream gate. The owner has been
// catching these by hand during review. This module catches them mechanically.
//
// ROW / true-false items carry the master `correctRow` (R/W) straight through and
// have no local option letter, so they are not checked here (only flagged if they
// unexpectedly carry a local option key).

export function normalizeKey(value) {
  if (value == null) return null;
  const s = String(value).trim().toUpperCase();
  return s.length ? s : null;
}

// Pull the master qid's correct-answer facts from a questions.json entry.
export function masterCorrectInfo(masterQuestion) {
  const type = String(masterQuestion?.type ?? "").toUpperCase();
  if (type === "ROW" || type === "TRUEFALSE" || type === "TRUE_FALSE") {
    return { type: "ROW", correctRow: masterQuestion?.correctRow ?? null };
  }
  const options = Array.isArray(masterQuestion?.options) ? masterQuestion.options : [];
  const correctOptionId = masterQuestion?.correctOptionId ?? null;
  const correctOption = options.find((o) => o?.id === correctOptionId) ?? null;
  return {
    type: "MCQ",
    correctOptionId,
    correctOptionKey: correctOption?.originalKey ?? null,
    correctOptionText: correctOption?.text ?? null,
    optionIds: options.map((o) => o?.id),
  };
}

// status values:
//   ok                         — local key's option is meaning-aligned to master correct
//   ok-manual-confirmed        — same, but the entry was hand-confirmed (meaning unverifiable from
//                                production data alone; surfaced for optional review)
//   mismatch                   — local key's option is NOT aligned to master correct (a different
//                                local option is); the answer key is wrong by meaning
//   corrupt-map                — duplicate canonicalOptionId in the meaning map (two local options
//                                claim the same master option) — the scar left by a wrong
//                                hand-confirm overwrite; the true key is ambiguous, needs review
//   master-correct-not-mapped  — no meaning-map entry aligns to the master's correct option
//   row-has-key                — ROW/true-false master but the locale entry carries an option letter
//   not-applicable             — ROW/true-false, nothing to check
//   no-data                    — MCQ but missing optionMeaningMap or localeCorrectOptionKey
export function checkMcqAnswerKey({ qid, masterQuestion, localeEntry }) {
  const m = masterCorrectInfo(masterQuestion);
  if (m.type !== "MCQ") {
    const k = normalizeKey(localeEntry?.localeCorrectOptionKey);
    return { qid, status: k ? "row-has-key" : "not-applicable", masterType: "ROW", actualKey: k };
  }

  const meaningMap = Array.isArray(localeEntry?.optionMeaningMap) ? localeEntry.optionMeaningMap : null;
  const actualKey = normalizeKey(localeEntry?.localeCorrectOptionKey);
  const base = {
    qid,
    masterType: "MCQ",
    masterCorrectId: m.correctOptionId,
    masterCorrectKey: m.correctOptionKey,
    masterCorrectText: m.correctOptionText,
    actualKey,
  };
  if (!meaningMap || !actualKey) {
    return { ...base, status: "no-data" };
  }

  // canonicalOptionId -> [sourceKeys]
  const byCanon = new Map();
  for (const e of meaningMap) {
    const cid = e?.canonicalOptionId;
    const sk = normalizeKey(e?.sourceKey);
    if (cid == null || sk == null) continue;
    if (!byCanon.has(cid)) byCanon.set(cid, []);
    byCanon.get(cid).push(sk);
  }
  const duplicateCanonicalIds = [...byCanon.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([cid]) => cid);

  const actualEntry = meaningMap.find((e) => normalizeKey(e?.sourceKey) === actualKey) ?? null;
  const alignmentMethod = actualEntry?.alignmentMethod ?? null;
  const manualConfirmed =
    alignmentMethod === "manual-answer-key-confirmed" || actualEntry?.manualAnswerKeyConfirmed === true;
  const expectedKeys = byCanon.get(m.correctOptionId) ?? [];

  const result = {
    ...base,
    status: "ok",
    expectedKeys,
    localChosenText: actualEntry?.sourceText ?? actualEntry?.sourceTextBody ?? null,
    actualEntryCanonicalId: actualEntry?.canonicalOptionId ?? null,
    alignmentMethod,
    alignmentScore: actualEntry?.alignmentScore ?? null,
    manualConfirmed,
    duplicateCanonicalIds,
  };

  if (duplicateCanonicalIds.length > 0) {
    result.status = "corrupt-map";
    return result;
  }
  if (!byCanon.has(m.correctOptionId)) {
    result.status = "master-correct-not-mapped";
    return result;
  }
  if (!expectedKeys.includes(actualKey)) {
    result.status = "mismatch";
    return result;
  }
  if (manualConfirmed) {
    result.status = "ok-manual-confirmed";
  }
  return result;
}

// ---------------------------------------------------------------------------
// PRECISE gloss-based meaning check (the primary check).
//
// The structural check above can only inspect the (possibly overwritten) meaning
// map, so on production it surfaces *suspects*, not confirmed-wrong answers. The
// precise check instead compares the ENGLISH GLOSS of each local option to the
// master's correct-option English text and asks: is the option marked correct
// actually the best meaning-match to the master's correct answer? This needs the
// per-option gloss (`sourceGlossEn` in staged previews; `optionsGlossEn` in batch
// matched/review-needed/unresolved), which is stripped from production — so the
// precise check runs at BATCH TIME, exactly where the reviewer assigns the key.
//
// textSimilarity is INJECTED (pass pipeline.mjs#textSimilarity) so this stays a
// pure module and uses the same metric as the matcher.

// options: [{ key, glossEn }]. Returns the meaning-derived expected key + ranking.
export function expectedKeyByMeaning({ options, masterCorrectText, textSimilarity }) {
  if (!masterCorrectText || !Array.isArray(options) || options.length === 0) {
    return { expectedKey: null, score: 0, margin: 0, ranked: [] };
  }
  const ranked = options
    .map((o) => ({
      key: normalizeKey(o.key),
      glossEn: o.glossEn ?? null,
      score: o.glossEn ? Number(textSimilarity(o.glossEn, masterCorrectText)) || 0 : 0,
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  return {
    expectedKey: best?.key ?? null,
    score: best?.score ?? 0,
    margin: (best?.score ?? 0) - (second?.score ?? 0),
    ranked,
  };
}

// status:
//   ok               — assigned key IS the best meaning-match to master correct
//   mismatch         — a DIFFERENT local option clearly matches master correct better
//                      (the assigned answer key is wrong by meaning) — HARD FAIL
//   ambiguous        — assigned key is about as good a match as the best (tie); review
//   weak-evidence    — even the best option matches master correct only weakly; can't
//                      trust the gloss alignment, route to manual review
//   no-assigned-key  — no answer key assigned to compare
//   no-data          — missing option glosses or master correct text
//   not-applicable   — ROW/true-false master (no option key)
//   row-has-key      — ROW master but a key was assigned (suspicious)
export function checkAnswerKeyMeaning({
  qid,
  masterQuestion,
  options,
  assignedKey,
  textSimilarity,
  minScore = 0.2,
  minMargin = 0.08,
  highConfidenceAssignedCeiling = 0.1,
  highConfidenceGap = 0.2,
}) {
  const m = masterCorrectInfo(masterQuestion);
  const ak = normalizeKey(assignedKey);
  if (m.type !== "MCQ") {
    return { qid, status: ak ? "row-has-key" : "not-applicable", masterType: "ROW", assignedKey: ak };
  }
  const masterCorrectText = m.correctOptionText;
  if (!masterCorrectText || !Array.isArray(options) || options.length === 0) {
    return { qid, status: "no-data", assignedKey: ak, masterCorrectText };
  }
  const exp = expectedKeyByMeaning({ options, masterCorrectText, textSimilarity });
  const assignedOpt = options.find((o) => normalizeKey(o.key) === ak) ?? null;
  const assignedScore =
    assignedOpt?.glossEn ? Number(textSimilarity(assignedOpt.glossEn, masterCorrectText)) || 0 : 0;
  const base = {
    qid,
    status: "ok",
    masterType: "MCQ",
    assignedKey: ak,
    expectedKey: exp.expectedKey,
    masterCorrectKey: m.correctOptionKey,
    masterCorrectText,
    assignedGloss: assignedOpt?.glossEn ?? null,
    expectedGloss: exp.ranked[0]?.glossEn ?? null,
    assignedScore: round3(assignedScore),
    expectedScore: round3(exp.score),
    margin: round3(exp.margin),
    ranked: exp.ranked.map((r) => ({ key: r.key, score: round3(r.score) })),
  };
  if (!ak) return { ...base, status: "no-assigned-key" };
  if (ak === exp.expectedKey) return base;
  // Assigned key differs from the meaning-best option.
  if (exp.score < minScore) return { ...base, status: "weak-evidence" };
  if (exp.score - assignedScore < minMargin) return { ...base, status: "ambiguous" };
  // Confidence: a HIGH-confidence mismatch is one where the assigned option is
  // essentially UNRELATED to the master correct answer (assignedScore very low)
  // and the expected option beats it by a wide margin. This is robust to the
  // textSimilarity metric being negation/antonym-blind: negation false-positives
  // (e.g. "no left turn" token-matching "left turn") have a HIGH assignedScore,
  // so they never reach high confidence. Only high-confidence mismatches gate the
  // apply step; the rest are surfaced as warnings for human review.
  const confidence =
    assignedScore <= (highConfidenceAssignedCeiling) && exp.score - assignedScore >= highConfidenceGap
      ? "high"
      : "medium";
  return { ...base, status: "mismatch", confidence };
}

function round3(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 1000) / 1000 : n;
}

export const MEANING_HARD_FAIL = new Set(["mismatch", "row-has-key"]);
export const MEANING_REVIEW = new Set(["ambiguous", "weak-evidence", "no-assigned-key"]);

export const HARD_FAIL_STATUSES = new Set(["mismatch", "corrupt-map", "master-correct-not-mapped", "row-has-key"]);
export const REVIEW_STATUSES = new Set(["ok-manual-confirmed", "no-data"]);

// Run the check over a translations-style { questions: { qid: entry } } document
// against a master qid map. Returns { results, summary }.
export function checkTranslationsAgainstMaster({ translations, masterByQid, lang }) {
  const questions =
    translations?.questions && typeof translations.questions === "object" ? translations.questions : translations ?? {};
  const results = [];
  for (const [qid, entry] of Object.entries(questions)) {
    if (!entry || typeof entry !== "object") continue;
    const masterQuestion = masterByQid.get(qid);
    if (!masterQuestion) {
      results.push({ qid, status: "no-master", lang });
      continue;
    }
    // Only check MCQ items that actually localized options (skip pure ROW / text).
    const isMcqLike = masterCorrectInfo(masterQuestion).type === "MCQ";
    if (!isMcqLike) continue;
    results.push({ ...checkMcqAnswerKey({ qid, masterQuestion, localeEntry: entry }), lang });
  }
  const summary = {};
  for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;
  return { results, summary };
}
