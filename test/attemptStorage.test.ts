import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EXPIRE_AFTER_MS,
  normalizeUserKey,
  sampleWithoutReplacement,
  computeNextUnansweredIndex,
  getOrCreateAttempt,
  readAttemptById,
  writeAttempt,
  readActiveAttemptId,
  writeActiveAttemptId,
  listAttempts,
  migrateLocalAttemptsToCanonical,
  type TestAttemptV1,
} from "@/lib/test-engine/attemptStorage";

// ---------------------------------------------------------------------------
// CHARACTERIZATION tests for lib/test-engine/attemptStorage.ts
//
// These lock down the CURRENT behavior of the attempt lifecycle. `safeParse`,
// `isExpired`, and `markExpiredIfNeeded` are NOT exported, so they are
// characterized indirectly through the public API (readAttemptById /
// getOrCreateAttempt).
//
// Storage key layout (private constants, mirrored here only to construct
// synthetic localStorage state for migration/dedup tests):
//   attempt record : expatise:attempt:v1:id:<attemptId>
//   active pointer : expatise:attempt:v1:active:<userKey>:<modeKey>:<datasetId>:<datasetVersion>
// ---------------------------------------------------------------------------

const ATTEMPT_KEY_PREFIX = "expatise:attempt:v1:id";
const ACTIVE_PTR_PREFIX = "expatise:attempt:v1:active";

function attemptKeyById(attemptId: string) {
  return `${ATTEMPT_KEY_PREFIX}:${attemptId}`;
}
function activePtrKey(p: {
  userKey: string;
  modeKey: string;
  datasetId: string;
  datasetVersion: string;
}) {
  return `${ACTIVE_PTR_PREFIX}:${p.userKey}:${p.modeKey}:${p.datasetId}:${p.datasetVersion}`;
}

function makeAttempt(overrides: Partial<TestAttemptV1> = {}): TestAttemptV1 {
  const now = 1_000_000;
  return {
    schemaVersion: 1,
    attemptId: "att-1",
    userKey: "guest",
    modeKey: "real-test",
    datasetId: "ds-1",
    datasetVersion: "v1",
    questionIds: ["q1", "q2", "q3"],
    answersByQid: {},
    flaggedByQid: {},
    timeLimitSec: 2700,
    remainingSec: 2700,
    status: "in_progress",
    createdAt: now,
    lastActiveAt: now,
    ...overrides,
  };
}

const BASE_PARAMS = {
  userKey: "guest",
  modeKey: "real-test",
  datasetId: "ds-1",
  datasetVersion: "v1",
};

