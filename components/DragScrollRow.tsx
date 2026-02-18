'use client';

import React, { useEffect, useRef, useState } from 'react';

type DragScrollRowProps = {
  children: React.ReactNode;
  className?: string;
};

export default function DragScrollRow({ children, className }: DragScrollRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Treat "coarse pointer" devices as touch (iOS/Android).
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia?.('(pointer: coarse)');
    const update = () => {
      const coarse = mql?.matches ?? false;
      const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
      setIsTouch(coarse || touchPoints > 0);
    };
    update();
    mql?.addEventListener?.('change', update);
    return () => mql?.removeEventListener?.('change', update);
  }, []);

  const enableMouseDrag = !isTouch;

  const [dragging, setDragging] = useState(false);
  const [snapOff, setSnapOff] = useState(false);

  // pointer tracking
  const pointerDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const startClientXRef = useRef(0);
  const startLocalXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

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
        setSnapOff(false);
      }
    };

    frameIdRef.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enableMouseDrag) return;
    if (e.pointerType !== 'mouse') return;

    const el = rowRef.current;
    if (!el) return;

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

    setDragging(true);
    setSnapOff(true);
    didDragRef.current = true;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enableMouseDrag) return;

    const el = rowRef.current;
    if (!el || !pointerDownRef.current) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    const dxFromStart = e.clientX - startClientXRef.current;

    if (!dragging && Math.abs(dxFromStart) < DRAG_THRESHOLD) return;
    if (!dragging) beginDragMode(e);

    const x = getLocalX(e.clientX);
    const walk = x - startLocalXRef.current;

    el.scrollLeft = startScrollLeftRef.current - walk;

    const dx = e.clientX - lastClientXRef.current;
    lastClientXRef.current = e.clientX;
    velocityRef.current = dx * 0.9;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (!enableMouseDrag) return;
    if (!pointerDownRef.current) return;

    pointerDownRef.current = false;
    activePointerIdRef.current = null;

    if (e?.currentTarget && dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (!dragging) return;

    setDragging(false);

    if (Math.abs(velocityRef.current) > 0.5) startMomentum();
    else {
      velocityRef.current = 0;
      setSnapOff(false);
    }

    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  return (
    <div
      ref={rowRef}
      className={className}
      onPointerDown={enableMouseDrag ? onPointerDown : undefined}
      onPointerMove={enableMouseDrag ? onPointerMove : undefined}
      onPointerUp={enableMouseDrag ? endDrag : undefined}
      onPointerCancel={enableMouseDrag ? endDrag : undefined}
      onPointerLeave={enableMouseDrag ? endDrag : undefined}
      onClickCapture={
        enableMouseDrag
          ? (e) => {
              if (didDragRef.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          : undefined
      }
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',

        cursor: enableMouseDrag ? (dragging ? 'grabbing' : 'grab') : undefined,
        userSelect: enableMouseDrag && dragging ? 'none' : undefined,

        // ✅ On touch devices, let the browser do native scrolling & direction lock.
        touchAction: enableMouseDrag ? 'pan-y' : 'auto',

        // ✅ Only disable snap during mouse-drag/momentum.
        scrollSnapType: enableMouseDrag && snapOff ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}
