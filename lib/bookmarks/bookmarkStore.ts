// lib/bookmarks/bookmarkStore.ts

export type BookmarkStore = {
  listIds(userKey: string, datasetId: string): Promise<string[]>;
  writeIds(userKey: string, datasetId: string, ids: string[]): Promise<void>;
  toggle(userKey: string, datasetId: string, id: string, prev?: string[]): Promise<string[]>;
  clear(userKey: string, datasetId: string): Promise<void>;
};
