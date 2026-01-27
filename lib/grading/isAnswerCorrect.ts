// lib/grading/isAnswerCorrect.ts
import type { Question } from '@/lib/qbank/types';

function normalizeRowChoice(v: string | null | undefined): 'R' | 'W' | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === 'r' || t === 'right') return 'R';
  if (t === 'w' || t === 'wrong') return 'W';
  return null;
}

export function isAnswerCorrect(question: Question, chosenKey: string | null | undefined): boolean {
  if (!chosenKey) return false;

  // ROW
  if (question.type === 'ROW') {
    const chosen = normalizeRowChoice(chosenKey);
    const expected = normalizeRowChoice(question.correctRow ?? null);
    return !!(chosen && expected && chosen === expected);
  }

  // MCQ
  if (question.type === 'MCQ') {
    const expected = question.correctOptionId;
    if (!expected || !question.options?.length) return false;

    const idx = question.options.findIndex((opt, i) => {
      const letter = String.fromCharCode(65 + i); // A,B,C...
      const key = opt.originalKey ?? letter;
      return chosenKey === key || chosenKey === letter || chosenKey === opt.id;
    });

    if (idx < 0) return false;

    const opt = question.options[idx];
    const letter = String.fromCharCode(65 + idx);
    const key = opt.originalKey ?? letter;

    // expected might be option id OR key/letter depending on dataset format
    return expected === opt.id || expected === key || expected === letter;
  }

  return false;
}
