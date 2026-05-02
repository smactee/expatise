// app/all-questions/AllQuestionsClient.client.tsx

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import QuestionExplanationToggle from '@/components/QuestionExplanationToggle';
import styles from './all-questions.module.css';
import { loadDataset } from '@/lib/qbank/loadDataset';
import type { DatasetId } from '@/lib/qbank/datasets';
import type { Question } from '@/lib/qbank/types';
import { TAG_TAXONOMY, labelForTag } from '@/lib/qbank/tagTaxonomy';
import { deriveTopicSubtags } from '@/lib/qbank/deriveTopicSubtags';
import { getTranslatedOnlyLocaleNotice, isTranslatedOnlyQuestionLocale } from '@/lib/qbank/localeSupport';
import { loadImageColorTags, type QuestionImageColorEntry } from '@/lib/qbank/loadImageColorTags';
import { useBookmarks } from "@/lib/bookmarks/useBookmarks"; // adjust path if you use "@/lib/..."
import BackButton from '@/components/BackButton';
import { useClearedMistakes } from '@/lib/mistakes/useClearedMistakes';
import { attemptStore } from "@/lib/attempts/store";
import type { Attempt } from "@/lib/attempts/attemptStore";
import { useUserKey } from "@/components/useUserKey.client";
import { isAnswerCorrect } from '@/lib/grading/isAnswerCorrect';
import PremiumFeatureModal from '@/components/PremiumFeatureModal';
import { useAuthStatus } from '@/components/useAuthStatus';
import { useEntitlements } from '@/components/EntitlementsProvider.client';
import { useUsageCap } from '@/lib/freeAccess/useUsageCap';
import { userKeyFromEmail } from '@/lib/identity/userKey';
import { migrateLocalAttemptsToCanonical } from '@/lib/test-engine/attemptStorage';
import { useT } from '@/lib/i18n/useT';
import { getRowDisplayLabel } from '@/lib/qbank/rowDisplay';





function normalizeRowChoice(v: string | null | undefined): "R" | "W" | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "r" || t === "right") return "R";
  if (t === "w" || t === "wrong") return "W";
  return null;
}

function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptySearchQuery(query: string | null | undefined): boolean {
  return String(query ?? "").trim().length === 0;
}

