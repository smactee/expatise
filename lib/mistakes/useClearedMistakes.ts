"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const keyFor = (datasetId: string, userKey: string) =>
  `expatise:mistakesCleared:${userKey}:${datasetId}`;

function readIds(datasetId: string, userKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(datasetId, userKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIds(datasetId: string, userKey: string, ids: string[]) {
  try {
    localStorage.setItem(keyFor(datasetId, userKey), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function useClearedMistakes(datasetId: string, userKey: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readIds(datasetId, userKey));
  }, [datasetId, userKey]);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const clearMany = useCallback(
    (qids: string[]) => {
      setIds((prev) => {
        const next = new Set(prev);
        qids.forEach((id) => next.add(id));
        const arr = Array.from(next);
        writeIds(datasetId, userKey, arr);
        return arr;
      });
    },
    [datasetId, userKey]
  );

  const undoMany = useCallback(
    (qids: string[]) => {
      setIds((prev) => {
        const next = new Set(prev);
        qids.forEach((id) => next.delete(id));
        const arr = Array.from(next);
        writeIds(datasetId, userKey, arr);
        return arr;
      });
    },
    [datasetId, userKey]
  );

  const clearAll = useCallback(() => {
    setIds([]);
    writeIds(datasetId, userKey, []);
  }, [datasetId, userKey]);

  return { ids, idSet, clearMany, undoMany, clearAll };
}
