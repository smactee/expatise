// lib/freeAccess/localUsageCap.ts
"use client";

export const FREE_CAPS = {
  questionsShown: 420,
  examStarts: 10,
} as const;

export type UsageCapState = {
  shown: number;         // counts every question display
  examStarts: number;    // counts only when starting a NEW exam (reused === false)
  lastView?: { sig: string; at: number }; // tiny debounce to avoid accidental double-count
  updatedAt: number;
};

const EVT = "expatise:usagecap-changed";
const keyFor = (userKey: string) => `expatise:usagecap:v2:user:${userKey || "guest"}`;
const migrationKeyFor = (userKey: string) =>
  `expatise:usagecap:v2:migrated:user:${userKey || "guest"}`;

type UsageCapMigrationSnapshot = {
  shown: number;
  examStarts: number;
  updatedAt: number;
};

type UsageCapMigrationRecord = {
  version: 1;
  absorbed: Record<string, UsageCapMigrationSnapshot>;
};

function baseMigrationRecord(): UsageCapMigrationRecord {
  return { version: 1, absorbed: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function baseState(): UsageCapState {
  return { shown: 0, examStarts: 0, updatedAt: 0 };
}

function toSnapshot(state: UsageCapState): UsageCapMigrationSnapshot {
  return {
    shown: Math.max(0, Number(state.shown ?? 0)),
    examStarts: Math.max(0, Number(state.examStarts ?? 0)),
    updatedAt: Math.max(0, Number(state.updatedAt ?? 0)),
  };
}

function sameSnapshot(a?: UsageCapMigrationSnapshot, b?: UsageCapMigrationSnapshot) {
  return (
    (a?.shown ?? 0) === (b?.shown ?? 0) &&
    (a?.examStarts ?? 0) === (b?.examStarts ?? 0) &&
    (a?.updatedAt ?? 0) === (b?.updatedAt ?? 0)
  );
}

function sameLastView(
  a?: UsageCapState["lastView"],
  b?: UsageCapState["lastView"]
) {
  return (a?.sig ?? "") === (b?.sig ?? "") && (a?.at ?? 0) === (b?.at ?? 0);
}

function sameState(a: UsageCapState, b: UsageCapState) {
  return (
    a.shown === b.shown &&
    a.examStarts === b.examStarts &&
    a.updatedAt === b.updatedAt &&
    sameLastView(a.lastView, b.lastView)
  );
}

function newestLastView(
  a?: UsageCapState["lastView"],
  b?: UsageCapState["lastView"]
) {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

function hasStateData(state: UsageCapState) {
  return (
    state.shown > 0 ||
    state.examStarts > 0 ||
    state.updatedAt > 0 ||
    !!state.lastView
  );
}

function readMigrationRecord(userKey: string): UsageCapMigrationRecord {
  if (typeof window === "undefined") return baseMigrationRecord();

  const parsed = safeParse(localStorage.getItem(migrationKeyFor(userKey)));
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.absorbed)) {
    return baseMigrationRecord();
  }

  const absorbed: Record<string, UsageCapMigrationSnapshot> = {};

  for (const [sourceKey, snapshot] of Object.entries(parsed.absorbed)) {
    if (!sourceKey || !isRecord(snapshot)) continue;

    absorbed[sourceKey] = {
      shown: Math.max(0, Number(snapshot.shown ?? 0)),
      examStarts: Math.max(0, Number(snapshot.examStarts ?? 0)),
      updatedAt: Math.max(0, Number(snapshot.updatedAt ?? 0)),
    };
  }

  return { version: 1, absorbed };
}

function writeMigrationRecord(userKey: string, record: UsageCapMigrationRecord) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(migrationKeyFor(userKey), JSON.stringify(record));
  } catch {
    // ignore quota/private mode
  }
}

/**
 * Migration:
 * - If you previously stored shownKeys[], migrate shown = shownKeys.length.
 * - Keep examStarts if present.
 */
function readState(userKey: string): UsageCapState {
  if (typeof window === "undefined") return baseState();

  const parsed = safeParse(localStorage.getItem(keyFor(userKey)));

  // migrate from v1 (shownKeys)
  if (isRecord(parsed) && Array.isArray(parsed.shownKeys)) {
    const migrated: UsageCapState = {
      shown: parsed.shownKeys.length,
      examStarts: typeof parsed.examStarts === "number" ? parsed.examStarts : 0,
      updatedAt: Date.now(),
    };
    writeState(userKey, migrated);
    return migrated;
  }

  if (!isRecord(parsed)) return baseState();

  return {
    shown: typeof parsed.shown === "number" ? parsed.shown : 0,
    examStarts: typeof parsed.examStarts === "number" ? parsed.examStarts : 0,
    lastView:
      isRecord(parsed.lastView) &&
      typeof parsed.lastView.sig === "string" &&
      typeof parsed.lastView.at === "number"
        ? { sig: String(parsed.lastView.sig), at: Number(parsed.lastView.at) }
        : undefined,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
  };
}

