// scripts/postprocess-qbank.mjs
import fs from "node:fs";
import path from "node:path";
import {
  RANGE_RULES,
  inRange,
  suggestTagsForText,
} from "./tag-dictionary.mjs";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : null;
  };
  return {
    input: get("--in"),
    output: get("--out"),
  };
}

function autoRangeTags(number) {
  const out = [];
  for (const r of RANGE_RULES) {
    if (inRange(number, r)) out.push(...(r.add || []));
  }
  return Array.from(new Set(out));
}

function buildSearchText(q) {
  const parts = [q.prompt];
  if (q.type === "mcq") {
    for (const o of q.options || []) parts.push(o.text);
  }
  return parts.join(" ");
}

const { input, output } = parseArgs();
if (!input || !output) {
  console.error("Usage: node scripts/postprocess-qbank.mjs --in <questions.raw.json> --out <questions.json>");
  process.exit(1);
}

const raw = readJson(input);
const questions = raw.questions || [];

const processed = questions.map((q) => {
  const auto = new Set();

  // structural tags (always)
  auto.add(q.type === "mcq" ? "#mcq" : "#row");
  if ((q.assets || []).length > 0) auto.add("#pic");

  // range-based topic tags
  for (const t of autoRangeTags(q.number)) auto.add(t);

  // dictionary suggestions (NOT auto-applied; shown to you later)
  const text = buildSearchText(q);
  const suggested = suggestTagsForText(text, { maxTags: 6 });

  return {
    ...q,
    tags: {
      auto: Array.from(auto),
      user: [],                  // you’ll fill later
      suggested: suggested,       // [{tag, score}]
    }
  };
});

const out = {
  meta: raw.meta,
  questions: processed,
};

writeJson(output, out);
console.log(`✅ Postprocessed ${processed.length} questions -> ${output}`);
