#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  GENERATED_DIR,
  REPORTS_DIR,
  ROOT,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  compareQid,
  isAutoPropagationPlaceholder,
  normalizeQid,
  questionArray,
  questionQid,
  translationQuestions,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const datasetPaths = getDatasetPaths(dataset);
const reportJsonPath = path.join(REPORTS_DIR, "missing-qid-backfill-system-audit.json");
const reportMdPath = path.join(REPORTS_DIR, "missing-qid-backfill-system-audit.md");
const languageCodes = ["ru", "ko", "ja"];

const masterDoc = readJson(datasetPaths.questionsPath);
const masterQids = uniqueSorted(questionArray(masterDoc).map(questionQid).filter(Boolean));
const masterQidSet = new Set(masterQids);
const packageJson = readJson(path.join(ROOT, "package.json"));

const coverage = Object.fromEntries(languageCodes.map((lang) => [lang, auditLanguage(lang)]));
const scripts = auditScripts(packageJson);
const generatedOutputs = auditGeneratedOutputs();
const validation = auditValidationBeforeMerge(scripts);
const missingTranslationMarking = auditMissingTranslationMarking(coverage, generatedOutputs);
const autoPropagation = auditAutoPropagation(packageJson, scripts);
const decisionMemory = auditDecisionMemory();
const newQuestionPromotion = auditNewQuestionPromotion();
const remainingBlockers = determineRemainingBlockers({
  scripts,
  validation,
  missingTranslationMarking,
  autoPropagation,
  decisionMemory,
});
const recommendation = remainingBlockers.length === 0
  ? "Phase 3 complete"
  : remainingBlockers.some((entry) => entry.severity === "blocker")
    ? "Phase 3 not complete"
    : "Phase 3 partially complete";

const report = {
  generatedAt: new Date().toISOString(),
  dataset,
  master: {
    path: relative(datasetPaths.questionsPath),
    qidCount: masterQids.length,
  },
  coverage,
  scripts,
  generatedOutputs,
  validation,
  missingTranslationMarking,
  autoPropagation,
  decisionMemory,
  newQuestionPromotion,
  remainingBlockers,
  recommendation,
};

await writeJson(reportJsonPath, report);
await writeText(reportMdPath, renderMarkdown(report));

console.log(`Wrote ${relative(reportJsonPath)}`);
console.log(`Wrote ${relative(reportMdPath)}`);
console.log(`Master qids: ${report.master.qidCount}`);
for (const lang of languageCodes) {
  const entry = report.coverage[lang];
  console.log(`${lang}: ${entry.productionPresentQids}/${entry.masterQids} production coverage (${entry.coveragePercent}%), missing ${entry.missingQids.length}, placeholders ${entry.placeholderQids.length}, extra ${entry.extraQids.length}`);
}
console.log(`Backfill scripts found: ${scripts.summary.found}/${scripts.summary.required}`);
console.log(`Staged backfill outputs found: ${generatedOutputs.stagingBackfillFiles.length}`);
console.log(`Decision memory backfill entries: ${decisionMemory.backfillEntryCount}`);
console.log(`Recommendation: ${recommendation}`);

