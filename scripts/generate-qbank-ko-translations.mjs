#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import OpenAI from "openai";

const ROOT = process.cwd();
const DATASET_PATH = path.join(ROOT, "public/qbank/2023-test1/questions.json");
const TAG_PATCH_PATH = path.join(ROOT, "public/qbank/2023-test1/tags.patch.json");
const GLOSSARY_PATH = path.join(ROOT, "docs/korean-qbank-glossary.md");
const OUTPUT_PATH = path.join(ROOT, "public/qbank/2023-test1/translations.ko.json");

const args = parseArgs(process.argv.slice(2));
const MODEL = args.model ?? "gpt-5-mini";
const BATCH_SIZE = Number(args.batchSize ?? 12);
const LIMIT = args.limit ? Number(args.limit) : null;
const OVERWRITE = Boolean(args.overwrite);
const START_AT = Number(args.startAt ?? 0);
const DRY_RUN = Boolean(args.dryRun);
const IDS = args.ids ? parseIds(args.ids) : null;
const REFINE_EXISTING_VISUAL = Boolean(args.refineExistingVisual);

const SOURCE_MODES = ["pdf-adapted", "pdf-template-guided", "direct"];
const PDF_FIRST_TEMPLATE_CLASSES = new Set([
  "traffic-light-meaning",
  "lane-signal-direction",
  "traffic-sign-meaning",
  "traffic-sign-statement",
  "road-marking-meaning",
  "road-marking-statement",
  "warning-light-meaning",
  "symbol-meaning",
  "switch-symbol-control",
  "device-identification",
  "pedal-identification",
  "gauge-identification",
  "switch-position-statement",
]);
const MANUAL_EXCEPTION_IDS = new Set();
const MANUAL_EXCEPTION_NOTE =
  "수동 예외 문항: 영문 원문과 실제 이미지 의미가 일치하지 않아 자동 정규화에서 제외한다.";

if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE <= 0) {
  throw new Error(`Invalid --batch-size: ${args.batchSize}`);
}

if (!Number.isFinite(START_AT) || START_AT < 0) {
  throw new Error(`Invalid --start-at: ${args.startAt}`);
}

const SYSTEM_PROMPT = `
You translate English driving-test questions into Korean for a question bank.

Non-negotiable rules:
- English source remains the source of truth.
- Do not change IDs, answer logic, option meaning, or image semantics.
- Use compact, natural, exam-prep-friendly Korean.
- Do not force weak one-to-one matching to the Korean PDF.
- Reuse/adapt Korean PDF wording only when confidence is clearly high.
- Direct English -> Korean translation is the default.
- If confidence is not high, translate directly from English using the glossary rules.
- For fixed visual-concept questions, Korean PDF phrasing now has priority over freer generalized Korean.
- Split image-bearing questions into three classes:
  - fixed visual concept: signs, dashboard lights, switch symbols, gauges, standardized icons/symbols
    -> prefer PDF-first or pdf-template-guided wording only when confidence is high
  - scene-based image question: traffic situations, lane/intersection scenes, parking/stopping/overtaking/yielding scenes
    -> direct English -> Korean is the default, with stricter review
  - context/evidentiary image question: image supports the question but is not a standardized symbol family
    -> direct translation is the default, review as needed
- Fixed visual canonical stems to prefer:
  - sign families -> "이 표지의 뜻은?"
  - lane-direction families -> "이 표시의 뜻은?"
  - road-marking families -> "이 노면표시의 의미는?"
  - dashboard-light families -> "계기판에 등이 켜졌다. 무슨 의미인가?"
  - dashboard symbol families -> "계기판에서 ...의 의미는?"
  - switch/control families -> "표시가 된 스위치는 어떤 장치를 제어하는가?"
  - gauge / instrument families -> "이 계기는 무엇인가?"
- For switch/control option families, prefer PDF-style terms like "서리 제거", "제습".
- Prefer specific switch labels over broad rewrites:
  - e.g. 전조등 스위치, 하향 전조등 스위치, 상향 전조등 스위치, 실내등 스위치, 후면 안개등 스위치
- Do not force "경고등" into every dashboard-light question; follow the PDF-style stem first unless the concept explicitly requires the warning-light label.
- Use explicit reuse modes:
  - pdf-adapted: near-exact fixed visual/concept match; Korean can closely follow the PDF-derived wording family.
  - pdf-template-guided: the visual concept/template matches strongly, but options or wording still need regeneration from English source truth.
  - direct: no high-confidence PDF-style template reuse.
- Weight visual/concept signals more heavily than text similarity for fixed visual questions:
  - traffic sign meaning
  - lane-use / direction signal questions
  - dashboard / warning light questions
  - switch / control questions
  - gauge / meter questions
  - fixed symbol meaning questions
- Keep legal terms distinct: 범칙금 / 과태료 / 벌금 / 벌점 / 구류.
- For image-dependent questions, prefer faithful neutral Korean wording over imported PDF phrasing unless the sign/signal template match is clearly exact.
- When the Korean wording is uncertain, do not guess loosely and do not try to find a vaguely similar UI question.
  Check in this order:
  1. the exact English source question for the same qID
  2. the question's taxonomy/subtopic hints
  3. nearby related English questions in the same taxonomy/subtopic
  4. the same asset/image/icon/sign family when applicable
  5. the Korean PDF wording for that concept family
  Then use those signals to confirm the intended concept, answer logic, option semantics, and the most consistent Korean terminology/template.
  If confidence is still not high, flag the item for review or keep it as a manual exception.
- For dashboard/warning-light/device questions, stay conservative and avoid overconfident device naming when the English is awkward.
- For legal/admin/penalty questions, prefer precise recurring terms and lean toward review when the legal phrasing is uncertain.
- For non-visual scenario-heavy questions, direct translation is still the default, but be more conservative about marking them high-confidence when the scenario or answer logic is easy to misread.
- Keep review selective for non-visual questions:
  - keep review strict for legal/admin/punishment wording, negation-sensitive wording, truth/false statements where wording can flip the answer, numeric thresholds, condition-sensitive logic, and ambiguous right-of-way / liability wording
  - do not lower confidence for straightforward tunnel/weather/highway behavior or ordinary courtesy/yielding items when the Korean is clear
- Prefer concise Korean over explanatory restatement.
- Keep sentence endings consistent:
  - ROW / true-false style statements: plain declarative Korean ending such as "-다".
  - MCQ question prompts: concise interrogative such as "-는가?", "무엇인가?", "어떻게 해야 하는가?".
  - Fill-in-the-blank prompts: make the Korean read naturally with the blank and options; do not leave awkward English-style scaffolding.
- Preserve permission/prohibition nuance carefully:
  - can / may / allowed -> 할 수 있다 / 허용된다 only when the English really permits it
  - should -> should-style instruction, not permission
  - prohibited / not allowed -> 금지된다 / 해서는 안 된다 / 할 수 없다 depending on context
- Standardize distance wording with "미터" in Korean prompts and options. Do not switch to bare "m".
- Standardize non-visual speed wording with Korean-style notation:
  - use "시속 50km", "시속 100km"
  - use "시속 몇 km" for interrogative prompts
- Keep horn / warning / signaling phrasing natural:
  - honk -> 경적을 울리다
  - turn on the signal / hazard lights -> 방향지시등을 켜다 / 비상점멸등을 켜다
  - warning sign -> 경고표지판 or 경고표지 depending on context
- Default glossary overrides for this pass:
  - 문명운전 -> 안전 운전
  - 수리보양 -> 정비 / 수리 / 관리 depending on context
  - 비자동차 -> 비동력 차량 / 자전거 등 비동력 차량 unless an official-style legal label clearly requires exact wording
  - 차량관리소 -> 차량관리소
  - 검사표지 is the default recurring term
  - 보험표지 -> 보험표지
  - use 표지판 as the Korean taxonomy/subtopic label for road signs
  - use 노면 as the Korean taxonomy/subtopic label for road markings
  - in road-marking question wording, prefer 노면표시-based phrasing aligned with the Korean PDF
  - use 계기판 표시등 or 경고등 depending on context
  - use 기어 / 변속 / 장치 depending on context; do not force one word everywhere
  - for sign questions, prefer "이 표지의 뜻은?"
  - for fixed visual lane families, prefer "이 표시의 뜻은?"
  - for road-marking questions, prefer "이 노면표시의 의미는?"
  - for dashboard-light families, prefer "계기판에 등이 켜졌다. 무슨 의미인가?"
  - for switch/control families, prefer "표시가 된 스위치는 어떤 장치를 제어하는가?"

Output requirements:
- Return JSON only.
- Return one item for every input question.
- Preserve option IDs exactly.
- "sourceMode" must be one of "pdf-adapted", "pdf-template-guided", or "direct".
- Use "pdf-adapted" only when the Korean wording clearly reuses/adapts a high-confidence Korean PDF phrasing or fixed PDF-style template.
- Use "pdf-template-guided" when the visual concept/template matches strongly but the options or final Korean still need regeneration from English source truth.
- Use "direct" for everything else.
- "confidence" must be "high", "medium", or "low".
- Use "high" when the Korean wording is straightforward and stable.
- Use "medium" when the translation is still acceptable but has image, dashboard/device, or legal-context risk worth later QA.
- Use "low" only when the item clearly needs manual review.
- If "reviewHints" include image-dependent, legal-admin-sensitive, dashboard-device-sensitive, scenario-sensitive, or answer-logic-sensitive, be more conservative about using "high".
- "reviewNotes" should be empty unless the item has a real ambiguity or legal/terminology risk.
- Keep review notes short.
`.trim();

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const glossary = await fs.readFile(GLOSSARY_PATH, "utf8");
  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8"));
  const patch = JSON.parse(await fs.readFile(TAG_PATCH_PATH, "utf8"));

  if (!dataset?.questions || !Array.isArray(dataset.questions)) {
    throw new Error("questions.json does not contain a questions array");
  }

  if (REFINE_EXISTING_VISUAL) {
    const existing = await loadExistingOutput();
    const refined = refineExistingVisualTranslations(existing, dataset.questions, patch);
    const finalized = finalizeMeta(refined);
    if (!DRY_RUN) await writeOutput(finalized);
    logSummary(finalized);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY ?? (await readOpenAIKeyFromDotenv());
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not found in environment or .env.local");
  }

  const client = new OpenAI({ apiKey });

  const existing = OVERWRITE ? emptyTranslationFile() : await loadExistingOutput();
  const allQuestions = dataset.questions;
  const targetQuestions = IDS
    ? pickQuestionsById(allQuestions, IDS)
    : LIMIT
      ? allQuestions.slice(0, LIMIT)
      : allQuestions;
  const pending = targetQuestions
    .slice(START_AT)
    .filter((question) => !existing.questions[question.id]);

  if (pending.length === 0) {
    const finalized = finalizeMeta(existing);
    if (!DRY_RUN) await writeOutput(finalized);
    logSummary(finalized);
    return;
  }

  console.log(
    `Translating ${pending.length} question(s) with ${MODEL} in batches of ${BATCH_SIZE}.`
  );

  let out = structuredClone(existing);
  let processed = 0;

  for (const batch of chunk(pending, BATCH_SIZE)) {
    const batchPayload = batch.map((question) =>
      buildQuestionPayload(question, patch[question.id], allQuestions, patch)
    );
    const translated = await translateBatch(client, glossary, batchPayload);

    for (const item of translated.questions) {
      const original = batch.find((q) => q.id === item.id);
      if (!original) {
        throw new Error(`Batch returned unknown question id: ${item.id}`);
      }

      const normalized = normalizeTranslationItem(original, item);
      out.questions[item.id] = normalized;
    }

    out = finalizeMeta(out);
    processed += batch.length;
    console.log(`Processed ${processed}/${pending.length}`);

    if (!DRY_RUN) {
      await writeOutput(out);
    }
  }

  out = finalizeMeta(out);
  if (!DRY_RUN) await writeOutput(out);
  logSummary(out);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = camelCase(rawKey);

    if (inlineValue != null) {
      out[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }

    out[key] = next;
    i += 1;
  }
  return out;
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseIds(value) {
  const ids = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("Invalid --ids: provide a comma-separated list of question IDs");
  }

  return unique(ids);
}

