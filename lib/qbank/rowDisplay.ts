export function getRowDisplayLabel(value: string | null | undefined): "Y" | "N" | "" {
  if (!value) return "";

  const normalized = value.trim().toLowerCase();

  if (normalized === "r" || normalized === "right") return "Y";
  if (normalized === "w" || normalized === "wrong") return "N";

  return "";
}
