"use client";

import { useEffect, useState, type CSSProperties } from "react";

function getVisualViewportBottomOffset() {
  if (typeof window === "undefined") return 0;

  const viewport = window.visualViewport;
  if (!viewport) return 0;

  return Math.max(
    0,
    Math.round(window.innerHeight - (viewport.height + viewport.offsetTop))
  );
}

export function useVisualViewportBottomOffset() {
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateBottomOffset = () => {
      setBottomOffset(getVisualViewportBottomOffset());
    };

    updateBottomOffset();

    const viewport = window.visualViewport;

    window.addEventListener("resize", updateBottomOffset);
    window.addEventListener("orientationchange", updateBottomOffset);
    viewport?.addEventListener("resize", updateBottomOffset);
    viewport?.addEventListener("scroll", updateBottomOffset);

    return () => {
      window.removeEventListener("resize", updateBottomOffset);
      window.removeEventListener("orientationchange", updateBottomOffset);
      viewport?.removeEventListener("resize", updateBottomOffset);
      viewport?.removeEventListener("scroll", updateBottomOffset);
    };
  }, []);

  return {
    "--vv-bottom-offset": `${bottomOffset}px`,
  } as CSSProperties;
}
