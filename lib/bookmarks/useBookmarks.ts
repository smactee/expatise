// lib/bookmarks/useBookmarks.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bookmarkStore } from "./store";
import { useUserKey } from "@/components/useUserKey.client";

export function useBookmarks(datasetId: string, userKeyOverride?: string) {
  const inferredUserKey = useUserKey();
  const userKey = userKeyOverride ?? inferredUserKey;

  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const list = await bookmarkStore.listIds(userKey, datasetId);
      if (!cancelled) setIds(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [datasetId, userKey]);

  const idSet = useMemo(() => new Set(ids), [ids]);
  const isBookmarked = useCallback((id: string) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    async (id: string) => {
      // optimistic UI update + store persistence
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return Array.from(next);
      });

      // persist based on the latest known ids
      // (we pass current ids via closure to avoid re-reading localStorage)
      await bookmarkStore.toggle(userKey, datasetId, id, ids);
    },
    [datasetId, userKey, ids]
  );

  return { ids, idSet, isBookmarked, toggle };
}
