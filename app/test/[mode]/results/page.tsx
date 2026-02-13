/* app/test/[mode]/results/page.tsx */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Image from "next/image";
import styles from "./results.module.css";
import { loadDataset } from "@/lib/qbank/loadDataset";
import type { DatasetId } from "@/lib/qbank/datasets";
import type { Question } from "@/lib/qbank/types";
import { attemptStore } from "@/lib/attempts/store";
import type { TestAttemptV1 } from "@/lib/attempts/engine";
import { useAuthStatus } from "@/components/useAuthStatus";
import { normalizeUserKey } from "@/lib/attempts/engine";
import { useBookmarks } from "@/lib/bookmarks/useBookmarks";
import { TEST_MODES, type TestModeId } from "@/lib/testModes";
import { useClearedMistakes } from "@/lib/mistakes/useClearedMistakes";
import CSRBoundary from "@/components/CSRBoundary";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRowChoice(v: string | null | undefined): "R" | "W" | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "r" || t === "right") return "R";
  if (t === "w" || t === "wrong") return "W";
  return null;
}

type ReviewItem = {
  qid: string;
  testNo: number;
  prompt: string;
  imageSrc?: string;
  options: { key: string; text: string; tone: "neutral" | "correct" | "wrong" }[];
  explanation?: string;
};

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const params = useParams<{ mode: string }>();

  const modeId = (params.mode ?? "real") as TestModeId;
  const cfg = TEST_MODES[modeId] ?? TEST_MODES.real;

  // attemptId from query
  const attemptId = sp.get("attemptId");

  // time display from query (optional)
const usedSecondsRaw = Number(sp.get("usedSeconds") ?? "0");
const usedSeconds =
  Number.isFinite(usedSecondsRaw) && usedSecondsRaw > 0 ? Math.floor(usedSecondsRaw) : 0;

const limitSecondsRaw = Number(sp.get("limitSeconds") ?? "0");
const limitSeconds = Number.isFinite(limitSecondsRaw) ? Math.floor(limitSecondsRaw) : 0;

// Untimed if no limit was provided (practice should push limitSeconds=0)
const showUntimed = limitSeconds <= 0;

const timeMin = Math.floor(usedSeconds / 60);
const timeSec = usedSeconds % 60;
const timeText = showUntimed ? "Untimed" : `${timeMin}min ${timeSec}sec`;


const { email } = useAuthStatus();
const userKey = normalizeUserKey(email ?? "") || "guest";

  const [attempt, setAttempt] = useState<TestAttemptV1 | null>(null);
  const [computed, setComputed] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const [viewMode, setViewMode] = useState<"list" | "carousel">("list");
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  // datasetId for bookmarks should come from attempt if possible; fallback to mode config
  const datasetId = ((attempt?.datasetId ?? cfg.datasetId) as unknown) as DatasetId;
  const { toggle, isBookmarked } = useBookmarks(datasetId, userKey);


  const { clearMany: clearMistakesMany } = useClearedMistakes(datasetId, userKey);
  const didAutoClearRef = useRef(false);

  /**
   * ✅ SELF-HEAL:
   * If user visits /test/[mode]/results with NO attemptId,
   * find the newest attempt for this mode and redirect with attemptId.
   */
 const qs = sp.toString();

