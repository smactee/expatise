// lib/test-engine/buildReviewItems.ts

import type { Question } from "@/lib/qbank/types";
import type { AnswerRecord } from "@/lib/test-engine/attemptStorage";
import type { Locale } from "@/messages";
import { getRowDisplayLabel } from "@/lib/qbank/rowDisplay";

export type ReviewItem = {
  qid: string;
  testNo: number;
  prompt: string;
  imageSrc?: string;
  options: { key: string; text: string; tone: "neutral" | "correct" | "wrong" }[];
  explanation?: string;
};

function normalizeRowChoice(v: string | null | undefined): "R" | "W" | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "r" || t === "right") return "R";
  if (t === "w" || t === "wrong") return "W";
  return null;
}

/**
 * Pure transformation: build the WRONG-only review items from the picked
 * questions + the attempt's answers. No I/O, no side effects, no state.
 *
 * Returns the same structure the results effect used to produce inline,
 * already sorted by testNo ascending.
 */
export function buildReviewItems(
  picked: Question[],
  answersByQid: Record<string, AnswerRecord>,
  locale: Locale,
): ReviewItem[] {
  const items: ReviewItem[] = [];

  for (let i = 0; i < picked.length; i++) {
    const q = picked[i];
    const testNo = i + 1;

    const chosenKey = answersByQid[q.id]?.choice ?? null;

    const assets = q.assets;
    const imageAsset = Array.isArray(assets)
      ? assets.find((x) => x?.kind === "image" && typeof x?.src === "string")
      : null;
    const imageSrc = imageAsset?.src as string | undefined;

    if (q.type === "ROW") {
      const correctRow = normalizeRowChoice(q.correctRow ?? null);
      const chosenRow = normalizeRowChoice(chosenKey);
      const isCorrect = !!(chosenRow && correctRow && chosenRow === correctRow);
      if (isCorrect) continue;

      items.push({
        qid: q.id,
        testNo,
        prompt: q.prompt,
        imageSrc,
        options: [
          {
            key: "R",
            text: getRowDisplayLabel("R", locale),
            tone: correctRow === "R" ? "correct" : chosenRow === "R" ? "wrong" : "neutral",
          },
          {
            key: "W",
            text: getRowDisplayLabel("W", locale),
            tone: correctRow === "W" ? "correct" : chosenRow === "W" ? "wrong" : "neutral",
          },
        ],
        explanation: q.explanation ?? q.sourceExplanation,
      });
      continue;
    }

    const correctOptionId = q.correctOptionId ?? undefined;
    const opts = Array.isArray(q.options) ? q.options : [];

    const chosenOpt =
      chosenKey
        ? opts.find((opt, idx) => {
            const k = opt?.originalKey ?? String.fromCharCode(65 + idx);
            return k === chosenKey;
          })
        : null;

    const isCorrect = !!(chosenOpt && correctOptionId && chosenOpt.id === correctOptionId);
    if (isCorrect) continue;

    const correctIndex = opts.findIndex((opt) => opt?.id === correctOptionId);
    const correctKey =
      correctIndex >= 0
        ? (opts[correctIndex].originalKey ?? String.fromCharCode(65 + correctIndex))
        : null;

    items.push({
      qid: q.id,
      testNo,
      prompt: q.prompt,
      imageSrc,
      options: opts.map((opt, idx) => {
        const key = opt?.originalKey ?? String.fromCharCode(65 + idx);
        // Isolate the Latin enumeration key ("A.") as LTR so its trailing
        // period doesn't reorder to ".A" in RTL/Arabic. The key+text render
        // as one string here, so use Unicode isolates (LRI…PDI) rather than
        // a styled span — invisible, and covers both the list and swipe views.
        const text = `⁦${key}.⁩ ${opt?.text ?? ""}`;
        let tone: "neutral" | "correct" | "wrong" = "neutral";
        if (correctKey && key === correctKey) tone = "correct";
        if (chosenKey && key === chosenKey && key !== correctKey) tone = "wrong";
        return { key, text, tone };
      }),
      explanation: q.explanation ?? q.sourceExplanation,
    });
  }

  items.sort((x, y) => x.testNo - y.testNo);
  return items;
}