function auditLanguage(lang) {
  const translationPath = path.join(datasetPaths.datasetDir, `translations.${lang}.json`);

  if (!fileExists(translationPath)) {
    return {
      lang,
      path: relative(translationPath),
      exists: false,
      masterQids: masterQids.length,
      fileEntries: 0,
      filePresentMasterQids: 0,
      productionPresentQids: 0,
      placeholderQids: [],
      missingQids: masterQids,
      silentlyAbsentQids: masterQids,
      extraQids: [],
      coveragePercent: percent(0, masterQids.length),
      fileCoveragePercent: percent(0, masterQids.length),
    };
  }

  const doc = readJson(translationPath);
  const translations = translationQuestions(doc);
  const fileQids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
  const placeholderQids = new Set(Object.entries(translations)
    .filter(([, entry]) => isAutoPropagationPlaceholder(entry))
    .map(([qid]) => normalizeQid(qid))
    .filter(Boolean));
  const productionQids = new Set([...fileQids].filter((qid) => !placeholderQids.has(qid)));
  const filePresentMasterQids = masterQids.filter((qid) => fileQids.has(qid)).sort(compareQid);
  const productionPresentMasterQids = masterQids.filter((qid) => productionQids.has(qid)).sort(compareQid);
  const missingQids = masterQids.filter((qid) => !productionQids.has(qid)).sort(compareQid);
  const silentlyAbsentQids = masterQids.filter((qid) => !fileQids.has(qid)).sort(compareQid);
  const extraQids = [...fileQids].filter((qid) => !masterQidSet.has(qid)).sort(compareQid);

  return {
    lang,
    path: relative(translationPath),
    exists: true,
    masterQids: masterQids.length,
    fileEntries: Object.keys(translations).length,
    filePresentMasterQids: filePresentMasterQids.length,
    productionPresentQids: productionPresentMasterQids.length,
    placeholderQids: [...placeholderQids].filter((qid) => masterQidSet.has(qid)).sort(compareQid),
    missingQids,
    silentlyAbsentQids,
    extraQids,
    coveragePercent: percent(productionPresentMasterQids.length, masterQids.length),
    fileCoveragePercent: percent(filePresentMasterQids.length, masterQids.length),
  };
}

function auditScripts(packageJsonValue) {
  const required = [
    ["propagate-new-master-qids", "scripts/propagate-new-master-qids.mjs"],
    ["build-missing-localization-backfill", "scripts/build-missing-localization-backfill.mjs"],
    ["generate-missing-localization-draft", "scripts/generate-missing-localization-draft.mjs"],
    ["review-generated-localization-quality", "scripts/review-generated-localization-quality.mjs"],
    ["validate-missing-localization-backfill", "scripts/validate-missing-localization-backfill.mjs"],
    ["apply-reviewed-missing-localization-backfill", "scripts/apply-reviewed-missing-localization-backfill.mjs"],
  ];

  const entries = required.map(([npmScript, scriptPath]) => {
    const absolutePath = path.join(ROOT, scriptPath);
    return {
      npmScript,
      scriptPath,
      fileExists: fileExists(absolutePath),
      npmScriptExists: Boolean(packageJsonValue?.scripts?.[npmScript]),
      npmCommand: packageJsonValue?.scripts?.[npmScript] ?? null,
    };
  });

  return {
    requiredScripts: entries,
    summary: {
      required: entries.length,
      found: entries.filter((entry) => entry.fileExists && entry.npmScriptExists).length,
      missing: entries.filter((entry) => !entry.fileExists || !entry.npmScriptExists).map((entry) => entry.npmScript),
    },
  };
}

function auditGeneratedOutputs() {
  const allGeneratedFiles = fileExists(GENERATED_DIR) ? walk(GENERATED_DIR) : [];
  const stagingDir = path.join(GENERATED_DIR, "staging");
  const currentStagingFiles = fileExists(stagingDir) ? walk(stagingDir) : [];
  const currentReportFiles = fileExists(REPORTS_DIR) ? walk(REPORTS_DIR) : [];
  const stagingBackfillFiles = currentStagingFiles
    .filter((filePath) => /^backfill\.[^.]+\.(missing-qids|generated-draft|reviewed|needs-fix)\.json$/.test(path.basename(filePath)))
    .map(outputRecord)
    .sort(sortOutputRecords);
  const reportBackfillFiles = currentReportFiles
    .filter((filePath) => /^backfill-(validation|quality-review|production-merge)\.[^.]+\.json$/.test(path.basename(filePath)))
    .map(outputRecord)
    .sort(sortOutputRecords);
  const archivedBackfillFiles = allGeneratedFiles
    .filter((filePath) => /\/archive\/.*\/backfill[^/]*\.(json|md)$/.test(toSlash(filePath)))
    .map(outputRecord)
    .sort(sortOutputRecords);

  return {
    stagingBackfillFiles,
    reportBackfillFiles,
    archivedBackfillFiles,
    counts: {
      stagingBackfillFiles: stagingBackfillFiles.length,
      reportBackfillFiles: reportBackfillFiles.length,
      archivedBackfillFiles: archivedBackfillFiles.length,
    },
  };
}

