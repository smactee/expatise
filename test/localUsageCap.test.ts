import { describe, it, expect, afterEach, vi } from "vitest";
import {
  FREE_CAPS,
  usageCapEventName,
  getUsageCapState,
  getUsageCapProgress,
  remainingQuestions,
  canShowQuestion,
  markQuestionShown,
  canStartExam,
  incrementExamStart,
  migrateUsageCapToCanonical,
} from "@/lib/freeAccess/localUsageCap";

// ---------------------------------------------------------------------------
// CHARACTERIZATION tests for lib/freeAccess/localUsageCap.ts
//
// Free-tier accounting: `shown` (question displays, cap 420) and `examStarts`
// (cap 10). State key: expatise:usagecap:v2:user:<userKey || "guest">.
// `safeParse`, `readState`/`writeState` are private and characterized via the
// public getters/mutators and migrate function.
// ---------------------------------------------------------------------------

const stateKey = (userKey: string) =>
  `expatise:usagecap:v2:user:${userKey || "guest"}`;

describe("FREE_CAPS + event name", () => {
  it("exposes the current cap constants", () => {
    expect(FREE_CAPS.questionsShown).toBe(420);
    expect(FREE_CAPS.examStarts).toBe(10);
  });
  it("exposes the change event name", () => {
    expect(usageCapEventName()).toBe("expatise:usagecap-changed");
  });
});

describe("baseline (no stored state)", () => {
  it("getUsageCapState returns a zeroed base state", () => {
    expect(getUsageCapState("guest")).toEqual({
      shown: 0,
      examStarts: 0,
      updatedAt: 0,
    });
  });

  it("getUsageCapProgress reports zero usage against the caps", () => {
    expect(getUsageCapProgress("u@x.com")).toEqual({
      shown: 0,
      shownMax: 420,
      examStarts: 0,
      examStartsMax: 10,
    });
  });

  it("remainingQuestions is the full cap", () => {
    expect(remainingQuestions("guest")).toBe(420);
  });

  it("canShowQuestion is true and canStartExam is true at baseline", () => {
    expect(canShowQuestion("guest")).toBe(true);
    expect(canStartExam("guest")).toBe(true);
  });
});

