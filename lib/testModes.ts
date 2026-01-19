import type { DatasetId } from "@/lib/qbank/datasets";

export type TestModeId =
  | "real"
  | "practice"
  | "half"
  | "rapid";

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
};

export const TEST_MODES: Record<TestModeId, TestModeConfig> = {
  real: {
    modeId: "real",
    modeKey: "real-test",
    routeBase: "/test/real",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 10,
    timeLimitMinutes: 45,
    preflightRequiredQuestions: 100,
  },

  practice: {
    modeId: "practice",
    modeKey: "practice-test",
    routeBase: "/test/practice",
    datasetId: "cn-2023-test1",
    datasetVersion: "cn-2023-test1@v1",
    questionCount: 100,
    timeLimitMinutes: 10,
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
    timeLimitMinutes: 15,
    preflightRequiredQuestions: 20,
  },
};