function auditValidationBeforeMerge(scripts) {
  const applyEntry = scripts.requiredScripts.find((entry) => entry.npmScript === "apply-reviewed-missing-localization-backfill");
  const validateEntry = scripts.requiredScripts.find((entry) => entry.npmScript === "validate-missing-localization-backfill");
  const applyPath = applyEntry ? path.join(ROOT, applyEntry.scriptPath) : null;
  const applyText = applyPath && fileExists(applyPath) ? fs.readFileSync(applyPath, "utf8") : "";

  return {
    validatorScriptExists: Boolean(validateEntry?.fileExists && validateEntry?.npmScriptExists),
    applyScriptValidatesBeforeMerge: applyText.includes("validateDraftItems("),
    requiresGeneratedTextBeforeMerge: applyText.includes("requireGeneratedText: true"),
    requiresApprovedReviewBeforeMerge: applyText.includes("requireApproved: true"),
    blocksApplyWhenInvalid: applyText.includes("if (apply && validation.valid)"),
    overwriteGuardPresent: applyText.includes("allow-overwrite") && applyText.includes("overlappingProductionQids"),
    validationReportsFound: auditGeneratedOutputs().reportBackfillFiles.filter((entry) => entry.kind === "validation").length,
  };
}

function auditMissingTranslationMarking(coverageValue, generatedOutputsValue) {
  const stagedQidsByLang = new Map();
  for (const record of generatedOutputsValue.stagingBackfillFiles.filter((entry) => entry.kind === "missing-qids")) {
    const doc = readJson(path.join(ROOT, record.path));
    const qids = new Set((Array.isArray(doc?.missingQids) ? doc.missingQids : [])
      .map(normalizeQid)
      .filter(Boolean));
    stagedQidsByLang.set(record.lang, qids);
  }

  const perLanguage = Object.fromEntries(Object.entries(coverageValue).map(([lang, entry]) => {
    const stagedQids = stagedQidsByLang.get(lang) ?? new Set();
    const missingSet = new Set(entry.missingQids);
    const stagedMissingQids = [...stagedQids].filter((qid) => missingSet.has(qid)).sort(compareQid);

    return [lang, {
      missingQids: entry.missingQids,
      placeholderQids: entry.placeholderQids,
      silentlyAbsentQids: entry.silentlyAbsentQids,
      stagedMissingQids,
      allMissingMarkedOrStaged: entry.silentlyAbsentQids.length === 0
        && entry.missingQids.every((qid) => entry.placeholderQids.includes(qid) || stagedQids.has(qid)),
    }];
  }));

  return {
    perLanguage,
    totalSilentlyAbsentQids: Object.values(perLanguage).reduce((sum, entry) => sum + entry.silentlyAbsentQids.length, 0),
    allCurrentMissingTranslationsMarkedOrReviewable: Object.values(perLanguage).every((entry) => entry.allMissingMarkedOrStaged),
  };
}

