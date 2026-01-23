// components/SwipeBack.client.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const EDGE_PX = 1;           // (touch) keep your original
const MOUSE_EDGE_PX = 24;    // (mouse) easier to start on desktop

const MIN_DX = 80;           // how far to drag to trigger
const MAX_DY = 50;           // ignore if mostly vertical
const MAX_TIME_MS = 450;     // ignore slow drags

function isNoSwipeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    `[data-noswipeback="true"], button, a, input, textarea, select, label, [role="slider"]`
  );
}

function isTypingTarget(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

function isInNoSwipeZone(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest(`[data-noswipeback="true"]`);
}

export default function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();

  const touchStartRef = useRef({
    active: false,
    triggered: false,
    x: 0,
    y: 0,
    t: 0,
  });

  const mouseStartRef = useRef({
    active: false,
    triggered: false,
    x: 0,
    y: 0,
    t: 0,
  });

  useEffect(() => {
    if (pathname === "/") return;

    const goBack = () => {
      if (window.history.length > 1) router.back();
      else router.push("/");
    };

    // Desktop helpers ONLY while developing (so prod web users don’t get surprises).
    const enableDesktopHelpers = process.env.NODE_ENV !== "production";

    // ----------------------------
    // Touch (keep exactly as you had it)
    // ----------------------------
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isNoSwipeTarget(e.target)) return;

      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;

      touchStartRef.current = {
        active: x <= EDGE_PX,
        triggered: false,
        x,
        y,
        t: Date.now(),
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const s = touchStartRef.current;
      if (!s.active || s.triggered) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;

      if (dx <= 0) return;

      if (Math.abs(dy) > MAX_DY) {
        s.active = false;
        return;
      }

      if (Date.now() - s.t > MAX_TIME_MS) {
        s.active = false;
        return;
      }

      if (dx >= MIN_DX) {
        s.triggered = true;
        goBack();
      }
    };

    const onTouchEnd = () => {
      touchStartRef.current.active = false;
      touchStartRef.current.triggered = false;
    };

    // ----------------------------
    // Mouse (desktop convenience)
    // ----------------------------
    const onMouseDown = (e: MouseEvent) => {
      if (!enableDesktopHelpers) return;
      if (e.button !== 0) return; // left button only
      if (isNoSwipeTarget(e.target)) return;

      const x = e.clientX;
      const y = e.clientY;

      mouseStartRef.current = {
        active: x <= MOUSE_EDGE_PX,
        triggered: false,
        x,
        y,
        t: Date.now(),
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!enableDesktopHelpers) return;

      const s = mouseStartRef.current;
      if (!s.active || s.triggered) return;

      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;

      if (dx <= 0) return;

      if (Math.abs(dy) > MAX_DY) {
        s.active = false;
        return;
      }

      if (Date.now() - s.t > MAX_TIME_MS) {
        s.active = false;
        return;
      }

      if (dx >= MIN_DX) {
        s.triggered = true;
        s.active = false;
        goBack();
      }
    };

    const onMouseUp = () => {
      mouseStartRef.current.active = false;
      mouseStartRef.current.triggered = false;
    };

    // ----------------------------
    // Keyboard (desktop convenience)
    // ----------------------------
    const onKeyDown = (e: KeyboardEvent) => {
      if (!enableDesktopHelpers) return;

      const activeEl = document.activeElement;

      // Don’t hijack typing, or anything inside a no-swipe zone
      if (isTypingTarget(activeEl) || isInNoSwipeZone(activeEl)) return;

      const isBackspace = e.key === "Backspace";
      const isAltLeft = e.key === "ArrowLeft" && e.altKey;   // Win/Linux
      const isMetaLeft = e.key === "ArrowLeft" && e.metaKey; // Mac
      const isCmdBracket = e.key === "[" && e.metaKey;       // Mac Cmd+[

      if (!isBackspace && !isAltLeft && !isMetaLeft && !isCmdBracket) return;

      e.preventDefault();
      goBack();
    };

    // listeners
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);

      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pathname, router]);

  return null;
}
