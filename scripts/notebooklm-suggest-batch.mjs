#!/usr/bin/env node

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  DEFAULT_DATASET,
  ROOT,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const NOTEBOOK_URL = "https://notebooklm.google.com/notebook/f7750796-0812-4563-8b75-4a2362c8b3d5";
const CDP_ENDPOINT = "http://localhost:9222";
const LOW_CONFIDENCE_AUTO_SCORE = 85;
const LOW_CONFIDENCE_AUTO_GAP = 12;

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const limit = args.limit == null ? null : Number(args.limit);
const headed = args.headed === true || String(args.headed ?? "").toLowerCase() === "true";
const force = args.force === true || String(args.force ?? "").toLowerCase() === "true";
const dryRun = args["dry-run"] === true || String(args["dry-run"] ?? "").toLowerCase() === "true";
const simplePrompt = args["simple-prompt"] === true || String(args["simple-prompt"] ?? "").toLowerCase() === "true";
const candidateJudge = args["candidate-judge"] === true || String(args["candidate-judge"] ?? "").toLowerCase() === "true";
const timeoutMs = parsePositiveNumber(args["timeout-ms"], 120_000);

await ensurePipelineDirs({ lang, batchId });

const batchFiles = getBatchFiles(lang, batchId);
const suggestionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-notebooklm-suggestions.json`);
const decisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);
const existingSuggestions = fileExists(suggestionsPath)
  ? readJson(suggestionsPath)
  : {
      lang,
      batch: batchId,
      batchId,
      dataset,
      generatedAt: stableNow(),
      notebookUrl: NOTEBOOK_URL,
      cdpEndpoint: CDP_ENDPOINT,
      items: [],
    };

const suggestionByItemId = new Map(
  (Array.isArray(existingSuggestions.items) ? existingSuggestions.items : [])
    .filter((item) => item?.itemId)
    .map((item) => [String(item.itemId), item]),
);

const decisions = fileExists(decisionsPath) ? readJson(decisionsPath) : { items: [] };
const decisionByItemId = new Map(
  (Array.isArray(decisions.items) ? decisions.items : [])
    .filter((item) => item?.itemId)
    .map((item) => [String(item.itemId), item]),
);

const sourceItems = loadSourceItems();
const selectedItems = selectItems(sourceItems, decisionByItemId)
  .filter((entry) => force || !suggestionByItemId.has(entry.item.itemId))
  .slice(0, limit && Number.isFinite(limit) && limit > 0 ? limit : undefined);

console.log(`NotebookLM suggestion selection: ${selectedItems.length} item(s) selected from ${sourceItems.length} source item(s).`);
console.log(`Output: ${path.relative(ROOT, suggestionsPath)}`);
console.log(`Chrome CDP endpoint: ${CDP_ENDPOINT}`);
console.log(`Prompt mode: ${candidateJudge ? "candidate-judge" : simplePrompt ? "simple" : "full"}`);
console.log(`NotebookLM timeout: ${timeoutMs}ms`);

if (dryRun) {
  for (const entry of selectedItems) {
    console.log(`\n--- ${entry.section}: ${entry.item.itemId} ---\n${buildPrompt(entry)}`);
  }
  process.exit(0);
}

let browserContext = null;
let browser = null;
let page = null;
if (selectedItems.length > 0) {
  ({ browser, browserContext, page } = await openNotebook());
}

let processed = 0;
let parsed = 0;
let closeMatches = 0;

for (const entry of selectedItems) {
  const itemId = entry.item.itemId;
  const prompt = buildPrompt(entry);
  const startedAt = new Date().toISOString();
  let rawNotebookAnswer = null;
  let output;

  try {
    const notebookResponse = await askNotebook(page, prompt);
    rawNotebookAnswer = notebookResponse.text;

    if (notebookResponse.timedOut) {
      output = {
        itemId,
        sourceImage: entry.item.sourceImage ?? null,
        rawNotebookAnswer,
        status: "timeout",
        waitDiagnostics: notebookResponse.diagnostics,
        processedAt: startedAt,
      };
      console.warn(`NotebookLM response timeout for ${itemId}: ${notebookResponse.diagnostics.summary}`);
      suggestionByItemId.set(itemId, output);
      await persistSuggestions();
      processed += 1;
      console.log(`${processed}/${selectedItems.length} ${itemId}: ${output.status}`);
      await delay(1200);
      continue;
    }

    const parsedResult = parseNotebookJson(rawNotebookAnswer);
    const parsedAnswer = parsedResult.value;

    if (!parsedAnswer) {
      output = {
        itemId,
        sourceImage: entry.item.sourceImage ?? null,
        rawNotebookAnswer,
        status: "parse-failed",
        parseDiagnostics: parsedResult.diagnostics,
        processedAt: startedAt,
      };
      console.warn(`Parse failed for ${itemId}: ${formatParseFailureDiagnostics(parsedResult.diagnostics)}`);
    } else {
      const normalized = normalizeNotebookAnswer(parsedAnswer);
      parsed += 1;
      if (normalized.isCloseMatch) {
        closeMatches += 1;
      }
      output = {
        itemId,
        sourceImage: entry.item.sourceImage ?? null,
        notebookSuggestedQid: normalized.qid,
        notebookQuestionNumber: normalized.questionNumber,
        notebookAnswerKey: normalized.answerKey,
        confidence: normalized.confidence,
        isCloseMatch: normalized.isCloseMatch,
        reason: normalized.reason,
        matchedText: normalized.matchedText,
        rawNotebookAnswer,
        parseDiagnostics: parsedResult.diagnostics,
        status: "ok",
        processedAt: startedAt,
      };
    }
  } catch (error) {
    output = {
      itemId,
      sourceImage: entry.item.sourceImage ?? null,
      rawNotebookAnswer,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      processedAt: startedAt,
    };
  }

  suggestionByItemId.set(itemId, output);
  await persistSuggestions();
  processed += 1;
  console.log(`${processed}/${selectedItems.length} ${itemId}: ${output.status}${output.notebookSuggestedQid ? ` ${output.notebookSuggestedQid}` : ""}`);
  await delay(1200);
}

if (browserContext) {
  await browserContext.close();
}
if (browser) {
  await browser.close();
}

console.log(`NotebookLM suggestions complete: processed=${processed}, parsed=${parsed}, closeMatches=${closeMatches}.`);

function loadSourceItems() {
  const docs = [
    ["auto-matched", batchFiles.matchedPath],
    ["review-needed", batchFiles.reviewNeededPath],
    ["unresolved", batchFiles.unresolvedPath],
  ];
  const entries = [];
  for (const [section, filePath] of docs) {
    if (!fileExists(filePath)) {
      continue;
    }
    const doc = readJson(filePath);
    for (const item of Array.isArray(doc.items) ? doc.items : []) {
      entries.push({ section, item });
    }
  }
  return entries;
}

function selectItems(entries, decisionsByItemId) {
  return entries.filter((entry) => {
    const item = entry.item;
    if (!item?.itemId) {
      return false;
    }
    const decision = decisionsByItemId.get(item.itemId);
    if (looksManuallyReviewed(decision, entry.section)) {
      return false;
    }
    if (entry.section === "unresolved" || entry.section === "review-needed") {
      return true;
    }
    return isLowConfidenceAutoMatch(item);
  });
}

function looksManuallyReviewed(decision, section) {
  if (!decision) {
    return false;
  }
  const notes = String(decision.reviewerNotes ?? "").trim();
  if (notes) {
    return true;
  }
  if (decision.deleteQuestion === true || decision.createNewQuestion === true || decision.keepUnresolved === true) {
    return true;
  }
  const approvedQid = normalizeQid(decision.approvedQid);
  const initialSuggestedQid = normalizeQid(decision.initialSuggestedQid);
  if (section !== "auto-matched" && approvedQid) {
    return true;
  }
  if (approvedQid && initialSuggestedQid && approvedQid !== initialSuggestedQid) {
    return true;
  }
  return false;
}

function isLowConfidenceAutoMatch(item) {
  const score = Number(item?.match?.score ?? item?.topCandidates?.[0]?.score ?? 0);
  const gap = Number(item?.match?.scoreGap ?? item?.analysis?.autoMatch?.scoreGap ?? 0);
  const reasonCodes = item?.analysis?.decisionReasonCodes ?? item?.analysis?.autoMatch?.reasonCodes ?? [];
  return (
    score < LOW_CONFIDENCE_AUTO_SCORE ||
    gap < LOW_CONFIDENCE_AUTO_GAP ||
    (Array.isArray(reasonCodes) && reasonCodes.some((code) => /gap|weak|conflict|confirm/i.test(String(code))))
  );
}

function buildPrompt(entry) {
  if (candidateJudge) {
    return buildCandidateJudgePrompt(entry);
  }
  if (simplePrompt) {
    return buildSimplePrompt(entry);
  }

  const item = entry.item;
  const topCandidates = (Array.isArray(item.topCandidates) ? item.topCandidates : []).slice(0, 6).map((candidate, index) => ({
    rank: index + 1,
    qid: candidate.qid ?? null,
    questionNumber: candidate.number ?? null,
    score: candidate.score ?? null,
    answerKey: candidate.correctAnswer?.correctOptionKey ?? candidate.correctAnswer?.correctRow ?? null,
    prompt: candidate.prompt ?? null,
  }));
  const visibleImageDescription = [
    ...(Array.isArray(item.visualEvidenceNotes) ? item.visualEvidenceNotes : []),
    item.hasImage === true ? `visual object tags: ${(item.visualObjectTags ?? []).join(", ")}` : null,
    item.hasImage === true ? `visual color tags: ${(item.visualColorTags ?? []).join(", ")}` : null,
  ].filter(Boolean).join("\n");

  return `Find the most similar question in this notebook.

