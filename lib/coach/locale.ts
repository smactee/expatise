type CoachSectionHeadings = {
  summary: string;
  snapshot: string;
  topLevers: string;
  today: string;
  next7Days: string;
  oneTarget: string;
};

type CoachLocaleConfig = {
  label: string;
  outputLanguage: string;
  sectionHeadings: CoachSectionHeadings;
  emphasisLabels: {
    why: readonly string[];
    next: readonly string[];
    target: readonly string[];
  };
  planLabels: {
    ten: string;
    twenty: string;
    forty: string;
  };
  windowLabels: {
    skill30: string;
    skillAll: string;
    habit7: string;
  };
};

export const COACH_LOCALE_REGISTRY = {
  en: {
    label: "English",
    outputLanguage: "English",
    sectionHeadings: {
      summary: "Summary",
      snapshot: "Snapshot",
      topLevers: "Top levers",
      today: "Today (10 / 20 / 40)",
      next7Days: "Next 7 days",
      oneTarget: "One target",
    },
    emphasisLabels: {
      why: ["Why"],
      next: ["Next", "Next action"],
      target: ["Target"],
    },
    planLabels: {
      ten: "10 min",
      twenty: "20 min",
      forty: "40 min",
    },
    windowLabels: {
      skill30: "30d",
      skillAll: "all-time",
      habit7: "7d",
    },
  },
  ko: {
    label: "한국어",
    outputLanguage: "Korean",
    sectionHeadings: {
      summary: "요약",
      snapshot: "스냅샷",
      topLevers: "핵심 레버",
      today: "오늘 (10 / 20 / 40)",
      next7Days: "다음 7일",
      oneTarget: "하나의 목표",
    },
    emphasisLabels: {
      why: ["이유"],
      next: ["다음 행동", "다음"],
      target: ["목표"],
    },
    planLabels: {
      ten: "10분",
      twenty: "20분",
      forty: "40분",
    },
    windowLabels: {
      skill30: "30일",
      skillAll: "전체 기간",
      habit7: "7일",
    },
  },
  ja: {
    label: "日本語",
    outputLanguage: "Japanese",
    sectionHeadings: {
      summary: "要約",
      snapshot: "現状",
      topLevers: "優先ポイント",
      today: "今日（10 / 20 / 40）",
      next7Days: "今後7日間",
      oneTarget: "ひとつの目標",
    },
    emphasisLabels: {
      why: ["理由"],
      next: ["次にやること", "次"],
      target: ["目標"],
    },
    planLabels: {
      ten: "10分",
      twenty: "20分",
      forty: "40分",
    },
    windowLabels: {
      skill30: "30日",
      skillAll: "全期間",
      habit7: "7日",
    },
  },
} as const satisfies Record<string, CoachLocaleConfig>;

export type CoachLocale = keyof typeof COACH_LOCALE_REGISTRY;

export const DEFAULT_COACH_LOCALE = "en" as const satisfies CoachLocale;

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

const localeConfigs = Object.values(COACH_LOCALE_REGISTRY);

export const LEGACY_COACH_SECTION_HEADINGS = [
  "Summary",
  "Snapshot",
  "Top levers",
  "Today",
  "Next 7 days",
  "The One thing",
] as const;

export const ALL_COACH_SECTION_HEADINGS = unique([
  ...localeConfigs.flatMap((config) => Object.values(config.sectionHeadings)),
  ...LEGACY_COACH_SECTION_HEADINGS,
]);

export const ALL_COACH_ONE_TARGET_HEADINGS = unique([
  ...localeConfigs.map((config) => config.sectionHeadings.oneTarget),
  "The One thing",
]);

export const ALL_COACH_KEY_LABELS = unique(
  localeConfigs.flatMap((config) => [
    ...config.emphasisLabels.why,
    ...config.emphasisLabels.next,
    ...config.emphasisLabels.target,
  ])
);

export const ALL_COACH_WINDOW_LABELS = unique(
  localeConfigs.flatMap((config) => Object.values(config.windowLabels))
);

export function isCoachLocale(value: string | null | undefined): value is CoachLocale {
  return typeof value === "string" && value in COACH_LOCALE_REGISTRY;
}

export function resolveCoachLocale(
  value: string | null | undefined,
  fallback: CoachLocale = DEFAULT_COACH_LOCALE
): CoachLocale {
  return isCoachLocale(value) ? value : fallback;
}

export function getCoachLocaleConfig(value: string | null | undefined) {
  const locale = resolveCoachLocale(value);
  return {
    locale,
    ...COACH_LOCALE_REGISTRY[locale],
  };
}

export function getCoachWindowLabels(
  value: string | null | undefined,
  skillWindowLabel: "30d" | "all",
  habitWindowLabel: "7d"
) {
  const { windowLabels } = getCoachLocaleConfig(value);

  return {
    skill: skillWindowLabel === "all" ? windowLabels.skillAll : windowLabels.skill30,
    habit: habitWindowLabel === "7d" ? windowLabels.habit7 : windowLabels.habit7,
  };
}
