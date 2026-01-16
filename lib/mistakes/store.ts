// lib/mistakes/store.ts
import { LocalClearedMistakesStore } from "./localClearedMistakesStore";

export interface ClearedMistakesStore {
  listIds(userKey: string, datasetId: string): Promise<string[]>;
  writeIds(userKey: string, datasetId: string, ids: string[]): Promise<void>;
  addMany(userKey: string, datasetId: string, ids: string[]): Promise<string[]>;
  removeMany(userKey: string, datasetId: string, ids: string[]): Promise<string[]>;
  clearAll(userKey: string, datasetId: string): Promise<void>;
}

export const clearedMistakesStore: ClearedMistakesStore = new LocalClearedMistakesStore();