Return ONLY JSON in this exact format:
{
  "qid": "q0000 or null",
  "questionNumber": "number or null",
  "answerKey": "A/B/C/D/Right/Wrong/null",
  "confidence": 0-100,
  "isCloseMatch": true/false,
  "reason": "short explanation",
  "matchedText": "exact or closest question text"
}

If there is no close match, return:
{
  "qid": null,
  "questionNumber": null,
  "answerKey": null,
  "confidence": 0,
  "isCloseMatch": false,
  "reason": "NO CLOSE MATCH",
  "matchedText": null
}

Source item:
- itemId: ${item.itemId ?? ""}
- sourceImage: ${item.sourceImage ?? ""}
- source prompt: ${item.promptRawJa ?? item.localizedText?.prompt ?? ""}
- English gloss: ${item.promptGlossEn ?? item.translatedText?.prompt ?? ""}
- options/choices: ${JSON.stringify(item.optionsRawJa ?? item.localizedText?.options ?? [])}
- English options/choices: ${JSON.stringify(item.optionsGlossEn ?? item.translatedText?.options ?? [])}
- current initialSuggestedQid: ${item.match?.qid ?? item.topCandidates?.[0]?.qid ?? ""}
- current topCandidates: ${JSON.stringify(topCandidates)}
- current staged answer key: ${item.correctKeyRaw ?? item.correctAnswerRaw ?? ""}
- visible image/OCR description if available: ${visibleImageDescription || "none"}`;
}

function buildSimplePrompt(entry) {
  const item = entry.item;
  const sourcePrompt = item.promptRawJa ?? item.localizedText?.prompt ?? "";
  const choices = item.optionsRawJa ?? item.localizedText?.options ?? [];
  const candidateQids = getCandidateQids(item);
  return `Find the most similar question in this notebook.

