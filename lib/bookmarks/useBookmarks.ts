// lib/bookmarks/useBookmarks.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bookmarkStore } from "./store";
import { useUserKey } from "@/components/useUserKey.client";
import { useAuthStatus } from "@/components/useAuthStatus";
import { userKeyFromEmail } from "@/lib/identity/userKey";

type BookmarkMigrationRecord = {
  version: 1;
  absorbed: Record<string, string[]>;
};

function migrationKeyFor(userKey: string, datasetId: string) {
  return `expatise:bookmarks:v2:migrated:user:${userKey}:dataset:${datasetId}`;
}

function uniqSorted(ids: string[]) {
  return Array.from(new Set((ids ?? []).map(String))).sort();
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isCanonicalUserKey(userKey: string) {
  return userKey.startsWith("sb:");
}

function readMigrationRecord(userKey: string, datasetId: string): BookmarkMigrationRecord {
  if (typeof window === "undefined") {
    return { version: 1, absorbed: {} };
  }

  try {
    const raw = window.localStorage.getItem(migrationKeyFor(userKey, datasetId));
    if (!raw) return { version: 1, absorbed: {} };

    const parsed = JSON.parse(raw);
    const absorbed =
      parsed && typeof parsed === "object" && parsed.absorbed && typeof parsed.absorbed === "object"
        ? Object.fromEntries(
            Object.entries(parsed.absorbed).map(([source, ids]) => [
              source,
              uniqSorted(Array.isArray(ids) ? ids.map(String) : []),
            ])
          )
        : {};

    return { version: 1, absorbed };
  } catch {
    return { version: 1, absorbed: {} };
  }
}

function writeMigrationRecord(userKey: string, datasetId: string, record: BookmarkMigrationRecord) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(migrationKeyFor(userKey, datasetId), JSON.stringify(record));
  } catch {
    // ignore storage failures
  }
}

export function useBookmarks(datasetId: string, userKeyOverride?: string) {
  const inferredUserKey = useUserKey();
  const { email } = useAuthStatus();
  const userKey = userKeyOverride ?? inferredUserKey;
  const legacyEmailUserKey = userKeyFromEmail(email);

  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isCanonicalUserKey(userKey)) {
        const list = await bookmarkStore.listIds(userKey, datasetId);
        if (!cancelled) setIds(list);
        return;
      }

      const canonicalIds = uniqSorted(await bookmarkStore.listIds(userKey, datasetId));
      const sourceKeys = Array.from(
        new Set(
          [legacyEmailUserKey, "guest"].filter(
            (source): source is string => Boolean(source) && source !== userKey
          )
        )
      );

      if (sourceKeys.length === 0) {
        if (!cancelled) setIds(canonicalIds);
        return;
      }

      const record = readMigrationRecord(userKey, datasetId);
      let nextCanonicalIds = canonicalIds;
      let markerChanged = false;

      for (const sourceKey of sourceKeys) {
        const sourceIds = uniqSorted(await bookmarkStore.listIds(sourceKey, datasetId));
        const absorbedIds = uniqSorted(record.absorbed[sourceKey] ?? []);
        const absorbedSet = new Set(absorbedIds);
        const newIds = sourceIds.filter((id) => !absorbedSet.has(id));

        if (newIds.length > 0) {
          nextCanonicalIds = uniqSorted([...nextCanonicalIds, ...newIds]);
        }

        const nextAbsorbedIds = uniqSorted([...absorbedIds, ...sourceIds]);
        if (!sameIds(nextAbsorbedIds, absorbedIds)) {
          record.absorbed[sourceKey] = nextAbsorbedIds;
          markerChanged = true;
        }
      }

      if (!sameIds(nextCanonicalIds, canonicalIds)) {
        await bookmarkStore.writeIds(userKey, datasetId, nextCanonicalIds);
      }

      if (markerChanged) {
        writeMigrationRecord(userKey, datasetId, record);
      }

      if (!cancelled) setIds(nextCanonicalIds);
    })();

    return () => {
      cancelled = true;
    };
  }, [datasetId, legacyEmailUserKey, userKey]);

  const idSet = useMemo(() => new Set(ids), [ids]);
  const isBookmarked = useCallback((id: string) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    async (id: string) => {
      setIds((prev) => {
        const nextSet = new Set(prev);
        if (nextSet.has(id)) nextSet.delete(id);
        else nextSet.add(id);

        const next = Array.from(nextSet);
        // ✅ persist EXACTLY what UI is showing (no stale closure)
        void bookmarkStore.writeIds(userKey, datasetId, next);
        return next;
      });
    },
    [datasetId, userKey]
  );

  const removeMany = useCallback(
    async (removeIds: string[]) => {
      const removeSet = new Set((removeIds ?? []).map(String));

      setIds((prev) => {
        const next = prev.filter((id) => !removeSet.has(String(id)));
        void bookmarkStore.writeIds(userKey, datasetId, next);
        return next;
      });
    },
    [datasetId, userKey]
  );

  return { ids, idSet, isBookmarked, toggle, removeMany };
}
