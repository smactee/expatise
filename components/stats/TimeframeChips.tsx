// components/stats/TimeframeChips.tsx
'use client';

import styles from './TimeframeChips.module.css';

export type Timeframe = 7 | 30 | 'all';
export const TIMEFRAMES: Timeframe[] = [7, 30, 'all'];

export function tfShort(t: Timeframe) {
  return t === 'all' ? 'All' : `${t}D`;
}

type Props = {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
  align?: 'left' | 'center';
};

export default function TimeframeChips({
  value,
  onChange,
  align = 'center',
}: Props) {
  return (
    <div
      className={`${styles.statsChips} ${
        align === 'center' ? styles.statsChipsCenter : ''
      }`}
    >
      {TIMEFRAMES.map((t) => {
        const active = value === t;
        return (
          <button
            key={String(t)}
            type="button"
            onClick={() => onChange(t)}
            className={`${styles.statsChip} ${
              active ? styles.statsChipActive : ''
            }`}
          >
            {tfShort(t)}
          </button>
        );
      })}
    </div>
  );
}
