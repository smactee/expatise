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
    if (existing) {
      const allSet = new Set(params.allQuestionIds);
      const valid =
        existing.schemaVersion === SCHEMA_VERSION &&
        existing.userKey === params.userKey &&
        existing.modeKey === params.modeKey &&
        existing.datasetId === params.datasetId &&
        existing.datasetVersion === params.datasetVersion &&
        existing.questionIds.length === params.questionCount &&
        new Set(existing.questionIds).size === existing.questionIds.length &&
        existing.questionIds.every((id) => allSet.has(id)) &&
        !isExpired(existing, now) &&
        existing.status !== 'submitted' &&
        existing.status !== 'expired';

      if (valid) {
        const resumed: TestAttemptV1 = {
          ...existing,
          status: 'in_progress',
          lastActiveAt: now,
          pausedAt: undefined,
        };
        writeAttempt(resumed);
        // keep pointer the same
        return { attempt: resumed, reused: true };
      }
    }
  }

  // Create new attempt
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

    status: 'in_progress',

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