Return ONLY JSON:
{
  "qid": "q0000 or null",
  "answerKey": "A/B/C/D/Right/Wrong/null",
  "confidence": 0-100,
  "isCloseMatch": true/false,
  "reason": "short reason",
  "matchedText": "closest question text"
}

Source:
${sourcePrompt}

Choices:
${formatChoices(choices)}

Candidate qids:
${candidateQids.join(", ") || "none"}`;
}

function buildCandidateJudgePrompt(entry) {
  const item = entry.item;
  const sourcePrompt = item.promptRawJa ?? item.localizedText?.prompt ?? "";
  const choices = item.optionsRawJa ?? item.localizedText?.options ?? [];
  const candidates = getTopCandidates(item, 5);
  return `Choose the best matching candidate from this list only. If none match, return null.

Return ONLY JSON:
{
  "qid": "q0000 or null",
  "answerKey": "A/B/C/D/Right/Wrong/null",
  "confidence": 0-100,
  "isCloseMatch": true/false,
  "reason": "short reason"
}

Source question:
${sourcePrompt}

Source choices:
${formatChoices(choices)}

Candidates:
${formatCandidateJudgeCandidates(candidates)}`;
}

function getTopCandidates(item, count) {
  return (Array.isArray(item.topCandidates) ? item.topCandidates : []).slice(0, count);
}

function formatCandidateJudgeCandidates(candidates) {
  if (!candidates.length) {
    return "none";
  }
  return candidates.map((candidate, index) => {
    const qid = normalizeQid(candidate.qid) ?? String(candidate.qid ?? "null");
    const score = candidate.score == null ? "unknown" : candidate.score;
    const answerKey = candidate.correctAnswer?.correctOptionKey ?? candidate.correctAnswer?.correctRow ?? candidate.correctAnswer?.answerRaw ?? "unknown";
    return [
      `${index + 1}. qid: ${qid}`,
      `   prompt: ${candidate.prompt ?? ""}`,
      `   choices:`,
      indentLines(formatCandidateOptions(candidate.options), "   "),
      `   answerKey: ${answerKey}`,
      `   score: ${score}`,
    ].join("\n");
  }).join("\n\n");
}

function formatChoices(choices) {
  return (Array.isArray(choices) ? choices : [])
    .map((choice, index) => {
      const text = String(choice ?? "").trim();
      if (/^[A-D]\b/.test(text)) {
        return text;
      }
      return `${String.fromCharCode(65 + index)} ${text}`;
    })
    .join("\n");
}

function formatCandidateOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (option && typeof option === "object") {
        const key = option.id ?? option.key ?? String.fromCharCode(65 + index);
        const text = option.text ?? option.translatedText ?? "";
        const translated = option.translatedText && option.translatedText !== text ? ` (${option.translatedText})` : "";
        return `${key} ${text}${translated}`.trim();
      }
      const text = String(option ?? "").trim();
      if (/^[A-D]\b/.test(text)) {
        return text;
      }
      return `${String.fromCharCode(65 + index)} ${text}`;
    })
    .join("\n");
}

function indentLines(text, prefix) {
  return String(text || "none")
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function getCandidateQids(item) {
  const qids = [
    item.match?.qid,
    ...(Array.isArray(item.topCandidates) ? item.topCandidates.map((candidate) => candidate?.qid) : []),
  ].map(normalizeQid).filter(Boolean);
  return [...new Set(qids)];
}

async function openNotebook() {
  const { chromium } = await import("playwright");
  await assertChromeCdpAvailable();
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error("Connected to Chrome over CDP, but no browser context was available.");
  }
  await context.setDefaultTimeout(15000);
  let page = context.pages().find((candidate) => candidate.url().startsWith(NOTEBOOK_URL));
  page ??= context.pages().find((candidate) => /notebooklm\.google\.com/.test(candidate.url()));
  page ??= await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 }).catch(() => null);
  await page.goto(NOTEBOOK_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("Connected to existing Chrome over CDP. Waiting for NotebookLM UI...");
  if (headed) {
    console.log("The --headed flag is accepted for workflow compatibility; Chrome must already be visible because this script no longer launches a browser.");
  }
  try {
    await waitForNotebookReady(page);
  } catch (error) {
    await writeNotebookDiagnostics(page);
    throw error;
  }
  return { browser, browserContext: null, page };
}

async function assertChromeCdpAvailable() {
  try {
    const response = await fetch(`${CDP_ENDPOINT}/json/version`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      [
        `Chrome is not reachable at ${CDP_ENDPOINT}.`,
        "Start Chrome manually with remote debugging enabled, then rerun this command:",
        "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222",
        "Use your normal logged-in Chrome session so NotebookLM can reuse Google authentication.",
        `Original connection error: ${error instanceof Error ? error.message : String(error)}`,
      ].join("\n"),
    );
  }
}

async function waitForNotebookReady(page) {
  const deadline = Date.now() + (headed ? 10 * 60_000 : 90_000);
  while (Date.now() < deadline) {
    const url = page.url();
    const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (/notebooklm\.google\.com\/notebook\//.test(url) && /ask|notebook|source|chat/i.test(text)) {
      const input = await findPromptInput(page);
      if (input) {
        return;
      }
    }
    await delay(2000);
  }
  throw new Error("NotebookLM prompt input was not available. Login may be required, or the NotebookLM UI changed.");
}

async function writeNotebookDiagnostics(page, extra = {}) {
  const diagnosticsDir = path.join(STAGING_DIR, "notebooklm-diagnostics");
  await mkdir(diagnosticsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch((error) => `Unable to read body text: ${error.message}`);
  const diagnostic = {
    generatedAt: new Date().toISOString(),
    lang,
    batchId,
    ...extra,
    url: page.url(),
    title: await page.title().catch(() => null),
    bodyTextPreview: bodyText.slice(0, 4000),
  };
  const jsonPath = path.join(diagnosticsDir, `${lang}-${batchId}-${stamp}.json`);
  await writeFile(jsonPath, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8");
  const screenshotPath = path.join(diagnosticsDir, `${lang}-${batchId}-${stamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => null);
  console.log(`NotebookLM diagnostics written to ${path.relative(ROOT, jsonPath)}.`);
}

