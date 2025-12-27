// lib/qbank/deriveTopicSubtags.ts
import type { Question } from "./types";
import { SYLLABUS_RULES, type TopicKey, type SubtagKey } from "./syllabusKeywords";

/**
 * Strict classifier:
 * - Picks ONE best topic
 * - Picks ONE best subtopic within that topic (anchor-gated)
 * - Returns [] if no confident topic
 * - Returns [topic] if topic is confident but no subtopic anchor matched
 * - Returns [topic, subtopic] if subtopic matched
 *
 * Also salvages legacy tags by mapping them into the new taxonomy.
 */
export function deriveTopicSubtags(item: Question): string[] {
  const text = buildText(item);

  const rawTags = [...(item.tags ?? []), ...(item.autoTags ?? [])]
    .map((t) => String(t ?? "").trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);

  // normalize + map legacy tags into new tag set
  const tags = new Set<string>();
  for (const t of rawTags) {
    tags.add(t);
    const mapped = LEGACY_TAG_MAP[t];
    if (mapped) tags.add(mapped);
  }

  // ✅ manual override wins if user tags contain canonical topic/subtopic keys
  const manualTopic = (Object.keys(SYLLABUS_RULES) as TopicKey[]).find((t) => tags.has(t));
  if (manualTopic) {
    const subObj = SYLLABUS_RULES[manualTopic].subtopics;
    const manualSub = Object.keys(subObj).find((k) => tags.has(k)) as SubtagKey | undefined;
    return manualSub ? [manualTopic, manualSub] : [manualTopic];
  }

  const topic = pickBestTopic(text, tags);
  if (!topic) return [];

  const sub = pickBestSubtopic(topic, text, tags);
  return sub ? [topic, sub] : [topic];
}

function buildText(item: Question) {
  const parts = [
    item.prompt ?? "",
    ...(item.options?.map((o) => `${o.originalKey ?? o.id}. ${o.text}`) ?? []),
  ];
  return parts.join(" ").toLowerCase();
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

function pickBestTopic(text: string, tags: Set<string>): TopicKey | null {
  const topics = Object.keys(SYLLABUS_RULES) as TopicKey[];

  let best: TopicKey | null = null;
  let bestScore = 0;
  let bestAnchorHits = 0;

  for (const topic of topics) {
    const rules = SYLLABUS_RULES[topic];

    const anchorHits = countHits(text, rules.topicAnchors);
    const tagBoost = tags.has(topic) ? 2 : 0;

    const score = anchorHits * 2 + tagBoost;

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
  if (bestScore >= 2) return best; // tag-only rare cases
  return null;
}

function pickBestSubtopic<T extends TopicKey>(
  topic: T,
  text: string,
  tags: Set<string>
): SubtagKey | null {
  type LocalSubKey = Extract<SubtagKey, `${T}:${string}`>;

  // tell TS: for THIS topic, subtopics are only LocalSubKey -> SubtopicConfig
  const rules = SYLLABUS_RULES[topic].subtopics as Record<
    LocalSubKey,
    { anchors: readonly string[]; keywords: readonly string[] }
  >;

  const keys = Object.keys(rules) as LocalSubKey[];
  const priority = SUBTOPIC_PRIORITY[topic] as readonly LocalSubKey[];

  let best: LocalSubKey | null = null;
  let bestScore = 0;
  let bestAnchorHits = 0;

  for (const subKey of keys) {
    const rule = rules[subKey];
    if (!rule.anchors?.length) continue;
    if (!hitsAny(text, rule.anchors)) continue;

    const a = countHits(text, rule.anchors);
    const k = countHits(text, rule.keywords ?? []);
    const score = a * 3 + k + (tags.has(subKey) ? 1 : 0);

    const currIdx = priority.indexOf(subKey);
    const bestIdx = best ? priority.indexOf(best) : Number.POSITIVE_INFINITY;

    const betterPriority = currIdx !== -1 && currIdx < bestIdx;

    if (
      score > bestScore ||
      (score === bestScore && a > bestAnchorHits) ||
      (score === bestScore && a === bestAnchorHits && betterPriority)
    ) {
      bestScore = score;
      bestAnchorHits = a;
      best = subKey;
    }
  }

  return best ? (best as unknown as SubtagKey) : null;
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
  "driving-operations": ["driving-operations:indicators", "driving-operations:control-gears"],
};

/**
 * Legacy tag mapping (salvage old work)
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
  "vehicle-operation:controls": "driving-operations:control-gears",
  "vehicle-operation:control-gears": "driving-operations:control-gears",
};
