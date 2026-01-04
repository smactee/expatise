/* Bookmarks */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const keyFor = (datasetId: string) => `expatise:bookmarks:${datasetId}`;

function readIds(datasetId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(datasetId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIds(datasetId: string, ids: string[]) {
  try {
    localStorage.setItem(keyFor(datasetId), JSON.stringify(ids));
  } catch {
    // ignore quota/private-mode errors
  }
}

export function useBookmarks(datasetId: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readIds(datasetId));
  }, [datasetId]);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const isBookmarked = useCallback((id: string) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        const arr = Array.from(next);
        writeIds(datasetId, arr);
        return arr;
      });
    },
    [datasetId]
  );

  return { ids, idSet, isBookmarked, toggle };
}
