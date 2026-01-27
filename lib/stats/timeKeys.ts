export type TimeKind = "test" | "study";

const PREFIX = "expatise:time";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Local date, NOT UTC
export function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function timeKey(kind: TimeKind, day: Date | string) {
  const ymd = typeof day === "string" ? day : ymdLocal(day);
  return `${PREFIX}:${kind}:${ymd}`;
}
