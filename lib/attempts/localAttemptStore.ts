// lib/attempts/localAttemptStore.ts
import type { AttemptStore, Attempt, GetOrCreateParams, ClosePatch } from "./attemptStore";

import {
  listAttempts as legacyList,
  writeAttempt as legacyWrite,
  clearAttemptsByFilter,
  getOrCreateAttempt as legacyGetOrCreate,
  closeAttemptById as legacyClose,
  readAttemptById as legacyRead,
} from "@/lib/test-engine/attemptStorage";

export class LocalAttemptStore implements AttemptStore {
  async listAttempts(userKey: string, datasetId: string) {
    return legacyList({ userKey, datasetId, sort: "newest" });
  }

  async saveAttempt(userKey: string, datasetId: string, attempt: Attempt) {
    legacyWrite({
      ...attempt,
      userKey,
      datasetId,
      lastActiveAt: Date.now(),
    });
  }

  async clearAttempts(userKey: string, datasetId: string) {
    await Promise.resolve(clearAttemptsByFilter({ userKey, datasetId }));
  }

  async getOrCreateAttempt(params: GetOrCreateParams) {
    return Promise.resolve(legacyGetOrCreate(params));
  }

  async writeAttempt(attempt: Attempt) {
    legacyWrite(attempt);
  }

  async closeAttemptById(attemptId: string, patch?: ClosePatch) {
    return Promise.resolve(legacyClose(attemptId, patch));
  }

  async readAttemptById(attemptId: string) {
    return Promise.resolve(legacyRead(attemptId));
  }
}
