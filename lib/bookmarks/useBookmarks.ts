
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const legacyKeyFor = (datasetId: string) => `expatise:bookmarks:${datasetId}`;
const keyFor = (userKey: string, datasetId: string) =>
  `expatise:bookmarks:v1:user:${userKey}:dataset:${datasetId}`;

function readIds(userKey: string, datasetId: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const k = keyFor(userKey, datasetId);
    let raw = localStorage.getItem(k);

    // ✅ one-time migration for your existing dev bookmarks
    if (!raw && userKey === "guest") {
      const legacy = localStorage.getItem(legacyKeyFor(datasetId));
      if (legacy) {
        localStorage.setItem(k, legacy);
        localStorage.removeItem(legacyKeyFor(datasetId));
        raw = legacy;
      }
    }

    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIds(userKey: string, datasetId: string, ids: string[]) {
  try {
    localStorage.setItem(keyFor(userKey, datasetId), JSON.stringify(ids));
  } catch {
    // ignore quota/private-mode errors
  }
}

export function useBookmarks(datasetId: string, userKey: string = "guest") {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readIds(userKey, datasetId));
  }, [datasetId, userKey]);

  const idSet = useMemo(() => new Set(ids), [ids]);
  const isBookmarked = useCallback((id: string) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        const arr = Array.from(next);
        writeIds(userKey, datasetId, arr);
        return arr;
      });
    },
    [datasetId, userKey]
  );

  return { ids, idSet, isBookmarked, toggle };
}
