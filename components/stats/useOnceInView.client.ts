'use client';

import { useEffect, useRef, useState } from 'react';

type OnceInViewOptions = {
  threshold?: number | number[];
  rootMargin?: string;
};

export function useOnceInView<T extends Element>(threshold?: number): { ref: React.RefObject<T | null>; seen: boolean };
export function useOnceInView<T extends Element>(opts?: OnceInViewOptions): { ref: React.RefObject<T | null>; seen: boolean };
export function useOnceInView<T extends Element>(arg: number | OnceInViewOptions = 0.35) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  const opts: OnceInViewOptions =
    typeof arg === 'number' ? { threshold: arg } : arg;

  const threshold = opts.threshold ?? 0.35;
  const rootMargin = opts.rootMargin ?? '0px';

  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;

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
      { threshold, rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, threshold, rootMargin]);

  return { ref, seen };
}

// Convenience wrapper: triggers when element crosses the middle of the viewport
export function useOnceInMidView<T extends Element>() {
  return useOnceInView<T>({ threshold: 0, rootMargin: '-50% 0px -50% 0px' });
}
