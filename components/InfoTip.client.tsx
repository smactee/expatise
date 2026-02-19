"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./InfoTip.module.css";

export default function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // Close when user taps/clicks outside
  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={styles.root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.btn}
        aria-label="Info"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⓘ
      </button>

      {open ? (
        <span role="tooltip" className={styles.tip}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
