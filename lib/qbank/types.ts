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

export interface QuestionTranslationOptionAlignmentEntry {
  sourceIndex?: number;
  sourceKey?: string | null;
  sourceText?: string;
  sourceTextBody?: string;
  sourceGlossEn?: string;
  canonicalOptionId?: string;
  canonicalOptionKey?: string | null;
  canonicalOptionText?: string;
  alignmentScore?: number;
  alignmentMethod?: string;
  manualAnswerKeyConfirmed?: boolean;
  confirmedAsCorrectKey?: boolean;
}

export type QuestionTranslationSourceMode = 'pdf-adapted' | 'pdf-template-guided' | 'direct';
export type QuestionTranslationConfidence = 'high' | 'medium' | 'low';
export type QuestionTranslationReviewStatus = 'ready' | 'needs-review';

export interface QuestionTranslationEntry {
  prompt?: string;
  explanation?: string;
  options?: Record<string, string>;
  localeOptionOrder?: QuestionTranslationOptionAlignmentEntry[];
  optionMeaningMap?: QuestionTranslationOptionAlignmentEntry[];
  localeCorrectOptionKey?: string | null;
  sourceMode?: QuestionTranslationSourceMode;
  confidence?: QuestionTranslationConfidence;
  reviewStatus?: QuestionTranslationReviewStatus;
  flags?: string[];
  notes?: string[];
}

export interface QuestionTranslationFileMeta {
  locale: string;
  translatedQuestions?: number;
  pdfAdaptedCount?: number;
  pdfTemplateGuidedCount?: number;
  directCount?: number;
  ambiguousCount?: number;
  imageVerificationCount?: number;
  glossaryPath?: string;
}

export interface QuestionTranslationFile {
  meta?: QuestionTranslationFileMeta;
  questions: Record<string, QuestionTranslationEntry>;
}

export interface Question {
  id: string;
  number: number;
  type: QuestionType;        // ✅ uppercase everywhere
  prompt: string;
  sourcePrompt: string;
  options: QuestionOption[];
  sourceOptions: QuestionOption[];
  correctRow: CorrectRow | null;
  correctOptionId: string | null;
  assets: QuestionAsset[];
  tags: string[];
  autoTags: string[];
  explanation?: string;
  sourceExplanation?: string;
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
