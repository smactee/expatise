'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import BottomNav from '../../components/BottomNav';
import styles from './all-questions.module.css';
import { loadDataset } from '../../lib/qbank/loadDataset';
import type { DatasetId } from '../../lib/qbank/datasets';
import type { Question } from '../../lib/qbank/types';
import { TAG_TAXONOMY, labelForTag } from '../../lib/qbank/tagTaxonomy';
import { deriveTopicSubtags } from '../../lib/qbank/deriveTopicSubtags';

function isCorrectMcq(item: Question, optId: string, optKey?: string) {
  if (item.type !== 'MCQ' || !item.correctOptionId) return false;
  return item.correctOptionId === optId || (optKey && item.correctOptionId === optKey);
}

export default function AllQuestionsClient({ datasetId }: { datasetId: DatasetId }) {
  const [q, setQ] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null); // null = All


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

  const derivedById = useMemo(() => {
  const m = new Map<string, string[]>();
  for (const item of q) {
    m.set(item.id, deriveTopicSubtags(item));
  }
  return m;
}, [q]);


const unclassified = useMemo(() => {
  return q.filter((item) => {
    const tags = derivedById.get(item.id) ?? [];
    const hasTopic = tags.some((t) => !t.includes(":")); // topic tags have no ":"
    return !hasTopic;
  });
}, [q, derivedById]);

useEffect(() => {
  if (unclassified.length > 0) {
    console.log("UNCLASSIFIED COUNT:", unclassified.length);
    console.table(
      unclassified.map((x) => ({
        number: x.number,
        id: x.id,
        prompt: x.prompt,
      }))
    );
  }
}, [unclassified]);

  const filtered = useMemo(() => {
  const qNorm = query.trim().toLowerCase();

  return q.filter((item) => {
    const derivedTags = new Set(derivedById.get(item.id) ?? []);

        const qDigits = qNorm.replace(/[^0-9]/g, ""); // allows "103", "#103", "103."
   const matchesNumber = qDigits.length > 0 && Number(qDigits) === item.number;


    const matchesText =
      !qNorm ||
      matchesNumber ||
      item.prompt.toLowerCase().includes(qNorm) ||
      (item.autoTags ?? []).some((t) => t.toLowerCase().includes(qNorm));


    // Topic/subtopic filtering
    const matchesTopic = !activeTopic || derivedTags.has(activeTopic);
    const matchesSub = !activeTopic || !activeSub || derivedTags.has(activeSub);

    return matchesText && matchesTopic && matchesSub;
  });
}, [q, query, activeTopic, activeSub, derivedById]);

const tagCounts = useMemo(() => {
  const topicCounts: Record<string, number> = {};
  const subCounts: Record<string, number> = {};

  for (const item of q) {
    const tags = new Set(derivedById.get(item.id) ?? []);

    // count topics (no ":")
    for (const t of tags) {
      if (!t.includes(":")) {
        topicCounts[t] = (topicCounts[t] ?? 0) + 1;
      }
    }

    // count subtopics (has ":" but not ":all")
    for (const t of tags) {
      if (t.includes(":") && !t.endsWith(":all")) {
        subCounts[t] = (subCounts[t] ?? 0) + 1;
      }
    }
  }

  return { topicCounts, subCounts };
}, [q, derivedById]);


  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <h1 className={styles.title}>All Questions</h1>
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder="Search question text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

       {/* Row 1: Topics */}
<div className={styles.chips}>
  {TAG_TAXONOMY.map((topic) => {
    const isActive = activeTopic === topic.key;
    return (
      <button
        key={topic.key}
        type="button"
        className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
        onClick={() => {
          // click again to clear
          if (isActive) {
            setActiveTopic(null);
            setActiveSub(null);
          } else {
            setActiveTopic(topic.key);
            setActiveSub(null); // default to "All"
          }
        }}
      >
        {topic.label} ({tagCounts.topicCounts[topic.key] ?? 0})
      </button>
    );
  })}
</div>

{/* Row 2: Subtopics (only show when a topic is selected) */}
{activeTopic && (
  <div className={styles.chips}>
    {TAG_TAXONOMY.find((t) => t.key === activeTopic)!.subtopics.map((sub) => {
      const isActive = activeSub === sub.key;

      return (
        <button
          key={sub.key}
          type="button"
          className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
          onClick={() => {
            setActiveSub(isActive ? null : sub.key);
          }}
        >
          {sub.label.replace(/^#/, "")} ({tagCounts.subCounts[sub.key] ?? 0})
        </button>
      );
    })}
  </div>
)}


        <section className={styles.list}>
          {filtered.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
  <span className={styles.qNo}>{item.number}.</span>

  {(() => {
    const tags = derivedById.get(item.id) ?? [];
    const topicKey = tags.find((t) => !t.includes(":")); // topic = no ":"
    return (
      <span className={styles.qType}>
        {topicKey ? labelForTag(topicKey) : "Unclassified"}
      </span>
    );
  })()}
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
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 600px"
                  />
                </div>
              )}

              {/* ✅ ANSWERS */}
              {item.type === 'ROW' && item.correctRow && (
                <div className={styles.answerRow}>
                  <span className={styles.answerLabel}>Answer</span>
                  <span className={styles.answerPill}>
  {item.correctRow === "R"
    ? "Right"
    : item.correctRow === "W"
    ? "Wrong"
    : item.correctRow}
</span>

                </div>
              )}

              {item.type === 'MCQ' && item.options?.length > 0 && (
                <ul className={styles.optionList}>
                  {item.options.map((opt) => {
                    const key = opt.originalKey ?? opt.id;
                    const correct = isCorrectMcq(item, opt.id, opt.originalKey);
                    return (
                      <li
                        key={opt.id}
                        className={`${styles.option} ${correct ? styles.optionCorrect : ''}`}
                      >
                        <span className={styles.optionKey}>{key}.</span>
                        {opt.text}
                      </li>
                    );
                  })}
                </ul>
              )}

<div className={styles.tagRow}>
  {(() => {
    const tags = derivedById.get(item.id) ?? [];
    const sub = tags.find((t) => t.includes(":") && !t.endsWith(":all"));
    if (!sub) return null;

    return (
      <span className={styles.tagPill}>
        {labelForTag(sub)}
      </span>
    );
  })()}
</div>



            </article>
          ))}
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
