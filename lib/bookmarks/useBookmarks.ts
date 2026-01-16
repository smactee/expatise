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