useEffect(() => {
  if (attemptId) return;

  (async () => {
    const list = await attemptStore.listAttempts(userKey, cfg.datasetId);
    const matching = list.filter(
      (a) => a.modeKey === cfg.modeKey && a.datasetVersion === cfg.datasetVersion
    );
    const ranked = [...matching].sort(
      (a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)
    );
    const best = ranked[0];

    if (!best?.attemptId) {
      router.replace(`/test/${cfg.modeId}`);
      return;
    }

    const next = new URLSearchParams(qs);
    next.set("attemptId", best.attemptId);
    router.replace(`/test/${cfg.modeId}/results?${next.toString()}`);
  })();
}, [attemptId, userKey, cfg, router, qs]);


  // Carousel pointer handlers
  const onCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;

    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) return;

    const el = carouselRef.current;
    if (!el) return;

    dragRef.current.down = true;
    dragRef.current.moved = false;
    dragRef.current.startX = e.clientX;
    dragRef.current.startLeft = el.scrollLeft;

    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
  };

  const onCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (!dragRef.current.down) return;

    const el = carouselRef.current;
    if (!el) return;

    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;

    el.scrollLeft = dragRef.current.startLeft - dx;
  };

  const snapToNearestSlide = () => {
    const el = carouselRef.current;
    if (!el) return;

    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    el.scrollTo({ left: idx * w, behavior: "smooth" });
  };

  const onCarouselPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;

    const el = carouselRef.current;
    if (!el) return;

    dragRef.current.down = false;
    setIsDragging(false);

    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}

    snapToNearestSlide();
  };

  useEffect(() => {
    if (viewMode !== "carousel") return;

    const el = carouselRef.current;
    if (!el) return;

    const onScroll = () => {
      const w = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / w);
      setActiveSlide(Math.max(0, Math.min(idx, reviewItems.length - 1)));
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [viewMode, reviewItems.length]);

  // Load attempt + compute
  useEffect(() => {
    if (!attemptId) return;

    (async () => {
      const a = await attemptStore.readAttemptById(attemptId);
      setAttempt(a);

      if (!a) return;

      const ds = await loadDataset(a.datasetId as DatasetId);
      const byId = new Map(ds.map((q) => [q.id, q] as const));
      const picked = a.questionIds.map((id: string) => byId.get(id)).filter(Boolean) as Question[];

      // score
      let correct = 0;
const correctIds: string[] = [];

for (const q of picked) {
  const chosenKey = a.answersByQid[q.id]?.choice ?? null;
  if (!chosenKey) continue;

  let isCorrect = false;

  if (q.type === "ROW") {
    const chosen = normalizeRowChoice(chosenKey);
    const expected = normalizeRowChoice((q as any).correctRow ?? null);
    isCorrect = !!(chosen && expected && chosen === expected);
  } else {
    const chosenOpt = q.options.find((opt, idx) => {
      const k = opt.originalKey ?? String.fromCharCode(65 + idx);
      return k === chosenKey;
    });

    if (chosenOpt && (q as any).correctOptionId && chosenOpt.id === (q as any).correctOptionId) {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    correct += 1;
    correctIds.push(q.id);
  }
}

setComputed({ correct, total: picked.length });

// ✅ auto-clear ONLY for mistakes mode, only once
if (modeId === "mistakes" && !didAutoClearRef.current) {
  didAutoClearRef.current = true;
  if (correctIds.length) clearMistakesMany(correctIds);
}


      // WRONG-only review items
      const items: ReviewItem[] = [];
      for (let i = 0; i < picked.length; i++) {
        const q = picked[i];
        const testNo = i + 1;

        const chosenKey = a.answersByQid[q.id]?.choice ?? null;
        const qType = String((q as any).type ?? "").toUpperCase();

        const assets = (q as any).assets;
        const imageAsset = Array.isArray(assets)
          ? assets.find((x: any) => x?.kind === "image" && typeof x?.src === "string")
          : null;
        const imageSrc = imageAsset?.src as string | undefined;

        if (qType === "ROW") {
          const correctRow = normalizeRowChoice((q as any).correctRow ?? null);
          const chosenRow = normalizeRowChoice(chosenKey);
          const isCorrect = !!(chosenRow && correctRow && chosenRow === correctRow);
          if (isCorrect) continue;

          items.push({
            qid: (q as any).id,
            testNo,
            prompt: (q as any).prompt,
            imageSrc,
            options: [
              { key: "R", text: "R. Right", tone: correctRow === "R" ? "correct" : chosenRow === "R" ? "wrong" : "neutral" },
              { key: "W", text: "W. Wrong", tone: correctRow === "W" ? "correct" : chosenRow === "W" ? "wrong" : "neutral" },
            ],
            explanation: (q as any).explanation,
          });
          continue;
        }

        const correctOptionId = (q as any).correctOptionId as string | undefined;
        const opts = Array.isArray((q as any).options) ? (q as any).options : [];

        const chosenOpt =
          chosenKey
            ? opts.find((opt: any, idx: number) => {
                const k = opt?.originalKey ?? String.fromCharCode(65 + idx);
                return k === chosenKey;
              })
            : null;

        const isCorrect = !!(chosenOpt && correctOptionId && chosenOpt.id === correctOptionId);
        if (isCorrect) continue;

        const correctIndex = opts.findIndex((opt: any) => opt?.id === correctOptionId);
        const correctKey =
          correctIndex >= 0
            ? (opts[correctIndex].originalKey ?? String.fromCharCode(65 + correctIndex))
            : null;

        items.push({
          qid: (q as any).id,
          testNo,
          prompt: (q as any).prompt,
          imageSrc,
          options: opts.map((opt: any, idx: number) => {
            const key = opt?.originalKey ?? String.fromCharCode(65 + idx);
            const text = `${key}. ${opt?.text ?? ""}`;
            let tone: "neutral" | "correct" | "wrong" = "neutral";
            if (correctKey && key === correctKey) tone = "correct";
            if (chosenKey && key === chosenKey && key !== correctKey) tone = "wrong";
            return { key, text, tone };
          }),
          explanation: (q as any).explanation,
        });
      }

      setBrokenImages({});
      items.sort((x, y) => x.testNo - y.testNo);
      setReviewItems(items);
    })();
  }, [attemptId, modeId, clearMistakesMany]);




  // Close attempt once
  useEffect(() => {
    if (!attemptId) return;
    void attemptStore.closeAttemptById(attemptId);
  }, [attemptId]);

  const pct = useMemo(() => {
    const t = computed.total > 0 ? computed.total : 1;
    return clamp(computed.correct / t, 0, 1);
  }, [computed.correct, computed.total]);
  const percent = useMemo(() => Math.round(pct * 100), [pct]);

  // While self-healing redirect runs, show a tiny placeholder (prevents flashing "Missing attemptId")
  if (!attemptId) {
    return (
  <div className={styles.viewport} data-noswipeback="true">
    <main className={styles.screen}>

          <div className={styles.card} />
          <div style={{ padding: 16 }}>Loading results…</div>
        </main>
      </div>
    );
  }

  // ---- UI BELOW (your existing layout) ----
  return (
  <div className={styles.viewport} data-noswipeback="true">
    <main className={styles.screen}>

        <div className={styles.card} />
        <div className={styles.shiftUp}>
          <h1 className={styles.congrats}>Congratulations!</h1>

          <div className={styles.ringWrap} aria-label="Score progress">
            <div className={styles.ring} style={{ "--p": `${pct * 360}deg` } as React.CSSProperties} />
            <div className={styles.ringCenterText}>{percent}</div>
          </div>

          <div className={styles.scoreBox} aria-hidden="true">
            <div className={styles.lineTop} />
            <div className={styles.lineBottom} />
            <div className={styles.lineMid} />

            <div className={styles.scoreLeft}>
              <div className={styles.scoreValue}>
                {computed.correct}/{computed.total || 0}
              </div>
              <div className={styles.scoreLabel}>Score</div>
            </div>

            <div className={styles.scoreRight}>
              <div className={styles.scoreValue}>{timeText}</div>
              <div className={styles.scoreLabel}>Time</div>
            </div>
          </div>

          <div className={styles.testResultsTitle}>Test Results</div>

          <div className={styles.incorrectRow}>
            <Image src="/images/test/red-x-icon.png" alt="Red X Icon" width={24} height={24} className={styles.btnIcon} />
            <div className={styles.incorrectText}>Incorrect</div>
            <div className={styles.incorrectSpacer} />

            {reviewItems.length > 0 && viewMode === "carousel" && (
              <div className={styles.slideCounter}>
                {activeSlide + 1}/{reviewItems.length}
              </div>
            )}

            <button
              type="button"
              className={styles.viewToggle}
              onClick={() => setViewMode((v) => (v === "list" ? "carousel" : "list"))}
              aria-pressed={viewMode === "carousel"}
              aria-label={viewMode === "carousel" ? "Switch to list view" : "Switch to swipe view"}
              title={viewMode === "carousel" ? "List view" : "Swipe view"}
            >
              <Image
                src={viewMode === "carousel" ? "/images/test/list-icon.png" : "/images/test/carousel-icon.png"}
                alt=""
                width={18}
                height={18}
              />
            </button>
          </div>

          <section 
          data-noswipeback={viewMode === "carousel" ? "true" : undefined}
          className={[styles.reviewArea, viewMode === "carousel" ? styles.reviewAreaCarousel : ""].join(" ")}>
            {reviewItems.length === 0 ? (
              <p className={styles.question}>Expatise! No incorrect questions! 🎉</p>
            ) : viewMode === "list" ? (
              reviewItems.map((it) => (
                <article key={it.qid} style={{ marginBottom: 18 }}>
                  <div className={styles.questionRow}>
                    <p className={[styles.question, styles.questionText].join(" ")}>
                      {it.testNo}. {it.prompt}
                    </p>

                    <button
                      type="button"
                      className={styles.bookmarkBtn}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(it.qid);
                      }}
                      aria-label={isBookmarked(it.qid) ? "Remove bookmark" : "Add bookmark"}
                      title={isBookmarked(it.qid) ? "Bookmarked" : "Bookmark"}
                      data-bookmarked={isBookmarked(it.qid) ? "true" : "false"}
                    >
                      <span className={styles.bookmarkIcon} aria-hidden="true" />
                    </button>
                  </div>

                  <div className={styles.qaRow}>
                    {it.imageSrc && !brokenImages[it.qid] ? (
                      <div className={styles.imageWrap}>
                        <Image
                          src={it.imageSrc}
                          alt="Question image"
                          fill
                          sizes="120px"
                          className={styles.image}
                          unoptimized
                          onError={() => setBrokenImages((p) => ({ ...p, [it.qid]: true }))}
                        />
                      </div>
                    ) : null}

                    <div className={styles.options}>
                      {it.options.map((o) => (
                        <div
                          key={o.key}
                          className={[
                            styles.option,
                            o.tone === "correct"
                              ? styles.optionCorrect
                              : o.tone === "wrong"
                              ? styles.optionWrong
                              : styles.optionNeutral,
                          ].join(" ")}
                        >
                          {o.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {(it.explanation ?? "").trim().length > 0 && (
                    <>
                      <div className={styles.exTitle}>Explanation:</div>
                      <div className={styles.exBody}>{it.explanation}</div>
                    </>
                  )}
                </article>
              ))
            ) : (
              <div
                ref={carouselRef}
                className={[styles.carousel, isDragging ? styles.carouselDragging : ""].join(" ")}
                onPointerDown={onCarouselPointerDown}
                onPointerMove={onCarouselPointerMove}
                onPointerUp={onCarouselPointerUpOrCancel}
                onPointerCancel={onCarouselPointerUpOrCancel}
                onClickCapture={(e) => {
                  if (dragRef.current.moved) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragRef.current.moved = false;
                  }
                }}
              >
                {reviewItems.map((it) => (
                  <div key={it.qid} className={styles.slide}>
                    <article>
                      <div className={styles.questionRow}>
                        <p className={[styles.question, styles.questionText].join(" ")}>
                          {it.testNo}. {it.prompt}
                        </p>

                        <button
                          type="button"
                          className={styles.bookmarkBtn}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(it.qid);
                          }}
                          aria-label={isBookmarked(it.qid) ? "Remove bookmark" : "Add bookmark"}
                          title={isBookmarked(it.qid) ? "Bookmarked" : "Bookmark"}
                          data-bookmarked={isBookmarked(it.qid) ? "true" : "false"}
                        >
                          <span className={styles.bookmarkIcon} aria-hidden="true" />
                        </button>
                      </div>

                      <div className={styles.qaRow}>
                        {it.imageSrc && !brokenImages[it.qid] ? (
                          <div className={styles.imageWrap}>
                            <Image
                              src={it.imageSrc}
                              alt="Question image"
                              fill
                              sizes="120px"
                              className={styles.image}
                              unoptimized
                              draggable={false}
                              onError={() => setBrokenImages((p) => ({ ...p, [it.qid]: true }))}
                            />
                          </div>
                        ) : null}

                        <div className={styles.options}>
                          {it.options.map((o) => (
                            <div
                              key={o.key}
                              className={[
                                styles.option,
                                o.tone === "correct"
                                  ? styles.optionCorrect
                                  : o.tone === "wrong"
                                  ? styles.optionWrong
                                  : styles.optionNeutral,
                              ].join(" ")}
                            >
                              {o.text}
                            </div>
                          ))}
                        </div>
                      </div>

                      {(it.explanation ?? "").trim().length > 0 && (
                        <>
                          <div className={styles.exTitle}>Explanation:</div>
                          <div className={styles.exBody}>{it.explanation}</div>
                        </>
                      )}
                    </article>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button type="button" className={styles.continueBtn} onClick={() => router.push("/")}>
            <span className={styles.continueText}>Home</span>
            <Image src="/images/other/right-arrow.png" alt="Home" width={18} height={18} className={styles.btnIcon} />
          </button>
        </div>
      </main>
    </div>
  );
}

export default function TestModeResultsPage() {
  return (
    <CSRBoundary>
      <Inner />
    </CSRBoundary>
  );
}