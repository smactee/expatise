export type CoachTopLever = {
  title: string;
  why: string;
  next: string;
};

export type CoachTodayPlan = {
  ten: string;
  twenty: string;
  forty: string;
};

export type CoachReportData = {
  summary: string;
  snapshot: string[];
  topLevers: CoachTopLever[];
  today: CoachTodayPlan;
  next7Days: string[];
  oneTarget: string;
};

export const COACH_REPORT_CACHE_VERSION = 2;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function asTopLevers(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const title = asString((item as Record<string, unknown>).title);
      const why = asString((item as Record<string, unknown>).why);
      const next = asString((item as Record<string, unknown>).next);

      if (!title || !why || !next) return null;
      return { title, why, next };
    })
    .filter((item): item is CoachTopLever => Boolean(item));
}

function asTodayPlan(value: unknown): CoachTodayPlan | null {
  if (!value || typeof value !== "object") return null;

  const ten = asString((value as Record<string, unknown>).ten);
  const twenty = asString((value as Record<string, unknown>).twenty);
  const forty = asString((value as Record<string, unknown>).forty);

  if (!ten || !twenty || !forty) return null;

  return {
    ten,
    twenty,
    forty,
  };
}

export function normalizeCoachReportData(value: unknown): CoachReportData | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const summary = asString(obj.summary);
  const snapshot = asStringArray(obj.snapshot);
  const topLevers = asTopLevers(obj.topLevers);
  const today = asTodayPlan(obj.today);
  const next7Days = asStringArray(obj.next7Days);
  const oneTarget = asString(obj.oneTarget);

  if (!summary || !snapshot.length || !topLevers.length || !today || !next7Days.length || !oneTarget) {
    return null;
  }

  return {
    summary,
    snapshot,
    topLevers,
    today,
    next7Days,
    oneTarget,
  };
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start < 0 || end <= start) return null;

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseCoachReportDataFromText(text: string) {
  return normalizeCoachReportData(extractJsonObject(text));
}
