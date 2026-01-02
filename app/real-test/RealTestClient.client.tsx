// app/real-test/RealTestClient.client.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import styles from './real-test.module.css';

import { loadDataset } from '../../lib/qbank/loadDataset';
import type { DatasetId } from '../../lib/qbank/datasets';
import type { Question } from '../../lib/qbank/types';
import { useBookmarks } from '../../lib/bookmarks/useBookmarks';

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RealTestClient({
  datasetId,
  timeLimitMinutes,
}: {
  datasetId: DatasetId;
  timeLimitMinutes: number;
}) {
  const router = useRouter();

  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const total = items.length || 100;
  const currentNo = Math.min(index + 1, total);

  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);

  const { toggle, isBookmarked } = useBookmarks(datasetId);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const ds = await loadDataset(datasetId);
      if (!mounted) return;

      setItems(ds);
      setIndex(0);
      setSelectedKey(null);
      setTimeLeft(timeLimitMinutes * 60);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [datasetId, timeLimitMinutes]);

  // countdown
  useEffect(() => {
    if (loading) return;
    if (timeLeft <= 0) return;

    const t = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [loading, timeLeft]);

  const item = items[index];
const imageAsset = item?.assets?.find((a) => a.kind === 'image');



  const progressPct = useMemo(() => {
    if (!items.length) return 0;
    return ((index + 1) / items.length) * 100;
  }, [index, items.length]);

  const onNext = () => {
    if (!items.length) return;

    // (optional) require an answer before next
    if (!selectedKey) return;

    const next = index + 1;
    if (next >= items.length) {
      // finished (you can route to results later)
      router.back();
      return;
    }

    setIndex(next);
    setSelectedKey(null);
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.loading}>Loading…</div>
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.loading}>No questions found.</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <span className={styles.backIcon} aria-hidden="true">‹</span>
            <span className={styles.backText}>Back</span>
          </button>

          <div className={styles.topRight}>
            <div className={styles.timer}>
              <span className={styles.timerIcon} aria-hidden="true" />
              <span className={styles.timerText}>{timeLimitMinutes}Min</span>
            </div>
          </div>
        </div>

        {/* Progress row */}
        <div className={styles.progressRow}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.progressText}>{currentNo}/{items.length}</div>
        </div>

        {/* Question row (with bookmark icon on the right) */}
        <div className={styles.questionRow}>
          <p className={styles.questionText}>{item.prompt}</p>

          <button
            type="button"
            className={styles.bookmarkBtn}
            onClick={(e) => {
              e.stopPropagation();
              toggle(item.id);
            }}
            aria-label={isBookmarked(item.id) ? 'Remove bookmark' : 'Add bookmark'}
            title={isBookmarked(item.id) ? 'Bookmarked' : 'Bookmark'}
            data-bookmarked={isBookmarked(item.id) ? 'true' : 'false'}
          >
            {/* NOTE: this is where your class rename matters */}
            <span className={styles.bookmarkIcon} aria-hidden="true" />
          </button>
        </div>

        {/* Image (if exists) */}
        {imageAsset && (
  <div className={styles.imageWrap}>
    <Image
      src={imageAsset.src}
      alt="Question image"
      fill
      className={styles.image}
      priority
    />
  </div>
)}


{/* Answers */}
<div className={styles.answers}>
  {item.type === 'MCQ' &&
    item.options.map((opt, idx) => {
      const key = opt.originalKey ?? String.fromCharCode(65 + idx); // A, B, C, D...
      const active = selectedKey === key;

      return (
        <button
          key={opt.id} // safest key for React lists
          type="button"
          className={`${styles.optionBtn} ${active ? styles.optionActive : ''}`}
          onClick={() => setSelectedKey(key)} // key is now always string
        >
          <span className={styles.optionKey}>{key}.</span>
          <span className={styles.optionText}>{opt.text}</span>
        </button>
      );
    })}
</div>



        {/* Next */}
        <button
          type="button"
          className={styles.nextBtn}
          onClick={onNext}
          disabled={!selectedKey}
        >
          Next <span className={styles.nextArrow} aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