async function readOpenAIKeyFromDotenv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    const match = raw.match(/^OPENAI_API_KEY=(.+)$/m);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function pickQuestionsById(allQuestions, ids) {
  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  const picked = ids.map((id) => {
    const question = byId.get(id);
    if (!question) {
      throw new Error(`Question id not found in questions.json: ${id}`);
    }
    return question;
  });

  return picked;
}

function emptyTranslationFile() {
  return {
    meta: {
      locale: "ko",
      translatedQuestions: 0,
      pdfAdaptedCount: 0,
      pdfTemplateGuidedCount: 0,
      directCount: 0,
      ambiguousCount: 0,
      imageVerificationCount: 0,
      glossaryPath: "docs/korean-qbank-glossary.md",
      model: MODEL,
      generatedAt: new Date().toISOString(),
    },
    questions: {},
  };
}

async function loadExistingOutput() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      meta: parsed.meta ?? emptyTranslationFile().meta,
      questions: parsed.questions ?? {},
    };
  } catch {
    return emptyTranslationFile();
  }
}

function collectTags(question, patchTags = []) {
  const tags = new Set();
  const rawTags = question?.tags;

  if (Array.isArray(rawTags)) {
    for (const value of rawTags) tags.add(cleanTag(value));
  } else if (rawTags && typeof rawTags === "object") {
    for (const key of ["user", "auto"]) {
      for (const value of rawTags[key] ?? []) tags.add(cleanTag(value));
    }
    for (const value of rawTags.suggested ?? []) {
      tags.add(cleanTag(value?.tag));
    }
  }

  for (const value of patchTags ?? []) tags.add(cleanTag(value));

  return [...tags].filter(Boolean);
}

