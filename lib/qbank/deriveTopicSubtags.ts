// lib/qbank/deriveTopicSubtags.ts
import type { Question } from "./types";
import { SYLLABUS_RULES } from "./syllabusKeywords";
import type { TopicKey, SubtagKey } from "./syllabusKeywords";

/**
 * Exact classifier (strict):
 * - Picks ONE best topic
 * - Picks ONE best subtopic within that topic (anchor-gated)
 * - Returns [] if no confident topic
 * - Returns [topic] if topic is confident but no subtopic anchor matched
 * - Returns [topic, subtopic] if subtopic matched
 */
export function deriveTopicSubtags(item: Question): string[] {
  const text = buildText(item);

  const tags = new Set(
    [...(item.tags ?? []), ...(item.autoTags ?? [])]
      .map((t) => String(t ?? "").trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
  );

  // ✅ Manual override first (from tags.patch.json or any manual tags)
  const manualTopic = (Object.keys(SYLLABUS_RULES) as TopicKey[]).find((t) =>
    tags.has(t)
  );

  if (manualTopic) {
    const manualSub = Object.keys(SYLLABUS_RULES[manualTopic].subtopics).find(
      (k) => tags.has(k)
    ) as SubtagKey | undefined;

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

function countHits(text: string, phrases: string[]) {
  let s = 0;
  for (const p of phrases) {
    const needle = String(p ?? "").toLowerCase();
    if (needle && text.includes(needle)) s++;
  }
  return s;
}

function hitsAny(text: string, phrases: string[]) {
  return phrases.some((p) => {
    const needle = String(p ?? "").toLowerCase();
    return needle && text.includes(needle);
  });
}

/**
 * TOPIC PRIORITY (tie-breaker):
 * If scores tie, we choose earlier in this list.
 * Adjust if you want different behavior.
 */
const TOPIC_PRIORITY: TopicKey[] = [
  "traffic-signals",
  "vehicle-operation",
  "traffic-law",
  "safe-driving",
  "local-rules",
];

function pickBestTopic(text: string, tags: Set<string>): TopicKey | null {
  const topics = Object.keys(SYLLABUS_RULES) as TopicKey[];

  let best: TopicKey | null = null;
  let bestScore = 0;
  let bestAnchorHits = 0;

  for (const topic of topics) {
    const rules = SYLLABUS_RULES[topic];

    // IMPORTANT:
    // - anchors are the main driver
    // - tag boost is small, only used as a helper
    const anchorHits = countHits(text, rules.topicAnchors);
    const tagBoost = topicTagBoost(topic, tags);

    const score = anchorHits * 2 + tagBoost;

    if (
      score > bestScore ||
      (score === bestScore &&
        anchorHits > bestAnchorHits) ||
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

  // Strict confidence:
  // must have at least 1 anchor hit OR a strong tag boost
  if (!best) return null;
  if (bestAnchorHits >= 1) return best;
  if (bestScore >= 2) return best; // tagBoost-only cases (rare)
  return null;
}

function pickBestSubtopic(topic: TopicKey, text: string, tags: Set<string>): SubtagKey | null {
  const rules = SYLLABUS_RULES[topic].subtopics;
  const keys = Object.keys(rules) as SubtagKey[];

  // subtopic priority inside each topic (tie-breaker)
  const priority = subtopicPriority(topic);

  let best: SubtagKey | null = null;
  let bestScore = 0;
  let bestAnchorHits = 0;

  for (const subKey of keys) {
    if (tags.has(subKey)) return subKey; // ✅ manual override wins

    if (!subKey.startsWith(topic + ":")) continue;

    const rule = rules[subKey];
    if (!rule?.anchors?.length) continue;

    // Anchor-gated: must hit at least one anchor to be eligible
    if (!hitsAny(text, rule.anchors)) continue;

    const a = countHits(text, rule.anchors);
    const k = countHits(text, rule.keywords ?? []);
    const boost = subtopicTagBoost(subKey, tags);

    const score = a * 3 + k + boost;

    if (
      score > bestScore ||
      (score === bestScore && a > bestAnchorHits) ||
      (score === bestScore &&
        a === bestAnchorHits &&
        best &&
        priority.indexOf(subKey) < priority.indexOf(best))
    ) {
      bestScore = score;
      bestAnchorHits = a;
      best = subKey;
    }
  }

  return bestScore >= 1 ? best : null;
}

function subtopicPriority(topic: TopicKey): SubtagKey[] {
  // Priority rules you requested (example: license plate -> registration first)
  // Adjust freely.
  const p: Record<TopicKey, string[]> = {
    "traffic-law": [
      "traffic-law:vehicle-registration",
      "traffic-law:driving-license",
      "traffic-law:accident-procedure",
      "traffic-law:violations-procedure",
      "traffic-law:road-conditions-rules",
    ],
    "traffic-signals": [
      "traffic-signals:signal-lights",
      "traffic-signals:road-signs",
      "traffic-signals:road-markings",
      "traffic-signals:hand-signals",
      "traffic-signals:special-signals",
    ],
    "safe-driving": [
      "safe-driving:violation-penalties",
      "safe-driving:expressway-breakdown",
      "safe-driving:parking",
      "safe-driving:yield",
      "safe-driving:requirements",
    ],
    "vehicle-operation": [
      "vehicle-operation:safety-devices",
      "vehicle-operation:control-gears",
      "vehicle-operation:instruments-indicators",
    ],
    "local-rules": ["local-rules:local-laws"],
  };

  return (p[topic] ?? []) as SubtagKey[];
}

function topicTagBoost(topic: TopicKey, tags: Set<string>) {
  const hasAny = (arr: string[]) => arr.some((t) => tags.has(t));

  if (topic === "traffic-signals") {
    if (hasAny(["signals"])) return 2;
  }
  if (topic === "traffic-law") {
    if (hasAny(["law", "license", "registration", "violations", "accidents"])) return 2;
  }
  if (topic === "safe-driving") {
    if (hasAny(["safe-driving", "expressway"])) return 2;
  }
  if (topic === "vehicle-operation") {
    if (hasAny(["vehicle-knowledge", "vehicle-operation"])) return 2;
  }
  if (topic === "local-rules") {
    if (hasAny(["local", "local-rules"])) return 2;
  }
  return 0;
}

function subtopicTagBoost(subKey: SubtagKey, tags: Set<string>) {
  const map: Record<string, string[]> = {
    "traffic-law:driving-license": ["license"],
    "traffic-law:vehicle-registration": ["registration", "license-plate"],
    "traffic-law:accident-procedure": ["accidents", "accident"],
    "traffic-law:violations-procedure": ["violations"],
    "traffic-signals:signal-lights": ["signals"],
    "traffic-signals:road-signs": ["signals"],
    "traffic-signals:road-markings": ["signals"],
    "traffic-signals:hand-signals": ["signals"],
    "safe-driving:violation-penalties": ["drinking", "illegal", "overloaded"],
    "safe-driving:expressway-breakdown": ["expressway"],
    "vehicle-operation:instruments-indicators": ["vehicle-knowledge"],
    "vehicle-operation:control-gears": ["vehicle-knowledge"],
    "vehicle-operation:safety-devices": ["vehicle-knowledge"],
  };

  const needles = map[subKey] ?? [];
  return needles.some((t) => tags.has(t)) ? 1 : 0;
}
