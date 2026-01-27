"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { timeKey, type TimeKind } from "@/lib/stats/timeKeys";

function routeKind(pathname: string): TimeKind | null {
  if (!pathname) return null;

  // pages we DO NOT track
  if (pathname.startsWith("/stats") || pathname.startsWith("/profile")) return null;

  // test routes
  if (
    pathname.startsWith("/test") ||
    pathname.startsWith("/real-test") ||
    pathname.startsWith("/all-test")
  ) {
    return "test";
  }

  // study routes (add more later if you want)
  if (
    pathname.startsWith("/all-questions") ||
    pathname.startsWith("/my-mistakes") ||
    pathname.startsWith("/bookmarks")
  ) {
    return "study";
  }

  return null;
}

export default function TimeTracker() {
  const pathname = usePathname();

  const kindRef = useRef<TimeKind | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  function flush() {
    if (typeof window === "undefined") return;

    const kind = kindRef.current;
    const startedAt = startedAtRef.current;
    if (!kind || !startedAt) return;

    const now = Date.now();
    const deltaSec = Math.floor((now - startedAt) / 1000);

    // reset start either way so we don't double count
    startedAtRef.current = now;

    if (deltaSec <= 0) return;

    const k = timeKey(kind, new Date());
    const prev = Number(window.localStorage.getItem(k) ?? "0");
    const next = (Number.isFinite(prev) ? prev : 0) + deltaSec;

    try {
      window.localStorage.setItem(k, String(next));
    } catch {
      // ignore quota/private mode
    }
  }

  function stop() {
    flush();
    kindRef.current = null;
    startedAtRef.current = null;
  }

  function start(nextKind: TimeKind | null) {
    stop();
    if (!nextKind) return;
    kindRef.current = nextKind;
    startedAtRef.current = Date.now();
  }

  useEffect(() => {
    // start for this route
    start(routeKind(pathname));

    // flush every 10s so refresh/close doesn’t lose much
    intervalRef.current = window.setInterval(() => flush(), 10_000);

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        start(routeKind(pathname));
      }
    };

    const onBeforeUnload = () => flush();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
      stop();
    };
    // re-run on route changes
  }, [pathname]);

  return null;
}