describe("normalizeUserKey", () => {
  it("trims, lowercases, and returns a real email", () => {
    expect(normalizeUserKey("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  it("falls back to 'guest' for null/undefined/empty/whitespace", () => {
    expect(normalizeUserKey(null)).toBe("guest");
    expect(normalizeUserKey(undefined)).toBe("guest");
    expect(normalizeUserKey("")).toBe("guest");
    expect(normalizeUserKey("   ")).toBe("guest");
  });
});

describe("EXPIRE_AFTER_MS constant", () => {
  it("is 30 minutes in ms", () => {
    expect(EXPIRE_AFTER_MS).toBe(30 * 60 * 1000);
  });
});

describe("computeNextUnansweredIndex", () => {
  it("returns 0 when nothing is answered", () => {
    const a = makeAttempt({ questionIds: ["q1", "q2", "q3"], answersByQid: {} });
    expect(computeNextUnansweredIndex(a)).toBe(0);
  });

  it("returns the index of the first unanswered question (order = questionIds order)", () => {
    const a = makeAttempt({
      questionIds: ["q1", "q2", "q3"],
      answersByQid: { q1: { choice: "A", answeredAt: 1 } },
    });
    expect(computeNextUnansweredIndex(a)).toBe(1);
  });

  it("skips answered ones even if a LATER question is answered and an EARLIER one is not", () => {
    // Characterizes that it walks questionIds order, not answer-insertion order.
    const a = makeAttempt({
      questionIds: ["q1", "q2", "q3"],
      answersByQid: { q3: { choice: "A", answeredAt: 1 } },
    });
    expect(computeNextUnansweredIndex(a)).toBe(0);
  });

  it("returns length when all are answered", () => {
    const a = makeAttempt({
      questionIds: ["q1", "q2"],
      answersByQid: {
        q1: { choice: "A", answeredAt: 1 },
        q2: { choice: "B", answeredAt: 2 },
      },
    });
    expect(computeNextUnansweredIndex(a)).toBe(2);
  });
});

describe("sampleWithoutReplacement", () => {
  it("throws when fewer ids than requested", () => {
    expect(() => sampleWithoutReplacement(["a", "b"], 3)).toThrow(
      /Not enough ids: have 2, need 3/,
    );
  });

  it("returns exactly n ids", () => {
    const out = sampleWithoutReplacement(["a", "b", "c", "d"], 2);
    expect(out).toHaveLength(2);
  });

  it("returns a subset with no duplicates (sampling WITHOUT replacement)", () => {
    const out = sampleWithoutReplacement(["a", "b", "c", "d", "e"], 4);
    expect(new Set(out).size).toBe(out.length);
    for (const id of out) expect(["a", "b", "c", "d", "e"]).toContain(id);
  });

  it("is deterministic for a fixed Math.random seed sequence", () => {
    // The function uses Math.random per draw. With a stubbed RNG the output
    // is fully determined. j = i + floor(rand * (len - i)).
    const ids = ["a", "b", "c", "d"]; // len 4
    const seq = [0, 0, 0]; // n=3 draws, each picks j = i (no swap)
    let k = 0;
    const spy = vi.spyOn(Math, "random").mockImplementation(() => seq[k++]);
    try {
      // i=0 -> j=0, i=1 -> j=1, i=2 -> j=2: no swaps, prefix preserved.
      expect(sampleWithoutReplacement(ids, 3)).toEqual(["a", "b", "c"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("same seed sequence yields identical results across calls", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const run = () => {
      let k = 0;
      const seq = [0.99, 0.5, 0.0];
      const spy = vi.spyOn(Math, "random").mockImplementation(() => seq[k++]);
      try {
        return sampleWithoutReplacement(ids, 3);
      } finally {
        spy.mockRestore();
      }
    };
    expect(run()).toEqual(run());
  });

  it("does not mutate the input array", () => {
    const ids = ["a", "b", "c"];
    const copy = [...ids];
    sampleWithoutReplacement(ids, 2);
    expect(ids).toEqual(copy);
  });
});

describe("readAttemptById / writeAttempt (round-trip + safeParse robustness)", () => {
  it("round-trips a written attempt", () => {
    const a = makeAttempt({ attemptId: "rt-1" });
    writeAttempt(a);
    expect(readAttemptById("rt-1")).toEqual(a);
  });

  it("returns null for a missing record", () => {
    expect(readAttemptById("does-not-exist")).toBeNull();
  });

  it("returns null for corrupt (non-JSON) stored value [safeParse swallows the error]", () => {
    window.localStorage.setItem(attemptKeyById("corrupt"), "{not json");
    expect(readAttemptById("corrupt")).toBeNull();
  });

  it("returns null when schemaVersion does not match SCHEMA_VERSION (1)", () => {
    window.localStorage.setItem(
      attemptKeyById("oldver"),
      JSON.stringify({ ...makeAttempt(), schemaVersion: 2 }),
    );
    expect(readAttemptById("oldver")).toBeNull();
  });
});

describe("getOrCreateAttempt - fresh creation", () => {
  it("creates a fresh in_progress attempt when no active pointer exists", () => {
    const { attempt, reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4", "q5"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    expect(attempt.status).toBe("in_progress");
    expect(attempt.questionIds).toHaveLength(3);
    expect(attempt.remainingSec).toBe(2700);
    expect(attempt.timeLimitSec).toBe(2700);
    expect(attempt.answersByQid).toEqual({});
    // Pointer now points at the fresh attempt.
    expect(readActiveAttemptId(BASE_PARAMS)).toBe(attempt.attemptId);
    // Record is persisted under its id.
    expect(readAttemptById(attempt.attemptId)).not.toBeNull();
  });
});

describe("getOrCreateAttempt - reuse via the `valid` predicate", () => {
  function seedActive(overrides: Partial<TestAttemptV1> = {}) {
    const a = makeAttempt({ attemptId: "active-1", ...overrides });
    writeAttempt(a);
    writeActiveAttemptId({ ...BASE_PARAMS, attemptId: a.attemptId });
    return a;
  }

  it("reuses a still-valid in_progress attempt and bumps it to in_progress/clears pausedAt", () => {
    const now = Date.now();
    seedActive({ lastActiveAt: now, createdAt: now, status: "paused", pausedAt: now });

    const { attempt, reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(true);
    expect(attempt.attemptId).toBe("active-1");
    expect(attempt.status).toBe("in_progress");
    expect(attempt.pausedAt).toBeUndefined();
  });

  it("does NOT reuse when questionCount differs (count mismatch -> fresh, pointer cleared then re-set)", () => {
    seedActive({ lastActiveAt: Date.now(), createdAt: Date.now() });

    const { attempt, reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 4, // seeded attempt has 3
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    expect(attempt.attemptId).not.toBe("active-1");
    expect(attempt.questionIds).toHaveLength(4);
  });

  it("does NOT reuse when a questionId is no longer in allQuestionIds", () => {
    seedActive({
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      questionIds: ["q1", "q2", "qX"], // qX dropped from the pool
    });

    const { reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
  });

  it("does NOT reuse when timeLimitSec differs (config change invalidates)", () => {
    seedActive({ lastActiveAt: Date.now(), createdAt: Date.now(), timeLimitSec: 2700 });

    const { reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 1800, // changed
    });

    expect(reused).toBe(false);
  });

  it("does NOT reuse a submitted attempt; creates a fresh one", () => {
    seedActive({
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
      status: "submitted",
      submittedAt: Date.now(),
    });

    const { reused, attempt } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    expect(attempt.status).toBe("in_progress");
  });

  it("does NOT reuse when the active pointer is dangling (record missing); clears pointer then creates fresh", () => {
    // Pointer present but no record behind it.
    writeActiveAttemptId({ ...BASE_PARAMS, attemptId: "ghost" });
    expect(readActiveAttemptId(BASE_PARAMS)).toBe("ghost");

    const { reused, attempt } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    // New pointer points at the fresh attempt, not the ghost.
    expect(readActiveAttemptId(BASE_PARAMS)).toBe(attempt.attemptId);
    expect(readActiveAttemptId(BASE_PARAMS)).not.toBe("ghost");
  });
});

describe("getOrCreateAttempt - expiry (isExpired / markExpiredIfNeeded, characterized indirectly)", () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => {
    nowSpy?.mockRestore();
  });

  it("expires an attempt inactive >= EXPIRE_AFTER_MS, marks the record 'expired', and creates a fresh one", () => {
    const t0 = 5_000_000;
    const stale = makeAttempt({
      attemptId: "stale-1",
      status: "in_progress",
      createdAt: t0,
      lastActiveAt: t0,
    });
    writeAttempt(stale);
    writeActiveAttemptId({ ...BASE_PARAMS, attemptId: "stale-1" });

    // Jump past the expiry window.
    nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0 + EXPIRE_AFTER_MS + 1);

    const { reused, attempt } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    expect(attempt.attemptId).not.toBe("stale-1");
    // The stale record is now persisted as 'expired'.
    expect(readAttemptById("stale-1")?.status).toBe("expired");
  });

  it("does NOT expire an attempt still within the window (boundary: exactly EXPIRE_AFTER_MS - 1)", () => {
    const t0 = 6_000_000;
    const fresh = makeAttempt({
      attemptId: "young-1",
      status: "in_progress",
      createdAt: t0,
      lastActiveAt: t0,
    });
    writeAttempt(fresh);
    writeActiveAttemptId({ ...BASE_PARAMS, attemptId: "young-1" });

    nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0 + EXPIRE_AFTER_MS - 1);

    const { reused, attempt } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(true);
    expect(attempt.attemptId).toBe("young-1");
  });

  it("uses pausedAt as the inactivity anchor when present (a long-paused attempt expires)", () => {
    const t0 = 7_000_000;
    const paused = makeAttempt({
      attemptId: "paused-1",
      status: "paused",
      createdAt: t0,
      // lastActiveAt is recent, but pausedAt is old -> pausedAt wins.
      lastActiveAt: t0 + EXPIRE_AFTER_MS,
      pausedAt: t0,
    });
    writeAttempt(paused);
    writeActiveAttemptId({ ...BASE_PARAMS, attemptId: "paused-1" });

    nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0 + EXPIRE_AFTER_MS + 1);

    const { reused } = getOrCreateAttempt({
      ...BASE_PARAMS,
      allQuestionIds: ["q1", "q2", "q3", "q4"],
      questionCount: 3,
      timeLimitSec: 2700,
    });

    expect(reused).toBe(false);
    expect(readAttemptById("paused-1")?.status).toBe("expired");
  });
});

describe("listAttempts", () => {
  it("returns only schemaVersion-1 attempt records, filtered and sorted newest-first by default", () => {
    writeAttempt(makeAttempt({ attemptId: "a", userKey: "u1", lastActiveAt: 100 }));
    writeAttempt(makeAttempt({ attemptId: "b", userKey: "u1", lastActiveAt: 300 }));
    writeAttempt(makeAttempt({ attemptId: "c", userKey: "u2", lastActiveAt: 200 }));
    // unrelated key should be ignored
    window.localStorage.setItem("some:other:key", "noise");

    const u1 = listAttempts({ userKey: "u1" });
    expect(u1.map((a) => a.attemptId)).toEqual(["b", "a"]); // newest first
  });

  it("supports oldest sort", () => {
    writeAttempt(makeAttempt({ attemptId: "a", userKey: "u1", lastActiveAt: 100 }));
    writeAttempt(makeAttempt({ attemptId: "b", userKey: "u1", lastActiveAt: 300 }));
    const u1 = listAttempts({ userKey: "u1", sort: "oldest" });
    expect(u1.map((a) => a.attemptId)).toEqual(["a", "b"]);
  });
});

describe("migrateLocalAttemptsToCanonical (pointer/dedup)", () => {
  it("rewrites legacy attempt records' userKey to the canonical key", () => {
    const legacy = makeAttempt({
      attemptId: "leg-1",
      userKey: "legacy@x.com",
      status: "in_progress",
    });
    writeAttempt(legacy);

    migrateLocalAttemptsToCanonical({
      userKey: "canon@x.com",
      legacyUserKeys: ["legacy@x.com"],
    });

    expect(readAttemptById("leg-1")?.userKey).toBe("canon@x.com");
  });

  it("is a no-op when there are no distinct legacy keys", () => {
    const a = makeAttempt({ attemptId: "noop-1", userKey: "canon@x.com" });
    writeAttempt(a);
    migrateLocalAttemptsToCanonical({
      userKey: "canon@x.com",
      legacyUserKeys: ["canon@x.com", "", "  "],
    });
    expect(readAttemptById("noop-1")?.userKey).toBe("canon@x.com");
  });

  it("dedups pointers into the canonical slot, picking the most-recently-active in_progress attempt and removing legacy pointers", () => {
    const slot = {
      modeKey: "real-test",
      datasetId: "ds-1",
      datasetVersion: "v1",
    };
    // Two legacy attempts in the same mode/dataset slot, different recency.
    const older = makeAttempt({
      attemptId: "old",
      userKey: "legacy@x.com",
      status: "in_progress",
      lastActiveAt: 100,
      ...slot,
    });
    const newer = makeAttempt({
      attemptId: "new",
      userKey: "legacy@x.com",
      status: "in_progress",
      lastActiveAt: 999,
      ...slot,
    });
    writeAttempt(older);
    writeAttempt(newer);

    // Legacy pointers pointing at each.
    window.localStorage.setItem(
      activePtrKey({ userKey: "legacy@x.com", ...slot }),
      "new",
    );
    // A second legacy key's pointer at the older record.
    window.localStorage.setItem(
      activePtrKey({ userKey: "legacy2@x.com", ...slot }),
      "old",
    );

    migrateLocalAttemptsToCanonical({
      userKey: "canon@x.com",
      legacyUserKeys: ["legacy@x.com", "legacy2@x.com"],
    });

    // Canonical pointer points at the newest valid candidate.
    const canonPtr = readActiveAttemptId({ userKey: "canon@x.com", ...slot });
    expect(canonPtr).toBe("new");

    // Legacy pointers are removed.
    expect(
      window.localStorage.getItem(activePtrKey({ userKey: "legacy@x.com", ...slot })),
    ).toBeNull();
    expect(
      window.localStorage.getItem(activePtrKey({ userKey: "legacy2@x.com", ...slot })),
    ).toBeNull();
  });

  it("removes the canonical pointer when no valid (in_progress/paused) candidate exists", () => {
    const slot = {
      modeKey: "real-test",
      datasetId: "ds-1",
      datasetVersion: "v1",
    };
    // A submitted legacy attempt -> not a valid resume candidate.
    writeAttempt(
      makeAttempt({
        attemptId: "done",
        userKey: "legacy@x.com",
        status: "submitted",
        submittedAt: 500,
        lastActiveAt: 500,
        ...slot,
      }),
    );
    // Pre-existing canonical pointer that should get cleared.
    window.localStorage.setItem(
      activePtrKey({ userKey: "canon@x.com", ...slot }),
      "done",
    );
    window.localStorage.setItem(
      activePtrKey({ userKey: "legacy@x.com", ...slot }),
      "done",
    );

    migrateLocalAttemptsToCanonical({
      userKey: "canon@x.com",
      legacyUserKeys: ["legacy@x.com"],
    });

    expect(
      window.localStorage.getItem(activePtrKey({ userKey: "canon@x.com", ...slot })),
    ).toBeNull();
  });
});
