// lib/testModes.ts

import type { DatasetId } from "@/lib/qbank/datasets";

export type TestModeId =
  | "real"
  | "practice"
  | "half"
  | "rapid"
  | "mistakes"
  | "bookmarks"
  | "topics"
  | "ten-percent";

export type TestModeConfig = {
  modeId: TestModeId;
  /**
   * Used to isolate attempts, resumes, free caps, and analytics.
   * MUST be unique per mode.
   */
  modeKey: string;
  routeBase: string;
  datasetId: DatasetId;
  datasetVersion: string;
  /** Number of questions in this test */
  questionCount: number;
  /** Time limit in minutes */
  timeLimitMinutes: number;
  /**
   * Optional fairness gate.
   * Example: require 50 available even if test only uses 20.
   */
  preflightRequiredQuestions?: number;
  autoAdvanceSeconds?: number;
};

export const TEST_MODES: Record<TestModeId, TestModeConfig> = {
  real: {
    modeId: "real",
    modeKey: "real-test",
    routeBase: "/test/real",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 100,
    timeLimitMinutes: 45,
    preflightRequiredQuestions: 100,
  },

  "ten-percent": {
    modeId: "ten-percent",
    modeKey: "ten-percent-test",
    routeBase: "/test/ten-percent",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 10,
    timeLimitMinutes: 5,
    preflightRequiredQuestions: 10,
  },

  practice: {
    modeId: "practice",
    modeKey: "practice-test",
    routeBase: "/test/practice",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 20,
    timeLimitMinutes: 0,
    preflightRequiredQuestions: 1,
  },

  half: {
    modeId: "half",
    modeKey: "half-test",
    routeBase: "/test/half",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 50,
    timeLimitMinutes: 23,
    preflightRequiredQuestions: 50,
  },

  rapid: {
    modeId: "rapid",
    modeKey: "rapid-test",
    routeBase: "/test/rapid",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 100,
    timeLimitMinutes: 10,
    preflightRequiredQuestions: 20,
    autoAdvanceSeconds: 6,
  },

  mistakes: {
    modeId: "mistakes",
    modeKey: "mistakes-test",
    routeBase: "/test/mistakes",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 50, 
    timeLimitMinutes: 0, 
    preflightRequiredQuestions: 1,
  },

  bookmarks: {
    modeId: "bookmarks",
    modeKey: "bookmarks-test",
    routeBase: "/test/bookmarks",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 50, 
    timeLimitMinutes: 0, 
    preflightRequiredQuestions: 1,
  },

  topics: {
    modeId: "topics",
    modeKey: "topics-test",
    routeBase: "/test/topics",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 20, 
    timeLimitMinutes: 10, 
    preflightRequiredQuestions: 1,
  },
};
