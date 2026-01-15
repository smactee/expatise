// app/all-questions/AllQuestionsClient.client.tsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';
import styles from './all-questions.module.css';
import { loadDataset } from '@/lib/qbank/loadDataset';
import type { DatasetId } from '@/lib/qbank/datasets';
import type { Question } from '@/lib/qbank/types';
import { TAG_TAXONOMY, labelForTag } from '@/lib/qbank/tagTaxonomy';
import { deriveTopicSubtags } from '@/lib/qbank/deriveTopicSubtags';
import { useBookmarks } from "@/lib/bookmarks/useBookmarks"; // adjust path if you use "@/lib/..."
import BackButton from '@/components/BackButton';
import { useClearedMistakes } from '@/lib/mistakes/useClearedMistakes';
import { attemptStore } from "@/lib/attempts/store";
import type { Attempt } from "@/lib/attempts/attemptStore";
import { useUserKey } from "@/components/useUserKey.client";






function isCorrectMcq(item: Question, optId: string, optKey?: string) {
  if (item.type !== 'MCQ' || !item.correctOptionId) return false;
  return item.correctOptionId === optId || (optKey && item.correctOptionId === optKey);
}

export default function AllQuestionsClient({ datasetId, mode = 'all' }: { datasetId: DatasetId; mode?: 'all' | 'bookmarks' | 'mistakes' }) {
  // ✅ 1) hooks first
const userKey = useUserKey();

  // ✅ 3) now it's safe to use userKey
  const { idSet: bookmarkedSet, isBookmarked, toggle } = useBookmarks(datasetId, userKey);
  const {
  ids: clearedMistakeIds,
  idSet: clearedMistakesSet,
  clearMany: clearMistakesMany,
} = useClearedMistakes(datasetId, userKey);

  
  const [q, setQ] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);

  // ✅ Selection (only used in Bookmarks mode)
const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
const [showToTop, setShowToTop] = useState(false);
const [navOffsetY, setNavOffsetY] = useState(0);
const lastYRef = useRef(0);

const [submittedAttempts, setSubmittedAttempts] = useState<Attempt[]>([]);



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
  if (mode !== "bookmarks" && mode !== "mistakes") {
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

function normalizeRowChoice(v: string | null | undefined): 'R' | 'W' | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === 'r' || t === 'right') return 'R';
  if (t === 'w' || t === 'wrong') return 'W';
  return null;
}


type MistakeMeta = { wrongCount: number; lastWrongAt: number };

const mistakesMetaById = useMemo(() => {
  if (mode !== 'mistakes') return new Map<string, MistakeMeta>();
  if (q.length === 0) return new Map<string, MistakeMeta>();

  const byId = new Map(q.map((item) => [item.id, item] as const));

  // ✅ now from adapter-loaded state (async loaded in useEffect)
  const attempts = submittedAttempts;

  const meta = new Map<string, MistakeMeta>();

  for (const a of attempts) {
    for (const [qid, rec] of Object.entries(a.answersByQid ?? {})) {
      const question = byId.get(qid);
      if (!question) continue;

      const chosenKey = rec?.choice ?? null;
      if (!chosenKey) continue;

      let isCorrect = false;

      if (question.type === 'ROW') {
        const chosen = normalizeRowChoice(chosenKey);
        const expected = normalizeRowChoice(question.correctRow ?? null);
        isCorrect = !!(chosen && expected && chosen === expected);
      } else {
        const chosenOpt = question.options?.find((opt, idx) => {
          const k = opt.originalKey ?? String.fromCharCode(65 + idx);
          return k === chosenKey;
        });

        isCorrect = !!(
          chosenOpt &&
          question.correctOptionId &&
          chosenOpt.id === question.correctOptionId
        );
      }

      if (isCorrect) continue;

      const prev = meta.get(qid);
      const answeredAt =
        typeof rec.answeredAt === 'number' ? rec.answeredAt : (a.submittedAt ?? 0);

      meta.set(qid, {
        wrongCount: (prev?.wrongCount ?? 0) + 1,
        lastWrongAt: Math.max(prev?.lastWrongAt ?? 0, answeredAt),
      });
    }
  }

  return meta;
}, [mode, q, submittedAttempts]);



