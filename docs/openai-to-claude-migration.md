# OpenAI → Claude Migration Plan

Status: **planned 2026-05-30.** Goal: move the qbank-localization workflow off OpenAI onto
the Anthropic SDK (`@anthropic-ai/sdk`), and add a Claude semantic reranker stage.

## OpenAI touchpoints (inventory)

Dependency: `openai ^6.22.0`. Env key: `OPENAI_API_KEY` (in `.env.local`). No Anthropic SDK yet.

| File | Role | Migration |
|---|---|---|
| `scripts/extract-screenshot-intake.mjs` | **Vision OCR** — screenshots → `intake.json` (Responses API, `gpt-4.1`, image input) | **Phase 1** — port to Claude vision |
| `lib/openai.ts` | Shared OpenAI client (app/scripts) | Phase 2 — replace with Anthropic client helper |
| `scripts/generate-missing-localization-draft.mjs` | Backfill draft generation (text) | Phase 2 |
| `scripts/generate-qbank-ko-translations.mjs` | Korean translation generation (text) | Phase 2 |
| `scripts/review-generated-localization-quality.mjs` | Backfill QA (text) | Phase 2 |

The **matching workflow** (the user's focus) depends only on `extract-screenshot-intake.mjs`.
The other three are the **backfill** workflow — migrated in Phase 2.

## Phase 1 — port screenshot extraction to Claude

Replace the OpenAI Responses call (`extractOneScreenshot`, lines ~309-326) with
`@anthropic-ai/sdk`:

- Client: `new Anthropic()` (reads `ANTHROPIC_API_KEY`); fall back to reading the key from
  `.env.local` like the current `readOpenAIKeyFromDotenv` helper.
- Image: base64 content block — `{type:"image", source:{type:"base64", media_type, data}}`.
- Structured output: `output_config: {format: {type: "json_schema", schema: EXTRACTION_SCHEMA}}`
  so the model returns valid JSON directly (replaces the `parseJsonObject(output_text)` step).
- **Preserve the exact output field set** `normalizeExtractedItem` expects, so nothing
  downstream changes: `typeHint, promptRaw, optionsRaw, correctKeyRaw, correctAnswerRaw,
  promptTranslated, optionsTranslated, correctAnswerTranslated, hasEmbeddedQuestionImage,
  visualObjectTags, visualColorTags, visualNumberTags, visualLayoutTags, visualEvidenceNotes,
  status, confidence, notes`.
- Keep the 3-attempt retry + `fallbackFailedExtraction` behavior.
- Model: `claude-opus-4-8` by default (see decision below).

## Phase 1 — add the Claude semantic reranker (the accuracy lever)

New module (e.g. `qbank-tools/lib/claude-reranker.mjs` + a `scripts/rerank-batch.mjs` entry).
After `process-screenshot-batch` produces ranked candidates, for each item that didn't
confidently auto-match:

- Input: the item's English gloss + options + image tags, and its **top ~8 candidates**
  (the lexical shortlist — recall@8 ≈ 87%, so the answer is usually present).
- Few-shot: relevant **decision-memory** records (prior verified matches / rejections /
  confusion pairs) as exemplars — this is what makes it compound each language.
- Ask Claude to pick the best qid, or return `none` / `needs-review`, with a reason.
- **Prompt caching:** put the stable context (master shortlist framing + decision-memory
  exemplars) first with `cache_control`, the per-item question last — so repeated calls in a
  batch read the cache. Verify via `usage.cache_read_input_tokens`.
- Output: write Claude's pick + confidence + reason into the workbench decisions so it shows
  up in human review (never silently overwrite — the human still confirms).

## Prerequisites

- **`ANTHROPIC_API_KEY`** must be added to `.env.local` (only `OPENAI_API_KEY` is there now).
  The ported code reads it from env; it will not run until the key is present.
- `npm install @anthropic-ai/sdk`.

## Decisions needed (see chat)

1. **Model tier for extraction.** `claude-opus-4-8` is the default (best vision/accuracy).
   For ~900 screenshots/language, a cheaper tier (Haiku 4.5 / Sonnet 4.6) materially cuts cost
   — user's call. The reranker should stay on Opus (it's the accuracy lever).
2. **Scope now:** Phase 1 only (extraction + reranker), or also Phase 2 (the 3 backfill
   scripts + `lib/openai.ts`) in the same pass.

## Validation

- Extraction: run on a small French batch, diff the produced `intake.json` field set against
  an existing OpenAI-produced one (same screenshots) — confirm shape parity + quality.
- Reranker: leave-one-language-out on the ROW/MCQ French sample (exclude fr's stored
  translation), measure top-1 lift vs. the lexical matcher's 55%/87% baseline.
</content>
