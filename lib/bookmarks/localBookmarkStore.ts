// lib/bookmarks/localBookmarkStore.ts
import type { BookmarkStore } from "./bookmarkStore";
import { Preferences } from "@capacitor/preferences";

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
    try {
      const k = keyFor(userKey, datasetId);
      let { value: raw } = await Preferences.get({ key: k });

      // ✅ one-time migration for your existing dev bookmarks (guest only)
      if (!raw && userKey === "guest") {
        const legacy = localStorage.getItem(legacyKeyFor(datasetId));
        if (legacy) {
          try {
            await Preferences.set({ key: k, value: legacy });
            localStorage.removeItem(legacyKeyFor(datasetId));
            raw = legacy;
          } catch {
            // ignore
          }
        }
      }

      return safeParseIds(raw);
    } catch {
      return [];
    }
  }

  async writeIds(userKey: string, datasetId: string, ids: string[]): Promise<void> {
    try {
      await Preferences.set({ key: keyFor(userKey, datasetId), value: JSON.stringify(ids) });
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
    try {
      await Preferences.remove({ key: keyFor(userKey, datasetId) });
    } catch {
      // ignore
    }
  }
}
