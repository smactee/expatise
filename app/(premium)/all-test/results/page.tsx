// app/(premium)/all-test/results/page.tsx
import { redirect } from "next/navigation";

export default function AllTestResultsAlias({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else if (typeof v === "string") qs.set(k, v);
  }
  const q = qs.toString();
  redirect(`/test/real/results${q ? `?${q}` : ""}`);
}
