// lib/bookmarks/localBookmarkStore.ts
import type { BookmarkStore } from "./bookmarkStore";

const legacyKeyFor = (datasetId: string) => `expatise:bookmarks:${datasetId}`;
const keyFor = (userKey: string, datasetId: string) =>
  `expatise:bookmarks:v1:user:${userKey}:dataset:${datasetId}`;

function safeParseIds(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export class LocalBookmarkStore implements BookmarkStore {
  async listIds(userKey: string, datasetId: string): Promise<string[]> {
    if (typeof window === "undefined") return [];

    const k = keyFor(userKey, datasetId);
    let raw = localStorage.getItem(k);

    // ✅ one-time migration for your existing dev bookmarks (guest only)
    if (!raw && userKey === "guest") {
      const legacy = localStorage.getItem(legacyKeyFor(datasetId));
      if (legacy) {
        try {
          localStorage.setItem(k, legacy);
          localStorage.removeItem(legacyKeyFor(datasetId));
          raw = legacy;
        } catch {
          // ignore
        }
      }
    }

    return safeParseIds(raw);
  }

  async writeIds(userKey: string, datasetId: string, ids: string[]): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(keyFor(userKey, datasetId), JSON.stringify(ids));
    } catch {
      // ignore quota/private-mode errors
    }
  }

  async toggle(userKey: string, datasetId: string, id: string, prev?: string[]): Promise<string[]> {
    const base = prev ?? (await this.listIds(userKey, datasetId));
    const next = new Set(base);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    const arr = Array.from(next).sort();
    await this.writeIds(userKey, datasetId, arr);
    return arr;
  }

  async clear(userKey: string, datasetId: string): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(keyFor(userKey, datasetId));
    } catch {
      // ignore
    }
  }
}
