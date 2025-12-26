// lib/qbank/syllabusKeywords.ts

export type TopicKey =
  | "traffic-law"
  | "local-rules"
  | "traffic-signals"
  | "safe-driving"
  | "vehicle-operation";

export type TagKey =
  | TopicKey
  | `${TopicKey}:${string}`;

export type SubtopicConfig = {
  anchors: string[];   // strong signals
  keywords: string[];  // weaker/extra signals
};

export type TopicConfig = {
  topicAnchors: string[];                // decides the topic
  subtopics: Record<string, SubtopicConfig>; // decides the subtopic
};

// NOTE: All strings are matched via text.includes(...)
// so multi-word phrases must appear in that same order.
export const SYLLABUS_KEYWORDS: Record<TopicKey, TopicConfig> = {
  "traffic-law": {
    // Section 1 objective includes “safe driving in various road conditions”
    topicAnchors: [
      // law/procedure core
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

      // road conditions / road sections (these pull into Traffic Law by design)
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
    ],
    subtopics: {
      "traffic-law:violations-procedure": {
        anchors: ["procedural regulations", "detain", "detaining"],
        keywords: ["cases for detaining", "punishment at the scene"],
      },

      "traffic-law:accident-procedure": {
        anchors: ["traffic accident", "accident scene", "report to the police"],
        keywords: ["voluntary negotiation", "leave the scene", "expressway"],
      },

      "traffic-law:driving-license": {
        anchors: ["driving license", "driving licence", "probation period", "penalty point"],
        keywords: [
          "application for driving license",
          "validity period",
          "replacement",
          "reissue",
          "physical examination",
          "inspection",
          "revocation",
          "pass mark",
          "testing requirements",
        ],
      },

      "traffic-law:vehicle-registration": {
        anchors: ["registration", "license plate", "vehicle license", "temporary license plate"],
        keywords: ["transfer", "modification", "mortgage", "revocation", "motor vehicle inspection"],
      },

      "traffic-law:road-conditions-rules": {
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

  "local-rules": {
    topicAnchors: ["local laws", "local regulations"],
    subtopics: {
      "local-rules:local-laws": {
        anchors: ["local laws", "local regulations"],
        keywords: ["based on local laws", "local rules"],
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
      "flashing yellow",
      "hazard light",
      "level crossing",
      "road sign",
      "warning sign",
      "prohibitive",
      "indicative",
      "directional",
      "tourist area",
      "road marking",
      "hand signals",
      "traffic police",
      "guide arrow",
      "yellow line",
      "broken line",
      "solid line",
      "meaning of this sign",
      "meaning of this sig n",
      "mark",
      "yellow lane",
    ],
    subtopics: {
      "traffic-signals:signal-lights": {
        anchors: ["red light", "green light", "yellow light", "signal light"],
        keywords: ["arrow shape", "driving lanes"],
      },
      "traffic-signals:road-signs": {
        anchors: ["road sign", "warning sign", "prohibitive", "indicative", "meaning of this sign"],
        keywords: ["directional", "tourist area"],
      },
      "traffic-signals:road-markings": {
        anchors: ["road marking", "markings", "guide arrow", "yellow line", "yellow broken line", "broken line","solid line", "meaning of this sig n", "yellow lane"],
        keywords: ["indicative markings", "prohibitive markings", "warning markings", "stop line", "zebra", "mark"],
      },
      "traffic-signals:hand-signals": {
        anchors: ["traffic police", "hand signals"],
        keywords: ["stop signals", "going-straight", "left turn", "right turn", "lane changing", "slowdown", "pull over"],
      },
      "traffic-signals:special-signals": {
        anchors: ["level crossing", "flashing yellow", "hazard light"],
        keywords: ["signal lights on driving lanes"],
      },
    },
  },

  "safe-driving": {
    topicAnchors: [
      "safe driving",
      "safety responsibility",
      "yield",
      "special vehicle",
      "road maintenance",
      "parking",
      "expressway",
      "breakdown",
      "warning requirements",

      // violation penalties list (section 4)
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
    ],
    subtopics: {
      "safe-driving:requirements": {
        anchors: ["safe driving", "requirements for safe driving", "safety responsibility"],
        keywords: ["proper driving skills"],
      },
      "safe-driving:yield": {
        anchors: ["yield", "special vehicle", "road maintenance"],
        keywords: ["right of way"],
      },
      "safe-driving:parking": {
        anchors: ["parking", "car park"],
        keywords: ["parking rules"],
      },
      "safe-driving:expressway-breakdown": {
        anchors: ["expressway", "breakdown"],
        keywords: ["handling measures", "warning requirements"],
      },
      "safe-driving:violation-penalties": {
        anchors: ["punishment", "prohibited"],
        keywords: [
          "traffic signal violations",
          "drinking",
          "drugs",
          "medicines",
          "illegal driving license",
          "illegal license plate",
          "punishment at the scene",
          "obtaining driving license by illegal means",
          "over-seated",
          "overloaded",
          "cancellation rules",
        ],
      },
    },
  },

  "vehicle-operation": {
    topicAnchors: [
      "instruments",
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

      "steering wheel",
      "clutch pedal",
      "brake pedal",
      "accelerator pedal",
      "gear shift",
      "handbrake",
      "ignition switch",
      "light switch",
      "windscreen wiper",
      "defrost",
      "defog",

      "safe headrest",
      "seatbelt",
      "abs",
      "srs",

      "lights to",
      "lights when",
      "It lights",
      "instrument",
      "symbol indicate",
      "displays",
      "in strument",
      "flashes",
    ],
    subtopics: {
      "vehicle-operation:instruments-indicators": {
        anchors: ["instruments", "indicator", "alarm light"],
        keywords: [
          "fog lamp indicator",
          "engine oil pressure",
          "brake alarm",
          "low fuel warning",
          "water temperature",
          "seatbelt alarm",
          "low-beam",
          "high-beam",
          "flashing hazard light",
          "turn signal",
          "lights to",
          "lights when",
          "It lights",
          "instrument",
          "symbol indicate",
          "displays",
          "in strument",
          "flashes",
        ],
      },
      "vehicle-operation:control-gears": {
        anchors: ["steering wheel", "clutch pedal", "brake pedal", "accelerator pedal"],
        keywords: ["gear shift", "handbrake", "ignition switch", "light switch", "windscreen wiper", "defrost", "defog"],
      },
      "vehicle-operation:safety-devices": {
        anchors: ["safe headrest", "seatbelt", "abs", "srs"],
        keywords: ["safety devices"],
      },
    },
  },
} as const;

// --- exports for classifier ---
export const SYLLABUS_RULES = SYLLABUS_KEYWORDS; // alias so your import works

export type SyllabusRules = typeof SYLLABUS_RULES;

// internal helper type (so we don't redeclare TopicKey)
type RuleTopicKey = keyof SyllabusRules;

// union of ALL subtopic keys across all topics
export type SubtagKey =
  {
    [T in RuleTopicKey]: keyof SyllabusRules[T]["subtopics"];
  }[RuleTopicKey] & string;

