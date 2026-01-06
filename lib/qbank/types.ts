// lib/qbank/types.ts

export type QuestionType = 'ROW' | 'MCQ';
export type CorrectRow = 'Right' | 'Wrong' | 'R' | 'W';

export interface QuestionAsset {
  kind: 'image';
  src: string;
  width?: number;
  height?: number;
}

export interface QuestionOption {
  id: string;            // internal id
  text: string;
  originalKey?: string;  // usually "A" | "B" | "C" | "D" if available
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;        // ✅ uppercase everywhere
  prompt: string;
  options: QuestionOption[];
  correctRow: CorrectRow | null;
  correctOptionId: string | null;
  assets: QuestionAsset[];
  tags: string[];
  autoTags: string[];
  explanation?: string;
}

// Your processed JSON may be:
// 1) { questions: [...] }
// 2) just [...]
export interface RawQuestion {
  id: string;
  number: number;
  type: unknown;
  prompt?: unknown;
  options?: unknown;
  correctRow?: unknown;
  correctOptionId?: unknown;
  answer?: unknown;
  assets?: unknown;
  tags?: unknown;
  explanation?: unknown;
}

export type RawQBank = { questions: RawQuestion[] } | RawQuestion[];