async function findPromptInput(page) {
  const candidates = [
    page.getByRole("textbox").last(),
    page.locator("textarea").last(),
    page.locator("div[contenteditable='true']").last(),
    page.locator("[contenteditable='true']").last(),
  ];
  for (const locator of candidates) {
    try {
      if ((await locator.count()) > 0 && (await locator.isVisible({ timeout: 1000 }))) {
        return locator;
      }
    } catch {
      // Try the next locator.
    }
  }
  return null;
}

async function askNotebook(page, prompt) {
  const beforeState = await waitForNotebookConversationBaseline(page);
  const input = await findPromptInput(page);
  if (!input) {
    throw new Error("NotebookLM prompt input not found.");
  }
  await input.click();
  const tagName = await input.evaluate((node) => node.tagName.toLowerCase());
  if (tagName === "textarea" || tagName === "input") {
    await input.fill(prompt);
  } else {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type(prompt, { delay: 1 });
  }
  await submitNotebookPrompt(page);

  const waitStartedAt = Date.now();
  const deadline = waitStartedAt + timeoutMs;
  const pollMs = 1500;
  const stableMs = 5000;
  let latest = "";
  let lastResponseText = "";
  let lastChangedAt = Date.now();
  let loggedThinking = false;

  console.log("waiting for NotebookLM response...");
  while (Date.now() < deadline) {
    const latestState = await getNotebookConversationState(page);
    latest = latestState.text;
    const conversationChanged =
      latestState.messageCount > beforeState.messageCount ||
      (latestState.messageCount === beforeState.messageCount && latestState.lastMessageText !== beforeState.lastMessageText);
    const responseText = conversationChanged ? getPostSubmitText(beforeState.text, latestState.text) : "";
    if (responseText !== lastResponseText) {
      lastResponseText = responseText;
      lastChangedAt = Date.now();
    }

    if (isNotebookWorking(responseText) || (responseText.trim() && isNotebookWorking(latest))) {
      if (!loggedThinking) {
        console.log("response still thinking...");
        loggedThinking = true;
      }
      await delay(pollMs);
      continue;
    }

    const parsed = responseText.trim() ? parseNotebookJson(responseText).value : null;
    if (parsed) {
      return {
        text: responseText,
        timedOut: false,
        diagnostics: {
          summary: "valid JSON response detected",
          elapsedMs: Date.now() - waitStartedAt,
        },
      };
    }

    if (responseText.trim() && Date.now() - lastChangedAt >= stableMs) {
      console.log("response stabilized");
      return {
        text: responseText,
        timedOut: false,
        diagnostics: {
          summary: "response stabilized",
          elapsedMs: Date.now() - waitStartedAt,
          stableMs,
        },
      };
    }

    await delay(pollMs);
  }
  await writeNotebookDiagnostics(page, {
    reason: "notebooklm-response-timeout",
    timeoutMs,
    lastResponsePreview: lastResponseText.slice(0, 4000),
    lastResponseEndedThinking: isNotebookThinking(lastResponseText),
    conversationTextPreview: latest.slice(-4000),
    conversationMessageCountBefore: beforeState.messageCount,
    conversationLastMessageBeforePreview: beforeState.lastMessageText.slice(-1000),
  });
  return {
    text: latest,
    timedOut: true,
    diagnostics: {
      summary: "timed out waiting for NotebookLM to finish responding",
      timeoutMs,
      lastResponseEndedThinking: isNotebookThinking(lastResponseText),
      lastResponseLength: lastResponseText.length,
    },
  };
}

