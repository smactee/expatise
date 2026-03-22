// components/stats/TimeframeChips.tsx
'use client';

import styles from './TimeframeChips.module.css';
import { useT } from '@/lib/i18n/useT';

export type Timeframe = 7 | 30 | 'all';
export const TIMEFRAMES: Timeframe[] = [7, 30, 'all'];

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
  const { t } = useT();

  return (
    <div
      className={`${styles.statsChips} ${
        align === 'center' ? styles.statsChipsCenter : ''
      }`}
    >
      {TIMEFRAMES.map((timeframe) => {
        const active = value === timeframe;
        return (
          <button
            key={String(timeframe)}
            type="button"
            onClick={() => onChange(timeframe)}
            className={`${styles.statsChip} ${
              active ? styles.statsChipActive : ''
            }`}
          >
            {timeframe === 'all'
              ? t('stats.timeframes.allShort')
              : t('stats.timeframes.daysShort', { days: timeframe })}
          </button>
        );
      })}
    </div>
  );
}
