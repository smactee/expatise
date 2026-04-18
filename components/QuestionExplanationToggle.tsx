'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './QuestionExplanationToggle.module.css';

type QuestionExplanationToggleProps = {
  explanation?: string | null;
  label: string;
};

export default function QuestionExplanationToggle({
  explanation,
  label,
}: QuestionExplanationToggleProps) {
  const text = (explanation ?? '').trim();
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <Image
          src={
            expanded
              ? '/images/questions/caret-down-solid.png'
              : '/images/questions/caret-right-solid.png'
          }
          alt=""
          aria-hidden="true"
          className={styles.icon}
          width={12}
          height={12}
          draggable={false}
        />
        <span className={styles.label}>{label}</span>
      </button>

      {expanded ? <div className={styles.body}>{text}</div> : null}
    </div>
  );
}
