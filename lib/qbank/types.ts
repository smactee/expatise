export type RawQuestionType = 'tf' | 'mcq';

export type RawOption = { key: string; text: string };

export type RawAsset = {
  path: string;
  page?: number;
  width?: number;
  height?: number;
  ext?: string;
};

export type RawQuestion = {
  id: string;
  number: number;
  type: RawQuestionType;
  prompt: string;
  options: RawOption[];
  answer: string;
  tags?: string[];
  assets?: RawAsset[];
  source?: unknown;
};

// Your JSON might be either an array OR { questions: [...] }
export type RawQBank = RawQuestion[] | { questions: RawQuestion[]; meta?: unknown };

export type QType = 'ROW' | 'MCQ';

export type QAsset = {
  kind: 'image';
  src: string;
  width?: number;
  height?: number;
};

export type Question = {
  id: string;
  number: number;
  type: QType;
  prompt: string;

  options: Array<{ id: string; text: string }>;
  correctOptionId: string;

  assets: QAsset[];

  tags: string[];
  autoTags: string[];
};
