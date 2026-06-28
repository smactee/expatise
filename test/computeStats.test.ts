import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeStats, type AttemptLike } from "@/lib/stats/computeStats";
import type { Question } from "@/lib/qbank/types";
import { timeKey } from "@/lib/stats/timeKeys";

// ---------------------------------------------------------------------------
// CHARACTERIZATION / SNAPSHOT tests for lib/stats/computeStats.ts
//
// This is the guard for the upcoming dead-field-removal pass: it feeds a small
// FIXED synthetic input and asserts as many StatsVM output fields as is
// reasonable so that removing a still-needed field would break a test.
//
// Determinism notes:
// - We FREEZE Date.now() so timeframe filtering and "today"/streak windows are
//   stable.
// - Attempt timestamps are built from LOCAL Date(...) constructors so
//   day/week/hour bucketing is correct regardless of the runner's timezone.
// - deriveTopicSubtags is a pure keyword classifier (no data files). The chosen
//   prompts classify deterministically (verified):
//     "driving license penalty point ... test"  -> road-safety:license
//     "traffic accident ... report to the police ... leave the scene; injured"
//                                                -> road-safety:accidents
// ---------------------------------------------------------------------------

// A fixed "now": Wednesday 2024-06-12, 10:00 local.
const NOW = new Date(2024, 5, 12, 10, 0, 0, 0).getTime();

function freezeNow() {
  return vi.spyOn(Date, "now").mockReturnValue(NOW);
}

// --- Synthetic questions ---------------------------------------------------

function licenseMcq(id: string, correctOptionId: string): Question {
  return {
    id,
    number: 1,
    type: "MCQ",
    prompt: "A driving license penalty point question about test.",
    sourcePrompt: "A driving license penalty point question about test.",
    options: [
      { id: `${id}-a`, text: "alpha", originalKey: "A" },
      { id: `${id}-b`, text: "bravo", originalKey: "B" },
    ],
    sourceOptions: [],
    correctRow: null,
    correctOptionId,
    assets: [],
    tags: [],
    autoTags: [],
  };
}

function accidentMcq(id: string, correctOptionId: string): Question {
  return {
    id,
    number: 1,
    type: "MCQ",
    prompt:
      "After a traffic accident you must report to the police and not leave the scene; injured.",
    sourcePrompt:
      "After a traffic accident you must report to the police and not leave the scene; injured.",
    options: [
      { id: `${id}-a`, text: "alpha", originalKey: "A" },
      { id: `${id}-b`, text: "bravo", originalKey: "B" },
    ],
    sourceOptions: [],
    correctRow: null,
    correctOptionId,
    assets: [],
    tags: [],
    autoTags: [],
  };
}

const ALL_MODES = ["real-test", "half-test", "rapid-fire-test"];