function cleanTag(value) {
  return String(value ?? "").trim().replace(/^#/, "").toLowerCase();
}

function buildQuestionPayload(question, patchTags = [], allQuestions = [], patch = {}) {
  const tags = collectTags(question, patchTags);
  const assets = Array.isArray(question.assets) ? question.assets : [];
  const hasImage = assets.some((asset) => !!asset?.src);
  const kindHints = classifyQuestion(question, tags, assets);
  const relatedEnglishQuestions = findRelatedEnglishQuestions(
    question,
    tags,
    allQuestions,
    patch,
    kindHints.templateClass
  );

  return {
    id: question.id,
    number: question.number,
    type: question.type,
    prompt: question.prompt,
    explanation:
      typeof question.explanation === "string" && question.explanation.trim().length > 0
        ? question.explanation
        : question.prompt,
    explanationSameAsPrompt:
      String(question.explanation ?? "").trim() === String(question.prompt ?? "").trim(),
    options: Array.isArray(question.options)
      ? question.options.map((option, index) => ({
          id: option.id,
          key: option.originalKey ?? String.fromCharCode(65 + index),
          text: option.text,
        }))
      : [],
    tags,
    hasImage,
    assetCount: assets.length,
    assetPaths: assets
      .map((asset) => String(asset?.src ?? "").trim())
      .filter(Boolean)
      .slice(0, 2),
    templateClass: kindHints.templateClass,
    imageQuestionClass: kindHints.imageQuestionClass,
    contextHints: kindHints.contextHints,
    terminologyHints: kindHints.terminologyHints,
    matchingSignals: kindHints.matchingSignals,
    preferredSourceMode: kindHints.preferredSourceMode,
    reviewHints: kindHints.reviewHints,
    relatedEnglishQuestions,
    manualException: MANUAL_EXCEPTION_IDS.has(question.id),
  };
}

function classifyQuestion(question, tags, assets = []) {
  const prompt = String(question.prompt ?? "");
  const lower = prompt.toLowerCase();
  const options = Array.isArray(question.options) ? question.options : [];
  const optionTexts = options.map((option) => String(option.text ?? ""));
  const optionBlob = optionTexts.join(" | ").toLowerCase();
  const contextHints = [];
  const reviewHints = [];
  const hasImage = assets.some((asset) => !!asset?.src);
  const templateClass = detectTemplateClass(question, tags, hasImage);
  const imageQuestionClass = classifyImageQuestionClass(question, templateClass, hasImage);
  const matchingSignals = buildSignalProfile({
    question,
    tags,
    assets,
    hasImage,
    lowerPrompt: lower,
    optionBlob,
    templateClass,
  });
  const terminologyHints = buildTerminologyHints(templateClass, lower, optionBlob);
  let preferredSourceMode = decideSourceMode(matchingSignals, templateClass, options.length);

  const tagMap = [
    ["license", "Road Safety > license"],
    ["vehicle-registration", "Road Safety > registration"],
    ["accidents", "Road Safety > accidents"],
    ["traffic-lights", "Traffic Signals > signal lights"],
    ["traffic-signs", "Traffic Signals > road signs"],
    ["road-markings", "Traffic Signals > road markings"],
    ["police-hand-signals", "Traffic Signals > police signals"],
    ["safe-driving", "Proper Driving > safe driving"],
    ["right-of-way", "Proper Driving > safe driving"],
    ["expressway", "Proper Driving > safe driving"],
    ["violations-penalties", "Proper Driving > traffic laws"],
    ["law", "Proper Driving > traffic laws"],
    ["points-system", "Proper Driving > traffic laws"],
    ["vehicle-basics", "Driving Operations"],
  ];

  for (const [tag, hint] of tagMap) {
    if (tags.includes(tag)) contextHints.push(hint);
  }

  const isDashboardOrDeviceQuestion = isDashboardOrDevicePrompt(lower);
  const isLegalAdminQuestion = isLegalAdminPrompt(lower);
  const isNegationSensitive = isNegationSensitivePrompt(question, lower, hasImage);
  const isNumericThresholdSensitive = isNumericThresholdSensitivePrompt(prompt, lower, optionTexts, hasImage);
  const isConditionSensitive = isConditionSensitivePrompt(prompt, lower, hasImage);
  const isRightOfWayLiabilitySensitive = isRightOfWayLiabilitySensitivePrompt(lower, hasImage);
  const isTruthFalseSensitive = isTruthFalseSensitivePrompt(
    question,
    hasImage,
    isNegationSensitive,
    isNumericThresholdSensitive,
    isConditionSensitive,
    isRightOfWayLiabilitySensitive
  );

  if (PDF_FIRST_TEMPLATE_CLASSES.has(templateClass)) {
    contextHints.push("PDF-first fixed visual/template class");
  }

  if (imageQuestionClass === "fixed-symbol") {
    contextHints.push("image-question-class: fixed-symbol");
  } else if (imageQuestionClass === "scene-based") {
    contextHints.push("image-question-class: scene-based");
    reviewHints.push("scene-based-image");
  } else if (imageQuestionClass === "context-image") {
    contextHints.push("image-question-class: context-image");
    reviewHints.push("context-image");
  }

  if (hasImage) {
    reviewHints.push("image-dependent");
  }

  if (isDashboardOrDeviceQuestion) {
    contextHints.push("Driving Operations > dashboard/device terminology");
    reviewHints.push("dashboard-device-sensitive");
  }

  if (isLegalAdminQuestion) {
    reviewHints.push("legal-admin-sensitive");
  }

  if (isNegationSensitive) {
    reviewHints.push("negation-sensitive");
  }

  if (isNumericThresholdSensitive) {
    reviewHints.push("numeric-threshold-sensitive");
  }

  if (isConditionSensitive) {
    reviewHints.push("condition-sensitive");
  }

  if (isRightOfWayLiabilitySensitive) {
    reviewHints.push("right-of-way-liability-sensitive");
  }

  if (isTruthFalseSensitive) {
    reviewHints.push("truth-false-sensitive");
  }

  if (matchingSignals.ambiguousImageConcept) {
    reviewHints.push("visual-concept-ambiguous");
  }

  if (MANUAL_EXCEPTION_IDS.has(question.id)) {
    reviewHints.push("manual-exception");
    preferredSourceMode = "direct";
  }

  if (hasImage && imageQuestionClass !== "fixed-symbol") {
    preferredSourceMode = "direct";
  }

  if (
    preferredSourceMode !== "direct" &&
    (reviewHints.includes("legal-admin-sensitive") || matchingSignals.ambiguousImageConcept)
  ) {
    preferredSourceMode = "direct";
  }

  return {
    templateClass,
    imageQuestionClass,
    contextHints: unique(contextHints),
    terminologyHints,
    matchingSignals: {
      visual: matchingSignals.visualSignals,
      structural: matchingSignals.structuralSignals,
      terminology: matchingSignals.terminologySignals,
      scores: {
        visual: matchingSignals.visualScore,
        structural: matchingSignals.structuralScore,
        terminology: matchingSignals.terminologyScore,
        total: matchingSignals.totalScore,
      },
    },
    preferredSourceMode,
    reviewHints: unique(reviewHints),
  };
}

function classifyImageQuestionClass(question, templateClass, hasImage) {
  if (!hasImage) return "none";
  if (PDF_FIRST_TEMPLATE_CLASSES.has(templateClass)) return "fixed-symbol";

  const prompt = String(question.prompt ?? "").toLowerCase();
  const isSceneBased =
    question.type === "row" ||
    /in this situation|on this road|at this intersection|which lane|what should you do|what to do|how to drive|how to turn|from which side|what caused|what kind of violation|what kind of lane|how to use the lights|encountering this kind|the act of this|the method of this|at this position|in this section|stop and yield|speed up|change lanes|overtake|leave the expressway|enter the expressway|rear-end collision|by the roadside|pedestrians|red car/.test(
      prompt
    );

  return isSceneBased ? "scene-based" : "context-image";
}

function findRelatedEnglishQuestions(question, tags, allQuestions, patch, templateClass) {
  if (!Array.isArray(allQuestions) || allQuestions.length === 0) return [];

  const scored = [];
  for (const candidate of allQuestions) {
    if (candidate.id === question.id) continue;

    const candidateTags = collectTags(candidate, patch[candidate.id]);
    const overlap = candidateTags.filter((tag) => tags.includes(tag)).length;
    const hasCandidateImage = Array.isArray(candidate.assets) && candidate.assets.some((asset) => !!asset?.src);
    const candidateTemplateClass = detectTemplateClass(candidate, candidateTags, hasCandidateImage);
    const sameTemplate = candidateTemplateClass === templateClass;

    if (overlap === 0 && !sameTemplate) continue;

    const proximity = Math.abs(Number(candidate.number ?? 0) - Number(question.number ?? 0));
    const score = overlap * 10 + (sameTemplate ? 8 : 0) - Math.min(proximity, 50) / 10;
    scored.push({
      score,
      id: candidate.id,
      prompt: String(candidate.prompt ?? "").trim(),
      tags: candidateTags.slice(0, 2),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ id, prompt, tags }) => ({ id, prompt, tags }));
}

function isDashboardOrDevicePrompt(lowerPrompt) {
  return /what is this device|what device does the switch of this symbol control|which part does this switch control|which part does it control|what is this instrument|what pedal is this|what does this symbol indicate|this lights up continuously|this lights up to indicate that|warning light|airbag|seat belt|ignition switch|turn signal switch|light switch|gear lever|clutch lever/.test(
    lowerPrompt
  );
}

function isLegalAdminPrompt(lowerPrompt) {
  return /license|licence|penalty|fine|points|detained|detention|revoked|drinking|drunk|criminal|liabilit|inspection label|insurance label|registration|license plate|public security|apply.*license|driving license|motor vehicle driving license|commercial motor vehicle|illegal act|violates the law|subject to a|vehicle license|certificate of physical conditions|check\b|write-off|school bus/.test(
    lowerPrompt
  );
}

function isNegationSensitivePrompt(question, lowerPrompt, hasImage) {
  return (
    !hasImage &&
    (question.type === "row" || question.type === "ROW") &&
    /\b(not|no|never|cannot|can't|can not|may not|must not|should not|isn't|aren't|without|prohibited|forbidden|illegal)\b/.test(
      lowerPrompt
    )
  );
}

function isNumericThresholdSensitivePrompt(prompt, lowerPrompt, optionTexts, hasImage) {
  if (hasImage) return false;

  const optionBlob = optionTexts.join(" ").toLowerCase();
  return (
    /\b\d+\b/.test(prompt) ||
    /(km\/h|km\/hr|meters?|metres?|points?|yuan|years?|months?|days?|percent|%)/.test(
      `${lowerPrompt} ${optionBlob}`
    ) ||
    /\b(less than|more than|at least|not exceed|exceed|within|over|under|minimum|maximum)\b/.test(
      lowerPrompt
    )
  );
}

function isConditionSensitivePrompt(prompt, lowerPrompt, hasImage) {
  if (hasImage) return false;

  const conditionalCount =
    (lowerPrompt.match(/\b(when|if|before|after|while|unless|in case|as long as|despite|once)\b/g) ?? [])
      .length;
  const hasBlank = lowerPrompt.includes("______");
  const isLong = prompt.length > 155;
  const isClearlyRoutineBehavior =
    /(tunnel|fog|rain|snow|wind|icy|slippery|expressway|highway|bus stop|crosswalk|pedestrians?|ambulance|bike rider|mountain road|downhill|uphill|overtaking signal|yield|courtesy|headlights?|fog light|hazard lights?)/.test(
      lowerPrompt
    ) &&
    conditionalCount <= 1 &&
    !hasBlank &&
    !isLong;

  if (isClearlyRoutineBehavior) return false;

  return hasBlank || isLong || conditionalCount >= 2;
}

function isRightOfWayLiabilitySensitivePrompt(lowerPrompt, hasImage) {
  return (
    !hasImage &&
    /(right-of-way|right of way|liable|liability|responsible|responsibility|fault|blame|compensation|which vehicle.*first|who.*first|bear.*responsibility)/.test(
      lowerPrompt
    )
  );
}

function isTruthFalseSensitivePrompt(
  question,
  hasImage,
  isNegationSensitive,
  isNumericThresholdSensitive,
  isConditionSensitive,
  isRightOfWayLiabilitySensitive
) {
  if (hasImage) return false;
  if (!(question.type === "row" || question.type === "ROW")) return false;
  return (
    isNegationSensitive ||
    isNumericThresholdSensitive ||
    isConditionSensitive ||
    isRightOfWayLiabilitySensitive
  );
}

function detectTemplateClass(question, tags, hasImage) {
  const prompt = String(question.prompt ?? "").toLowerCase();
  const optionBlob = Array.isArray(question.options)
    ? question.options.map((option) => String(option.text ?? "")).join(" | ").toLowerCase()
    : "";

  if (!hasImage) return "textual";

  if (/what device does the switch of this symbol control/.test(prompt)) {
    return "switch-symbol-control";
  }
  if (/this lights up continuously|this lights up to indicate that/.test(prompt)) {
    return "warning-light-meaning";
  }
  if (/what does this symbol indicate/.test(prompt)) {
    return "symbol-meaning";
  }
  if (/what is this instrument/.test(prompt)) {
    return "gauge-identification";
  }
  if (/what pedal is this/.test(prompt)) {
    return "pedal-identification";
  }
  if (/what is this device/.test(prompt)) {
    if (/switch|lights|wiper|defogger|gear lever|handbrake|clutch lever|throttle lever/.test(optionBlob)) {
      return "device-identification";
    }
    return "scene-device-question";
  }
  if (/this traffic light means|what does this traffic light mean|what does this signal light mean/.test(prompt)) {
    return "traffic-light-meaning";
  }
  if (
    /what is the (?:max speed limit|max speed|minimum speed) (?:on this road|on this city road|on this highway|on this expressway|in this lane)/.test(
      prompt
    )
  ) {
    return "traffic-sign-meaning";
  }
  if (/these traffic lights allow the vehicle to/.test(prompt)) {
    return "lane-signal-direction";
  }
  if (/what is the max speed limit on this road|what is the max speed on this expressway/.test(prompt)) {
    return "traffic-sign-meaning";
  }
  if (/what does this sign mean|what(?:'|’)?s the meaning of this sign|what is the meaning of this sign/.test(prompt)) {
    return "traffic-sign-meaning";
  }
  if (/what does this road marking mean/.test(prompt)) {
    return "road-marking-meaning";
  }
  if (/which kind of vehicles are allowed to drive in the lane with this marking on road/.test(prompt)) {
    return "road-marking-meaning";
  }
  if (/^this sign\b/.test(prompt)) {
    return "traffic-sign-statement";
  }
  if (/^top speed in this section is [0-9]+km\/h/.test(prompt)) {
    return "traffic-sign-statement";
  }
  if (/^this road marking\b|^this kind of traffic marking\b/.test(prompt)) {
    return "road-marking-statement";
  }
  if (/light switch|ignition switch|turn signal switch|rear fog light lights/.test(prompt)) {
    return "switch-position-statement";
  }
  return "scene-visual";
}

function buildSignalProfile({
  question,
  tags,
  assets,
  hasImage,
  lowerPrompt,
  optionBlob,
  templateClass,
}) {
  const options = Array.isArray(question.options) ? question.options : [];
  const visualSignals = [];
  const structuralSignals = [];
  const terminologySignals = [];
  let visualScore = 0;
  let structuralScore = 0;
  let terminologyScore = 0;

  if (hasImage) {
    visualSignals.push("has-image-asset");
    visualScore += 35;
  }

  if (PDF_FIRST_TEMPLATE_CLASSES.has(templateClass)) {
    visualSignals.push(`pdf-first-template:${templateClass}`);
    visualScore += 35;
  }

  if (
    tags.some((tag) =>
      ["traffic-lights", "traffic-signs", "road-markings", "police-hand-signals", "vehicle-basics"].includes(tag)
    )
  ) {
    visualSignals.push("taxonomy-aligns-with-visual-concept");
    visualScore += 10;
  }

  if (/symbol|switch|instrument|device|sign|traffic light|lights up/.test(lowerPrompt)) {
    visualSignals.push("prompt-names-fixed-visual-concept");
    visualScore += 10;
  }

  if (/\.(jpeg|jpg|png|webp)$/i.test(String(assets?.[0]?.src ?? ""))) {
    visualSignals.push("single-fixed-image-asset");
    visualScore += 5;
  }

  if (question.type === "mcq" || question.type === "MCQ") {
    structuralSignals.push("mcq-shape");
    structuralScore += 8;
  }

  if (question.type === "row" || question.type === "ROW") {
    structuralSignals.push("row-shape");
    structuralScore += 8;
  }

  if (PDF_FIRST_TEMPLATE_CLASSES.has(templateClass) && options.length === 4) {
    structuralSignals.push("four-option-fixed-template");
    structuralScore += 8;
  }

  if (
    hasCanonicalLabelFamily(optionBlob, templateClass) ||
    (options.length === 0 && /this sign|lights up continuously|rear fog light lights/.test(lowerPrompt))
  ) {
    structuralSignals.push("option-family-matches-fixed-concept");
    structuralScore += 12;
  }

  if (/\b(turn right|turn left|go straight|warning|beam|fog|wiper|washer|airbag|tachometer|meter|pedal|defog)/.test(optionBlob)) {
    terminologySignals.push("canonical-option-family");
    terminologyScore += 12;
  }

  if (
    /traffic light|sign|road marking|crosswalk|hazard lights|warning sign|airbag|wiper|washer|defog|fog light|speed and mileage meter|tachometer|gear lever|handbrake|pedal/.test(
      `${lowerPrompt} ${optionBlob}`
    )
  ) {
    terminologySignals.push("glossary-term-overlap");
    terminologyScore += 12;
  }

  const rowAnswer = String(question.correctRow ?? "").toLowerCase();
  const ambiguousImageConcept =
    /jammed section ahead/.test(lowerPrompt) ||
    (/working/.test(lowerPrompt) && /airbag/.test(lowerPrompt) && !["w", "wrong"].includes(rowAnswer));

  const totalScore = visualScore + structuralScore + terminologyScore;

  return {
    visualSignals,
    structuralSignals,
    terminologySignals,
    visualScore,
    structuralScore,
    terminologyScore,
    totalScore,
    ambiguousImageConcept,
  };
}

function hasCanonicalLabelFamily(optionBlob, templateClass) {
  if (!optionBlob) return false;

  const families = {
    "traffic-light-meaning": /intersection warning|no passing|draw attention|allowed to pass/,
    "lane-signal-direction": /turn right|turn left|go straight|stop and wait/,
    "traffic-sign-meaning": /crosswalk|no passing|warning|yield|speed|parking/,
    "road-marking-meaning": /cross-hatched|stop line|crosswalk|broken line|solid line/,
    "warning-light-meaning": /airbag|abs|seat belt|malfunction|working properly/,
    "symbol-meaning": /high beam|low beam|master switch|fog light|air circulation|fan/,
    "switch-symbol-control": /windscreen|rear window|wiper|washer|defrosting|defogging/,
    "device-identification": /switch|lights|wiper|defogger|gear lever|handbrake|clutch lever|throttle lever/,
    "pedal-identification": /clutch pedal|accelerator pedal|brake pedal|handbrake/,
    "gauge-identification": /speed and mileage meter|engine tachometer|fuel consumption|top speed meter/,
  };

  const matcher = families[templateClass];
  return matcher ? matcher.test(optionBlob) : false;
}

function buildTerminologyHints(templateClass, lowerPrompt, optionBlob) {
  const hints = [];

  switch (templateClass) {
    case "traffic-sign-meaning":
    case "traffic-sign-statement":
      hints.push('Prefer the PDF-first stem "이 표지의 뜻은?" for sign families');
      break;
    case "traffic-light-meaning":
    case "lane-signal-direction":
      hints.push('Prefer the PDF-first stem "이 표시의 뜻은?" for fixed signal/lane families');
      if (templateClass === "lane-signal-direction") {
        hints.push("When the image truly shows a lane-use label family, prefer terms like 좌회전차선, 우회전차선, 직진 우회전 공용차선, 직진 좌회전 공용차선, U턴 차선");
      }
      break;
    case "road-marking-meaning":
    case "road-marking-statement":
      hints.push('Prefer the PDF-first stem "이 노면표시의 의미는?" for road-marking families');
      break;
    case "warning-light-meaning":
      hints.push('Prefer the PDF-style dashboard stem "계기판에 등이 켜졌다. 무슨 의미인가?"');
      break;
    case "switch-symbol-control":
      hints.push('Prefer the PDF-style switch stem "표시가 된 스위치는 어떤 장치를 제어하는가?"');
      break;
    case "symbol-meaning":
      hints.push('Prefer the PDF-style dashboard-symbol stem "계기판에서 ... 의 의미는?" when the icon family is dashboard-related');
      break;
    case "gauge-identification":
      hints.push('Prefer the exact stem "이 계기는 무엇인가?"');
      break;
    case "device-identification":
      hints.push("Prefer PDF-style switch/device labels over broad app-style rewrites");
      break;
  }

  if (/crosswalk/.test(`${lowerPrompt} ${optionBlob}`)) {
    hints.push("Use 횡단보도 consistently");
  }
  if (/fog light/.test(`${lowerPrompt} ${optionBlob}`)) {
    hints.push("Prefer 전면 안개등 / 후면 안개등 in fixed visual switch/light families");
  }
  if (/defrost|defog/.test(`${lowerPrompt} ${optionBlob}`)) {
    hints.push("Prefer 서리 제거 / 제습 wording in PDF-style switch/control options");
  }

  return unique(hints);
}

function decideSourceMode(matchingSignals, templateClass, optionCount = 0) {
  if (matchingSignals.ambiguousImageConcept) {
    return "direct";
  }

  if (
    ["switch-position-statement", "warning-light-meaning", "traffic-sign-meaning", "symbol-meaning"].includes(
      templateClass
    ) &&
    matchingSignals.visualScore >= (templateClass === "traffic-sign-meaning" ? 75 : 80)
  ) {
    return "pdf-template-guided";
  }

  if (templateClass === "traffic-sign-statement" && matchingSignals.visualScore >= 75) {
    return "pdf-adapted";
  }

  if (
    matchingSignals.visualScore >= 80 &&
    matchingSignals.structuralScore >= 18 &&
    matchingSignals.terminologyScore >= 12
  ) {
    if (
      optionCount === 0 &&
      ["traffic-sign-statement", "road-marking-statement"].includes(templateClass)
    ) {
      return "pdf-adapted";
    }
    return "pdf-template-guided";
  }

  if (
    matchingSignals.visualScore >= 70 &&
    matchingSignals.structuralScore >= 8 &&
    matchingSignals.terminologyScore >= 10
  ) {
    return "pdf-template-guided";
  }

  return "direct";
}

async function translateBatch(client, glossary, batchPayload) {
  const prompt = [
    "Glossary/style guide:",
    glossary,
    "",
    "Translate the following batch.",
    "Return JSON with this exact shape:",
    '{ "questions": [ { "id": "...", "prompt": "...", "explanation": "...", "options": { "optId": "..." }, "sourceMode": "pdf-adapted|pdf-template-guided|direct", "confidence": "high|medium|low", "reviewNotes": ["..."] } ] }',
    "",
    JSON.stringify({ questions: batchPayload }, null, 2),
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model: MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
      });

      const text = (response.output_text ?? "").trim();
      const parsed = parseJsonObject(text);
      validateBatchResponse(batchPayload, parsed);
      return parsed;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`Batch retry ${attempt} failed: ${error.message ?? error}`);
      await sleep(1200 * attempt);
    }
  }

  throw new Error("Unreachable");
}

function parseJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function validateBatchResponse(batchPayload, parsed) {
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Response JSON is missing a questions array");
  }

  if (parsed.questions.length !== batchPayload.length) {
    throw new Error(
      `Expected ${batchPayload.length} questions, received ${parsed.questions.length}`
    );
  }

  const expectedIds = new Set(batchPayload.map((item) => item.id));
  const expectedById = new Map(batchPayload.map((item) => [item.id, item]));
  for (const item of parsed.questions) {
    if (!expectedIds.has(item.id)) {
      throw new Error(`Unexpected question id in response: ${item.id}`);
    }
    if (typeof item.prompt !== "string" || item.prompt.trim().length === 0) {
      throw new Error(`Missing prompt for ${item.id}`);
    }
    if (typeof item.explanation !== "string" || item.explanation.trim().length === 0) {
      throw new Error(`Missing explanation for ${item.id}`);
    }
    if (!SOURCE_MODES.includes(item.sourceMode)) {
      throw new Error(`Invalid sourceMode for ${item.id}`);
    }
    if (item.confidence !== "high" && item.confidence !== "medium" && item.confidence !== "low") {
      throw new Error(`Invalid confidence for ${item.id}`);
    }

    const expected = expectedById.get(item.id);
    if ((expected?.options?.length ?? 0) > 0) {
      if (!item.options || typeof item.options !== "object") {
        throw new Error(`Missing options object for ${item.id}`);
      }
      for (const option of expected.options) {
        if (typeof item.options[option.id] !== "string" || item.options[option.id].trim().length === 0) {
          throw new Error(`Missing translated option ${option.id} for ${item.id}`);
        }
      }
    }
  }
}