async function getNotebookConversationState(page) {
  return page.evaluate(() => {
    const selectors = [".chat-panel-content", "section.chat-panel", "[role='log']", "[role='main']"];
    const messages = [...document.querySelectorAll(".chat-message-pair")];
    const messageCount = messages.length;
    const lastMessageText = (messages.at(-1)?.innerText || "").trim();
    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)];
      const visibleTexts = nodes
        .map((node) => node.innerText || "")
        .map((text) => text.trim())
        .filter(Boolean);
      if (visibleTexts.length > 0) {
        return { text: visibleTexts.join("\n").trim(), messageCount, lastMessageText };
      }
    }
    return { text: (document.body?.innerText || "").trim(), messageCount, lastMessageText };
  }).catch(async () => ({
    text: await page.locator("body").innerText({ timeout: 10000 }).catch(() => ""),
    messageCount: 0,
    lastMessageText: "",
  }));
}

async function waitForNotebookConversationBaseline(page) {
  const deadline = Date.now() + 8000;
  let previous = await getNotebookConversationState(page);
  while (Date.now() < deadline) {
    await delay(1000);
    const current = await getNotebookConversationState(page);
    if (
      current.messageCount > 0 &&
      current.messageCount === previous.messageCount &&
      current.lastMessageText === previous.lastMessageText
    ) {
      return current;
    }
    previous = current;
  }
  return previous;
}

