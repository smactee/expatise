// lib/test-engine/attemptStorage.ts

export type AttemptStatus = 'in_progress' | 'paused' | 'submitted' | 'expired';

export type AnswerRecord = {
  choice: string;      // 'A'|'B'... or 'R'|'W'
  answeredAt: number;  // Date.now()
};


export type TestAttemptV1 = {
  schemaVersion: 1;

  attemptId: string;
  userKey: string;        // normalized email
  modeKey: string;        // "real-test"
  datasetId: string;
  datasetVersion: string;

  questionIds: string[];  // frozen random order, length=questionCount

  answersByQid: Record<string, AnswerRecord>;
  flaggedByQid: Record<string, true>;

  timeLimitSec: number;
  remainingSec: number;

  status: AttemptStatus;

  createdAt: number;
  lastActiveAt: number;
  pausedAt?: number;

  submittedAt?: number;
};

const SCHEMA_VERSION = 1 as const;
const ATTEMPT_KEY_PREFIX = 'expatise:attempt:v1:id';
const ACTIVE_PTR_PREFIX = 'expatise:attempt:v1:active';

export const EXPIRE_AFTER_MS = 30 * 60 * 1000; // 30 min

export function normalizeUserKey(email: string | null | undefined) {
  const s = String(email ?? '').trim().toLowerCase();
  return s || 'guest';
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeStringify(v: any): string | null {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function attemptKeyById(attemptId: string) {
  return `${ATTEMPT_KEY_PREFIX}:${attemptId}`;
}

function activePtrKey(params: { userKey: string; modeKey: string; datasetId: string }) {
  const { userKey, modeKey, datasetId } = params;
  return `${ACTIVE_PTR_PREFIX}:${userKey}:${modeKey}:${datasetId}`;
}

export function readAttemptById(attemptId: string): TestAttemptV1 | null {
  if (typeof window === 'undefined') return null;
  const parsed = safeParse(window.localStorage.getItem(attemptKeyById(attemptId)));
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return null;
  return parsed as TestAttemptV1;
}

export function writeAttempt(attempt: TestAttemptV1) {
  if (typeof window === 'undefined') return;
  const json = safeStringify(attempt);
  if (!json) return;
  try {
    window.localStorage.setItem(attemptKeyById(attempt.attemptId), json);
  } catch {
    // ignore quota/private-mode errors
  }
}

// ✅ delete 1 attempt record
export function deleteAttemptById(attemptId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(attemptKeyById(attemptId));
  } catch {}
}

// ✅ clear attempts by filter (bookmarks-style parity)
export function clearAttemptsByFilter(filter: {
  userKey: string;
  datasetId?: string;
  modeKey?: string;
  status?: AttemptStatus;
}) {
  if (typeof window === "undefined") return;

  const attempts = listAttempts({
    userKey: filter.userKey,
    datasetId: filter.datasetId,
    modeKey: filter.modeKey,
    status: filter.status,
    sort: "newest",
  });

  for (const a of attempts) {
    // remove stored record
    deleteAttemptById(a.attemptId);

    // clear active pointer for that mode+dataset
    clearActiveAttemptPointer({
      userKey: a.userKey,
      modeKey: a.modeKey,
      datasetId: a.datasetId,
    });
  }
}



// ✅ clears the "active attempt pointer" so /real-test won't resume it
export function clearActiveAttemptPointer(params: {
  userKey: string;
  modeKey: string;
  datasetId: string;
}) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(activePtrKey(params));
  } catch {}
}



// ✅ marks attempt as submitted AND clears active pointer
export function closeAttemptById(
  attemptId: string,
  patch?: { remainingSec?: number }
): TestAttemptV1 | null {
  const a = readAttemptById(attemptId);
  if (!a) return null;

  // already closed -> still ensure pointer is cleared
  if (a.status === "submitted") {
    clearActiveAttemptPointer({ userKey: a.userKey, modeKey: a.modeKey, datasetId: a.datasetId });
    return a;
  }

  const now = Date.now();

  const closed: TestAttemptV1 = {
    ...a,
    status: "submitted",
    submittedAt: now,         // your type already implies this (or add it if missing)
    lastActiveAt: now,
    pausedAt: undefined,
    remainingSec: typeof patch?.remainingSec === "number" ? patch.remainingSec : a.remainingSec,
  };

  writeAttempt(closed);
  clearActiveAttemptPointer({ userKey: closed.userKey, modeKey: closed.modeKey, datasetId: closed.datasetId });

  return closed;
}


export function readActiveAttemptId(params: { userKey: string; modeKey: string; datasetId: string }) {
  if (typeof window === 'undefined') return null;
  const key = activePtrKey(params);
  return window.localStorage.getItem(key);
}

export function writeActiveAttemptId(params: {
  userKey: string;
  modeKey: string;
  datasetId: string;
  attemptId: string;
}) {
  if (typeof window === 'undefined') return;
  const key = activePtrKey(params);
  try {
    window.localStorage.setItem(key, params.attemptId);
  } catch {
    // ignore
  }
}

