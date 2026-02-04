//components/DragScrollRow.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

type DragScrollRowProps = {
  children: React.ReactNode;
  className?: string;
};

export default function DragScrollRow({ children, className }: DragScrollRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const [dragging, setDragging] = useState(false);
  const [snapOff, setSnapOff] = useState(false);

  // pointer tracking
  const pointerDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const startClientXRef = useRef(0);
  const startLocalXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  // drag threshold + "did drag" (to suppress click after a drag)
  const DRAG_THRESHOLD = 6; // px
  const didDragRef = useRef(false);

  // momentum
  const lastClientXRef = useRef(0);
  const velocityRef = useRef(0);
  const frameIdRef = useRef<number | null>(null);

  const stopAnimation = () => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  };

  const getLocalX = (clientX: number) => {
    const el = rowRef.current;
    if (!el) return clientX;
    const rect = el.getBoundingClientRect();
    return clientX - rect.left;
  };

  const startMomentum = () => {
    const el = rowRef.current;
    if (!el) return;

    const friction = 0.985;
    const minVelocity = 0.05;

    const step = () => {
      const node = rowRef.current;
      if (!node) return;

      node.scrollLeft -= velocityRef.current;
      velocityRef.current *= friction;

      if (Math.abs(velocityRef.current) > minVelocity) {
        frameIdRef.current = requestAnimationFrame(step);
      } else {
        velocityRef.current = 0;
        stopAnimation();
        setSnapOff(false); // restore snap after momentum ends
      }
    };

    frameIdRef.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rowRef.current;
    if (!el) return;

    // Do NOT preventDefault here (it can kill clicks)
    pointerDownRef.current = true;
    activePointerIdRef.current = e.pointerId;

    startClientXRef.current = e.clientX;
    startLocalXRef.current = getLocalX(e.clientX);
    startScrollLeftRef.current = el.scrollLeft;

    lastClientXRef.current = e.clientX;
    velocityRef.current = 0;

    didDragRef.current = false;
    stopAnimation();
  };

  const beginDragMode = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rowRef.current;
    if (!el) return;

    // Now we are officially dragging
    setDragging(true);
    setSnapOff(true);
    didDragRef.current = true;

    // Prevent text selection + stop browser gestures once dragging has started
    e.preventDefault();

    // Capture pointer ONLY after drag begins (so clicks on children still work)
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore (some environments can throw)
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rowRef.current;
    if (!el || !pointerDownRef.current) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    const dxFromStart = e.clientX - startClientXRef.current;

    // If we haven't entered drag mode yet, wait until threshold is exceeded
    if (!dragging && Math.abs(dxFromStart) < DRAG_THRESHOLD) {
      return;
    }

    // First move past threshold -> enter drag mode
    if (!dragging) {
      beginDragMode(e);
    } else {
      // already dragging: keep preventing default for smoothness
      e.preventDefault();
    }

    const x = getLocalX(e.clientX);
    const walk = x - startLocalXRef.current;

    el.scrollLeft = startScrollLeftRef.current - walk;

    // velocity (px per event)
    const dx = e.clientX - lastClientXRef.current;
    lastClientXRef.current = e.clientX;
    velocityRef.current = dx * 0.9;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownRef.current) return;

    pointerDownRef.current = false;
    activePointerIdRef.current = null;

    // release capture if we had it
    if (e?.currentTarget && dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (!dragging) {
      // was a click/tap, not a drag
      return;
    }

    setDragging(false);

    // fling
    if (Math.abs(velocityRef.current) > 0.5) {
      startMomentum();
    } else {
      velocityRef.current = 0;
      setSnapOff(false);
    }

    // Allow next click after this tick (we only want to block the click caused by this drag)
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  // Optional: make mouse wheel scroll horizontally (desktop testing)
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const onWheel = (ev: WheelEvent) => {
      const canScroll = el.scrollWidth > el.clientWidth + 1;
      if (!canScroll) return;

      // if user already has horizontal delta (trackpad), let it happen
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;

      ev.preventDefault();
      el.scrollLeft += ev.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={rowRef}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onClickCapture={(e) => {
        // If the user dragged, block the accidental click that happens on release
        if (didDragRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: dragging ? 'none' : undefined,
        // allow vertical page scroll; we handle horizontal drag ourselves
        touchAction: 'pan-y',
        // disable snap during drag/throw
        scrollSnapType: snapOff ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}
