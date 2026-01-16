// lib/sync/rules.ts
// Future DB sync contract (local-first now, deterministic sync later).
// Keep this file small + boring. This becomes your “constitution”.

export type AttemptStatus = "in_progress" | "paused" | "submitted" | "expired";

export type AttemptLike = {
  attemptId: string;
  status: AttemptStatus;
  lastActiveAt: number;
  updatedAt?: number;   // optional future-proofing
  createdAt?: number;
  submittedAt?: number;
};

function scoreAttempt(a: AttemptLike): number {
  // Use the most meaningful timestamp for sorting/recency
  return a.submittedAt ?? a.lastActiveAt ?? a.updatedAt ?? a.createdAt ?? 0;
}

/**
 * Attempts merge rules:
 * - submitted: append-only (never “unsubmit”)
 * - in_progress/paused: last-write-wins by lastActiveAt (fallback to updatedAt)
 * - if same attemptId exists on both sides:
 *    - if either is submitted -> keep submitted (prefer later submittedAt / score)
 *    - else keep the one with higher lastActiveAt (or updatedAt)
 */
export function mergeAttempts<T extends AttemptLike>(local?: T[], remote?: T[]): T[] {
  const map = new Map<string, T>();

  const upsert = (incoming: T) => {
    const existing = map.get(incoming.attemptId);
    if (!existing) {
      map.set(incoming.attemptId, incoming);
      return;
    }

    const existingSubmitted = existing.status === "submitted";
    const incomingSubmitted = incoming.status === "submitted";

    // If either is submitted, keep submitted record.
    if (existingSubmitted || incomingSubmitted) {
      if (existingSubmitted && incomingSubmitted) {
        // both submitted -> keep the “later” one
        map.set(
          incoming.attemptId,
          scoreAttempt(existing) >= scoreAttempt(incoming) ? existing : incoming
        );
        return;
      }

      map.set(incoming.attemptId, incomingSubmitted ? incoming : existing);
      return;
    }

    // Neither submitted -> LWW by lastActiveAt (fallback to updatedAt)
    const exT = existing.lastActiveAt ?? existing.updatedAt ?? 0;
    const inT = incoming.lastActiveAt ?? incoming.updatedAt ?? 0;
    map.set(incoming.attemptId, inT >= exT ? incoming : existing);
  };

  for (const a of local ?? []) upsert(a);
  for (const a of remote ?? []) upsert(a);

  const out = Array.from(map.values());
  out.sort((a, b) => scoreAttempt(b) - scoreAttempt(a));
  return out;
}

/**
 * Set-union rules (bookmarks, cleared mistakes):
 * - Adds are merged by union
 * - Deletions are NOT represented yet (if you need deletions across devices later,
 *   add tombstones: {id, removedAt} and merge by timestamp)
 */
export function mergeIdSets(localIds?: string[], remoteIds?: string[]): string[] {
  const s = new Set<string>();
  for (const id of localIds ?? []) s.add(String(id));
  for (const id of remoteIds ?? []) s.add(String(id));
  return Array.from(s.values()).sort(); // stable output helps debugging
}

export function mergeBookmarks(local?: string[], remote?: string[]) {
  return mergeIdSets(local, remote);
}

export function mergeClearedMistakes(local?: string[], remote?: string[]) {
  return mergeIdSets(local, remote);
}