export function sampleWithoutReplacement(ids: readonly string[], n: number): string[] {
  if (ids.length < n) throw new Error(`Not enough ids: have ${ids.length}, need ${n}`);
  const a = ids.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function isExpired(attempt: TestAttemptV1, now: number) {
  if (attempt.status === 'submitted') return false;
  if (attempt.status === 'expired') return true;
  const inactiveSince = attempt.pausedAt ?? attempt.lastActiveAt ?? attempt.createdAt;
  return now - inactiveSince >= EXPIRE_AFTER_MS;
}

function markExpiredIfNeeded(a: TestAttemptV1, now: number): TestAttemptV1 {
  if (!isExpired(a, now)) return a;
  if (a.status === "expired") return a;

  const expired: TestAttemptV1 = {
    ...a,
    status: "expired",
    lastActiveAt: now,
  };

  writeAttempt(expired);
  clearActiveAttemptPointer({ userKey: expired.userKey, modeKey: expired.modeKey, datasetId: expired.datasetId });
  return expired;
}


export function computeNextUnansweredIndex(attempt: TestAttemptV1): number {
  for (let i = 0; i < attempt.questionIds.length; i++) {
    const qid = attempt.questionIds[i];
    if (!attempt.answersByQid[qid]) return i;
  }
  return attempt.questionIds.length;
}

export function getOrCreateAttempt(params: {
  userKey: string;
  modeKey: string;
  datasetId: string;
  datasetVersion: string;
  allQuestionIds: string[];
  questionCount: number;
  timeLimitSec: number;
}): { attempt: TestAttemptV1; reused: boolean } {
  const now = Date.now();

  // Try reuse via active pointer
  const activeId = readActiveAttemptId({
    userKey: params.userKey,
    modeKey: params.modeKey,
    datasetId: params.datasetId,
  });

  if (activeId) {
    const existing = readAttemptById(activeId);

    // ✅ Edge case: pointer exists but record is missing/corrupt
    if (!existing) {
      clearActiveAttemptPointer({
        userKey: params.userKey,
        modeKey: params.modeKey,
        datasetId: params.datasetId,
      });
    } else {
      // ✅ NEW: persist expiration + clear pointer if needed
      const maybeExpired = markExpiredIfNeeded(existing, now);

      // If it expired, treat as invalid and fall through to "create new attempt"
      if (maybeExpired.status !== "expired") {
        const a = maybeExpired; // use a for the rest

        const allSet = new Set(params.allQuestionIds);

        const valid =
          a.schemaVersion === SCHEMA_VERSION &&
          a.userKey === params.userKey &&
          a.modeKey === params.modeKey &&
          a.datasetId === params.datasetId &&
          a.datasetVersion === params.datasetVersion &&
          a.questionIds.length === params.questionCount &&
          new Set(a.questionIds).size === a.questionIds.length &&
          a.questionIds.every((id) => allSet.has(id)) &&
          // markExpiredIfNeeded already handled expiration
          a.status !== "submitted" &&
          a.status !== "expired";

        if (valid) {
          const resumed: TestAttemptV1 = {
            ...a,
            status: "in_progress",
            lastActiveAt: now,
            pausedAt: undefined,
          };
          writeAttempt(resumed);
          // keep pointer the same
          return { attempt: resumed, reused: true };
        }

        // ✅ Invalid attempt for other reasons (datasetVersion mismatch, wrong count, etc.)
        // Clear pointer so the next open doesn’t keep trying to resume it.
        clearActiveAttemptPointer({
          userKey: params.userKey,
          modeKey: params.modeKey,
          datasetId: params.datasetId,
        });
      }

      // If maybeExpired.status === "expired", markExpiredIfNeeded already cleared pointer.
      // We just fall through to creation below.
    }
  }

  // -----------------------------
  // Create new attempt (fallback)
  // -----------------------------

  const picked = sampleWithoutReplacement(params.allQuestionIds, params.questionCount);

  const fresh: TestAttemptV1 = {
    schemaVersion: SCHEMA_VERSION,

    attemptId: uuid(),
    userKey: params.userKey,
    modeKey: params.modeKey,
    datasetId: params.datasetId,
    datasetVersion: params.datasetVersion,

    questionIds: picked,

    answersByQid: {},
    flaggedByQid: {},

    timeLimitSec: params.timeLimitSec,
    remainingSec: params.timeLimitSec,

    status: "in_progress",

    createdAt: now,
    lastActiveAt: now,
  };

  writeAttempt(fresh);

  writeActiveAttemptId({
    userKey: params.userKey,
    modeKey: params.modeKey,
    datasetId: params.datasetId,
    attemptId: fresh.attemptId,
  });

  return { attempt: fresh, reused: false };
}


export function listAttempts(filter?: {
  status?: AttemptStatus;
  datasetId?: string;
  modeKey?: string;
  userKey?: string;
  sort?: 'newest' | 'oldest'; // optional convenience
}): TestAttemptV1[] {
  if (typeof window === 'undefined') return [];

  const out: TestAttemptV1[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;

    // only attempt records
    if (!key.startsWith(`${ATTEMPT_KEY_PREFIX}:`)) continue;

    const parsed = safeParse(window.localStorage.getItem(key));
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) continue;

    const a = parsed as TestAttemptV1;

    if (filter?.status && a.status !== filter.status) continue;
    if (filter?.datasetId && a.datasetId !== filter.datasetId) continue;
    if (filter?.modeKey && a.modeKey !== filter.modeKey) continue;
    if (filter?.userKey && a.userKey !== filter.userKey) continue;

    out.push(a);
  }

  // stable ordering (very useful for UI)
  const dir = filter?.sort === 'oldest' ? 1 : -1; // default newest
  out.sort(
    (a, b) =>
      dir *
      ((a.submittedAt ?? a.lastActiveAt ?? a.createdAt ?? 0) -
        (b.submittedAt ?? b.lastActiveAt ?? b.createdAt ?? 0))
  );

  return out;
}

export function listSubmittedAttempts(params: {
  userKey: string;
  datasetId?: string;
  modeKey?: string;
}): TestAttemptV1[] {
  return listAttempts({
    status: 'submitted',
    userKey: params.userKey,
    datasetId: params.datasetId,
    modeKey: params.modeKey,
    sort: 'newest',
  });
}
