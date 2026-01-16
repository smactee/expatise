// lib/mistakes/useClearedMistakes.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clearedMistakesStore } from "@/lib/mistakes/store";
import { useUserKey } from "@/components/useUserKey.client";

export function useClearedMistakes(datasetId: string, userKeyOverride?: string) {
  const inferredUserKey = useUserKey();
  const userKey = userKeyOverride ?? inferredUserKey;

  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const list = await clearedMistakesStore.listIds(userKey, datasetId);
      if (!cancelled) setIds(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [datasetId, userKey]);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const clearMany = useCallback(
    (qids: string[]) => {
      setIds((prev) => {
        const next = Array.from(new Set([...prev, ...(qids ?? [])].map(String)));
        void clearedMistakesStore.writeIds(userKey, datasetId, next);
        return next;
      });
    },
    [datasetId, userKey]
  );

  const undoMany = useCallback(
    (qids: string[]) => {
      const remove = new Set((qids ?? []).map(String));
      setIds((prev) => {
        const next = prev.filter((id) => !remove.has(String(id)));
        void clearedMistakesStore.writeIds(userKey, datasetId, next);
        return next;
      });
    },
    [datasetId, userKey]
  );

  const clearAll = useCallback(() => {
    setIds([]);
    void clearedMistakesStore.clearAll(userKey, datasetId);
  }, [datasetId, userKey]);

  return { ids, idSet, clearMany, undoMany, clearAll };
}
