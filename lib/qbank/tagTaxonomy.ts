// lib/qbank/tagTaxonomy.ts

export type Topic = {
  key: string;   // internal key (stable)
  label: string; // what the user sees
  subtopics: { key: string; label: string }[];
};

export const TAG_TAXONOMY: Topic[] = [
  {
    key: "road-safety",
    label: "Road Safety",
    subtopics: [
      { key: "road-safety:license", label: "#License" },
      { key: "road-safety:registration", label: "#Registration" },
      { key: "road-safety:accidents", label: "#Accidents" },
      { key: "road-safety:road-conditions", label: "#Road Conditions" },
    ],
  },
  {
    key: "traffic-signals",
    label: "Traffic Signals",
    subtopics: [
      { key: "traffic-signals:signal-lights", label: "#Signal Lights" },
      { key: "traffic-signals:road-signs", label: "#Road Signs" },
      { key: "traffic-signals:road-markings", label: "#Road Markings" },
      { key: "traffic-signals:police-signals", label: "#Police Signals" },
    ],
  },
  {
    key: "proper-driving",
    label: "Proper Driving",
    subtopics: [
      { key: "proper-driving:safe-driving", label: "#Safe Driving" },
      { key: "proper-driving:traffic-laws", label: "#Traffic Laws" },
    ],
  },
  {
    key: "driving-operations",
    label: "Driving Operations",
    subtopics: [
      { key: "driving-operations:indicators", label: "#Indicators" },
      { key: "driving-operations:control-gears", label: "#Control Gears" },
    ],
  },
];

// Optional helper (nice for tag pills)
export function labelForTag(tagKey: string) {
  for (const topic of TAG_TAXONOMY) {
    if (topic.key === tagKey) return topic.label;
    const found = topic.subtopics.find((s) => s.key === tagKey);
    if (found) return found.label;
  }
  return tagKey
    .split(":")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
