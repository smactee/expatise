"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import BackButton from "@/components/BackButton";

import type { DatasetId } from "@/lib/qbank/datasets";
import type { Question } from "@/lib/qbank/types";
import { loadDataset } from "@/lib/qbank/loadDataset";

import { TAG_TAXONOMY, labelForTag } from "@/lib/qbank/tagTaxonomy";
import { deriveTopicSubtags } from "@/lib/qbank/deriveTopicSubtags";
import { useBookmarks } from "@/lib/bookmarks/useBookmarks";
import { useUserKey } from "@/components/useUserKey.client";

// ✅ Reuse the *same* CSS module to match All Questions exactly
import styles from "../all-questions/all-questions.module.css";

import { ROUTES } from "@/lib/routes";

type GlobalRow = {
  qid: string;
  wrong: number;
  total: number;
  score: number; // smoothed wrong rate (or plain wrong rate early)
};

function isCorrectMcq(item: Question, optId: string, optKey?: string) {
  if (item.type !== "MCQ" || !item.correctOptionId) return false;
  return item.correctOptionId === optId || (optKey && item.correctOptionId === optKey);
}

function normalizeRowChoice(v: string | null | undefined): "R" | "W" | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "r" || t === "right") return "R";
  if (t === "w" || t === "wrong") return "W";
  return null;
}

