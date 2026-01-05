// lib/test-engine/attemptTypes.ts

export type AttemptStatus = "in_progress" | "paused" | "submitted" | "expired";

export type AnswerRecord = {
  choice: string;      // e.g. "A" | "B" | "C" | "D"
  answeredAt: number;  // Date.now()
};

export type TestAttemptV1 = {
  schemaVersion: 1;

  attemptId: string;
  userKey: string;         // local key (email or "anon")
  modeKey: string;         // "real-test" (reusable)
  datasetId: string;       // e.g. "cn-2023-test1"
  datasetVersion: string;  // bump this when dataset changes

  questionIds: string[];   // length=50, unique, frozen, random order

  answersByQid: Record<string, AnswerRecord>;
  flaggedByQid: Record<string, true>;

  timeLimitSec: number;    // 2700 for 45 min
  remainingSec: number;    // starts 2700 (timer persistence later)

  status: AttemptStatus;

  createdAt: number;
  lastActiveAt: number;
  pausedAt?: number;

  submittedAt?: number;
};