function writeState(userKey: string, next: UsageCapState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(keyFor(userKey), JSON.stringify(next));
  } catch {
    // ignore quota/private mode
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {}
}

export function usageCapEventName() {
  return EVT;
}

export function migrateUsageCapToCanonical(
  canonicalUserKey: string,
  legacyUserKeys?: Array<string | null | undefined>
): UsageCapState {
  const canonicalKey = canonicalUserKey || "guest";
  if (typeof window === "undefined") return baseState();

  const sourceKeys = Array.from(
    new Set(
      (legacyUserKeys ?? [])
        .map((k) => String(k ?? "").trim())
        .filter(Boolean)
        .filter((k) => k !== canonicalKey)
    )
  );

  if (sourceKeys.length === 0) {
    return readState(canonicalKey);
  }

  const initial = readState(canonicalKey);
  let next = initial;
  const migration = readMigrationRecord(canonicalKey);
  let migrationChanged = false;

  for (const sourceKey of sourceKeys) {
    const source = readState(sourceKey);
    if (!hasStateData(source)) continue;

    const absorbed = migration.absorbed[sourceKey] ?? {
      shown: 0,
      examStarts: 0,
      updatedAt: 0,
    };

    const deltaShown = Math.max(0, source.shown - absorbed.shown);
    const deltaExamStarts = Math.max(0, source.examStarts - absorbed.examStarts);

    next = {
      ...next,
      shown: next.shown + deltaShown,
      examStarts: next.examStarts + deltaExamStarts,
      lastView: newestLastView(next.lastView, source.lastView),
      updatedAt: Math.max(next.updatedAt, source.updatedAt),
    };

    const snapshot = toSnapshot(source);
    if (!sameSnapshot(migration.absorbed[sourceKey], snapshot)) {
      migration.absorbed[sourceKey] = snapshot;
      migrationChanged = true;
    }
  }

  if (!sameState(initial, next)) {
    writeState(canonicalKey, next);
  }

  if (migrationChanged) {
    writeMigrationRecord(canonicalKey, migration);
  }

  return !sameState(initial, next) ? next : initial;
}

export function getUsageCapState(userKey: string): UsageCapState {
  return readState(userKey);
}

export function getUsageCapProgress(userKey: string) {
  const s = readState(userKey);
  return {
    shown: s.shown,
    shownMax: FREE_CAPS.questionsShown,
    examStarts: s.examStarts,
    examStartsMax: FREE_CAPS.examStarts,
  };
}

export function remainingQuestions(userKey: string) {
  const s = readState(userKey);
  return Math.max(0, FREE_CAPS.questionsShown - s.shown);
}

/**
 * Can we show the NEXT question?
 * New rule: we do NOT care if it's been seen before.
 */
export function canShowQuestion(userKey: string) {
  const s = readState(userKey);
  return s.shown < FREE_CAPS.questionsShown; // allow up to 420th display, block 421st
}

/**
 * Increment question shown (on display).
 * We accept a viewSig only to debounce accidental double-run.
 * This does NOT prevent counting the same question again later.
 */
export function markQuestionShown(userKey: string, viewSig?: string): UsageCapState {
  const prev = readState(userKey);
  const now = Date.now();

  if (viewSig && prev.lastView?.sig === viewSig && now - prev.lastView.at < 1500) {
    return prev; // debounce only
  }

  const next: UsageCapState = {
    ...prev,
    shown: prev.shown + 1,
    lastView: viewSig ? { sig: viewSig, at: now } : prev.lastView,
    updatedAt: now,
  };

  writeState(userKey, next);
  return next;
}

/**
 * Can we start a NEW exam?
 * - allows starts 1 through 10
 * - blocks the 11th start
 * - optional preflight: require remaining free questions >= requiredQuestions (e.g. 50)
 */
export function canStartExam(userKey: string, opts?: { requiredQuestions?: number }) {
  const s = readState(userKey);

  if (s.examStarts >= FREE_CAPS.examStarts) return false; // block 11th start

  const required = opts?.requiredQuestions ?? 0;
  if (required > 0 && remainingQuestions(userKey) < required) return false;

  return true;
}

export function incrementExamStart(userKey: string): UsageCapState {
  const prev = readState(userKey);
  const next: UsageCapState = {
    ...prev,
    examStarts: prev.examStarts + 1,
    updatedAt: Date.now(),
  };
  writeState(userKey, next);
  return next;
}
