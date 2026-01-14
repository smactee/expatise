// lib/attempts/attemptStore.ts
import type { TestAttemptV1 } from "@/lib/test-engine/attemptStorage";

export type Attempt = TestAttemptV1;

export type AttemptStore = {
  listAttempts: (userKey: string, datasetId: string) => Promise<Attempt[]>;
  saveAttempt: (userKey: string, datasetId: string, attempt: Attempt) => Promise<void>;
  clearAttempts: (userKey: string, datasetId: string) => Promise<void>;
};