describe("markQuestionShown", () => {
  it("increments shown by 1 and stamps updatedAt", () => {
    const next = markQuestionShown("guest");
    expect(next.shown).toBe(1);
    expect(next.updatedAt).toBeGreaterThan(0);
    expect(remainingQuestions("guest")).toBe(419);
  });

  it("records lastView when a viewSig is provided", () => {
    const next = markQuestionShown("guest", "q1#0");
    expect(next.lastView?.sig).toBe("q1#0");
    expect(typeof next.lastView?.at).toBe("number");
  });

  it("debounces a repeat of the SAME viewSig within 1500ms (does NOT increment)", () => {
    let t = 1_000_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => t);
    try {
      const first = markQuestionShown("guest", "same-sig");
      expect(first.shown).toBe(1);

      t += 500; // < 1500ms later, same sig
      const second = markQuestionShown("guest", "same-sig");
      expect(second.shown).toBe(1); // debounced
    } finally {
      spy.mockRestore();
    }
  });

  it("does NOT debounce once 1500ms have elapsed", () => {
    let t = 2_000_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => t);
    try {
      markQuestionShown("guest", "sig-a"); // shown=1
      t += 1500; // exactly 1500 -> NOT < 1500 -> counts
      const after = markQuestionShown("guest", "sig-a");
      expect(after.shown).toBe(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("does NOT debounce when the viewSig differs", () => {
    markQuestionShown("guest", "sig-1");
    const after = markQuestionShown("guest", "sig-2");
    expect(after.shown).toBe(2);
  });

  it("counts up to the cap and then blocks the next display", () => {
    // Seed near the cap directly to avoid 420 iterations.
    window.localStorage.setItem(
      stateKey("guest"),
      JSON.stringify({ shown: 419, examStarts: 0, updatedAt: 1 }),
    );
    expect(canShowQuestion("guest")).toBe(true); // 419 < 420
    markQuestionShown("guest"); // -> 420
    expect(remainingQuestions("guest")).toBe(0);
    expect(canShowQuestion("guest")).toBe(false); // 420 is NOT < 420
  });
});

describe("exam-start accounting", () => {
  it("incrementExamStart bumps examStarts", () => {
    const next = incrementExamStart("guest");
    expect(next.examStarts).toBe(1);
  });

  it("canStartExam allows starts 1..10 and blocks the 11th", () => {
    window.localStorage.setItem(
      stateKey("guest"),
      JSON.stringify({ shown: 0, examStarts: 9, updatedAt: 1 }),
    );
    expect(canStartExam("guest")).toBe(true); // 9 < 10
    incrementExamStart("guest"); // -> 10
    expect(canStartExam("guest")).toBe(false); // 10 >= 10
  });

  it("canStartExam with requiredQuestions preflight blocks when remaining < required", () => {
    window.localStorage.setItem(
      stateKey("guest"),
      JSON.stringify({ shown: 400, examStarts: 0, updatedAt: 1 }),
    );
    // remaining = 20
    expect(canStartExam("guest", { requiredQuestions: 50 })).toBe(false);
    expect(canStartExam("guest", { requiredQuestions: 20 })).toBe(true);
    expect(canStartExam("guest", { requiredQuestions: 0 })).toBe(true);
  });
});

describe("readState migration from v1 shownKeys[] (characterized via getUsageCapState)", () => {
  it("migrates legacy shownKeys[] to shown = shownKeys.length and preserves examStarts", () => {
    window.localStorage.setItem(
      stateKey("guest"),
      JSON.stringify({ shownKeys: ["a", "b", "c"], examStarts: 4 }),
    );
    const s = getUsageCapState("guest");
    expect(s.shown).toBe(3);
    expect(s.examStarts).toBe(4);
    // and it rewrites storage in the new shape (no shownKeys anymore)
    const reread = JSON.parse(window.localStorage.getItem(stateKey("guest"))!);
    expect(reread.shownKeys).toBeUndefined();
    expect(reread.shown).toBe(3);
  });
});

describe("migrateUsageCapToCanonical (absorb legacy usage, idempotently)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns canonical state unchanged when there are no distinct legacy keys", () => {
    window.localStorage.setItem(
      stateKey("canon"),
      JSON.stringify({ shown: 5, examStarts: 1, updatedAt: 10 }),
    );
    const out = migrateUsageCapToCanonical("canon", ["canon", "", null]);
    expect(out.shown).toBe(5);
    expect(out.examStarts).toBe(1);
  });

  it("absorbs a legacy key's shown+examStarts into the canonical totals", () => {
    window.localStorage.setItem(
      stateKey("canon"),
      JSON.stringify({ shown: 2, examStarts: 1, updatedAt: 10 }),
    );
    window.localStorage.setItem(
      stateKey("legacy"),
      JSON.stringify({ shown: 7, examStarts: 3, updatedAt: 20 }),
    );

    const out = migrateUsageCapToCanonical("canon", ["legacy"]);
    expect(out.shown).toBe(9); // 2 + 7
    expect(out.examStarts).toBe(4); // 1 + 3
    expect(out.updatedAt).toBe(20); // max(10, 20)
    // persisted
    expect(getUsageCapState("canon").shown).toBe(9);
  });

  it("is idempotent: re-running with the same unchanged legacy state does NOT double-count", () => {
    window.localStorage.setItem(
      stateKey("canon"),
      JSON.stringify({ shown: 0, examStarts: 0, updatedAt: 0 }),
    );
    window.localStorage.setItem(
      stateKey("legacy"),
      JSON.stringify({ shown: 5, examStarts: 2, updatedAt: 50 }),
    );

    const first = migrateUsageCapToCanonical("canon", ["legacy"]);
    expect(first.shown).toBe(5);
    const second = migrateUsageCapToCanonical("canon", ["legacy"]);
    expect(second.shown).toBe(5); // unchanged -> no re-absorption
    expect(second.examStarts).toBe(2);
  });

  it("only absorbs the DELTA when a legacy key grows after a prior migration", () => {
    window.localStorage.setItem(
      stateKey("canon"),
      JSON.stringify({ shown: 0, examStarts: 0, updatedAt: 0 }),
    );
    window.localStorage.setItem(
      stateKey("legacy"),
      JSON.stringify({ shown: 5, examStarts: 1, updatedAt: 50 }),
    );
    migrateUsageCapToCanonical("canon", ["legacy"]); // absorbs 5/1

    // legacy grows to 8/3
    window.localStorage.setItem(
      stateKey("legacy"),
      JSON.stringify({ shown: 8, examStarts: 3, updatedAt: 60 }),
    );
    const out = migrateUsageCapToCanonical("canon", ["legacy"]);
    expect(out.shown).toBe(8); // 5 + delta(3)
    expect(out.examStarts).toBe(3); // 1 + delta(2)
  });

  it("ignores empty legacy state (hasStateData false) and leaves canonical untouched", () => {
    window.localStorage.setItem(
      stateKey("canon"),
      JSON.stringify({ shown: 4, examStarts: 2, updatedAt: 10 }),
    );
    // legacy has no data at all
    const out = migrateUsageCapToCanonical("canon", ["empty-legacy"]);
    expect(out.shown).toBe(4);
    expect(out.examStarts).toBe(2);
  });
});
