// lib/qbank/tagTaxonomy.ts

import type { MessageKey } from '@/lib/i18n/messages';
import type { MessageParams } from '@/lib/i18n/types';

type TaxonomyLabelKey = Extract<MessageKey, `qbank.taxonomy.${string}`>;
type TaxonomyTranslator = (key: MessageKey, params?: MessageParams) => string;

export type Subtopic = {
  key: string; // internal key (stable)
  labelKey: TaxonomyLabelKey;
};

export type Topic = {
  key: string; // internal key (stable)
  labelKey: TaxonomyLabelKey;
  subtopics: Subtopic[];
};

export const TAG_TAXONOMY: Topic[] = [
  {
    key: "road-safety",
    labelKey: "qbank.taxonomy.topics.roadSafety",
    subtopics: [
      { key: "road-safety:license", labelKey: "qbank.taxonomy.subtopics.license" },
      { key: "road-safety:registration", labelKey: "qbank.taxonomy.subtopics.registration" },
      { key: "road-safety:accidents", labelKey: "qbank.taxonomy.subtopics.accidents" },
      { key: "road-safety:road-conditions", labelKey: "qbank.taxonomy.subtopics.roadConditions" },
    ],
  },
  {
    key: "traffic-signals",
    labelKey: "qbank.taxonomy.topics.trafficSignals",
    subtopics: [
      { key: "traffic-signals:signal-lights", labelKey: "qbank.taxonomy.subtopics.signalLights" },
      { key: "traffic-signals:road-signs", labelKey: "qbank.taxonomy.subtopics.roadSigns" },
      { key: "traffic-signals:road-markings", labelKey: "qbank.taxonomy.subtopics.roadMarkings" },
      { key: "traffic-signals:police-signals", labelKey: "qbank.taxonomy.subtopics.policeSignals" },
    ],
  },
  {
    key: "proper-driving",
    labelKey: "qbank.taxonomy.topics.properDriving",
    subtopics: [
      { key: "proper-driving:safe-driving", labelKey: "qbank.taxonomy.subtopics.safeDriving" },
      { key: "proper-driving:traffic-laws", labelKey: "qbank.taxonomy.subtopics.trafficLaws" },
    ],
  },
  {
    key: "driving-operations",
    labelKey: "qbank.taxonomy.topics.drivingOperations",
    subtopics: [
      { key: "driving-operations:indicators", labelKey: "qbank.taxonomy.subtopics.indicators" },
      { key: "driving-operations:gears", labelKey: "qbank.taxonomy.subtopics.gears" },
    ],
  },
];

const TAG_LABEL_KEYS = new Map<string, TaxonomyLabelKey>();

for (const topic of TAG_TAXONOMY) {
  TAG_LABEL_KEYS.set(topic.key, topic.labelKey);
  for (const subtopic of topic.subtopics) {
    TAG_LABEL_KEYS.set(subtopic.key, subtopic.labelKey);
  }
}

function fallbackLabelForTag(tagKey: string) {
  return tagKey
    .split(":")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelForTag(tagKey: string, t: TaxonomyTranslator) {
  const labelKey = TAG_LABEL_KEYS.get(tagKey);
  return labelKey ? t(labelKey) : fallbackLabelForTag(tagKey);
}
