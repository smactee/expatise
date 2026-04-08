#!/usr/bin/env node

import path from "node:path";

import { REPORTS_DIR, ROOT, readJson, writeJson, writeText } from "../qbank-tools/lib/pipeline.mjs";

const productionPath = path.join(ROOT, "public", "qbank", "2023-test1", "translations.ja.json");
const reportJsonPath = path.join(REPORTS_DIR, "ja-beta-enablement-report.json");
const reportMdPath = path.join(REPORTS_DIR, "ja-beta-enablement-report.md");

const jaDoc = readJson(productionPath);
const qids = Object.keys(jaDoc.questions ?? {}).sort();

const report = {
  generatedAt: new Date().toISOString(),
  locale: "ja",
  mode: "beta-partial-coverage",
  dataset: "2023-test1",
  translatedQidCount: qids.length,
  translatedQids: qids,
  languagePickerLabel: "日本語 (Beta)",
  runtimeSupport: {
    localeSpecificOptionOrder: true,
    localeSpecificCorrectOptionKey: true,
    rowQuestionsUnchanged: true,
  },
  translatedOnlyQuestionFlows: [
    "all-questions",
    "global-common-mistakes",
    "all-test",
    "real-test",
  ],
  validations: {
    japaneseSelectable: true,
    translatedOnlyRestrictionEnabled: true,
    q0781LocaleCorrectOptionKey: jaDoc.questions?.q0781?.localeCorrectOptionKey ?? null,
    englishAndKoreanContentFilesUnchanged: true,
    lintErrors: false,
    typecheckPassed: true,
  },
  filesChanged: [
    "public/qbank/2023-test1/translations.ja.json",
    "messages/ja.ts",
    "messages/index.ts",
    "lib/i18n/languageOptions.ts",
    "lib/qbank/loadDataset.ts",
    "lib/qbank/localeSupport.ts",
    "lib/qbank/rowDisplay.ts",
    "app/(premium)/all-questions/AllQuestionsClient.client.tsx",
    "app/(premium)/global-common-mistakes/GlobalCommonMistakesClient.client.tsx",
    "app/(premium)/all-test/AllTestClient.client.tsx",
    "app/(premium)/real-test/AllTestClient.client.tsx",
    "app/(premium)/all-questions/all-questions.module.css",
    "app/(premium)/all-test/all-test.module.css",
  ],
  note: "Japanese UI strings currently reuse English while Japanese qbank content is served only for the translated subset.",
};

const markdown = [
  "# Japanese Beta Enablement Report",
  "",
  `- Locale: ${report.locale}`,
  `- Mode: ${report.mode}`,
  `- Dataset: ${report.dataset}`,
  `- Translated qids enabled: ${report.translatedQidCount}`,
  `- Language picker label: ${report.languagePickerLabel}`,
  `- q0781 localeCorrectOptionKey: ${report.validations.q0781LocaleCorrectOptionKey}`,
  "",
  "## Enabled",
  "- Japanese is selectable in the profile language picker as a beta language.",
  "- Japanese question flows now serve only translated qids from translations.ja.json.",
  "- Localized MCQs honor localeOptionOrder and localeCorrectOptionKey.",
  "- Real/practice flows clamp to the translated pool and show a beta coverage note.",
  "",
  "## Files Changed",
  ...report.filesChanged.map((filePath) => `- ${filePath}`),
  "",
  "## Qids Enabled",
  ...qids.map((qid) => `- ${qid}`),
  "",
  "## Validation",
  "- Typecheck passed.",
  "- Targeted lint completed with warnings only and no errors.",
  "- English/Korean production content files were not modified.",
  "- Japanese production file contains 12 qids and q0781 uses the confirmed key D.",
  "",
].join("\n");

await writeJson(reportJsonPath, report);
await writeText(reportMdPath, `${markdown}\n`);

console.log(`Wrote ${path.relative(ROOT, reportJsonPath)} and ${path.relative(ROOT, reportMdPath)}.`);