describe("computeStats", () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nowSpy = freezeNow();
  });
  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe("empty input", () => {
    it("returns a fully-formed zeroed StatsVM with all keys present", () => {
      const vm = computeStats({
        attempts: [],
        questions: [],
        filters: { timeframeDays: "all", includeModeKeys: ALL_MODES },
      });

      // Scalar zeros
      expect(vm.attemptsCount).toBe(0);
      expect(vm.attemptedTotal).toBe(0);
      expect(vm.correctTotal).toBe(0);
      expect(vm.accuracy).toBe(0);
      expect(vm.accuracyPct).toBe(0);
      expect(vm.scoreAvg).toBe(0);
      expect(vm.scoreBest).toBe(0);
      expect(vm.scoreLatest).toBe(0);
      expect(vm.readinessPct).toBe(0);
      expect(vm.timeInTimedTestsSec).toBe(0);

      // Series exist and are empty (except the always-filled windows)
      expect(vm.scoreSeries).toEqual([]);
      expect(vm.weeklySeries).toEqual([]);
      expect(vm.bestWeekQuestions).toBe(0);
      expect(vm.consistencyStreakWeeks).toBe(0);
      expect(vm.bestDayQuestions).toBe(0);
      expect(vm.consistencyStreakDays).toBe(0);

      // dailySeries (all-timeframe, no data) -> a single day (today)
      expect(vm.dailySeries).toHaveLength(1);

      // bestTimeSeries always has the 7 fixed buckets
      expect(vm.bestTimeSeries).toHaveLength(7);
      expect(vm.bestTimeSeries.map((b) => b.label)).toEqual([
        "6–9",
        "9–12",
        "12–15",
        "15–18",
        "18–21",
        "21–24",
        "0–6",
      ]);
      expect(vm.bestTimeLabel).toBeNull();
      expect(vm.bestTimeAvgScore).toBe(0);

      // Topic mastery present but empty
      expect(vm.weakTopics).toEqual([]);
      expect(vm.topicMastery).toBeDefined();
      expect(vm.topicMastery!.minAttempted).toBe(10);
      expect(vm.topicMastery!.topics).toEqual([]);
      expect(vm.topicMastery!.weakestSubtopics).toEqual([]);

      // Heatmap structure: 4 dayParts x 7 weekdays
      expect(vm.Heatmap.weekdays).toHaveLength(7);
      expect(vm.Heatmap.dayParts.map((p) => p.key)).toEqual([
        "morning",
        "midday",
        "evening",
        "late",
      ]);
      expect(vm.Heatmap.cells).toHaveLength(4);
      expect(vm.Heatmap.cells[0]).toHaveLength(7);
      expect(vm.Heatmap.best).toBeNull();
      expect(vm.Heatmap.lowConfidenceNote).toBe("Not enough data yet.");

      // Time-log series: always a 7-day window
      expect(vm.timeDailySeries).toHaveLength(7);
      expect(vm.timeThisWeekMin).toBe(0);
      expect(vm.timeBestDayMin).toBe(0);
      expect(vm.timeStreakDays).toBe(0);
      expect(vm.deliberateThisWeekMin).toBe(0);
      expect(vm.studyThisWeekMin).toBe(0);
    });
  });

  describe("only submitted + allowed-mode + in-timeframe attempts are counted", () => {
    it("excludes in_progress, disallowed mode, and out-of-timeframe attempts", () => {
      const q = licenseMcq("q1", "q1-a"); // correct = option A
      const baseTime = new Date(2024, 5, 12, 9, 0, 0, 0).getTime(); // today 09:00

      const attempts: AttemptLike[] = [
        {
          status: "submitted",
          submittedAt: baseTime,
          modeKey: "real-test",
          questionIds: ["q1"],
          answersByQid: { q1: { choice: "A", answeredAt: baseTime } }, // correct
        },
        {
          status: "in_progress", // excluded: not submitted
          submittedAt: baseTime,
          modeKey: "real-test",
          questionIds: ["q1"],
          answersByQid: { q1: { choice: "A", answeredAt: baseTime } },
        },
        {
          status: "submitted",
          submittedAt: baseTime,
          modeKey: "some-other-mode", // excluded: mode not allowed
          questionIds: ["q1"],
          answersByQid: { q1: { choice: "A", answeredAt: baseTime } },
        },
        {
          status: "submitted",
          submittedAt: new Date(2024, 0, 1, 9, 0, 0, 0).getTime(), // excluded: >7d ago
          modeKey: "real-test",
          questionIds: ["q1"],
          answersByQid: { q1: { choice: "A", answeredAt: 0 } },
        },
      ];

      const vm = computeStats({
        attempts,
        questions: [q],
        filters: { timeframeDays: 7, includeModeKeys: ["real-test"] },
      });

      expect(vm.attemptsCount).toBe(1);
      expect(vm.attemptedTotal).toBe(1);
      expect(vm.correctTotal).toBe(1);
    });
  });

  describe("accuracy + score fields on a fixed multi-attempt input", () => {
    // Two submitted attempts, all in real-test, all within the last 7 days.
    // Attempt 1 (today 09:00): 2 questions, 1 correct -> score 50
    // Attempt 2 (yesterday 20:00): 2 questions, 2 correct -> score 100
    const q1 = licenseMcq("q1", "q1-a"); // correct = A
    const q2 = licenseMcq("q2", "q2-a"); // correct = A

    const t1 = new Date(2024, 5, 12, 9, 0, 0, 0).getTime(); // today 09:00 (bucket "9–12")
    const t2 = new Date(2024, 5, 11, 20, 0, 0, 0).getTime(); // yesterday 20:00 (bucket "18–21")

    const attempts: AttemptLike[] = [
      {
        status: "submitted",
        submittedAt: t1,
        modeKey: "real-test",
        questionIds: ["q1", "q2"],
        timeLimitSec: 600,
        remainingSec: 200,
        answersByQid: {
          q1: { choice: "A", answeredAt: t1 }, // correct
          q2: { choice: "B", answeredAt: t1 }, // wrong
        },
      },
      {
        status: "submitted",
        submittedAt: t2,
        modeKey: "real-test",
        questionIds: ["q1", "q2"],
        timeLimitSec: 600,
        remainingSec: 600,
        answersByQid: {
          q1: { choice: "A", answeredAt: t2 }, // correct
          q2: { choice: "A", answeredAt: t2 }, // correct
        },
      },
    ];

    function run() {
      return computeStats({
        attempts,
        questions: [q1, q2],
        filters: { timeframeDays: 7, includeModeKeys: ["real-test"] },
      });
    }

    it("counts attempts and aggregate grading totals", () => {
      const vm = run();
      expect(vm.attemptsCount).toBe(2);
      expect(vm.attemptedTotal).toBe(4); // 2 + 2 answered
      expect(vm.correctTotal).toBe(3); // 1 + 2 correct
    });

    it("computes accuracy = correct/attempted and its percent", () => {
      const vm = run();
      expect(vm.accuracy).toBeCloseTo(3 / 4, 10);
      expect(vm.accuracyPct).toBe(75);
    });

    it("computes per-attempt score series sorted by time ascending", () => {
      const vm = run();
      expect(vm.scoreSeries).toHaveLength(2);
      // sorted ascending by t: yesterday(100) then today(50)
      expect(vm.scoreSeries[0]).toEqual({
        t: t2,
        scorePct: 100,
        answered: 2,
        totalQ: 2,
      });
      expect(vm.scoreSeries[1]).toEqual({
        t: t1,
        scorePct: 50,
        answered: 2,
        totalQ: 2,
      });
    });

    it("computes scoreAvg / scoreBest / scoreLatest", () => {
      const vm = run();
      expect(vm.scoreAvg).toBe(75); // (50 + 100) / 2
      expect(vm.scoreBest).toBe(100);
      // scoreLatest uses scoreList[0], which follows `filtered` (newest first):
      // newest attempt is today's (score 50).
      expect(vm.scoreLatest).toBe(50);
    });

    it("computes readinessPct = round(100 * (0.7*acc + 0.3*median/100))", () => {
      const vm = run();
      // acc01 = 0.75 ; scores [100,50] median = 75 -> 0.75
      // readiness01 = 0.7*0.75 + 0.3*0.75 = 0.75 -> 75
      expect(vm.readinessPct).toBe(75);
    });

    it("accumulates timed-test time as (timeLimitSec - remainingSec)", () => {
      const vm = run();
      // attempt1: 600-200=400 ; attempt2: 600-600=0
      expect(vm.timeInTimedTestsSec).toBe(400);
    });

    it("buckets best-time-of-day by local submit hour", () => {
      const vm = run();
      const byLabel = Object.fromEntries(
        vm.bestTimeSeries.map((b) => [b.label, b]),
      );
      expect(byLabel["9–12"].attemptsCount).toBe(1); // today 09:00 -> 50
      expect(byLabel["9–12"].avgScore).toBe(50);
      expect(byLabel["18–21"].attemptsCount).toBe(1); // yesterday 20:00 -> 100
      expect(byLabel["18–21"].avgScore).toBe(100);
      // best time = highest avgScore bucket
      expect(vm.bestTimeLabel).toBe("18–21");
      expect(vm.bestTimeAvgScore).toBe(100);
    });

    it("buckets daily series and reports best day + day streak", () => {
      const vm = run();
      // timeframe 7 -> 7 day window ending today
      expect(vm.dailySeries).toHaveLength(7);
      const totalsByAnswered = vm.dailySeries.map((d) => d.questionsAnswered);
      // two days have data: yesterday (2) and today (2)
      expect(totalsByAnswered.filter((n) => n > 0)).toEqual([2, 2]);
      expect(vm.bestDayQuestions).toBe(2);
      // consecutive days ending today with answers: today + yesterday = 2
      expect(vm.consistencyStreakDays).toBe(2);
    });

    it("buckets weekly series and reports best week + week streak", () => {
      const vm = run();
      // both attempts in the same Mon-anchored week
      expect(vm.weeklySeries).toHaveLength(1);
      expect(vm.weeklySeries[0].testsCompleted).toBe(2);
      expect(vm.weeklySeries[0].questionsAnswered).toBe(4);
      expect(vm.bestWeekQuestions).toBe(4);
      expect(vm.consistencyStreakWeeks).toBe(1);
    });

    it("populates the heatmap cells for the active (weekday, dayPart) buckets and picks a best", () => {
      const vm = run();
      // Find any non-empty cell; there must be exactly 2 attempts spread across cells.
      const activeCells = vm.Heatmap.cells
        .flat()
        .filter((c) => c.attemptsCount > 0);
      const totalAttemptsInHeatmap = activeCells.reduce(
        (s, c) => s + c.attemptsCount,
        0,
      );
      expect(totalAttemptsInHeatmap).toBe(2);
      expect(vm.Heatmap.best).not.toBeNull();
      // both attempts in distinct cells (different days/hours) -> best is the 100 one
      expect(vm.Heatmap.best!.avgScore).toBe(100);
      // low confidence note fires (< 3 tests in the best cell)
      expect(vm.Heatmap.lowConfidenceNote).toMatch(/Low confidence/);
    });
  });

  describe("topic mastery thresholding (MIN_TOPIC_ATTEMPTED = 10)", () => {
    it("includes a subtopic in weakTopics/weakestSubtopics only once attempted >= 10", () => {
      // Build ONE attempt that answers 12 distinct license questions (10 correct,
      // 2 wrong) -> subtopic road-safety:license attempted=12.
      const questions: Question[] = [];
      const answersByQid: Record<string, { choice: string; answeredAt: number }> =
        {};
      const t = new Date(2024, 5, 12, 9, 0, 0, 0).getTime();
      for (let i = 0; i < 12; i++) {
        const id = `lic${i}`;
        questions.push(licenseMcq(id, `${id}-a`)); // correct = A
        // first 10 correct (A), last 2 wrong (B)
        answersByQid[id] = { choice: i < 10 ? "A" : "B", answeredAt: t };
      }

      const attempts: AttemptLike[] = [
        {
          status: "submitted",
          submittedAt: t,
          modeKey: "real-test",
          questionIds: questions.map((q) => q.id),
          answersByQid,
        },
      ];

      const vm = computeStats({
        attempts,
        questions,
        filters: { timeframeDays: "all", includeModeKeys: ["real-test"] },
      });

      // weakTopics: subtopic-level entries with attempted >= 10
      expect(vm.weakTopics).toHaveLength(1);
      expect(vm.weakTopics[0]).toEqual({
        tag: "road-safety:license",
        attempted: 12,
        correct: 10,
        accuracyPct: 83, // round(100*10/12)
      });

      // topicMastery grouping under parent topicKey "road-safety"
      expect(vm.topicMastery!.topics).toHaveLength(1);
      const topic = vm.topicMastery!.topics[0];
      expect(topic.topicKey).toBe("road-safety");
      expect(topic.attempted).toBe(12);
      expect(topic.correct).toBe(10);
      expect(topic.subtopics.map((s) => s.tag)).toContain("road-safety:license");

      // weakestSubtopics (confident only, attempted >= 10)
      expect(vm.topicMastery!.weakestSubtopics).toHaveLength(1);
      expect(vm.topicMastery!.weakestSubtopics[0].tag).toBe("road-safety:license");
    });

    it("excludes a subtopic with fewer than 10 attempts from weakTopics/weakestSubtopics", () => {
      const q = accidentMcq("acc1", "acc1-a");
      const t = new Date(2024, 5, 12, 9, 0, 0, 0).getTime();
      const vm = computeStats({
        attempts: [
          {
            status: "submitted",
            submittedAt: t,
            modeKey: "real-test",
            questionIds: ["acc1"],
            answersByQid: { acc1: { choice: "A", answeredAt: t } },
          },
        ],
        questions: [q],
        filters: { timeframeDays: "all", includeModeKeys: ["real-test"] },
      });

      // Only 1 attempt of the accidents subtopic -> below MIN_TOPIC_ATTEMPTED.
      expect(vm.weakTopics).toEqual([]);
      expect(vm.topicMastery!.weakestSubtopics).toEqual([]);
      // But the topic IS still grouped (topicMastery.topics has no min filter).
      expect(vm.topicMastery!.topics).toHaveLength(1);
      expect(vm.topicMastery!.topics[0].topicKey).toBe("road-safety");
    });
  });

  describe("time-log series read from localStorage (seeded)", () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it("reads per-day test/study seconds for the 7-day window and aggregates minutes", () => {
      // CHARACTERIZATION NOTE: the time-log block in computeStats builds its
      // day window from `new Date()` (the REAL wall clock), NOT from the
      // mocked Date.now(). So we must seed keys relative to the real "today",
      // not relative to NOW. (This wall-clock vs Date.now() split is itself a
      // characterized current behavior.)
      const realToday = new Date();
      realToday.setHours(0, 0, 0, 0);
      const realYesterday = new Date(realToday);
      realYesterday.setDate(realYesterday.getDate() - 1);

      // today: test=600s (10min) study=120s (2min)
      window.localStorage.setItem(timeKey("test", realToday), "600");
      window.localStorage.setItem(timeKey("study", realToday), "120");
      // yesterday: test=300s (5min)
      window.localStorage.setItem(timeKey("test", realYesterday), "300");

      const vm = computeStats({
        attempts: [],
        questions: [],
        filters: { timeframeDays: 7, includeModeKeys: ALL_MODES },
      });

      expect(vm.timeDailySeries).toHaveLength(7);
      // last entry is "today"
      const todayEntry = vm.timeDailySeries[vm.timeDailySeries.length - 1];
      expect(todayEntry.deliberateMin).toBe(10);
      expect(todayEntry.studyMin).toBe(2);
      expect(todayEntry.totalMin).toBe(12);

      const yesterdayEntry = vm.timeDailySeries[vm.timeDailySeries.length - 2];
      expect(yesterdayEntry.deliberateMin).toBe(5);
      expect(yesterdayEntry.totalMin).toBe(5);

      expect(vm.deliberateThisWeekMin).toBe(15); // 10 + 5
      expect(vm.studyThisWeekMin).toBe(2);
      expect(vm.timeThisWeekMin).toBe(17);
      expect(vm.timeBestDayMin).toBe(12); // today total
      // streak ending today: today(12) + yesterday(5) = 2 consecutive days
      expect(vm.timeStreakDays).toBe(2);
    });
  });
});
