// lib/mistakes/localClearedMistakesStore.ts
import type { ClearedMistakesStore } from "./store";

// legacy (your old key) — we’ll migrate from this if it exists
const legacyKeyFor = (userKey: string, datasetId: string) =>
  `expatise:mistakesCleared:${userKey}:${datasetId}`;

// v1 key (more future-proof / consistent with bookmarks naming)
const keyFor = (userKey: string, datasetId: string) =>
  `expatise:mistakesCleared:v1:user:${userKey}:dataset:${datasetId}`;

function safeParseIds(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function uniqSorted(ids: string[]) {
  return Array.from(new Set((ids ?? []).map(String))).sort();
}

function readKey(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function writeKey(k: string, raw: string) {
  try {
    localStorage.setItem(k, raw);
  } catch {
    // ignore
  }
}

function removeKey(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export class LocalClearedMistakesStore implements ClearedMistakesStore {
  async listIds(userKey: string, datasetId: string): Promise<string[]> {
    if (typeof window === "undefined") return [];

    const k = keyFor(userKey, datasetId);

    // ---- 1) Read v1 first
    let raw = readKey(k);

    // ---- 2) If missing, migrate legacy(userKey) -> v1(userKey)
    if (!raw) {
      const legacyK = legacyKeyFor(userKey, datasetId);
      const legacyRaw = readKey(legacyK);
      if (legacyRaw) {
        writeKey(k, legacyRaw);
        removeKey(legacyK);
        raw = legacyRaw;
      }
    }

    let ids = uniqSorted(safeParseIds(raw));

    // ---- 3) Guest -> user one-time merge (prevents “data vanished after login”)
    // Policy:
    // - If userKey !== "guest" and guest has ids, merge union into user
    // - Then clear guest keys so it’s truly “migrated once”
    if (userKey !== "guest") {
      const guestV1K = keyFor("guest", datasetId);
      const guestLegacyK = legacyKeyFor("guest", datasetId);

      // Ensure guest legacy is also migrated into guest v1 (so we merge from one place)
      let guestRaw = readKey(guestV1K);
      if (!guestRaw) {
        const gl = readKey(guestLegacyK);
        if (gl) {
          writeKey(guestV1K, gl);
          removeKey(guestLegacyK);
          guestRaw = gl;
        }
      }

      const guestIds = uniqSorted(safeParseIds(guestRaw));

      if (guestIds.length > 0) {
        const merged = uniqSorted([...ids, ...guestIds]);

        // Persist only if changed
        const changed =
          merged.length !== ids.length ||
          merged.some((v, i) => v !== ids[i]);

        if (changed) {
          writeKey(k, JSON.stringify(merged));
          ids = merged;
        }

        // clear guest storage so this doesn’t re-run forever
        removeKey(guestV1K);
        removeKey(guestLegacyK);
      }
    }

    return ids;
  }

  async writeIds(userKey: string, datasetId: string, ids: string[]): Promise<void> {
    if (typeof window === "undefined") return;
    writeKey(keyFor(userKey, datasetId), JSON.stringify(uniqSorted(ids)));
  }

  async addMany(userKey: string, datasetId: string, ids: string[]): Promise<string[]> {
    const prev = await this.listIds(userKey, datasetId);
    const next = uniqSorted([...prev, ...(ids ?? [])]);
    await this.writeIds(userKey, datasetId, next);
    return next;
  }

  async removeMany(userKey: string, datasetId: string, ids: string[]): Promise<string[]> {
    const remove = new Set((ids ?? []).map(String));
    const prev = await this.listIds(userKey, datasetId);
    const next = prev.filter((x) => !remove.has(String(x)));
    await this.writeIds(userKey, datasetId, next);
    return uniqSorted(next);
  }

  async clearAll(userKey: string, datasetId: string): Promise<void> {
    if (typeof window === "undefined") return;
    removeKey(keyFor(userKey, datasetId));
    removeKey(legacyKeyFor(userKey, datasetId));
  }
}