useEffect(() => {
  // Only needed for mistakes mode
  if (mode !== "mistakes") {
    setSubmittedAttempts([]);
    return;
  }

  let alive = true;

  (async () => {
    try {
      const all = await attemptStore.listAttempts(userKey, datasetId);

      // We only care about submitted attempts for mistakes analytics
      const submitted = all.filter((a) => a.status === "submitted");

      if (alive) setSubmittedAttempts(submitted);
    } catch {
      if (alive) setSubmittedAttempts([]);
    }
  })();

  return () => {
    alive = false;
  };
}, [mode, userKey, datasetId]);


const visible = useMemo(() => {
  if (mode === 'bookmarks') return filtered.filter((item) => bookmarkedSet.has(item.id));

  if (mode === "mistakes") {
  const arr = filtered
    .filter((item) => mistakesMetaById.has(item.id))
    .filter((item) => !clearedMistakesSet.has(item.id)); // ✅ hide cleared ones

  arr.sort((a, b) => {
    const ma = mistakesMetaById.get(a.id)!;
    const mb = mistakesMetaById.get(b.id)!;
    if (mb.lastWrongAt !== ma.lastWrongAt) return mb.lastWrongAt - ma.lastWrongAt;
    if (mb.wrongCount !== ma.wrongCount) return mb.wrongCount - ma.wrongCount;
    return a.number - b.number;
  });

  return arr;
}


  return filtered;
}, [filtered, mode, bookmarkedSet, mistakesMetaById, clearedMistakeIds]);



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

function clearMistakesSelected() {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;

  clearMistakesMany(ids);  // ✅ hide them from mistakes view
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

function unselectCard(id: string) {
  setSelectedIds((prev) => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}




useEffect(() => {
  if (typeof window === 'undefined') return;

  lastYRef.current = window.scrollY;

  const MIN_Y_TO_SHOW = 320; // don't show near top
  const DELTA_THRESHOLD = 6; // prevents flicker

  const onScroll = () => {
    const y = window.scrollY;
    const delta = y - lastYRef.current;

    // show only when scrolling UP (delta < 0), and far enough down
    if (y < MIN_Y_TO_SHOW) {
      setShowToTop(false);
    } else if (delta < -DELTA_THRESHOLD) {
      setShowToTop(true);
    } else if (delta > DELTA_THRESHOLD) {
      setShowToTop(false);
    }

    lastYRef.current = y;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);




  return (
<main className={styles.page}>
  <div className={styles.backButtonFixed}>
    <BackButton />
  </div>

  <div className={styles.frame}>

        <header className={styles.header}>
<h1 className={styles.title}>
  {mode === 'bookmarks'
    ? 'My Bookmarks'
    : mode === 'mistakes'
    ? 'My Mistakes'
    : 'All Questions'}
</h1>
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

{(mode === "bookmarks" || mode === "mistakes") && (
  <div className={styles.chipsRight}>
    {selectedIds.size > 0 && mode === "bookmarks" && (
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

    {selectedIds.size > 0 && mode === "mistakes" && (
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={clearMistakesSelected}
        aria-label={`Remove ${selectedIds.size} mistakes from view`}
        title={`Remove ${selectedIds.size} mistakes from view`}
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
<div
  className={styles.toTopWrap}
  style={{ transform: `translateY(${navOffsetY}px)` }}
>
<button
  type="button"
  className={`${styles.toTopBtn} ${showToTop ? styles.toTopBtnVisible : ''}`}
  onClick={() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  }}
  aria-label="Scroll to top"
  title="Back to top"
>
  <span className={styles.toTopIcon} aria-hidden="true">
    <Image
      src="/images/other/up-arrow.png"
      alt=""
      width={22}
      height={22}
      draggable={false}
    />
  </span>
</button>


</div>

        <BottomNav onOffsetChange={setNavOffsetY} />
      </div>
    </main>
  );
}
