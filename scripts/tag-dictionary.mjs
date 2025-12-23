// scripts/tag-dictionary.mjs
// Canonical tags used for filters. Keep this list tight and consistent.

export const CANONICAL_TAGS = [
  { tag: "#row", desc: "Right/Wrong format (auto)" },
  { tag: "#mcq", desc: "Multiple choice format (auto)" },
  { tag: "#pic", desc: "Has image assets (auto)" },

  { tag: "#law", desc: "Traffic safety laws, rights/obligations, local laws" },
  { tag: "#license", desc: "Driving license application/use/renewal/probation/revocation" },
  { tag: "#vehicle-registration", desc: "Registration/plates/vehicle license/inspection/transfer" },
  { tag: "#accidents", desc: "Accident handling, reporting, scenes, negotiation" },
  { tag: "#violations-penalties", desc: "Violations, punishments, DUI/drugs, illegal docs/plates" },
  { tag: "#points-system", desc: "Penalty points recording/deduction rules" },

  { tag: "#traffic-lights", desc: "Signal lights incl. arrows, lane signals, crossings" },
  { tag: "#traffic-signs", desc: "Road signs (warning/prohibitory/indicative/directional/tourist)" },
  { tag: "#road-markings", desc: "Road markings (solid/broken/zebra, etc.)" },
  { tag: "#police-hand-signals", desc: "Traffic police hand signals" },

  { tag: "#expressway", desc: "Expressway driving + breakdown warnings" },
  { tag: "#parking", desc: "Parking, stopping, pulling over rules" },
  { tag: "#right-of-way", desc: "Yielding rules, special vehicles, maintenance vehicles" },

  // Lean vehicle bucket (merged):
  { tag: "#vehicle-basics", desc: "Instruments/indicators, controls, safety devices (ABS/SRS)" },
];

// Your number-range bootstrap (topic tags only; type is parsed from content)
export const RANGE_RULES = [
  { from: 1, to: 104, add: [] },                       // mostly ROW (validate later)
  { from: 105, to: 186, add: [] },                     // mostly MCQ
  { from: 187, to: 361, add: ["#traffic", "#pic"] },   // traffic + pics
  { from: 362, to: 521, add: ["#safe-driving", "#pic"] }, // driving + pics (optional tags)
  { from: 522, to: 630, add: ["#traffic-signs", "#pic"] }, // signals/signs + pics
  { from: 631, to: 899, add: ["#traffic-signs", "#traffic-lights", "#pic"] },
  { from: 900, to: 926, add: ["#law"] },
  { from: 927, to: 969, add: ["#traffic-signs", "#pic"] },
  { from: 970, to: 973, add: ["#law"] },
];

// Validation expectations (soft check)
export const EXPECTED_TYPE_RANGES = [
  { from: 1, to: 104, expectedType: "row" },
  { from: 105, to: 186, expectedType: "mcq" },
  { from: 187, to: 361, expectedType: "row" },
  { from: 362, to: 521, expectedType: "mcq" },
];

// Keyword dictionary for auto-suggestions (rule-based, offline-friendly)
export const TAG_DICTIONARY = [
  {
    tag: "#license",
    keywords: [
      "driving license", "driver's license", "permit", "probation period",
      "validity period", "replacement", "renewal", "reissue", "lost",
      "inspection", "physical examination", "revocation", "category", "vehicle type",
      "apply for", "application", "pass mark", "testing requirements"
    ],
  },
  {
    tag: "#vehicle-registration",
    keywords: [
      "registration", "transfer", "mortgage", "revocation of registration",
      "license plate", "vehicle license", "temporary plate", "temporary license plate",
      "destroy", "loss", "damage", "inspection"
    ],
  },
  {
    tag: "#accidents",
    keywords: [
      "traffic accident", "accident scene", "scene handling", "report to the police",
      "reporting", "negotiation", "voluntary negotiation", "leave the scene",
      "expressway accident", "injury", "collision"
    ],
  },
  {
    tag: "#violations-penalties",
    keywords: [
      "violation", "violations", "punishment", "fine", "penalty", "detain",
      "detaining", "illegal", "drunk", "drinking", "alcohol", "drug", "medicine",
      "overloaded", "over-seated", "over seated", "forgery", "fraud"
    ],
  },
  {
    tag: "#points-system",
    keywords: [
      "penalty points", "point recording", "point deduction", "deduction standard",
      "points system"
    ],
  },
  {
    tag: "#traffic-lights",
    keywords: [
      "red light", "green light", "yellow light", "signal light", "lane signal",
      "arrow signal", "arrow shape", "flashing yellow", "hazard light",
      "level crossing", "traffic signal lights"
    ],
  },
  {
    tag: "#traffic-signs",
    keywords: [
      "traffic sign", "warning sign", "prohibitive sign", "indicative sign",
      "directional sign", "tourist area sign"
    ],
  },
  {
    tag: "#road-markings",
    keywords: [
      "road marking", "markings", "solid line", "broken line", "zebra crossing",
      "crosswalk", "stop line", "lane line"
    ],
  },
  {
    tag: "#police-hand-signals",
    keywords: [
      "traffic police", "hand signal", "stop signal", "going-straight",
      "left turn", "right turn", "lane changing", "slowdown", "pull over"
    ],
  },
  {
    tag: "#expressway",
    keywords: [
      "expressway", "motorway", "highway", "breakdown", "breakdown vehicle",
      "warning triangle", "hazard warning", "emergency lane", "hard shoulder"
    ],
  },
  {
    tag: "#parking",
    keywords: [
      "parking", "park", "pull over", "stop at the roadside", "stopping"
    ],
  },
  {
    tag: "#right-of-way",
    keywords: [
      "yield", "give way", "right of way", "special vehicles", "maintenance vehicles",
      "ambulance", "fire engine", "police car"
    ],
  },
  {
    tag: "#law",
    keywords: [
      "laws", "rules and regulations", "legal responsibility", "rights and obligations",
      "procedural regulations", "handling violations"
    ],
  },
  {
    tag: "#vehicle-basics",
    keywords: [
      "instrument", "indicator", "alarm light", "engine oil pressure", "low fuel",
      "water temperature", "low-beam", "high-beam", "seatbelt light",
      "steering wheel", "clutch", "brake pedal", "accelerator", "gear lever",
      "handbrake", "ignition switch", "windscreen wiper", "defrost", "defog",
      "abs", "srs", "headrest", "seatbelt"
    ],
  },
];

export function normalizeTag(t) {
  const s = String(t || "").trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

export function inRange(n, r) {
  return n >= r.from && n <= r.to;
}

export function suggestTagsForText(text, { maxTags = 5 } = {}) {
  const t = String(text || "").toLowerCase();
  const scores = new Map(); // tag -> score

  for (const rule of TAG_DICTIONARY) {
    let score = 0;
    for (const kw of rule.keywords) {
      const k = kw.toLowerCase();
      if (k && t.includes(k)) score += 1;
    }
    if (score > 0) scores.set(rule.tag, (scores.get(rule.tag) || 0) + score);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([tag, score]) => ({ tag, score }));
}
