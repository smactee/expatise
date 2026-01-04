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
import { useBookmarks } from "../../lib/bookmarks/useBookmarks"; // adjust path if you use "@/lib/..."
import BackButton from '../../components/BackButton';


function isCorrectMcq(item: Question, optId: string, optKey?: string) {
  if (item.type !== 'MCQ' || !item.correctOptionId) return false;
  return item.correctOptionId === optId || (optKey && item.correctOptionId === optKey);
}

export default function AllQuestionsClient({
  datasetId,
  mode = 'all',
}: {
  datasetId: DatasetId;
  mode?: 'all' | 'bookmarks';
}) {
  const [q, setQ] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null); // null = All
  const { idSet: bookmarkedSet, isBookmarked, toggle } = useBookmarks(datasetId);
  // ✅ Selection (only used in Bookmarks mode)
const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());



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

    const hasTopic = tags.some((t) => !t.includes(":")); // e.g. "road-safety"
    const hasSub = tags.some((t) => t.includes(":") && !t.endsWith(":all")); // e.g. "road-safety:accidents"

    // ✅ require BOTH topic + subtopic to be considered "classified"
    return !(hasTopic && hasSub);
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

useEffect(() => {
  if (mode !== "bookmarks") {
    setSelectedIds(new Set());
  }
}, [mode]);


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

const visible = useMemo(() => {
  if (mode !== 'bookmarks') return filtered;
  return filtered.filter((item) => bookmarkedSet.has(item.id));
}, [filtered, mode, bookmarkedSet]);

function unselectCard(id: string) {
  setSelectedIds((prev) => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}

function clearSelection() {
  setSelectedIds(new Set());
}

function unbookmarkSelected() {
  // Only unbookmark the currently selected ones
  const ids = Array.from(selectedIds);

  ids.forEach((id) => {
    // In bookmarks mode these should already be bookmarked,
    // but this guard keeps it safe.
    if (bookmarkedSet.has(id)) toggle(id);
  });

  clearSelection();
}


const visibleIds = useMemo(() => visible.map((x) => x.id), [visible]);

const allVisibleSelected = useMemo(() => {
  return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
}, [visibleIds, selectedIds]);

function toggleSelectAllVisible() {
  setSelectedIds((prev) => {
    const next = new Set(prev);

    const shouldClear =
      visibleIds.length > 0 && visibleIds.every((id) => next.has(id));

    if (shouldClear) {
      // Clear only visible ones
      visibleIds.forEach((id) => next.delete(id));
    } else {
      // Select all visible ones
      visibleIds.forEach((id) => next.add(id));
    }

    return next;
  });
}



  return (
    <main className={styles.page}>
       <BackButton />
      <div className={styles.frame}>
        <header className={styles.header}>
          <h1 className={styles.title}>{mode === 'bookmarks' ? 'My Bookmarks' : 'All Questions'}</h1>
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
<div className={styles.chipsRow}>
  <div className={styles.chips}>
    {TAG_TAXONOMY.map((topic) => {
      const isActive = activeTopic === topic.key;
      return (
        <button
          key={topic.key}
          type="button"
          className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
          onClick={() => {
            if (isActive) {
              setActiveTopic(null);
              setActiveSub(null);
            } else {
              setActiveTopic(topic.key);
              setActiveSub(null);
            }
          }}
        >
          {topic.label}
        </button>
      );
    })}
  </div>

{mode === "bookmarks" && (
  <div className={styles.chipsRight}>
    {selectedIds.size > 0 && (
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={unbookmarkSelected}
        aria-label={`Delete ${selectedIds.size} bookmarks`}
        title={`Delete ${selectedIds.size} bookmarks`}
      >
        Delete
      </button>
    )}

    <button
      type="button"
      className={styles.selectAllBtn}
      onClick={toggleSelectAllVisible}
      aria-label={allVisibleSelected ? "Clear selection" : "Select all visible"}
      title={allVisibleSelected ? "Clear selection" : "Select all"}
      data-active={allVisibleSelected ? "true" : "false"}
    >
      <Image
        src="/images/home/icons/selection-box-icon.png"
        alt=""
        width={18}
        height={18}
        className={styles.selectAllIcon}
        draggable={false}
      />
    </button>
  </div>
)}
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
          {sub.label.replace(/^#/, "")}
        </button>
      );
    })}
  </div>
)}


        <section className={styles.list}>
          {visible.map((item) => (
<article
  key={item.id}
  className={`${styles.card} ${selectedIds.has(item.id) ? styles.cardSelected : ""}`}
  onClick={(e) => {
    // Only do anything if this card is currently selected
    if (!selectedIds.has(item.id)) return;

    // Ignore clicks that originate from interactive elements inside the card
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) return;

    // ✅ unselect on tap/click
    unselectCard(item.id);
  }}
>

 <div className={styles.cardTop}>
  <span className={styles.qNo}>{item.number}.</span>

  <div className={styles.cardTopRight}>
    {(() => {
      const tags = derivedById.get(item.id) ?? [];
      const topicKey = tags.find((t) => !t.includes(':'));
      return (
        <span className={styles.qType}>
          {topicKey ? labelForTag(topicKey) : 'Unclassified'}
        </span>
      );
    })()}

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
  <span className={styles.bookmarkIcon} aria-hidden="true" />


</button>

  </div>
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
    const subs = tags.filter((t) => t.includes(":") && !t.endsWith(":all"));
    return subs.map((t) => (
      <span key={t} className={styles.tagPill}>
        {labelForTag(t)}
      </span>
    ));
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