function normalizeTranslationItem(original, item) {
  const reviewNotes = Array.isArray(item.reviewNotes)
    ? item.reviewNotes
        .map((note) => String(note ?? "").trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const lowerPrompt = String(original.prompt ?? "").toLowerCase();
  const hasImage = Array.isArray(original.assets) && original.assets.some((asset) => !!asset?.src);
  const templateClass = detectTemplateClass(original, [], hasImage);
  const imageQuestionClass = classifyImageQuestionClass(original, templateClass, hasImage);
  const manualException = MANUAL_EXCEPTION_IDS.has(original.id);
  const legalAdminSensitive = isLegalAdminPrompt(lowerPrompt);
  const optionTexts = Array.isArray(original.options)
    ? original.options.map((option) => String(option.text ?? ""))
    : [];
  const negationSensitive = isNegationSensitivePrompt(original, lowerPrompt, hasImage);
  const numericThresholdSensitive = isNumericThresholdSensitivePrompt(
    String(original.prompt ?? ""),
    lowerPrompt,
    optionTexts,
    hasImage
  );
  const conditionSensitive = isConditionSensitivePrompt(
    String(original.prompt ?? ""),
    lowerPrompt,
    hasImage
  );
  const rightOfWayLiabilitySensitive = isRightOfWayLiabilitySensitivePrompt(lowerPrompt, hasImage);
  const truthFalseSensitive = isTruthFalseSensitivePrompt(
    original,
    hasImage,
    negationSensitive,
    numericThresholdSensitive,
    conditionSensitive,
    rightOfWayLiabilitySensitive
  );
  const forcedReviewReasons = [];

  if (manualException) forcedReviewReasons.push("manual-exception");
  if (legalAdminSensitive) forcedReviewReasons.push("legal-admin");
  if (negationSensitive) forcedReviewReasons.push("negation-sensitive");
  if (numericThresholdSensitive) forcedReviewReasons.push("numeric-threshold-sensitive");
  if (conditionSensitive) forcedReviewReasons.push("condition-sensitive");
  if (rightOfWayLiabilitySensitive) forcedReviewReasons.push("right-of-way-liability-sensitive");
  if (truthFalseSensitive) forcedReviewReasons.push("truth-false-sensitive");

  if (manualException && !reviewNotes.includes(MANUAL_EXCEPTION_NOTE)) {
    reviewNotes.unshift(MANUAL_EXCEPTION_NOTE);
  }

  const confidence =
    item.confidence === "low"
      ? "low"
      : forcedReviewReasons.length > 0
        ? "medium"
        : item.confidence;

  const reviewStatus =
    confidence !== "high" || reviewNotes.length > 0 ? "needs-review" : "ready";

  const normalized = {
    prompt: normalizeKoreanMeasurementStyle(item.prompt.trim()),
    explanation: normalizeKoreanMeasurementStyle(item.explanation.trim()),
    sourceMode: item.sourceMode,
    confidence,
    reviewStatus,
  };

  if (Array.isArray(original.options) && original.options.length > 0) {
    const translatedOptions = {};
    const modelOptions = item.options && typeof item.options === "object" ? item.options : {};

    for (const option of original.options) {
      const translated = modelOptions[option.id];
      if (typeof translated !== "string" || translated.trim().length === 0) {
        throw new Error(`Missing translated option ${option.id} for ${original.id}`);
      }
      translatedOptions[option.id] = normalizeKoreanMeasurementStyle(translated.trim());
    }

    normalized.options = translatedOptions;
  }

  const autoFlags = [];
  if (hasImage) {
    autoFlags.push("image-dependent");
  }
  if (imageQuestionClass === "fixed-symbol") {
    autoFlags.push("fixed-symbol");
  }
  if (imageQuestionClass === "scene-based") {
    autoFlags.push("scene-based");
  }
  if (imageQuestionClass === "context-image") {
    autoFlags.push("context-image");
  }
  if (manualException) {
    autoFlags.push("manual-exception");
  }
  if (legalAdminSensitive) {
    autoFlags.push("legal-admin");
  }
  if (isDashboardOrDevicePrompt(lowerPrompt)) {
    autoFlags.push("dashboard-device");
  }
  if (negationSensitive) {
    autoFlags.push("negation-sensitive");
  }
  if (numericThresholdSensitive) {
    autoFlags.push("numeric-threshold-sensitive");
  }
  if (conditionSensitive) {
    autoFlags.push("condition-sensitive");
  }
  if (rightOfWayLiabilitySensitive) {
    autoFlags.push("right-of-way-liability-sensitive");
  }
  if (truthFalseSensitive) {
    autoFlags.push("truth-false-sensitive");
  }

  const mergedFlags = unique([
    ...autoFlags,
    ...(reviewStatus === "needs-review" ? ["needs-review"] : []),
  ]);

  if (mergedFlags.length > 0) normalized.flags = mergedFlags;
  if (reviewNotes.length > 0) normalized.notes = reviewNotes;

  return normalized;
}

function normalizeKoreanMeasurementStyle(text) {
  return String(text)
    .replace(/(\d+)\s*km\/(?:h|hr)\b/gi, "시속 $1km")
    .replace(/(\d+)\s*km\/시\b/gi, "시속 $1km")
    .replace(/몇\s*km\/(?:h|hr)\b/gi, "시속 몇 km")
    .replace(/시속\s+시속\s+/g, "시속 ")
    .replace(/시속\s+(\d+)\s*km\b/g, "시속 $1km")
    .replace(/속도를\s+시속\s+몇\s*km/g, "시속 몇 km")
    .replace(/속도는\s+시속\s+몇\s*km/g, "시속 몇 km")
    .replace(/속도가\s+시속\s+몇\s*km/g, "시속 몇 km");
}

function refineExistingVisualTranslations(existing, allQuestions, patch) {
  const questionsById = new Map(allQuestions.map((question) => [question.id, question]));
  const out = {
    meta: { ...existing.meta },
    questions: { ...existing.questions },
  };

  for (const [id, entry] of Object.entries(existing.questions)) {
    const original = questionsById.get(id);
    if (!original) continue;

    if (MANUAL_EXCEPTION_IDS.has(id)) {
      out.questions[id] = markManualExceptionEntry(entry);
      continue;
    }

    const tags = collectTags(original, patch[id]);
    const classification = classifyQuestion(original, tags, original.assets ?? []);
    if (!shouldRefineVisualEntry(entry, classification)) continue;

    out.questions[id] = refineVisualEntry(original, entry, classification);
  }

  return out;
}

function shouldRefineVisualEntry(entry, classification) {
  return PDF_FIRST_TEMPLATE_CLASSES.has(classification.templateClass);
}

function markManualExceptionEntry(entry) {
  const flags = unique([...(entry.flags ?? []), "manual-exception", "needs-review"]);
  const notes = unique([MANUAL_EXCEPTION_NOTE, ...(entry.notes ?? [])]);
  return {
    ...entry,
    sourceMode: "direct",
    confidence: entry.confidence === "low" ? "low" : "medium",
    reviewStatus: "needs-review",
    flags,
    notes,
  };
}

function refineVisualEntry(original, entry, classification) {
  const prompt = buildRefinedVisualPrompt(original, entry.prompt, classification.templateClass);
  const explanation =
    entry.explanation && entry.explanation !== entry.prompt
      ? buildRefinedVisualPrompt(original, entry.explanation, classification.templateClass)
      : prompt;
  const options = normalizeVisualOptions(original, entry.options, classification.templateClass);
  const reviewNotes = buildRefinementNotes(original, classification);
  const confidence = determineRefinedConfidence(original, classification, reviewNotes);
  const reviewStatus =
    confidence !== "high" || reviewNotes.length > 0 ? "needs-review" : "ready";

  const normalized = {
    ...entry,
    prompt,
    explanation,
    sourceMode: classification.preferredSourceMode,
    confidence,
    reviewStatus,
  };

  if (options) {
    normalized.options = options;
  }

  const flags = [];
  if (Array.isArray(original.assets) && original.assets.some((asset) => !!asset?.src)) {
    flags.push("image-dependent");
  }
  if (
    ["warning-light-meaning", "symbol-meaning", "switch-symbol-control", "device-identification", "pedal-identification", "gauge-identification", "switch-position-statement"].includes(
      classification.templateClass
    )
  ) {
    flags.push("dashboard-device");
  }
  if (classification.matchingSignals.visual.includes("pdf-first-template:traffic-sign-statement")) {
    flags.push("traffic-sign");
  }
  if (classification.matchingSignals.scores.total < 95 || reviewNotes.length > 0) {
    flags.push("needs-review");
  }
  if (classification.matchingSignals.visual.includes("pdf-first-template:traffic-light-meaning")) {
    flags.push("signal-template");
  }
  if (classification.matchingSignals.visual.includes("pdf-first-template:lane-signal-direction")) {
    flags.push("lane-signal");
  }
  if (reviewNotes.some((note) => note.includes("이미지"))) {
    flags.push("visual-concept-ambiguous");
  }

  normalized.flags = unique(flags);

  if (reviewNotes.length > 0) {
    normalized.notes = reviewNotes;
  } else {
    delete normalized.notes;
  }

  return normalized;
}

function buildRefinedVisualPrompt(original, currentPrompt, templateClass) {
  const lower = String(original.prompt ?? "").toLowerCase();
  const optionBlob = Array.isArray(original.options)
    ? original.options.map((option) => String(option.text ?? "")).join(" | ").toLowerCase()
    : "";

  switch (templateClass) {
    case "traffic-light-meaning":
    case "lane-signal-direction":
      return "이 표시의 뜻은?";
    case "traffic-sign-meaning":
      return "이 표지의 뜻은?";
    case "road-marking-meaning":
      return "이 노면표시의 의미는?";
    case "warning-light-meaning":
      if (original.type === "row" || original.type === "ROW") {
        if (/engine control system failed/.test(lower)) {
          return "계기판에 등이 켜졌다. 엔진 제어 시스템 이상을 의미한다.";
        }
        if (/airbag is working/.test(lower)) {
          return "계기판에 등이 켜졌다. 에어백이 정상 작동 중임을 의미한다.";
        }
      }
      return "계기판에 등이 켜졌다. 무슨 의미인가?";
    case "symbol-meaning":
      if (/beam|fog light|vehicle lights|airbag|abs|seat belt/.test(optionBlob)) {
        return "계기판에서 이 표시의 의미는?";
      }
      return "이 표시의 뜻은?";
    case "switch-symbol-control":
      return "표시가 된 스위치는 어떤 장치를 제어하는가?";
    case "gauge-identification":
      return "이 계기는 무엇인가?";
    case "pedal-identification":
      return "이 페달은 무엇인가?";
    case "device-identification":
      return "이 장치는 무엇인가?";
    case "switch-position-statement":
      return refineSwitchPositionStatement(lower, currentPrompt);
    case "traffic-sign-statement":
      return refineTrafficSignStatement(lower, currentPrompt);
    case "road-marking-statement":
      return refineRoadMarkingStatement(lower, currentPrompt);
    default:
      return currentPrompt;
  }
}

function refineSwitchPositionStatement(lowerPrompt, currentPrompt) {
  if (/whole car lights turn on/.test(lowerPrompt)) {
    return "전조등 스위치를 이 위치로 돌리면 차량의 모든 등화가 켜진다.";
  }
  if (/front fog lights turn on/.test(lowerPrompt)) {
    return "전면 안개등 스위치를 이 위치로 돌리면 전면 안개등이 켜진다.";
  }
  if (/rear fog light lights/.test(lowerPrompt)) {
    return "후면 안개등 스위치를 이 위치로 돌리면 후면 안개등이 켜진다.";
  }
  if (/steering wheel will be locked/.test(lowerPrompt)) {
    return "시동 스위치가 LOCK 위치에 있을 때 키를 빼면 핸들이 잠긴다.";
  }
  if (/starter engages/.test(lowerPrompt)) {
    return "시동 스위치가 START 위치에 있으면 시동 모터가 작동한다.";
  }
  if (/can not use electrical appliances/.test(lowerPrompt)) {
    return "시동 스위치가 ON 위치에 있으면 전기 장치를 사용할 수 없다.";
  }
  if (/left-turn signal will flash/.test(lowerPrompt)) {
    return "방향지시등 스위치를 위로 올리면 좌회전 방향지시등이 켜진다.";
  }
  if (/starter works when turning the ignition switch to the acc position/.test(lowerPrompt)) {
    return "시동 스위치를 ACC 위치로 돌리면 시동 모터가 작동한다.";
  }
  return currentPrompt;
}

function refineTrafficSignStatement(lowerPrompt, currentPrompt) {
  if (/crosswalk ahead/.test(lowerPrompt)) {
    return "이 표지는 전방에 횡단보도가 있음을 나타낸다.";
  }
  if (/jammed section ahead/.test(lowerPrompt)) {
    return "이 표지는 전방 정체 구간을 알리고 서행을 권고한다.";
  }
  const speedMatch = lowerPrompt.match(/^top speed in this section is ([0-9]+)km\/h/);
  if (speedMatch) {
    return `이 표지는 최고속도가 시속 ${speedMatch[1]}km임을 나타낸다.`;
  }
  return currentPrompt;
}

function refineRoadMarkingStatement(lowerPrompt, currentPrompt) {
  if (/cross-hatched marking area/.test(lowerPrompt)) {
    return "이 경우 노면표시의 빗금 구역 안으로 들어가 대기할 수 있다.";
  }
  return currentPrompt;
}

function normalizeVisualOptions(original, currentOptions, templateClass) {
  if (!currentOptions || typeof currentOptions !== "object") return currentOptions;

  const replacements = {
    "intersection warning": "교차로 주의",
    "no passing": "추월 금지",
    "draw attention": "주의",
    "allowed to pass": "통행 허용",
    "turn right": "우회전",
    "stop and wait": "정지 후 대기",
    "turn left": "좌회전",
    "go straight": "직진",
    "the windscreen defrosting or defogging": "앞유리 서리 제거 및 제습 장치",
    "the rear window defrosting or defogging": "뒷유리 서리 제거 및 제습 장치",
    "the windscreen wiper and washer": "앞유리 와이퍼 및 워셔",
    "the rear window wiper and washer": "뒷유리 와이퍼 및 워셔",
    "switch of the turn signal": "방향지시등 스위치",
    "switch of the head lights": "전조등 스위치",
    "switch of wiper": "와이퍼 스위치",
    "switch of the windscreen wiper": "와이퍼 스위치",
    "switch of defogger": "서리 제거 및 제습 스위치",
    "switch of the defogger": "서리 제거 및 제습 스위치",
    "the handbrake": "주차 브레이크",
    "the gear lever": "기어 변속 레버",
    "the clutch lever": "클러치 레버",
    "the air throttle lever": "스로틀 레버",
    "airbags working properly": "에어백 정상 작동",
    "not buckled up": "안전벨트를 매지 않음",
    "an abs system malfunction": "ABS 고장",
    "an airbag malfunction": "에어백 고장",
    "high beam lights": "상향 전조등",
    "low beam lights": "하향 전조등",
    "master switch of vehicle lights": "전조등 주 스위치",
    "tail fog light": "후면 안개등",
    "speed and mileage meter": "속도계 및 주행거리계",
    "engine tachometer": "엔진 회전수계",
    "top speed meter": "최고속도계",
    "fuel consumption per 100km": "100km당 연료 소비량",
  };

  const normalized = {};
  for (const option of Array.isArray(original.options) ? original.options : []) {
    const english = String(option.text ?? "").trim();
    const speedMatch = english.match(/^([0-9]+)\s*km(?:\/?(?:hr|h))?$/i);
    if (speedMatch) {
      normalized[option.id] = `시속 ${speedMatch[1]}km`;
      continue;
    }
    normalized[option.id] = replacements[english] ?? currentOptions[option.id];
  }

  return normalized;
}

function buildRefinementNotes(original, classification) {
  const notes = [];

  if (/jammed section ahead/i.test(String(original.prompt ?? ""))) {
    notes.push("영문 문구와 실제 표지 이미지가 잘 맞지 않아 수동 확인이 필요하다.");
  }

  if (
    classification.matchingSignals.scores.total < 95 &&
    !(
      ["traffic-sign-meaning", "traffic-sign-statement"].includes(classification.templateClass) &&
      classification.matchingSignals.scores.visual >= 75
    )
  ) {
    notes.push("시각 개념 매칭 신호가 충분히 높지 않아 수동 확인이 필요하다.");
  }

  if (classification.matchingSignals.visual.includes("pdf-first-template:traffic-sign-statement")) {
    return notes;
  }

  if (
    /airbag is working/i.test(String(original.prompt ?? "")) &&
    !["w", "wrong"].includes(String(original.correctRow ?? "").toLowerCase())
  ) {
    notes.push("에어백 경고등 문제는 이미지 의미와 문장 진위를 함께 확인하는 편이 안전하다.");
  }

  return unique(notes);
}

function determineRefinedConfidence(original, classification, reviewNotes) {
  if (reviewNotes.length > 0) {
    return "medium";
  }

  if (classification.preferredSourceMode === "direct") {
    return "medium";
  }

  if (
    [
      "warning-light-meaning",
      "symbol-meaning",
      "switch-symbol-control",
      "device-identification",
      "pedal-identification",
      "gauge-identification",
      "switch-position-statement",
      "traffic-sign-meaning",
      "traffic-sign-statement",
    ].includes(classification.templateClass) &&
    classification.matchingSignals.scores.visual >= 75
  ) {
    return "high";
  }

  return "high";
}

function finalizeMeta(file) {
  const entries = Object.values(file.questions);
  const pdfAdaptedCount = entries.filter((item) => item.sourceMode === "pdf-adapted").length;
  const pdfTemplateGuidedCount = entries.filter(
    (item) => item.sourceMode === "pdf-template-guided"
  ).length;
  const directCount = entries.filter((item) => item.sourceMode === "direct").length;
  const ambiguousCount = entries.filter(
    (item) => item.reviewStatus === "needs-review" || item.flags?.includes("needs-review")
  ).length;
  const imageVerificationCount = entries.filter((item) =>
    item.flags?.includes("image-dependent")
  ).length;

  return {
    meta: {
      ...file.meta,
      locale: "ko",
      translatedQuestions: entries.length,
      pdfAdaptedCount,
      pdfTemplateGuidedCount,
      directCount,
      ambiguousCount,
      imageVerificationCount,
      glossaryPath: "docs/korean-qbank-glossary.md",
      model: MODEL,
      generatedAt: new Date().toISOString(),
    },
    questions: file.questions,
  };
}

async function writeOutput(file) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function logSummary(file) {
  console.log(
    JSON.stringify(
      {
        output: path.relative(ROOT, OUTPUT_PATH),
        translatedQuestions: file.meta.translatedQuestions,
        pdfAdaptedCount: file.meta.pdfAdaptedCount,
        pdfTemplateGuidedCount: file.meta.pdfTemplateGuidedCount,
        directCount: file.meta.directCount,
        ambiguousCount: file.meta.ambiguousCount,
        imageVerificationCount: file.meta.imageVerificationCount,
      },
      null,
      2
    )
  );
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
