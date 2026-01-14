// lib/attempts/localAttemptStore.ts
import type { AttemptStore, Attempt } from "./attemptStore";
import {
  listAttempts as legacyList,
  writeAttempt as legacyWrite,
  clearAttemptsByFilter,
} from "@/lib/test-engine/attemptStorage";

export class LocalAttemptStore implements AttemptStore {
  async listAttempts(userKey: string, datasetId: string) {
    return legacyList({ userKey, datasetId, sort: "newest" });
  }

  async saveAttempt(userKey: string, datasetId: string, attempt: Attempt) {
    // DO NOT add fields that don't exist on TestAttemptV1
    legacyWrite({
      ...attempt,
      userKey,
      datasetId,
      // if you *really* want a touch timestamp:
      lastActiveAt: Date.now(),
    });
  }

  async clearAttempts(userKey: string, datasetId: string) {
    clearAttemptsByFilter({ userKey, datasetId });
  }
}
