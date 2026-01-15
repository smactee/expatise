// lib/attempts/attemptStore.ts
import type {
  TestAttemptV1,
  getOrCreateAttempt as legacyGetOrCreateAttempt,
  closeAttemptById as legacyCloseAttemptById,
  readAttemptById as legacyReadAttemptById,
} from "@/lib/test-engine/attemptStorage";

export type Attempt = TestAttemptV1;

export type GetOrCreateParams = Parameters<typeof legacyGetOrCreateAttempt>[0];
export type GetOrCreateResult = ReturnType<typeof legacyGetOrCreateAttempt>;
export type ClosePatch = Parameters<typeof legacyCloseAttemptById>[1];

export interface AttemptStore {
  listAttempts(userKey: string, datasetId: string): Promise<Attempt[]>;
  saveAttempt(userKey: string, datasetId: string, attempt: Attempt): Promise<void>;
  clearAttempts(userKey: string, datasetId: string): Promise<void>;

  getOrCreateAttempt(params: GetOrCreateParams): Promise<GetOrCreateResult>;
  writeAttempt(attempt: Attempt): Promise<void>;
  closeAttemptById(attemptId: string, patch?: ClosePatch): Promise<Attempt | null>;
  readAttemptById(attemptId: string): Promise<Attempt | null>;
}
