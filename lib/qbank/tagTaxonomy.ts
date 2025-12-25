// lib/qbank/tagTaxonomy.ts

export type Topic = {
  key: string;   // internal key (stable)
  label: string; // what the user sees (pretty)
  subtopics: { key: string; label: string }[];
};

export const TAG_TAXONOMY: Topic[] = [
  {
    key: "traffic-law",
    label: "Traffic Law",
    subtopics: [
      { key: "traffic-law:all", label: "All" },
      { key: "traffic-law:licensing", label: "Licensing" },
      { key: "traffic-law:registration", label: "Vehicle Registration" },
      { key: "traffic-law:violations-procedure", label: "Violations Procedure" },
      { key: "traffic-law:accident-procedure", label: "Accident Procedure" },
      { key: "traffic-law:responsibilities", label: "Rights & Responsibilities" },
    ],
  },
  {
    key: "local-rules",
    label: "Local Rules",
    subtopics: [
      { key: "local-rules:all", label: "All" },
      { key: "local-rules:key-points", label: "Local Key Points" },
      { key: "local-rules:parking", label: "Local Parking" },
      { key: "local-rules:speed", label: "Local Speed Rules" },
      { key: "local-rules:enforcement", label: "Local Enforcement" },
      { key: "local-rules:other", label: "Other Local Rules" },
    ],
  },
  {
    key: "traffic-signals",
    label: "Traffic Signals",
    subtopics: [
      { key: "traffic-signals:all", label: "All" },
      { key: "traffic-signals:traffic-lights", label: "Traffic Lights" },
      { key: "traffic-signals:road-signs", label: "Road Signs" },
      { key: "traffic-signals:road-markings", label: "Road Markings" },
      { key: "traffic-signals:hand-signals", label: "Hand Signals" },
      { key: "traffic-signals:special-signals", label: "Special Signals" },
    ],
  },
  {
    key: "safe-driving",
    label: "Safe & Courteous Driving",
    subtopics: [
      { key: "safe-driving:all", label: "All" },
      { key: "safe-driving:traffic-signs", label: "Traffic Signs" },
      { key: "safe-driving:markings-signals", label: "Road Markings & Signals" },
      { key: "safe-driving:right-of-way", label: "Rules & Right-of-Way" },
      { key: "safe-driving:scenarios", label: "Driving Scenarios" },
      { key: "safe-driving:violations", label: "Penalties & Violations" },
    ],
  },
  {
    key: "vehicle-operation",
    label: "Vehicle Operation",
    subtopics: [
      { key: "vehicle-operation:all", label: "All" },
      { key: "vehicle-operation:indicators", label: "Instruments & Indicators" },
      { key: "vehicle-operation:lights", label: "Lights & Signals" },
      { key: "vehicle-operation:controls", label: "Controls & Gears" },
      { key: "vehicle-operation:safety-devices", label: "Safety Devices" },
      { key: "vehicle-operation:checks", label: "Basic Checks" },
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
  // fallback: turn "road-signs" into "Road Signs"
  return tagKey
    .split(":")
    .pop()!
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
