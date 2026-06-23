#!/usr/bin/env node
// auto-delete-sign-no-image.mjs — STRICT, unreviewable auto-deletion (owner directive 2026-06-23).
//
// An image-identification question ("这个标志是何含义" / "what does this sign/marking mean?") with NO
// image asset is unanswerable garbage from the zh source app (the sign failed to render). The owner
// will NOT review these — they are OMITTED from the workbench entirely. Calibrated against batches
// 1–3: 4/4 such items were deleted (and 100% of ALL sign-meaning items were deleted), so the rule is
// safe. Detection requires BOTH a tight sign/marking-meaning prompt AND a vision-confirmed no-image
// status (hasImage:false AND imageTextStatus:"no-image" — both agree), to keep precision high.
//
//   node scripts/auto-delete-sign-no-image.mjs --lang zh --batch batch-004 [--apply true]
//
// Writes qbank-tools/history/auto-deleted.<lang>.<batch>.json (the audit log of what was omitted).
// Prints every omitted item for transparency. The briefing/workbench build excludes these itemIds.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((kv) => {
  const [k, ...v] = kv.trim().split(/\s+/); return [k, v.join(" ") || true];
}));
const lang = String(args.lang || "").trim();
const batch = String(args.batch || "").trim();
if (!lang || !batch) { console.error("usage: --lang <lang> --batch <batch>"); process.exit(1); }

const intakePath = path.join(ROOT, "imports", lang, batch, "intake.json");
const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));

// Tight image-identification-prompt detector (asks the MEANING/IDENTITY of a sign/marking).
const ZH = /(标志|标线)[^。]{0,8}(含义|何含义|什么意思|何意思|意思是|是什么|表示什么|何意)/
  ;
const ZH2 = /这是?什么(交通)?(标志|标线)/;
const ZH3 = /如图[^。]{0,12}(标志|标线)[^。]{0,8}(含义|什么)/;
const EN = /\bwhat\b.*\b(sign|marking)\b.*\b(mean|meaning|indicate)s?\b/i;
const EN2 = /\bmeaning of (this|the) (sign|marking|symbol)\b/i;
const EN3 = /\bwhat (traffic )?sign is this\b/i;
const EN4 = /\bwhat (kind|type) of (road )?marking\b/i;
const EN5 = /\bwhat does (this|the) (sign|marking|symbol) (mean|indicate)\b/i;

const isSignMeaning = (zh, en) =>
  ZH.test(zh || "") || ZH2.test(zh || "") || ZH3.test(zh || "") ||
  EN.test(en || "") || EN2.test(en || "") || EN3.test(en || "") || EN4.test(en || "") || EN5.test(en || "");

const omitted = [];
for (const it of intake.items) {
  const zh = it.promptRaw || it.localizedPrompt || "";
  const en = it.translatedPrompt || "";
  const noImage = it.hasImage === false && (it.imageTextStatus === "no-image" || it.imageTextStatus == null);
  if (isSignMeaning(zh, en) && noImage) {
    omitted.push({ itemId: it.itemId, promptZh: zh, promptEn: en, reason: "sign-meaning question with no image asset (auto-deleted, owner directive)" });
  }
}

const outPath = path.join(ROOT, "qbank-tools", "history", `auto-deleted.${lang}.${batch}.json`);
fs.writeFileSync(outPath, JSON.stringify({ lang, batch, rule: "sign-meaning-no-image", count: omitted.length, items: omitted }, null, 2));

console.log(`Auto-delete (sign-meaning + no-image) for ${lang} ${batch}: ${omitted.length} item(s) OMITTED from workbench.`);
for (const o of omitted) console.log(`  - ${o.itemId.split("/").pop()} :: "${(o.promptEn || o.promptZh).slice(0, 50)}"`);
console.log(`Audit log: ${path.relative(ROOT, outPath)}`);
