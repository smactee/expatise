export function safeNextPath(input: string | null | undefined) {
  const raw = String(input ?? "").trim();
  if (!raw) return "/";

  // Only allow internal paths
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";

  // Avoid loops / sensitive routes (tweak as you like)
  if (raw.startsWith("/premium")) return "/";
  if (raw.startsWith("/login")) return "/";

  return raw;
}