function getPostSubmitText(before, latest) {
  const beforeText = String(before ?? "");
  const latestText = String(latest ?? "");
  if (latestText === beforeText) {
    return "";
  }
  if (latestText.startsWith(beforeText)) {
    return latestText.slice(beforeText.length).trim();
  }
  let index = 0;
  while (index < beforeText.length && index < latestText.length && beforeText[index] === latestText[index]) {
    index += 1;
  }
  return latestText.slice(index).trim();
}

async function submitNotebookPrompt(page) {
  const submitButtons = page.getByRole("button", { name: /submit/i });
  const count = await submitButtons.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const button = submitButtons.nth(index);
    try {
      await button.waitFor({ state: "visible", timeout: 1000 });
      await page.waitForFunction(
        (element) => !element.disabled && element.getAttribute("aria-disabled") !== "true",
        await button.elementHandle(),
        { timeout: 3000 },
      );
      await button.click();
      return;
    } catch {
      // Try the next submit button, then fall back to Enter.
    }
  }
  await page.keyboard.press("Enter");
}

function isNotebookThinking(text) {
  return /(?:^|\n)\s*Thinking\.\.\.\s*$/i.test(String(text ?? "").trim());
}

function isNotebookWorking(text) {
  return /(?:^|\n)\s*(Thinking|Reading full chapters|Finding key words|Finding keywords|Examining the specifics|Examining specifics|Looking for clues|Consulting your sources|Assessing relevance)\.\.\.\s*$/i.test(
    String(text ?? "").trim(),
  );
}

