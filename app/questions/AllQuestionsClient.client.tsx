'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import BottomNav from '../../components/BottomNav';
import styles from './questions.module.css';
import { loadDataset } from '../../lib/qbank/loadDataset';
import type { DatasetId } from '../../lib/qbank/datasets';
import type { Question } from '../../lib/qbank/types';

export default function AllQuestionsClient({ datasetId }: { datasetId: DatasetId }) {
  const [q, setQ] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]); // canonical tag ids

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await loadDataset(datasetId);
        if (alive) setQ(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [datasetId]);

  const filtered = useMemo(() => {
    const qNorm = query.trim().toLowerCase();

    return q.filter((item) => {
      const matchesText =
        !qNorm ||
        item.prompt.toLowerCase().includes(qNorm) ||
        item.autoTags.some((t) => t.includes(qNorm));

      const tags = new Set([...item.tags, ...item.autoTags]);
      const matchesTags =
        activeTags.length === 0 || activeTags.every((t) => tags.has(t));

      return matchesText && matchesTags;
    });
  }, [q, query, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <h1 className={styles.title}>All Questions</h1>
          <p className={styles.subtitle}>
            {loading ? 'Loading…' : `${filtered.length} / ${q.length}`}
          </p>
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder="Search question text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.chips}>
          {['row', 'mcq', 'pic', 'law', 'signals', 'safe-driving', 'expressway', 'violations', 'license', 'vehicle-knowledge'].map((t) => (
            <button
              key={t}
              className={`${styles.chip} ${activeTags.includes(t) ? styles.chipActive : ''}`}
              onClick={() => toggleTag(t)}
              type="button"
            >
              #{t}
            </button>
          ))}
        </div>

        <section className={styles.list}>
          {filtered.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.qNo}>#{item.number}</span>
                <span className={styles.qType}>{item.type}</span>
              </div>

              <p className={styles.prompt}>{item.prompt}</p>

              {item.assets[0]?.kind === 'image' && (
                <div className={styles.imageWrap}>
                  <Image
                    src={item.assets[0].src}
                    alt={`Question ${item.number}`}
                    fill
                    className={styles.image}
                    draggable={false}
                  />
                </div>
              )}

              <div className={styles.tagRow}>
                {item.autoTags.slice(0, 4).map((t) => (
                  <span key={t} className={styles.tagPill}>#{t}</span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