function tokenizeSearchText(text: string | null | undefined): string[] {
  return normalizeSearchText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function searchTokenMatches(queryToken: string, textToken: string): boolean {
  if (queryToken === textToken) return true;

  // Keep searches token-aware: "ice" should not match "police" or "service".
  // Allow a small common adjective variant so "ice" can still find "icy".
  if (queryToken.endsWith("e") && textToken === `${queryToken.slice(0, -1)}y`) {
    return true;
  }

  return false;
}

function matchesSearchToken(queryToken: string, searchableText: string): boolean {
  return tokenizeSearchText(searchableText).some((textToken) => searchTokenMatches(queryToken, textToken));
}

function matchesSearchQuery(searchableText: string, queryTokens: string[]): boolean {
  return queryTokens.every((token) => matchesSearchToken(token, searchableText));
}

const IMAGE_FILTER_TOKEN_RE = /\bimage\b/i;
const IMAGE_FILTER_TOKEN_GLOBAL_RE = /\bimage\b/gi;
const UNCLASSIFIED_FILTER_TOKEN_RE = /\bunclassified\b/i;
const UNCLASSIFIED_FILTER_TOKEN_GLOBAL_RE = /\bunclassified\b/gi;

function queryWantsImageOnly(query: string): boolean {
  return IMAGE_FILTER_TOKEN_RE.test(query);
}

function stripImageFilterToken(query: string): string {
  return query.replace(IMAGE_FILTER_TOKEN_GLOBAL_RE, " ").replace(/\s+/g, " ").trim();
}

function queryWantsUnclassifiedOnly(query: string): boolean {
  return UNCLASSIFIED_FILTER_TOKEN_RE.test(query);
}

function stripUnclassifiedFilterToken(query: string): string {
  return query.replace(UNCLASSIFIED_FILTER_TOKEN_GLOBAL_RE, " ").replace(/\s+/g, " ").trim();
}

type QuestionSearchIndex = {
  normalizedText: string;
  rawFields: string[];
};

function rawSearchField(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesRawSearchQuery(searchIndex: QuestionSearchIndex | undefined, rawQuery: string): boolean {
  const needle = rawSearchField(rawQuery);
  if (!needle) return true;

  return searchIndex?.rawFields.some((field) => field.includes(needle)) ?? false;
}

function hasQuestionImage(item: Question): boolean {
  return Array.isArray(item.assets) && item.assets.some((asset) =>
    asset?.kind === "image" && typeof asset?.src === "string" && asset.src.trim().length > 0
  );
}

function isConcreteClassificationTag(tag: string, type: "topic" | "subtopic"): boolean {
  const normalized = String(tag ?? "").trim().toLowerCase();
  if (!normalized || normalized === "unclassified" || normalized === "uncategorized" || normalized === "unknown") {
    return false;
  }

  return type === "topic"
    ? !normalized.includes(":")
    : normalized.includes(":") && !normalized.endsWith(":all");
}

function isUnclassifiedQuestion(derivedTags: string[]): boolean {
  const hasTopic = derivedTags.some((tag) => isConcreteClassificationTag(tag, "topic"));
  const hasSubtopic = derivedTags.some((tag) => isConcreteClassificationTag(tag, "subtopic"));

  return !(hasTopic && hasSubtopic);
}

function parseExplicitFilterTokens(value: string | null | undefined): string[] | null {
  const raw = String(value ?? "");
  if (!/\s{2,}/.test(raw)) return null;

  return raw
    .split(/\s{2,}/)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);
}

function matchesExplicitFilterToken(token: string, searchableText: string, questionNumber: number): boolean {
  if (/^\d+$/.test(token) && Number(token) === questionNumber) {
    return true;
  }

  return matchesSearchToken(token, searchableText);
}

function toSearchTermList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined
    ? []
    : [value];

  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function searchableImageMetadataTerms(colorEntry: QuestionImageColorEntry | undefined): string[] {
  if (!colorEntry) return [];

  return [
    colorEntry.colorTags,
    colorEntry.objectTags,
    colorEntry.pinyinText,
    colorEntry.chineseText,
    colorEntry.hanziText,
    colorEntry.signText,
    colorEntry.ocrText,
  ]
    .flatMap(toSearchTermList);
}

function buildQuestionSearchIndex(
  item: Question,
  derivedTags: string[],
  colorEntry: QuestionImageColorEntry | undefined,
  t: ReturnType<typeof useT>["t"],
): QuestionSearchIndex {
  const tagLabels = derivedTags.map((tag) => labelForTag(tag, t));
  const colorTags = colorEntry?.colorTags ?? [];
  const imageMetadataTerms = searchableImageMetadataTerms(colorEntry);
  const roadSignHeuristics: string[] = [];
  const isRoadSignQuestion =
    derivedTags.includes("traffic-signals:road-signs") ||
    item.autoTags.some((tag) => tag.includes("traffic-signs")) ||
    item.tags.some((tag) => tag.includes("traffic-signs"));

  if (isRoadSignQuestion) {
    for (const color of colorTags) {
      roadSignHeuristics.push(`${color} sign`, `${color}-sign`);
    }
    if (colorTags.includes("yellow")) {
      roadSignHeuristics.push("warning", "warning sign", "yellow warning");
    }
    if (colorTags.includes("brown")) {
      roadSignHeuristics.push("tourist", "tourist sign", "brown tourist");
    }
  }

  const parts = [
    item.id,
    String(item.number),
    item.prompt,
    item.sourcePrompt,
    item.explanation,
    item.sourceExplanation,
    item.type,
    ...item.options.map((option) => option.text),
    ...item.sourceOptions.map((option) => option.text),
    ...item.tags,
    ...item.autoTags,
    ...derivedTags,
    ...tagLabels,
    ...imageMetadataTerms,
    ...roadSignHeuristics,
  ];

  const rawFields = parts.map(rawSearchField).filter(Boolean);

  return {
    normalizedText: normalizeSearchText(parts.filter(Boolean).join(" ")),
    rawFields,
  };
}


function isCorrectMcq(item: Question, optId: string, optKey?: string) {
  if (item.type !== 'MCQ' || !item.correctOptionId) return false;
  return item.correctOptionId === optId || (optKey && item.correctOptionId === optKey);
}

export default function AllQuestionsClient({ datasetId, mode = 'all' }: { datasetId: DatasetId; mode?: 'all' | 'bookmarks' | 'mistakes' }) {
  // ✅ 1) hooks first
const userKey = useUserKey();
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { isPremium } = useEntitlements();
  const { isOverCap } = useUsageCap();
  const premiumModalRequested = sp.get('premiumModal') === '1';

  // ✅ 3) now it's safe to use userKey
  const { idSet: bookmarkedSet, isBookmarked, toggle, removeMany } = useBookmarks(datasetId, userKey);
  const {
  idSet: clearedMistakesSet,
  clearMany: clearMistakesMany,
} = useClearedMistakes(datasetId, userKey);

  
  const [q, setQ] = useState<Question[]>([]);
  const [imageColorTagsById, setImageColorTagsById] = useState<Record<string, QuestionImageColorEntry>>({});
  const [, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);

  // ✅ Selection (only used in Bookmarks mode)
const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
const [showToTop, setShowToTop] = useState(false);
const [navOffsetY, setNavOffsetY] = useState(0);
const lastYRef = useRef(0);

const [submittedAttempts, setSubmittedAttempts] = useState<Attempt[]>([]);
const [showPremiumModal, setShowPremiumModal] = useState(false);

const { authed: supabaseAuthed, email } = useAuthStatus();
const legacyAttemptUserKey = userKeyFromEmail(email);

useEffect(() => {
  if (!premiumModalRequested) return;

  if (!isPremium && isOverCap) {
    setShowPremiumModal(true);
  }

  const next = new URLSearchParams(sp.toString());
  next.delete('premiumModal');
  const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname;
  router.replace(nextUrl, { scroll: false });
}, [isOverCap, isPremium, pathname, premiumModalRequested, router, sp]);



  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [data, imageColorTags] = await Promise.all([
          loadDataset(datasetId, {
            locale,
            translatedOnly: isTranslatedOnlyQuestionLocale(locale),
          }),
          loadImageColorTags(datasetId),
        ]);
        if (alive) {
          setQ(data);
          setImageColorTagsById(imageColorTags);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [datasetId, locale]);

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
    return isUnclassifiedQuestion(tags);
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

const searchIndexById = useMemo(() => {
  const index = new Map<string, QuestionSearchIndex>();

  for (const item of q) {
    const derivedTags = derivedById.get(item.id) ?? [];
    index.set(item.id, buildQuestionSearchIndex(item, derivedTags, imageColorTagsById[item.id], t));
  }

  return index;
}, [derivedById, imageColorTagsById, q, t]);

useEffect(() => {
  if (mode !== "bookmarks" && mode !== "mistakes") {
    setSelectedIds(new Set());
  }
}, [mode]);



  const filtered = useMemo(() => {
    const rawQuery = query.trim();
    const wantsImageOnly = queryWantsImageOnly(rawQuery);
    const wantsUnclassifiedOnly = queryWantsUnclassifiedOnly(rawQuery);
    const queryWithoutImage = wantsImageOnly ? stripImageFilterToken(rawQuery) : rawQuery;
    const textQuery = wantsUnclassifiedOnly ? stripUnclassifiedFilterToken(queryWithoutImage) : queryWithoutImage;
    const isSearching = !isEmptySearchQuery(textQuery);
    const explicitFilterTokens = parseExplicitFilterTokens(textQuery);
    const qNorm = normalizeSearchText(textQuery);
    const queryTerms = explicitFilterTokens === null && qNorm ? qNorm.split(" ").filter(Boolean) : [];

    return q.filter((item) => {
      const derivedTagList = derivedById.get(item.id) ?? [];
      const derivedTags = new Set(derivedTagList);
      const matchesTopic = !activeTopic || derivedTags.has(activeTopic);
      const matchesSub = !activeTopic || !activeSub || derivedTags.has(activeSub);
      if (!matchesTopic || !matchesSub) return false;

      if (wantsImageOnly && !hasQuestionImage(item)) return false;
      if (wantsUnclassifiedOnly && !isUnclassifiedQuestion(derivedTagList)) return false;

      const searchIndex = searchIndexById.get(item.id);
      const searchableText = searchIndex?.normalizedText ?? "";

      const qDigits = textQuery.replace(/[^0-9]/g, ""); // allows "103", "#103", "103."
      const matchesNumber = qDigits.length > 0 && Number(qDigits) === item.number;


      const matchesText =
        !isSearching
          ? true
          : qNorm.length === 0
          ? matchesRawSearchQuery(searchIndex, textQuery)
          : explicitFilterTokens !== null
          ? explicitFilterTokens.length === 0 ||
            explicitFilterTokens.every((token) => matchesExplicitFilterToken(token, searchableText, item.number))
          : matchesNumber ||
            matchesSearchQuery(searchableText, queryTerms);

      return matchesText;
    });
  }, [q, query, activeTopic, activeSub, derivedById, searchIndexById]);


type MistakeMeta = { wrongCount: number; lastWrongAt: number };

const mistakesMetaById = useMemo(() => {
  if (mode !== 'mistakes') return new Map<string, MistakeMeta>();
  if (q.length === 0) return new Map<string, MistakeMeta>();

  const byId = new Map(q.map((item) => [item.id, item] as const));
  const attempts = submittedAttempts;

  const meta = new Map<string, MistakeMeta>();

  for (const a of attempts) {
    for (const [qid, rec] of Object.entries(a.answersByQid ?? {})) {
      const question = byId.get(qid);
      if (!question) continue;

      const chosenKey = rec?.choice ?? null;
      if (!chosenKey) continue;

      const isCorrect = isAnswerCorrect(question, chosenKey);
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
      migrateLocalAttemptsToCanonical({
        userKey,
        legacyUserKeys: [legacyAttemptUserKey, "guest"],
      });

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
}, [mode, userKey, legacyAttemptUserKey, datasetId]);


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
}, [filtered, mode, bookmarkedSet, mistakesMetaById, clearedMistakesSet]);



function clearSelection() {
  setSelectedIds(new Set());
}

function unbookmarkSelected() {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  removeMany(ids);
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

function toggleCardSelection(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
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

// Total compiled mistakes (independent of search/topic filters)
const compiledMistakesCount = useMemo(() => {
  if (mode !== "mistakes") return 0;
  if (mistakesMetaById.size === 0) return 0;

  let n = 0;
  for (const id of mistakesMetaById.keys()) {
    if (!clearedMistakesSet.has(id)) n++;
  }
  return n;
}, [mode, mistakesMetaById, clearedMistakesSet]);

// Total compiled bookmarks (independent of search/topic filters)
const compiledBookmarksCount = useMemo(() => {
  if (mode !== "bookmarks") return 0;
  if (q.length === 0) return 0;

  let n = 0;
  for (const item of q) {
    if (bookmarkedSet.has(item.id)) n++;
  }
  return n;
}, [mode, q, bookmarkedSet]);

const premiumNextPath =
  mode === "bookmarks" ? "/bookmarks" : mode === "mistakes" ? "/my-mistakes" : "/all-questions";

const premiumPath = `/premium?next=${encodeURIComponent(premiumNextPath)}`;
const betaNotice = getTranslatedOnlyLocaleNotice(locale, q.length);


  return (
<main className={styles.page}>
  <div className={styles.backButtonFixed}>
    <BackButton />
  </div>

  <div className={styles.frame}>

<header className={styles.header}>
  <div className={styles.titleWrap}>
  <h1 className={styles.title}>
    {mode === "bookmarks"
      ? t("questionReview.myBookmarksTitle")
      : mode === "mistakes"
      ? t("questionReview.myMistakesTitle")
      : t("questionReview.allQuestionsTitle")}
  </h1>

  {mode === "mistakes" && compiledMistakesCount > 0 && (
    <span className={styles.countPill} aria-label={t("questionReview.countAria", { count: compiledMistakesCount })}>
      {compiledMistakesCount}
    </span>
  )}

  {mode === "bookmarks" && compiledBookmarksCount > 0 && (
    <span className={styles.countPill} aria-label={t("questionReview.countAria", { count: compiledBookmarksCount })}>
      {compiledBookmarksCount}
    </span>
  )}
</div>

  <div className={styles.headerActions}>
    {mode === "mistakes" && (
      <button
        type="button"
        className={styles.quizBtn}
        onClick={() => setShowPremiumModal(true)}
      >
        {t("questionReview.mistakesQuiz")}
      </button>
    )}

    {mode === "bookmarks" && (
      <button
        type="button"
        className={styles.quizBtn}
        onClick={() => setShowPremiumModal(true)}
      >
        {t("questionReview.bookmarksQuiz")}
      </button>
    )}
  </div>
</header>





        {betaNotice ? <p className={styles.betaNotice}>{betaNotice}</p> : null}

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder={t("questionReview.searchPlaceholder")}
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
          {labelForTag(topic.key, t)}
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
        aria-label={t("questionReview.deleteBookmarksAria", { count: selectedIds.size })}
        title={t("questionReview.deleteBookmarksAria", { count: selectedIds.size })}
      >
        {t("shared.common.delete")}
      </button>
    )}

    {selectedIds.size > 0 && mode === "mistakes" && (
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={clearMistakesSelected}
        aria-label={t("questionReview.removeMistakesAria", { count: selectedIds.size })}
        title={t("questionReview.removeMistakesAria", { count: selectedIds.size })}
      >
        {t("shared.common.delete")}
      </button>
    )}

    <button
      type="button"
      className={styles.selectAllBtn}
      onClick={toggleSelectAllVisible}
      aria-label={allVisibleSelected ? t("questionReview.clearSelectionAria") : t("questionReview.selectAllVisibleAria")}
      title={allVisibleSelected ? t("questionReview.clearSelectionTitle") : t("questionReview.selectAllTitle")}
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
          {labelForTag(sub.key, t)}
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
    // Only allow toggling when you're in bulk-select mode
    if (mode !== "bookmarks" && mode !== "mistakes") return;
    if (selectedIds.size === 0) return;

    // Ignore clicks from interactive elements inside the card
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) return;

    // ✅ toggle select/unselect
    toggleCardSelection(item.id);
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
          {topicKey ? labelForTag(topicKey, t) : t('questionReview.unclassified')}
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
  aria-label={isBookmarked(item.id) ? t('shared.bookmarks.removeAria') : t('shared.bookmarks.addAria')}
  title={isBookmarked(item.id) ? t('shared.bookmarks.activeTitle') : t('shared.bookmarks.idleTitle')}
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
                    alt={t('shared.questionImageAlt')}
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
  <ul className={styles.optionList}>
    {(['R', 'W'] as const).map((k) => {
      const correct = normalizeRowChoice(item.correctRow) === k;

      return (
        <li
          key={k}
          className={`${styles.option} ${correct ? styles.optionCorrect : ''}`}
        >
          <span className={styles.optionKey}>{getRowDisplayLabel(k, locale)}</span>
        </li>
      );
    })}
  </ul>
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

<QuestionExplanationToggle
  explanation={item.explanation ?? item.sourceExplanation}
  label={t('results.explanation')}
/>

<div className={styles.tagRow}>
  {(() => {
    const tags = derivedById.get(item.id) ?? [];
    const subs = tags.filter((tag) => tag.includes(":") && !tag.endsWith(":all"));
    return subs.map((tag) => (
      <span key={tag} className={styles.tagPill}>
        {labelForTag(tag, t)}
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
  aria-label={t('shared.scrollToTop.ariaLabel')}
  title={t('shared.scrollToTop.title')}
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

        <PremiumFeatureModal
          open={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          nextPath={premiumNextPath}
          isAuthed={supabaseAuthed}
          premiumPath={premiumPath}
        />
      </div>
    </main>
  );
}