function auditAutoPropagation(packageJsonValue, scriptsValue) {
  const scriptEntry = scriptsValue.requiredScripts.find((entry) => entry.npmScript === "propagate-new-master-qids");
  const scriptPath = scriptEntry ? path.join(ROOT, scriptEntry.scriptPath) : null;
  const scriptText = scriptPath && fileExists(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
  const packageScriptsText = Object.values(packageJsonValue?.scripts ?? {}).join("\n");
  const implicitHookFound = /propagate-new-master-qids/.test(packageScriptsText.replace(packageJsonValue?.scripts?.["propagate-new-master-qids"] ?? "", ""));

  return {
    scriptExists: Boolean(scriptEntry?.fileExists),
    npmScriptExists: Boolean(scriptEntry?.npmScriptExists),
    placeholderShapeDetected: scriptText.includes("translationStatus") && scriptText.includes("auto-propagation"),
    avoidsExistingOverwrite: scriptText.includes("Object.hasOwn") || scriptText.includes("existingQids"),
    writesReports: scriptText.includes("propagation-report.json") && scriptText.includes("propagation-report.md"),
    automaticPackageHookFound: implicitHookFound,
    supportedByCommand: Boolean(scriptEntry?.fileExists && scriptEntry?.npmScriptExists),
    command: "npm run propagate-new-master-qids",
  };
}

function auditDecisionMemory() {
  const decisionMemoryPath = path.join(ROOT, "qbank-tools", "history", "decision-memory.json");
  if (!fileExists(decisionMemoryPath)) {
    return {
      path: relative(decisionMemoryPath),
      exists: false,
      totalRecords: 0,
      backfillEntryCount: 0,
      byLang: {},
      byDecisionType: {},
      byFinalDecision: {},
    };
  }

  const doc = readJson(decisionMemoryPath);
  const records = Array.isArray(doc?.records) ? doc.records : [];
  const backfillRecords = records.filter(isBackfillDecisionRecord);

  return {
    path: relative(decisionMemoryPath),
    exists: true,
    totalRecords: records.length,
    backfillEntryCount: backfillRecords.length,
    byLang: countBy(backfillRecords, (record) => record.lang ?? "unknown"),
    byDecisionType: countBy(backfillRecords, (record) => record.decisionType ?? "unknown"),
    byFinalDecision: countBy(backfillRecords, (record) => record.finalDecision ?? "unknown"),
  };
}

function auditNewQuestionPromotion() {
  const promotionScripts = [
    "scripts/prepare-new-question-promotion-preview.mjs",
    "scripts/review-new-question-promotions.mjs",
    "scripts/apply-new-question-promotion.mjs",
  ].map((scriptPath) => ({ scriptPath, exists: fileExists(path.join(ROOT, scriptPath)) }));
  const outputFiles = fileExists(GENERATED_DIR)
    ? walk(GENERATED_DIR)
        .filter((filePath) => /new-question-promotion/.test(filePath))
        .map(outputRecord)
        .sort(sortOutputRecords)
    : [];

  return {
    scripts: promotionScripts,
    outputs: outputFiles,
    counts: {
      scriptsFound: promotionScripts.filter((entry) => entry.exists).length,
      outputsFound: outputFiles.length,
    },
  };
}

function determineRemainingBlockers({ scripts, validation, missingTranslationMarking, autoPropagation, decisionMemory }) {
  const blockers = [];

  for (const missing of scripts.summary.missing) {
    blockers.push({ severity: "blocker", issue: `Missing required backfill script or npm entry: ${missing}` });
  }
  if (!validation.validatorScriptExists || !validation.applyScriptValidatesBeforeMerge || !validation.requiresGeneratedTextBeforeMerge || !validation.requiresApprovedReviewBeforeMerge || !validation.blocksApplyWhenInvalid) {
    blockers.push({ severity: "blocker", issue: "Reviewed backfill merge is not fully guarded by validation and approval checks." });
  }
  if (!missingTranslationMarking.allCurrentMissingTranslationsMarkedOrReviewable) {
    blockers.push({ severity: "blocker", issue: "Some current missing master qids are silently absent instead of placeholdered or staged for review." });
  }
  if (!autoPropagation.supportedByCommand || !autoPropagation.placeholderShapeDetected || !autoPropagation.avoidsExistingOverwrite) {
    blockers.push({ severity: "blocker", issue: "Auto-propagation command is missing or unsafe." });
  }
  if (!decisionMemory.exists || decisionMemory.backfillEntryCount === 0) {
    blockers.push({ severity: "risk", issue: "Decision memory has no recorded backfill decisions yet." });
  }
  if (!autoPropagation.automaticPackageHookFound) {
    blockers.push({ severity: "risk", issue: "No package-level hook automatically runs propagation; the propagation command must be part of the workflow." });
  }

  return blockers;
}

function isBackfillDecisionRecord(record) {
  const text = JSON.stringify(record ?? {}).toLowerCase();
  return String(record?.decisionType ?? "").toLowerCase().includes("backfill")
    || (Array.isArray(record?.tags) && record.tags.map(String).some((tag) => tag.toLowerCase() === "backfill"))
    || text.includes("english_master_backfill");
}

function outputRecord(filePath) {
  const name = path.basename(filePath);
  const lang = name.match(/(?:backfill(?:-[^.]+)?|new-question-promotion(?:-[^.]+)?)\.([a-z]{2})(?:\.|$)/)?.[1]
    ?? name.match(/backfill\.([a-z]{2})\./)?.[1]
    ?? "unknown";
  const kind = name.match(/backfill\.([^.]+)\.(missing-qids|generated-draft|reviewed|needs-fix)\.json$/)?.[2]
    ?? name.match(/^backfill-(validation|quality-review|production-merge)\./)?.[1]
    ?? (name.includes("new-question-promotion") ? "new-question-promotion" : "other");
  const stat = fs.statSync(filePath);

  return {
    path: relative(filePath),
    lang,
    kind,
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function renderMarkdown(reportData) {
  const lines = [];
  lines.push("# Missing-QID Backfill System Audit", "");
  lines.push(`Generated: ${reportData.generatedAt}`);
  lines.push(`Dataset: ${reportData.dataset}`);
  lines.push(`Recommendation: ${reportData.recommendation}`);
  lines.push("");
  lines.push("## Master", "");
  lines.push(`- QID count: ${reportData.master.qidCount}`);
  lines.push("");
  lines.push("## Coverage", "");
  lines.push("| Language | Production present | File present | Missing | Placeholders | Extra | Coverage |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const lang of languageCodes) {
    const entry = reportData.coverage[lang];
    lines.push(`| ${lang} | ${entry.productionPresentQids} | ${entry.filePresentMasterQids} | ${entry.missingQids.length} | ${entry.placeholderQids.length} | ${entry.extraQids.length} | ${entry.coveragePercent}% |`);
  }
  lines.push("");
  lines.push("## System Checks", "");
  lines.push(`- Backfill scripts found: ${reportData.scripts.summary.found}/${reportData.scripts.summary.required}`);
  lines.push(`- Staged backfill outputs found: ${reportData.generatedOutputs.counts.stagingBackfillFiles}`);
  lines.push(`- Backfill reports found: ${reportData.generatedOutputs.counts.reportBackfillFiles}`);
  lines.push(`- Merge validation enforced: ${reportData.validation.applyScriptValidatesBeforeMerge && reportData.validation.requiresGeneratedTextBeforeMerge && reportData.validation.requiresApprovedReviewBeforeMerge && reportData.validation.blocksApplyWhenInvalid ? "yes" : "no"}`);
  lines.push(`- Current missing translations marked/reviewable: ${reportData.missingTranslationMarking.allCurrentMissingTranslationsMarkedOrReviewable ? "yes" : "no"}`);
  lines.push(`- Auto-propagation command available: ${reportData.autoPropagation.supportedByCommand ? "yes" : "no"}`);
  lines.push(`- Package-level auto hook found: ${reportData.autoPropagation.automaticPackageHookFound ? "yes" : "no"}`);
  lines.push(`- Decision memory backfill entries: ${reportData.decisionMemory.backfillEntryCount}`);
  lines.push("");
  lines.push("## Remaining Blockers/Risks", "");
  if (reportData.remainingBlockers.length === 0) {
    lines.push("None.");
  } else {
    for (const entry of reportData.remainingBlockers) {
      lines.push(`- ${entry.severity}: ${entry.issue}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function walk(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile()) {
        out.push(next);
      }
    }
  }
  return out;
}

function countBy(values, keyFn) {
  const out = {};
  for (const value of values) {
    const key = String(keyFn(value));
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([left], [right]) => left.localeCompare(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareQid);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function sortOutputRecords(left, right) {
  return left.path.localeCompare(right.path);
}

function toSlash(value) {
  return value.split(path.sep).join("/");
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}
