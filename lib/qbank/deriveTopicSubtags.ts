// lib/qbank/deriveTopicSubtags.ts
import type { Question } from "./types";
import { SYLLABUS_RULES, type TopicKey, type SubtagKey } from "./syllabusKeywords";

/**
 * Strict classifier with trust weighting:
 * - Manual tags (item.tags) are highest trust
 * - Prompt text is higher trust than MCQ option text
 * - Auto tags (item.autoTags) are lowest trust
 */
export function deriveTopicSubtags(item: Question): string[] {
  const { promptText, optionsText } = buildTexts(item);

  // ✅ Manual user tags (highest trust)
  const userTags = normalizeTagSet(item.tags);

  // ✅ Auto tags (lowest trust)
  const autoTags = normalizeTagSet(item.autoTags);

  // ✅ Apply legacy mapping to BOTH sets (optional but useful during transition)
  applyLegacyMap(userTags);
  applyLegacyMap(autoTags);

  // ✅ Manual override uses ONLY userTags (not autoTags)
  const manualTopic = (Object.keys(SYLLABUS_RULES) as TopicKey[]).find((t) => userTags.has(t));
  if (manualTopic) {
    const subObj = SYLLABUS_RULES[manualTopic].subtopics;
    const manualSub = Object.keys(subObj).find((k) => userTags.has(k)) as SubtagKey | undefined;
    return manualSub ? [manualTopic, manualSub] : [manualTopic];
  }

  const topic = pickBestTopic(promptText, userTags, autoTags);
  if (!topic) return [];

  const subs = pickTopSubtopics(topic, promptText, optionsText, userTags, autoTags);
  return subs.length ? [topic, ...subs] : [topic];
}

function normalizeTagSet(tags?: unknown[]): Set<string> {
  return new Set(
    (tags ?? [])
      .map((t) => String(t ?? "").trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
  );
}

function applyLegacyMap(tagSet: Set<string>) {
  for (const t of [...tagSet]) {
    const mapped = LEGACY_TAG_MAP[t];
    if (mapped) tagSet.add(mapped);
  }
}

function buildTexts(item: Question) {
  const promptText = (item.prompt ?? "").toLowerCase();

  const optionsText = (item.options ?? [])
    .map((o) => `${o.originalKey ?? o.id}. ${o.text}`)
    .join(" ")
    .toLowerCase();

  return { promptText, optionsText };
}

function countHits(text: string, phrases: readonly string[]) {
  let s = 0;
  for (const p of phrases) {
    const needle = String(p ?? "").toLowerCase();
    if (needle && text.includes(needle)) s++;
  }
  return s;
}

function hitsAny(text: string, phrases: readonly string[]) {
  return phrases.some((p) => {
    const needle = String(p ?? "").toLowerCase();
    return needle && text.includes(needle);
  });
}

/**
 * Topic priority for tie-breaks.
 */
const TOPIC_PRIORITY: readonly TopicKey[] = [
  "traffic-signals",
  "driving-operations",
  "road-safety",
  "proper-driving",
];

function pickBestTopic(text: string, userTags: Set<string>, autoTags: Set<string>): TopicKey | null {
  const topics = Object.keys(SYLLABUS_RULES) as TopicKey[];

  let best: TopicKey | null = null;
  let bestScore = 0;
  let bestAnchorHits = 0;

  for (const topic of topics) {
    const rules = SYLLABUS_RULES[topic];

    // ✅ Topic anchors use PROMPT ONLY
    const anchorHits = countHits(text, rules.topicAnchors);

    // ✅ Manual tags > auto tags
    const userBoost = userTags.has(topic) ? 3 : 0;
    const autoBoost = autoTags.has(topic) ? 1 : 0;

    const score = anchorHits * 2 + userBoost + autoBoost;

    if (
      score > bestScore ||
      (score === bestScore && anchorHits > bestAnchorHits) ||
      (score === bestScore &&
        anchorHits === bestAnchorHits &&
        best &&
        TOPIC_PRIORITY.indexOf(topic) < TOPIC_PRIORITY.indexOf(best))
    ) {
      bestScore = score;
      bestAnchorHits = anchorHits;
      best = topic;
    }
  }

  if (!best) return null;
  if (bestAnchorHits >= 1) return best;
  if (bestScore >= 3) return best; // allow manual-tag-only topic
  return null;
}

function pickTopSubtopics(
  topic: TopicKey,
  promptText: string,   // prompt-only (high trust)
  optionsText: string,  // options-only (low trust)
  userTags: Set<string>,
  autoTags: Set<string>
): SubtagKey[] {
  const rules = SYLLABUS_RULES[topic].subtopics as Record<
    string,
    { anchors: readonly string[]; keywords: readonly string[] }
  >;

  const keys = Object.keys(rules);
  const priority = SUBTOPIC_PRIORITY[topic] as readonly string[];

  // ---- tweak knobs here ----
  const MAX_SUBS = 3;
  const RELATIVE_THRESHOLD = 0.8;  // 2nd/3rd must be >= 65% of best
  const MIN_SCORE_FOR_EXTRA = 80;   // prevents weak/noisy extras
  // --------------------------

  const scored: Array<{ key: string; score: number; anchorHits: number; prioIdx: number }> = [];

  for (const subKey of keys) {
    const rule = rules[subKey];
    if (!rule?.anchors?.length) continue;

    // ✅ allow manual subtag even if anchors don't hit
    const manualHit = userTags.has(subKey);

    // ✅ anchor gating uses prompt-only unless manual tag exists
    if (!manualHit && !hitsAny(promptText, rule.anchors)) continue;

    const a = manualHit ? 1 : countHits(promptText, rule.anchors);

    // ✅ keywords weighted: prompt > options
    const kPrompt = countHits(promptText, rule.keywords ?? []);
    const kOpt = countHits(optionsText, rule.keywords ?? []);

    const userBoost = userTags.has(subKey) ? 6 : 0;
    const autoBoost = autoTags.has(subKey) ? 1 : 0;

    // anchors >>> prompt keywords > option keywords
    const score = a * 30 + kPrompt * 6 + kOpt * 1 + userBoost + autoBoost;

    scored.push({
      key: subKey,
      score,
      anchorHits: a,
      prioIdx: priority.indexOf(subKey),
    });
  }

  if (scored.length === 0) return [];

  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (y.anchorHits !== x.anchorHits) return y.anchorHits - x.anchorHits;

    const xP = x.prioIdx === -1 ? Number.POSITIVE_INFINITY : x.prioIdx;
    const yP = y.prioIdx === -1 ? Number.POSITIVE_INFINITY : y.prioIdx;
    return xP - yP;
  });

  const bestScore = scored[0].score;
  const picked: string[] = [scored[0].key];

  for (let i = 1; i < scored.length && picked.length < MAX_SUBS; i++) {
    const s = scored[i];
    const significant =
      s.score >= bestScore * RELATIVE_THRESHOLD &&
      s.score >= MIN_SCORE_FOR_EXTRA;

    if (significant) picked.push(s.key);
  }

  return picked as SubtagKey[];
}