function hash01(s: string) {
  // tiny stable hash -> 0..1 (for mock preview mode)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export default function GlobalCommonMistakesClient({ datasetId }: { datasetId: DatasetId }) {
  const userKey = useUserKey();
  const { isBookmarked, toggle } = useBookmarks(datasetId, userKey);

  const [q, setQ] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);

  const [rows, setRows] = useState<GlobalRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);

  // scroll-to-top behavior (same as All Questions)
  const [showToTop, setShowToTop] = useState(false);
  const [navOffsetY, setNavOffsetY] = useState(0);
  const lastYRef = useRef(0);

  // 1) load dataset
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await loadDataset(datasetId);
        if (alive) setQ(data);
      } finally {
        if (alive) setLoadingQ(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [datasetId]);

  // 2) fetch global top list (API will be added later)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingRows(true);
      try {
        const res = await fetch(`/api/global-common-mistakes?datasetId=${encodeURIComponent(datasetId)}&limit=100`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("no api yet");
        const json = await res.json();

        const items: any[] = Array.isArray(json?.items) ? json.items : [];

        const parsed: GlobalRow[] = items
          .map((x) => {
            const qid = String(x?.qid ?? x?.questionId ?? "");
            const wrong = Number(x?.wrong ?? 0);
            const total = Number(x?.total ?? 0);
            const score =
              typeof x?.score === "number"
                ? x.score
                : total > 0
                ? (wrong + 1) / (total + 2) // fallback
                : 0;
            if (!qid) return null;
            return { qid, wrong, total, score };
          })
          .filter(Boolean) as GlobalRow[];

        if (alive) {
          setRows(parsed);
          setUsingMock(false);
        }
      } catch {
        // no backend yet -> keep empty for now (we’ll optionally show mock below)
        if (alive) setRows([]);
      } finally {
        if (alive) setLoadingRows(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [datasetId]);

  // 3) optional: mock preview so you can design the page now
  useEffect(() => {
    if (rows.length > 0) return;
    if (q.length === 0) return;

    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_GLOBAL_MISTAKES !== "true") return;

    const mock = q
      .map((item) => {
        const r = hash01(item.id); // 0..1
        const total = 50 + Math.floor(r * 200); // 50..250
        const wrongRate = 0.15 + r * 0.65; // 15%..80%
        const wrong = Math.round(total * wrongRate);
        const score = (wrong + 1) / (total + 2);
        return { qid: item.id, wrong, total, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    setRows(mock);
    setUsingMock(true);
  }, [rows.length, q]);

  const derivedById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const item of q) m.set(item.id, deriveTopicSubtags(item));
    return m;
  }, [q]);

  const metaById = useMemo(() => {
    const m = new Map<string, GlobalRow>();
    for (const r of rows) m.set(r.qid, r);
    return m;
  }, [rows]);

  // ranked questions, in API order
  const ranked = useMemo(() => {
    const order = new Map<string, number>();
    rows.forEach((r, i) => order.set(r.qid, i));

    const arr = q.filter((item) => order.has(item.id));
    arr.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
    return arr;
  }, [q, rows]);

  const filtered = useMemo(() => {
    const qNorm = query.trim().toLowerCase();
    const qDigits = qNorm.replace(/[^0-9]/g, "");

    return ranked.filter((item) => {
      const derivedTags = new Set(derivedById.get(item.id) ?? []);

      const matchesNumber = qDigits.length > 0 && Number(qDigits) === item.number;
      const matchesText =
        !qNorm ||
        matchesNumber ||
        item.prompt.toLowerCase().includes(qNorm) ||
        (item.autoTags ?? []).some((t) => t.toLowerCase().includes(qNorm));

      const matchesTopic = !activeTopic || derivedTags.has(activeTopic);
      const matchesSub = !activeTopic || !activeSub || derivedTags.has(activeSub);

      return matchesText && matchesTopic && matchesSub;
    });
  }, [ranked, query, activeTopic, activeSub, derivedById]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    lastYRef.current = window.scrollY;

    const MIN_Y_TO_SHOW = 320;
    const DELTA_THRESHOLD = 6;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastYRef.current;

      if (y < MIN_Y_TO_SHOW) {
        setShowToTop(false);
      } else if (delta < -DELTA_THRESHOLD) {
        setShowToTop(true);
      } else if (delta > DELTA_THRESHOLD) {
        setShowToTop(false);
      }

      lastYRef.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = ranked.length;

  return (
    <main className={styles.page}>
      <div className={styles.backButtonFixed}>
        <BackButton />
      </div>

      <div className={styles.frame}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            Global Common Mistakes
            {count > 0 && (
              <span className={styles.countPill} aria-label={`${count} questions`}>
                {count}
              </span>
            )}
          </h1>

          <div className={styles.headerActions}>
            {/* UI now, wiring later */}
            <button
              type="button"
              className={styles.quizBtn}
              disabled
              title="Quiz will unlock when global data is available"
              style={{ opacity: 0.6 }}
            >
              Global Mistakes Quiz
            </button>
          </div>

          {(usingMock || (!loadingRows && rows.length === 0)) && (
            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {usingMock
                ? "Preview rankings (mock data)."
                : "Not enough global data yet — this will fill in after backend is connected."}
            </p>
          )}
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder="Search question text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Topic chips */}
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
        </div>

        {/* Subtopic chips */}
        {activeTopic && (
          <div className={styles.chips}>
            {TAG_TAXONOMY.find((t) => t.key === activeTopic)!.subtopics.map((sub) => {
              const isActive = activeSub === sub.key;
              return (
                <button
                  key={sub.key}
                  type="button"
                  className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                  onClick={() => setActiveSub(isActive ? null : sub.key)}
                >
                  {sub.label.replace(/^#/, "")}
                </button>
              );
            })}
          </div>
        )}

        <section className={styles.list}>
          {(loadingQ || loadingRows) && (
            <p style={{ opacity: 0.8, padding: "8px 2px" }}>Loading…</p>
          )}

          {!loadingQ && !loadingRows && filtered.length === 0 && (
            <p style={{ opacity: 0.8, padding: "8px 2px" }}>
              No questions to show yet.
            </p>
          )}

          {filtered.map((item) => {
            const tags = derivedById.get(item.id) ?? [];
            const topicKey = tags.find((t) => !t.includes(":"));
            const meta = metaById.get(item.id);
            const pctWrong =
              meta && meta.total > 0 ? Math.round((meta.wrong / meta.total) * 100) : null;

            return (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.qNo}>{item.number}.</span>

                  <div className={styles.cardTopRight}>
                    <span className={styles.qType}>
                      {topicKey ? labelForTag(topicKey) : "Unclassified"}
                    </span>

                    {pctWrong !== null && (
                      <span className={styles.qType} title={`${meta!.wrong}/${meta!.total} wrong`}>
                        {pctWrong}% wrong
                      </span>
                    )}

                    <button
                      type="button"
                      className={styles.bookmarkBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(item.id);
                      }}
                      aria-label={isBookmarked(item.id) ? "Remove bookmark" : "Add bookmark"}
                      title={isBookmarked(item.id) ? "Bookmarked" : "Bookmark"}
                      data-bookmarked={isBookmarked(item.id) ? "true" : "false"}
                    >
                      <span className={styles.bookmarkIcon} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <p className={styles.prompt}>{item.prompt}</p>

                {item.assets[0]?.kind === "image" && (
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

                {/* Answers */}
                {item.type === "ROW" && item.correctRow && (
                  <div className={styles.answerRow}>
                    <span className={styles.answerLabel}>Answer</span>
                    <span className={styles.answerPill}>
                      {item.correctRow === "R" ? "Right" : item.correctRow === "W" ? "Wrong" : item.correctRow}
                    </span>
                  </div>
                )}

                {item.type === "MCQ" && item.options?.length > 0 && (
                  <ul className={styles.optionList}>
                    {item.options.map((opt) => {
                      const key = opt.originalKey ?? opt.id;
                      const correct = isCorrectMcq(item, opt.id, opt.originalKey);
                      return (
                        <li key={opt.id} className={`${styles.option} ${correct ? styles.optionCorrect : ""}`}>
                          <span className={styles.optionKey}>{key}.</span>
                          {opt.text}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className={styles.tagRow}>
                  {tags
                    .filter((t) => t.includes(":") && !t.endsWith(":all"))
                    .map((t) => (
                      <span key={t} className={styles.tagPill}>
                        {labelForTag(t)}
                      </span>
                    ))}
                </div>
              </article>
            );
          })}
        </section>

        {/* Scroll to top */}
        <div className={styles.toTopWrap} style={{ transform: `translateY(${navOffsetY}px)` }}>
          <button
            type="button"
            className={`${styles.toTopBtn} ${showToTop ? styles.toTopBtnVisible : ""}`}
            onClick={() => {
              const prefersReduced =
                typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
            }}
            aria-label="Scroll to top"
            title="Back to top"
          >
            <span className={styles.toTopIcon} aria-hidden="true">
              <Image src="/images/other/up-arrow.png" alt="" width={22} height={22} draggable={false} />
            </span>
          </button>
        </div>

        <BottomNav onOffsetChange={setNavOffsetY} />
      </div>
    </main>
  );
}
