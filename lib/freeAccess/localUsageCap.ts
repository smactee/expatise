// lib/freeAccess/localUsageCap.ts
"use client";

export const FREE_CAPS = {
  questionsShown: 250,
  examStarts: 5,
} as const;

export type UsageCapState = {
  shown: number;         // counts every question display
  examStarts: number;    // counts only when starting a NEW exam (reused === false)
  lastView?: { sig: string; at: number }; // tiny debounce to avoid accidental double-count
  updatedAt: number;
};

const EVT = "expatise:usagecap-changed";
const keyFor = (userKey: string) => `expatise:usagecap:v2:user:${userKey || "guest"}`;

function safeParse(raw: string | null): any {
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

/**
 * Migration:
 * - If you previously stored shownKeys[], migrate shown = shownKeys.length.
 * - Keep examStarts if present.
 */
function readState(userKey: string): UsageCapState {
  if (typeof window === "undefined") return baseState();

  const parsed = safeParse(localStorage.getItem(keyFor(userKey)));

  // migrate from v1 (shownKeys)
  if (parsed && Array.isArray(parsed.shownKeys)) {
    const migrated: UsageCapState = {
      shown: parsed.shownKeys.length,
      examStarts: typeof parsed.examStarts === "number" ? parsed.examStarts : 0,
      updatedAt: Date.now(),
    };
    writeState(userKey, migrated);
    return migrated;
  }

  if (!parsed) return baseState();

  return {
    shown: typeof parsed.shown === "number" ? parsed.shown : 0,
    examStarts: typeof parsed.examStarts === "number" ? parsed.examStarts : 0,
    lastView:
      parsed.lastView && typeof parsed.lastView.sig === "string" && typeof parsed.lastView.at === "number"
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
 * - blocks the 6th start
 * - optional preflight: require remaining free questions >= requiredQuestions (e.g. 50)
 */
export function canStartExam(userKey: string, opts?: { requiredQuestions?: number }) {
  const s = readState(userKey);

  if (s.examStarts >= FREE_CAPS.examStarts) return false; // block 6th start

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