const SUBTOPIC_PRIORITY: {
  [T in TopicKey]: readonly Extract<SubtagKey, `${T}:${string}`>[];
} = {
  "road-safety": [
    "road-safety:license",
    "road-safety:registration",
    "road-safety:accidents",
    "road-safety:road-conditions",
  ],
  "traffic-signals": [
    "traffic-signals:signal-lights",
    "traffic-signals:road-signs",
    "traffic-signals:road-markings",
    "traffic-signals:police-signals",
  ],
  "proper-driving": ["proper-driving:traffic-laws", "proper-driving:safe-driving"],
  "driving-operations": ["driving-operations:indicators", "driving-operations:gears"],
};

/**
 * Legacy tag mapping (salvage old work)
 * Safe to delete later once your dataset no longer contains old tag strings.
 */
const LEGACY_TAG_MAP: Record<string, TopicKey | SubtagKey> = {
  // old topics -> new topics
  "traffic-law": "road-safety",
  "safe-driving": "proper-driving",
  "vehicle-operation": "driving-operations",
  "traffic-signals": "traffic-signals",

  // old subtopics -> new subtopics
  "traffic-law:driving-license": "road-safety:license",
  "traffic-law:vehicle-registration": "road-safety:registration",
  "traffic-law:accident-procedure": "road-safety:accidents",
  "traffic-law:road-conditions-rules": "road-safety:road-conditions",
  "traffic-law:violations-procedure": "proper-driving:traffic-laws",

  "safe-driving:violation-penalties": "proper-driving:traffic-laws",
  "safe-driving:requirements": "proper-driving:safe-driving",
  "safe-driving:yield": "proper-driving:safe-driving",
  "safe-driving:parking": "proper-driving:safe-driving",
  "safe-driving:expressway-breakdown": "proper-driving:safe-driving",
  "safe-driving:scenarios": "proper-driving:safe-driving",

  "traffic-signals:traffic-lights": "traffic-signals:signal-lights",
  "traffic-signals:special-signals": "traffic-signals:signal-lights",
  "traffic-signals:road-signs": "traffic-signals:road-signs",
  "traffic-signals:road-markings": "traffic-signals:road-markings",
  "traffic-signals:hand-signals": "traffic-signals:police-signals",

  "vehicle-operation:instruments-indicators": "driving-operations:indicators",
  "vehicle-operation:safety-devices": "driving-operations:indicators",
  "vehicle-operation:controls": "driving-operations:gears",
  "vehicle-operation:gears": "driving-operations:gears",
};
