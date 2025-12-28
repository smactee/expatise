// lib/qbank/syllabusKeywords.ts

export type TopicKey =
  | "road-safety"
  | "traffic-signals"
  | "proper-driving"
  | "driving-operations";

export type SubtagKey =
  | "road-safety:license"
  | "road-safety:registration"
  | "road-safety:accidents"
  | "road-safety:road-conditions"
  | "traffic-signals:signal-lights"
  | "traffic-signals:road-signs"
  | "traffic-signals:road-markings"
  | "traffic-signals:police-signals"
  | "proper-driving:safe-driving"
  | "proper-driving:traffic-laws"
  | "driving-operations:indicators"
  | "driving-operations:control-gears";

export type SubtopicConfig = {
  anchors: readonly string[];   // strong signals (must hit >= 1)
  keywords: readonly string[];  // weaker signals (scoring only)
};

// ✅ only allow subtopic keys that start with the topic prefix
type SubtagKeyFor<T extends TopicKey> = Extract<SubtagKey, `${T}:${string}`>;
// ✅ exact shape of SYLLABUS_RULES: each topic can ONLY have its own subtopics
export type SyllabusRules = {
  [T in TopicKey]: {
    topicAnchors: readonly string[];
    subtopics: Record<SubtagKeyFor<T>, SubtopicConfig>;
  };
};
// NOTE: strings are matched via text.includes(...)
// multi-word phrases must appear in that order.
export const SYLLABUS_RULES = {
  "road-safety": {
    topicAnchors: [
      // license/registration/accidents core
      "driving license",
      "driving licence",
      "penalty point",
      "probation period",
      "revocation",
      "reissue",
      "replacement",
      "registration",
      "license plate",
      "vehicle license",
      "temporary license plate",
      "motor vehicle inspection",
      "traffic accident",
      "accident scene",
      "report to the police",
      "leave the scene",
      "detain",
      "detaining",
      "procedural regulations",
      "human casulaties",
      "road accident",
      "injured",

      // “safe driving in various road conditions” (syllabus section 1)
      "fog",
      "foggy",
      "snow",
      "snowy",
      "icy",
      "ice",
      "heavy rain",
      "night",
      "visibility",
      "tunnel",
      "sharp curve",
      "mountain road",
      "landslide",
      "mudslide",
      "mudflow",
      "ramp",
      "interchange",
      "intersection",
      "overtaking",
      "following distance",
      "lane changing",
      "reverse",
      "reversing",
      "uphill",
      "downhill",
      "wet",
      "slippery",
      "muddy",
    ],
    subtopics: {
      "road-safety:license": {
        anchors: ["driving license", "driving licence", "penalty point", "probation period", "revocation"],
        keywords: [
          "application for driving license",
          "validity period",
          "replacement",
          "reissue",
          "physical examination",
          "inspection",
          "pass mark",
          "testing requirements",
        ],
      },
      "road-safety:registration": {
        anchors: ["registration", "license plate", "vehicle license", "temporary license plate", "motor vehicle inspection"],
        keywords: ["transfer", "modification", "mortgage", "revocation"],
      },
      "road-safety:accidents": {
        anchors: ["traffic accident", "accident scene", "report to the police", "leave the scene", "human casualties", "injured"],
        keywords: ["voluntary negotiation", "expressway"],
      },
      "road-safety:road-conditions": {
        anchors: [
          "fog",
          "foggy",
          "snow",
          "snowy",
          "icy",
          "ice",
          "heavy rain",
          "night",
          "visibility",
          "tunnel",
          "sharp curve",
          "mountain road",
          "landslide",
          "mudslide",
          "mudflow",
          "ramp",
          "interchange",
          "intersection",
          "uphill",
          "downhill",
          "wet",
          "slippery",
          "muddy",
        ],
        keywords: [
          "overtaking",
          "following distance",
          "lane changing",
          "reverse",
          "reversing",
          "pedestrian",
          "bicycle",
        ],
      },
    },
  },

  "traffic-signals": {
    topicAnchors: [
      "traffic light",
      "red light",
      "green light",
      "yellow light",
      "signal light",
      "arrow shape",
      "signal lights on driving lanes",
      "guide arrow",
      "flashing yellow",
      "level crossing",

      "road sign",
      "warning sign",
      "prohibitive",
      "indicative",
      "directional",
      "tourist area",
      "meaning of this sign",
      "This sign",

      "road marking",
      "markings",
      "yellow line",
      "broken line",
      "solid line",
      "stop line",
      "zebra",

      "traffic police",
      "hand signal",
      "hand signals",
      "pull over",
      "slowdown",
      "lane changing",
    ],
    subtopics: {
      "traffic-signals:signal-lights": {
        anchors: ["red light", "green light", "yellow light", "signal light", "flashing yellow", "level crossing"],
        keywords: ["arrow shape", "signal lights on driving lanes", "guide arrow", "level crossing"],
      },
      "traffic-signals:road-signs": {
        anchors: ["road sign", "warning sign", "prohibitive", "indicative", "meaning of this sign", "This sign"],
        keywords: ["directional", "tourist area"],
      },
      "traffic-signals:road-markings": {
        anchors: ["road marking", "markings", "yellow line", "broken line", "solid line", "stop line", "zebra", "crosswalk"],
        keywords: ["indicative markings", "prohibitive markings", "warning markings"],
      },
      "traffic-signals:police-signals": {
        anchors: ["traffic police", "hand signal", "hand signals", "pull over", "slowdown"],
        keywords: ["stop signals", "going-straight", "left turn", "right turn", "lane changing"],
      },
    },
  },

  "proper-driving": {
    topicAnchors: [
      // Safe driving content (syllabus section 4)
      "safe driving",
      "safety responsibility",
      "yield",
      "special vehicle",
      "road maintenance",
      "parking",
      "car park",
      "expressway",
      "breakdown",
      "warning requirements",

      // Traffic laws / penalties (syllabus section 4)
      "prohibited",
      "punishment",
      "drinking",
      "drugs",
      "medicines",
      "illegal driving license",
      "illegal license plate",
      "over-seated",
      "overloaded",
      "cancellation rules",
      "punishment at the scene",
    ],
    subtopics: {
      "proper-driving:safe-driving": {
        anchors: ["safe driving", "safety responsibility", "yield", "special vehicle", "road maintenance", "parking", "expressway", "breakdown"],
        keywords: ["requirements for safe driving", "handling measures", "warning requirements"],
      },
      "proper-driving:traffic-laws": {
        anchors: ["prohibited", "punishment", "drinking", "drugs", "illegal", "over-seated", "overloaded", "cancellation rules"],
        keywords: ["punishment at the scene", "traffic signal violations", "obtaining driving license by illegal means"],
      },
    },
  },

  "driving-operations": {
    topicAnchors: [
      // instruments/indicators
      "instruments",
      "instrument",
      "indicator",
      "alarm light",
      "fog lamp indicator",
      "engine oil pressure",
      "brake alarm",
      "low fuel warning",
      "water temperature",
      "low-beam",
      "high-beam",
      "seatbelt alarm",
      "flashing hazard light",
      "turn signal",
      "symbol",
      "displays",
      "flashes",
      "lights to indicate",

      // controls
      "steering wheel",
      "clutch pedal",
      "brake pedal",
      "accelerator pedal",
      "gear shift",
      "gear shift lever",
      "handbrake",
      "ignition switch",
      "light switch",
      "windscreen wiper",
      "defrost",
      "defog",

      // safety devices (mapped into Indicators by your new taxonomy)
      "safe headrest",
      "seatbelt",
      "abs",
      "srs",
    ],
    subtopics: {
      "driving-operations:indicators": {
        anchors: [
          "indicator",
          "alarm light",
          "engine oil pressure",
          "brake alarm",
          "low fuel warning",
          "water temperature",
          "low-beam",
          "high-beam",
          "seatbelt alarm",
          "flashing hazard light",
          "turn signal",
          "abs",
          "srs",
          "seatbelt",
          "safe headrest",
          "symbol",
          "displays",
          "flashes",
          "lights to indicate"
        ],
        keywords: ["fog lamp indicator", "instruments", "instrument"],
      },
      "driving-operations:control-gears": {
        anchors: ["steering wheel", "clutch pedal", "brake pedal", "accelerator pedal", "gear shift", "handbrake", "ignition switch"],
        keywords: ["light switch", "windscreen wiper", "defrost", "defog"],
      },
    },
  },
} as const satisfies SyllabusRules;
