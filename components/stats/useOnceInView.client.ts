'use client';

import { useEffect, useRef, useState } from 'react';

export function useOnceInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver not available (rare), just mark seen.
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, threshold]);

  return { ref, seen };
}