function parseNotebookJson(text) {
  const source = String(text ?? "");
  const diagnostics = {
    sourceLength: source.length,
    fencedJsonBlocks: 0,
    fencedBlocks: 0,
    balancedJsonObjects: 0,
    skippedPromptExamples: 0,
    attempts: [],
    summary: "",
  };
  const candidates = [];

  for (const match of source.matchAll(/```json\s*([\s\S]*?)```/gi)) {
    diagnostics.fencedJsonBlocks += 1;
    candidates.push({ source: "fenced-json", text: match[1], index: match.index ?? -1 });
  }
  for (const match of source.matchAll(/```\s*([\s\S]*?)```/g)) {
    diagnostics.fencedBlocks += 1;
    candidates.push({ source: "fenced", text: match[1], index: match.index ?? -1 });
  }
  const balanced = extractJsonCandidates(source);
  diagnostics.balancedJsonObjects = balanced.length;
  candidates.push(...balanced.map((candidate) => ({ source: "balanced-object", text: candidate.text, index: candidate.index })));

  const seen = new Set();
  for (const candidate of candidates) {
    const raw = String(candidate.text ?? "").trim();
    if (!raw || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    if (isPromptExampleCandidate(source, candidate.index)) {
      diagnostics.skippedPromptExamples += 1;
      continue;
    }
    const direct = tryParseCandidate(raw, candidate.source, false);
    diagnostics.attempts.push(direct.diagnostic);
    if (direct.value) {
      diagnostics.summary = `parsed via ${candidate.source}`;
      return { value: direct.value, diagnostics };
    }
    const cleanedText = cleanupJsonCandidate(raw);
    if (cleanedText !== raw) {
      const cleaned = tryParseCandidate(cleanedText, `${candidate.source}:safe-cleanup`, true);
      diagnostics.attempts.push(cleaned.diagnostic);
      if (cleaned.value) {
        diagnostics.summary = `parsed via ${candidate.source} after safe cleanup`;
        return { value: cleaned.value, diagnostics };
      }
    }
  }

  diagnostics.summary = candidates.length
    ? `no valid NotebookLM JSON object found after ${diagnostics.attempts.length} parse attempt(s)`
    : "no fenced JSON block or balanced JSON object found";
  return { value: null, diagnostics };
}

function tryParseCandidate(candidate, source, cleaned) {
  const diagnostic = {
    source,
    cleaned,
    repairUsed: cleaned,
    repairKind: cleaned ? "safe-malformed-json-repair" : null,
    length: candidate.length,
    ok: false,
    error: null,
    hasExpectedKeys: false,
    preview: candidate.slice(0, 240),
  };
  try {
    const parsed = JSON.parse(candidate);
    diagnostic.ok = true;
    diagnostic.hasExpectedKeys = hasNotebookAnswerShape(parsed);
    if (diagnostic.hasExpectedKeys) {
      return { value: parsed, diagnostic };
    }
    diagnostic.error = "JSON parsed, but expected NotebookLM answer keys were missing.";
  } catch (error) {
    diagnostic.error = error instanceof Error ? error.message : String(error);
  }
  return { value: null, diagnostic };
}

function formatParseFailureDiagnostics(diagnostics) {
  const attempts = Array.isArray(diagnostics?.attempts) ? diagnostics.attempts : [];
  const failures = attempts
    .slice(-3)
    .map((attempt) => `${attempt.source}${attempt.cleaned ? " cleaned" : ""}: ${attempt.error ?? "unknown parse error"}`)
    .join("; ");
  return [
    diagnostics?.summary ?? "unknown parse failure",
    `fencedJson=${diagnostics?.fencedJsonBlocks ?? 0}`,
    `fenced=${diagnostics?.fencedBlocks ?? 0}`,
    `balanced=${diagnostics?.balancedJsonObjects ?? 0}`,
    `skippedPromptExamples=${diagnostics?.skippedPromptExamples ?? 0}`,
    `attempts=${attempts.length}`,
    failures ? `recentFailures=${failures}` : null,
  ].filter(Boolean).join(" | ");
}

function cleanupJsonCandidate(candidate) {
  let text = String(candidate ?? "").trim();
  text = text
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
  text = text.replace(/,\s*([}\]])/g, "$1");
  text = insertMissingJsonPropertyCommas(text);
  if (!text.includes("\"") && text.includes("'")) {
    text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(inner.replace(/\\'/g, "'")));
  } else {
    text = text.replace(/([{,]\s*)'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g, '$1"$2":');
    text = text.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => `: ${JSON.stringify(inner.replace(/\\'/g, "'"))}`);
  }
  return text;
}

function insertMissingJsonPropertyCommas(text) {
  const withInlineRepairs = String(text ?? "").replace(
    /((?:"[^"\\]*(?:\\.[^"\\]*)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[}\]]))(\s+)(?="[^"\\]*(?:\\.[^"\\]*)*"\s*:)/g,
    "$1,$2",
  );
  const lines = withInlineRepairs.split("\n");
  const repaired = [];
  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    const nextLine = lines[index + 1] ?? "";
    if (looksLikeJsonPropertyContinuationNeedsComma(line, nextLine)) {
      line = `${line.trimEnd()},`;
    }
    repaired.push(line);
  }
  return repaired.join("\n");
}

function looksLikeJsonPropertyContinuationNeedsComma(line, nextLine) {
  const current = String(line ?? "").trimEnd();
  const next = String(nextLine ?? "").trimStart();
  if (!current || current.endsWith(",") || current.endsWith("{") || current.endsWith("[")) {
    return false;
  }
  if (!/^"[^"\\]*(?:\\.[^"\\]*)*"\s*:/.test(next)) {
    return false;
  }
  return /(?:"[^"\\]*(?:\\.[^"\\]*)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[}\]])$/.test(current);
}

function extractJsonCandidates(text) {
  const candidates = [];
  const source = String(text ?? "");
  for (let start = source.indexOf("{"); start !== -1; start = source.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          candidates.push({ text: source.slice(start, index + 1), index: start });
          break;
        }
      }
    }
  }
  return candidates;
}

function isPromptExampleCandidate(source, index) {
  if (!Number.isFinite(index) || index < 0) {
    return false;
  }
  const before = source.slice(Math.max(0, index - 800), index).toLowerCase();
  return (
    before.includes("return only json in this exact format") ||
    before.includes("if there is no close match, return") ||
    before.includes("current topcandidates") ||
    before.includes("source item:")
  );
}

function hasNotebookAnswerShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return ["qid", "answerKey", "confidence", "isCloseMatch", "reason"].every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  );
}

function parsePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeNotebookAnswer(answer) {
  const questionNumber = normalizeQuestionNumber(answer.questionNumber);
  const qid = normalizeQid(answer.qid) ?? (questionNumber == null ? null : qidFromNumber(questionNumber));
  return {
    qid,
    questionNumber: questionNumber ?? numberFromQid(qid),
    answerKey: normalizeAnswerKey(answer.answerKey),
    confidence: clamp(Number(answer.confidence ?? 0), 0, 100),
    isCloseMatch: answer.isCloseMatch === true,
    reason: typeof answer.reason === "string" ? answer.reason : null,
    matchedText: typeof answer.matchedText === "string" ? answer.matchedText : null,
  };
}

async function persistSuggestions() {
  await writeJson(suggestionsPath, {
    lang,
    batch: batchId,
    batchId,
    dataset,
    generatedAt: stableNow(),
    notebookUrl: NOTEBOOK_URL,
    cdpEndpoint: CDP_ENDPOINT,
    items: [...suggestionByItemId.values()],
  });
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null") {
    return null;
  }
  const match = text.match(/^q?0*(\d{1,4})$/i);
  return match ? qidFromNumber(Number(match[1])) : null;
}

function qidFromNumber(number) {
  return `q${String(Number(number)).padStart(4, "0")}`;
}

function numberFromQid(qid) {
  const match = String(qid ?? "").match(/^q0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function normalizeQuestionNumber(value) {
  if (value == null) {
    return null;
  }
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeAnswerKey(value) {
  const text = String(value ?? "").trim();
  if (!text || /^null$/i.test(text)) {
    return null;
  }
  const upper = text.toUpperCase();
  if (/^[A-D]$/.test(upper)) {
    return upper;
  }
  if (/^(RIGHT|WRONG)$/i.test(text)) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
  return text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
