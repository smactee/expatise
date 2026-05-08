#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  REPORTS_DIR,
  ROOT,
  fileExists,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const CATEGORY_ORDER = [
  "active-production",
  "active-review-workflow",
  "active-memory-intelligence",
  "active-validation",
  "cleanup/archive",
  "legacy-compatible",
  "deprecated-candidate",
  "dangerous-production-edit",
  "unknown-review-needed",
];

const PHASES = {
  ship: "1. Russian ship-readiness",
  master: "2. English master source-of-truth",
  backfill: "3. Missing-qid backfill",
  promotion: "4. New-question promotion",
  duplicate: "5. Duplicate detection",
  memory: "6. Decision memory",
  tags: "7. Tag intelligence",
  cleanup: "8. Repo cleanup / workflow hygiene",
  general: "General app/repo workflow",
};

const PURPOSE_OVERRIDES = {
  "apply-approved-image-replacements.mjs": "Apply reviewed image replacement decisions to master/raw qbank assets.",
  "apply-production-localization-merge.mjs": "Merge validated localization staging preview into production translations.",
  "apply-reviewed-missing-localization-backfill.mjs": "Apply approved missing-qid backfill translations to production translations.",
  "propagate-new-master-qids.mjs": "Create missing translation placeholders for new English master qids.",
  "audit-qbank-integrity.mjs": "Run cross-language qbank integrity audit.",
  "build-decision-memory.mjs": "Build reusable decision memory from production/history artifacts.",
  "build-duplicate-candidate-audit.mjs": "Detect and classify duplicate question candidates.",
  "prepare-qbank-tools-medium-archive-plan.mjs": "Prepare dry-run medium-risk qbank-tools archive plan.",
  "derive-correction-rules.mjs": "Derive reusable localization correction rules from reviewed artifacts.",
  "export-match-history.mjs": "Export matching history into reusable memory/training records.",
  "generate-image-color-tags.mjs": "Generate image color/object tag report artifacts.",
  "generate-qbank-ko-translations.mjs": "Legacy OpenAI-assisted Korean production translation generator.",
  "merge-image-replacement-second-pass-decisions.mjs": "Merge image replacement second-pass decisions into staging.",
  "qbank-health-check.mjs": "Run consolidated qbank validation, audit, and build checks.",
  "tag-dictionary.mjs": "Shared tag vocabulary and normalization helpers.",
};

const SCRIPT_OVERRIDES = {
  "add-explanations.mjs": {
    recommendedStatus: "dangerous-production-edit",
    phase: PHASES.master,
    purpose: "Legacy direct questions.json explanation editor.",
    modifiesProductionFiles: true,
    dryRunSupport: true,
    requiresGuardFlags: true,
    notes: "Default is dry-run/no-op. Production write requires --apply true --allow-dangerous-production-edit true.",
  },
  "postprocess-qbank.mjs": {
    recommendedStatus: "dangerous-production-edit",
    phase: PHASES.master,
    purpose: "Legacy raw-to-master qbank postprocessor.",
    modifiesProductionFiles: true,
    dryRunSupport: true,
    requiresGuardFlags: true,
    notes: "Default is dry-run/no-op. Output write requires --apply true --allow-dangerous-production-edit true.",
  },
  "apply-approved-image-replacements.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.master,
    purpose: PURPOSE_OVERRIDES["apply-approved-image-replacements.mjs"],
    notes: "Production-changing script with dry-run/apply behavior and production reference validation.",
  },
  "apply-new-question-promotion.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.promotion,
    purpose: "Promote reviewed new-question candidates into raw master and translation files.",
    notes: "Production-changing promotion script; requires reviewed promotion inputs.",
  },
  "apply-production-localization-merge.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.ship,
    purpose: PURPOSE_OVERRIDES["apply-production-localization-merge.mjs"],
    notes: "Production translation merge script gated by dry-run review inputs.",
  },
  "apply-reviewed-missing-localization-backfill.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.backfill,
    purpose: PURPOSE_OVERRIDES["apply-reviewed-missing-localization-backfill.mjs"],
    notes: "Production translation merge script gated by approved reviewed backfill items.",
  },
  "backfill-missing-image-object-tags.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.tags,
    purpose: "Backfill missing image object tags into image-color-tags.json when apply is requested.",
    notes: "Production metadata update is apply-gated; default behavior writes reports.",
  },
  "propagate-new-master-qids.mjs": {
    recommendedStatus: "active-production",
    phase: PHASES.backfill,
    purpose: PURPOSE_OVERRIDES["propagate-new-master-qids.mjs"],
    modifiesProductionFiles: true,
    dryRunSupport: false,
    requiresGuardFlags: false,
    notes: "Appends missing placeholders to translation files; safe by design but production-changing.",
  },
  "guard-protected-qbank-files.mjs": {
    recommendedStatus: "active-validation",
    phase: PHASES.master,
    purpose: "Guard protected production qbank files from unapproved edits.",
    notes: "Used by guarded master/image edit package commands.",
  },
  "replay-revenuecat-webhook.mjs": {
    recommendedStatus: "legacy-compatible",
    phase: PHASES.general,
    purpose: "Replay RevenueCat webhook fixtures for app billing workflow.",
    notes: "Not part of qbank multilingual workflow but kept for broader app operations.",
  },
  "apply-retro-auto-review-corrections.mjs": {
    recommendedStatus: "dangerous-production-edit",
    phase: PHASES.tags,
    purpose: "Apply retro auto-review corrections to localization production data.",
    modifiesProductionFiles: true,
    dryRunSupport: true,
    requiresGuardFlags: true,
    notes: "Default writes preview/report only. Production write requires --apply true --allow-dangerous-production-edit true.",
  },
  "generate-qbank-ko-translations.mjs": {
    recommendedStatus: "dangerous-production-edit",
    phase: PHASES.backfill,
    purpose: PURPOSE_OVERRIDES["generate-qbank-ko-translations.mjs"],
    modifiesProductionFiles: true,
    dryRunSupport: true,
    requiresGuardFlags: true,
    notes: "Not package-referenced. Default is dry-run/no-op. Production write requires --apply true --allow-dangerous-production-edit true.",
  },
  "derive-correction-rules.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.memory,
    purpose: PURPOSE_OVERRIDES["derive-correction-rules.mjs"],
    notes: "Memory/intelligence helper; classify before cleanup but not production-changing.",
  },
  "export-match-history.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.memory,
    purpose: PURPOSE_OVERRIDES["export-match-history.mjs"],
    notes: "Exports reviewed match history for reuse.",
  },
  "generate-image-color-tags.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.tags,
    purpose: PURPOSE_OVERRIDES["generate-image-color-tags.mjs"],
    notes: "Generates tag intelligence inputs/reports; production tag application is handled separately.",
  },
  "merge-image-replacement-second-pass-decisions.mjs": {
    recommendedStatus: "active-review-workflow",
    phase: PHASES.master,
    purpose: PURPOSE_OVERRIDES["merge-image-replacement-second-pass-decisions.mjs"],
    notes: "Review workflow merger for image replacement decisions.",
  },
  "qbank-health-check.mjs": {
    recommendedStatus: "active-validation",
    phase: PHASES.cleanup,
    purpose: PURPOSE_OVERRIDES["qbank-health-check.mjs"],
    modifiesProductionFiles: false,
    dryRunSupport: false,
    requiresGuardFlags: false,
    notes: "Package command qbank:health; writes health-check reports and runs validation/build commands.",
  },
  "tag-dictionary.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.tags,
    purpose: PURPOSE_OVERRIDES["tag-dictionary.mjs"],
    notes: "Shared tag vocabulary helper used by tag/duplicate intelligence.",
  },
  "qbank-tools/lib/feature-bridge.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.memory,
    purpose: "Feature extraction bridge shared by matching and memory systems.",
    notes: "Shared library, not a runnable cleanup target.",
  },
  "qbank-tools/lib/image-replacement-memory.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.memory,
    purpose: "Reusable memory helpers for image replacement workflows.",
    notes: "Shared library, not a runnable cleanup target.",
  },
  "qbank-tools/lib/missing-localization-backfill.mjs": {
    recommendedStatus: "active-review-workflow",
    phase: PHASES.backfill,
    purpose: "Shared missing-localization backfill library.",
    notes: "Shared library for backfill commands.",
  },
  "qbank-tools/lib/new-question-promotion-gate.mjs": {
    recommendedStatus: "active-review-workflow",
    phase: PHASES.promotion,
    purpose: "Shared gate logic for new-question promotion.",
    notes: "Shared library for promotion review/apply commands.",
  },
  "qbank-tools/lib/pipeline.mjs": {
    recommendedStatus: "active-review-workflow",
    phase: PHASES.general,
    purpose: "Shared qbank pipeline utilities.",
    notes: "Core shared library used by active commands.",
  },
  "qbank-tools/lib/tag-intelligence.mjs": {
    recommendedStatus: "active-memory-intelligence",
    phase: PHASES.tags,
    purpose: "Shared tag intelligence report builder.",
    notes: "Shared library for tag intelligence.",
  },
};

const PACKAGE_COMMAND_OVERRIDES = {
  "master-edit": {
    recommendedStatus: "active-production",
    purpose: "Guarded production master edit validation chain.",
    phase: PHASES.master,
    modifiesProductionFiles: true,
    dryRunSupport: false,
    requiresGuardFlags: true,
    notes: "Guard command plus integrity audit and build; does not itself edit files but validates approved master edits.",
  },
  "image-edit": {
    recommendedStatus: "active-production",
    purpose: "Guarded production image metadata edit validation chain.",
    phase: PHASES.master,
    modifiesProductionFiles: true,
    dryRunSupport: false,
    requiresGuardFlags: true,
    notes: "Guard command plus integrity audit and build; does not itself edit files but validates approved image edits.",
  },
};

const REPORT_JSON_PATH = path.join(REPORTS_DIR, "qbank-workflow-command-index.json");
const REPORT_MD_PATH = path.join(REPORTS_DIR, "qbank-workflow-command-index.md");
const packageJsonPath = path.join(ROOT, "package.json");
const reportsDir = REPORTS_DIR;

const packageJson = readJson(packageJsonPath);
const packageScripts = packageJson.scripts ?? {};
const npmCommandByScript = mapNpmCommands(packageScripts);
const reportIndex = loadGeneratedReportIndex();
const scriptPaths = [
  ...listFiles(path.join(ROOT, "scripts"), { suffix: ".mjs", recursive: false }),
  ...listFiles(path.join(ROOT, "qbank-tools", "lib"), { suffix: ".mjs", recursive: false }),
].sort((left, right) => relative(left).localeCompare(relative(right)));

const scriptEntries = scriptPaths.map((scriptPath) => classifyScript(scriptPath, npmCommandByScript, reportIndex));
const commandEntries = Object.entries(packageScripts).map(([name, command]) => classifyPackageCommand(name, command, scriptEntries));

const summary = {
  generatedAt: new Date().toISOString(),
  scriptsAudited: scriptEntries.length,
  packageCommandsAudited: commandEntries.length,
  countsByRecommendedStatus: countBy(scriptEntries, "recommendedStatus"),
  commandCountsByRecommendedStatus: countBy(commandEntries, "recommendedStatus"),
  activeProductionCount: countWhere(scriptEntries, "recommendedStatus", "active-production"),
  activeReviewWorkflowCount: countWhere(scriptEntries, "recommendedStatus", "active-review-workflow"),
  deprecatedCandidateCount: countWhere(scriptEntries, "recommendedStatus", "deprecated-candidate"),
  dangerousProductionEditCount: countWhere(scriptEntries, "recommendedStatus", "dangerous-production-edit"),
  unknownReviewNeededCount: countWhere(scriptEntries, "recommendedStatus", "unknown-review-needed"),
};

const report = {
  generatedAt: summary.generatedAt,
  sourcePaths: {
    packageJson: relative(packageJsonPath),
    scriptsDir: "scripts",
    qbankToolsLibDir: "qbank-tools/lib",
    generatedReportsDir: relative(reportsDir),
  },
  summary,
  packageCommands: commandEntries,
  scripts: scriptEntries,
  generatedReports: reportIndex.relevantReports,
};

await writeJson(REPORT_JSON_PATH, report);
await writeText(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Wrote ${relative(REPORT_JSON_PATH)}`);
console.log(`Wrote ${relative(REPORT_MD_PATH)}`);
console.log(`Scripts audited: ${summary.scriptsAudited}`);
console.log(`active-production: ${summary.activeProductionCount}`);
console.log(`active-review-workflow: ${summary.activeReviewWorkflowCount}`);
console.log(`deprecated-candidate: ${summary.deprecatedCandidateCount}`);
console.log(`dangerous-production-edit: ${summary.dangerousProductionEditCount}`);
console.log(`unknown-review-needed: ${summary.unknownReviewNeededCount}`);

function classifyScript(scriptPath, npmCommandByScript, reportIndex) {
  const relPath = relative(scriptPath);
  const basename = path.basename(scriptPath);
  const stem = basename.replace(/\.mjs$/, "");
  const text = fs.readFileSync(scriptPath, "utf8");
  const npmCommands = npmCommandByScript.get(relPath) ?? [];
  const override = SCRIPT_OVERRIDES[basename] ?? SCRIPT_OVERRIDES[relPath] ?? null;
  const writesProduction = override?.modifiesProductionFiles ?? detectsProductionWrite(text);
  const dryRunSupport = override?.dryRunSupport ?? detectsDryRunSupport(text, basename);
  const requiresGuardFlags = override?.requiresGuardFlags ?? detectsGuardFlags(text, basename);
  const outputs = inferOutputs(text, basename, reportIndex);
  const inputs = inferInputs(text, basename);
  const phase = override?.phase ?? inferPhase(basename, relPath, text);
  const recommendedStatus = override?.recommendedStatus ?? inferStatus({ basename, relPath, text, writesProduction, dryRunSupport, requiresGuardFlags, phase });

  return {
    path: relPath,
    npmCommands,
    purpose: override?.purpose ?? inferPurpose(basename, relPath),
    inputs,
    outputs,
    modifiesProductionFiles: writesProduction,
    dryRunSupport,
    requiresGuardFlags,
    relatedPhase: phase,
    recommendedStatus,
    notes: buildNotes({ override, text, writesProduction, dryRunSupport, requiresGuardFlags, npmCommands, outputs }),
  };
}

function classifyPackageCommand(name, command, scriptEntries) {
  const scriptPath = extractScriptPathFromCommand(command);
  const scriptEntry = scriptPath ? scriptEntries.find((entry) => entry.path === scriptPath) : null;
  const status = PACKAGE_COMMAND_OVERRIDES[name]?.recommendedStatus
    ?? scriptEntry?.recommendedStatus
    ?? inferPackageCommandStatus(name, command);

  return {
    name,
    command,
    path: scriptPath,
    purpose: PACKAGE_COMMAND_OVERRIDES[name]?.purpose ?? scriptEntry?.purpose ?? inferCommandPurpose(name, command),
    modifiesProductionFiles: PACKAGE_COMMAND_OVERRIDES[name]?.modifiesProductionFiles ?? scriptEntry?.modifiesProductionFiles ?? /master-edit|image-edit/.test(name),
    dryRunSupport: PACKAGE_COMMAND_OVERRIDES[name]?.dryRunSupport ?? scriptEntry?.dryRunSupport ?? /dry-run|lint|build|audit/.test(name),
    requiresGuardFlags: PACKAGE_COMMAND_OVERRIDES[name]?.requiresGuardFlags ?? scriptEntry?.requiresGuardFlags ?? command.includes("guard-protected-qbank-files"),
    relatedPhase: PACKAGE_COMMAND_OVERRIDES[name]?.phase ?? scriptEntry?.relatedPhase ?? PHASES.general,
    recommendedStatus: status,
    notes: PACKAGE_COMMAND_OVERRIDES[name]?.notes ?? (scriptEntry ? `Wraps ${scriptEntry.path}.` : "Package command does not directly map to a qbank script."),
  };
}

function detectsProductionWrite(text) {
  const productionPathMentioned = /public[/"',\s]+qbank|datasetPaths\.(questionsPath|rawQuestionsPath|imageColorTagsPath|translationPath)|context\.paths\.translationsPath|productionPath|IMAGE_TAGS_PATH|QUESTIONS_PATH|questions\.json|translations\.\$\{?lang/i.test(text);
  const writeCall = /writeJson|writeText|writeFile|writeFileSync|copyFile|renameSync|unlink|rm\(/.test(text);
  const activeWriteToProduction = /writeJson\((?:datasetPaths\.(?:questionsPath|rawQuestionsPath|imageColorTagsPath|translationPath)|context\.paths\.translationsPath|productionPath|IMAGE_TAGS_PATH|QUESTIONS_PATH)|writeFileSync\(filePath/.test(text)
    || /await fsp\.copyFile\(tempPath, finalAbsolutePath\)/.test(text);
  return productionPathMentioned && writeCall && activeWriteToProduction;
}

function detectsDryRunSupport(text, basename) {
  if (/dry-run|dryRun|dryRunOnly|applyRequested|allow-dangerous-production-edit|productionWriteAllowed|const apply = booleanArg|booleanArg\(args, "apply"|!apply/.test(text)) return true;
  if (/^prepare-|^audit-|^validate-|^generate-|^build-/.test(basename)) return true;
  return false;
}

function detectsGuardFlags(text, basename) {
  return /allow-questions-master-edit|allow-question-image-edit|allow-dangerous-production-edit|guard-protected-qbank-files|allow-overwrite|force/.test(text)
    || basename === "guard-protected-qbank-files.mjs";
}

function inferInputs(text, basename) {
  const inputs = new Set();
  if (/questions\.json|questionsPath|masterPath|QUESTIONS_PATH/.test(text)) inputs.add("public/qbank/2023-test1/questions.json");
  if (/questions\.raw\.json|rawQuestionsPath|rawMasterPath/.test(text)) inputs.add("public/qbank/2023-test1/questions.raw.json");
  if (/translations\.|translationsPath|translationPath|productionPath/.test(text)) inputs.add("public/qbank/2023-test1/translations.<lang>.json");
  if (/image-color-tags|imageColorTagsPath|IMAGE_TAGS_PATH/.test(text)) inputs.add("public/qbank/2023-test1/image-color-tags.json");
  if (/decision-memory/.test(text)) inputs.add("qbank-tools/history/decision-memory.json");
  if (/imports|batchFiles|batchDir|getBatchFiles/.test(text)) inputs.add("imports/<lang>/<batch>/*");
  if (/STAGING_DIR|generated\/staging|staging/.test(text)) inputs.add("qbank-tools/generated/staging/*");
  if (/REPORTS_DIR|generated\/reports|reports/.test(text)) inputs.add("qbank-tools/generated/reports/*");
  if (/OPENAI_API_KEY|openai|NotebookLM|notebooklm/i.test(text)) inputs.add("AI/NotebookLM/OpenAI runtime inputs");
  if (inputs.size === 0 && basename.includes("revenuecat")) inputs.add("RevenueCat webhook fixture/input");
  if (inputs.size === 0) inputs.add("repository files inferred from script arguments");
  return [...inputs].sort();
}

function inferOutputs(text, basename, reportIndex) {
  const outputs = new Set();
  for (const reportPath of reportIndex.byScriptStem.get(basename.replace(/\.mjs$/, "")) ?? []) outputs.add(reportPath);
  if (/REPORTS_DIR|generated\/reports|reportJsonPath|REPORT_JSON_PATH|OUT_JSON|jsonPath/.test(text)) outputs.add("qbank-tools/generated/reports/*");
  if (/STAGING_DIR|generated\/staging|previewPath|decisionsPath|missingItemsPath/.test(text)) outputs.add("qbank-tools/generated/staging/*");
  if (/HISTORY_DIR|qbank-tools\/history|decision-memory/.test(text) && /writeJson|writeText|writeFile/.test(text)) outputs.add("qbank-tools/history/*");
  if (/writeJson\((?:datasetPaths\.(?:questionsPath|rawQuestionsPath|imageColorTagsPath|translationPath)|context\.paths\.translationsPath|productionPath|IMAGE_TAGS_PATH|QUESTIONS_PATH)/.test(text)) outputs.add("public/qbank/2023-test1/*");
  if (/OUTPUT_PATH|public\/qbank\/2023-test1\/translations\.ko\.json/.test(text) && /writeFile/.test(text)) outputs.add("public/qbank/2023-test1/*");
  if (/archive|cleanup/.test(basename) || /generated\/archive/.test(text)) outputs.add("qbank-tools/generated/archive/*");
  if (/imports|batchFiles/.test(text) && /writeJson|writeText|writeFile/.test(text)) outputs.add("imports/<lang>/<batch>/*");
  if (outputs.size === 0) outputs.add("stdout/report-only or library exports");
  return [...outputs].sort();
}

function inferPhase(basename, relPath, text) {
  const value = `${basename} ${relPath} ${text.slice(0, 1200)}`.toLowerCase();
  if (/cleanup|archive|release-cleanup|qbank-tools-file|workflow|phase-status/.test(value)) return PHASES.cleanup;
  if (/tag|image-color|object-tags/.test(value)) return PHASES.tags;
  if (/decision-memory|memory|feature-store|match-index|image-replacement-memory/.test(value)) return PHASES.memory;
  if (/duplicate/.test(value)) return PHASES.duplicate;
  if (/new-question|promotion|combination-rule/.test(value)) return PHASES.promotion;
  if (/missing-localization|backfill|propagate-new-master-qids/.test(value)) return PHASES.backfill;
  if (/ru-ship|ru-discrepancy|ship-readiness/.test(value)) return PHASES.ship;
  if (/postprocess|add-explanations|approved-image-replacements|master-edit|questions\.json/.test(value)) return PHASES.master;
  if (/validate|audit|guard|preflight|benchmark|pilot/.test(value)) return "Cross-phase validation";
  return PHASES.general;
}

function inferStatus({ basename, relPath, text, writesProduction, dryRunSupport, requiresGuardFlags, phase }) {
  const value = `${basename} ${relPath}`.toLowerCase();
  if (writesProduction && !dryRunSupport && !requiresGuardFlags) return "dangerous-production-edit";
  if (/apply-approved-image-replacements|apply-new-question-promotion|apply-production-localization-merge|apply-reviewed-missing-localization-backfill|backfill-missing-image-object-tags|add-explanations|postprocess-qbank|complete-ko-ja-qid-sync/.test(value)) {
    return writesProduction && !dryRunSupport ? "dangerous-production-edit" : "active-production";
  }
  if (/cleanup|archive|release-cleanup|qbank-tools/.test(value)) return "cleanup/archive";
  if (/decision-memory|memory|feature-store|match-index|tag-intelligence|duplicate-candidate|qid-feature/.test(value)) return "active-memory-intelligence";
  if (/validate|audit|guard|report|verify|preflight|benchmark|calibrate|evaluate/.test(value)) return "active-validation";
  if (/workbench|review|stage|extract|process|notebooklm|merge-workbench|answer-key|unresolved|batch|localization|promotion|draft|snapshot/.test(value)) return "active-review-workflow";
  if (/legacy|retro|manual|consolidated|japanese-review|next-language|run-final|limited|pilot|ko-ja/.test(value)) return "legacy-compatible";
  if (phase === PHASES.general && text.length < 2000) return "deprecated-candidate";
  return "unknown-review-needed";
}

function inferPurpose(basename, relPath) {
  const name = basename.replace(/\.mjs$/, "");
  return PURPOSE_OVERRIDES[basename]
    ?? name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferCommandPurpose(name, command) {
  return `Package command: ${name} (${command})`;
}

function inferPackageCommandStatus(name, command) {
  if (/master-edit|image-edit/.test(name)) return "dangerous-production-edit";
  if (/build|lint|dev|start|revenuecat/.test(name)) return "legacy-compatible";
  if (/audit|validate|guard|report/.test(name)) return "active-validation";
  return "unknown-review-needed";
}

function buildNotes({ override, text, writesProduction, dryRunSupport, requiresGuardFlags, npmCommands, outputs }) {
  const notes = [];
  if (override?.notes) notes.push(override.notes);
  if (npmCommands.length) notes.push(`Package command(s): ${npmCommands.join(", ")}.`);
  if (writesProduction) notes.push("Detected write path into public/qbank production files.");
  if (dryRunSupport) notes.push("Dry-run or apply-gated behavior detected.");
  if (requiresGuardFlags) notes.push("Guard/force/overwrite flag detected; use only with reviewed inputs.");
  if (outputs.some((output) => output.includes("archive"))) notes.push("Archive/cleanup output detected; verify plan before apply.");
  if (/OPENAI_API_KEY|NotebookLM|notebooklm/i.test(text)) notes.push("External AI-assisted workflow; cache/rate-limit behavior should be checked before long runs.");
  if (!notes.length) notes.push("Classified by filename and source-code heuristics; review before removing or changing.");
  return notes;
}

function mapNpmCommands(packageScripts) {
  const out = new Map();
  for (const [name, command] of Object.entries(packageScripts)) {
    const scriptPath = extractScriptPathFromCommand(command);
    if (!scriptPath) continue;
    if (!out.has(scriptPath)) out.set(scriptPath, []);
    out.get(scriptPath).push(name);
  }
  return out;
}

function extractScriptPathFromCommand(command) {
  const match = String(command).match(/node\s+(scripts\/[^\s&]+\.mjs)/);
  return match?.[1] ?? null;
}

function loadGeneratedReportIndex() {
  const relevantReports = fileExists(reportsDir)
    ? fs.readdirSync(reportsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => {
          const filePath = path.join(reportsDir, entry.name);
          const stat = fs.statSync(filePath);
          return {
            path: relative(filePath),
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            likelySourceScript: inferLikelySourceScript(entry.name),
          };
        })
        .filter((entry) => entry.likelySourceScript)
        .sort((left, right) => left.path.localeCompare(right.path))
    : [];
  const byScriptStem = new Map();
  for (const report of relevantReports) {
    const key = report.likelySourceScript.replace(/^scripts\//, "").replace(/\.mjs$/, "");
    if (!byScriptStem.has(key)) byScriptStem.set(key, []);
    byScriptStem.get(key).push(report.path);
  }
  return { relevantReports, byScriptStem };
}

function inferLikelySourceScript(reportName) {
  const stem = reportName.replace(/\.(json|md|html|csv)$/, "");
  const candidates = [
    stem,
    stem.replace(/-report$/, ""),
    `build-${stem}`,
    `audit-${stem}`,
    `generate-${stem}`,
    `prepare-${stem}`,
    `review-${stem}`,
    `validate-${stem}`,
  ];
  for (const candidate of candidates) {
    const scriptPath = path.join(ROOT, "scripts", `${candidate}.mjs`);
    if (fileExists(scriptPath)) return `scripts/${candidate}.mjs`;
  }
  if (stem.includes("decision-memory")) return "scripts/build-decision-memory.mjs";
  if (stem.includes("duplicate")) return "scripts/build-duplicate-candidate-audit.mjs";
  if (stem.includes("tag-intelligence")) return "qbank-tools/lib/tag-intelligence.mjs";
  if (stem.includes("qbank-tools")) return "scripts/audit-qbank-tools-files.mjs";
  if (stem.includes("integrity")) return "scripts/audit-qbank-integrity.mjs";
  return null;
}

function listFiles(dirPath, { suffix, recursive }) {
  if (!fileExists(dirPath)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const filePath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && recursive) {
      out.push(...listFiles(filePath, { suffix, recursive }));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(filePath);
    }
  }
  return out;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank Workflow Command Index", "");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Scripts audited: ${report.summary.scriptsAudited}`);
  lines.push(`Package commands audited: ${report.summary.packageCommandsAudited}`);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(...markdownTable(Object.entries(report.summary.countsByRecommendedStatus).map(([status, count]) => ({ status, count })), ["status", "count"]));
  lines.push("");
  lines.push("## Dangerous Production Edit Scripts", "");
  const dangerous = report.scripts.filter((entry) => entry.recommendedStatus === "dangerous-production-edit");
  lines.push(...markdownTable(dangerous.map(compactScriptRow), ["path", "purpose", "phase", "dryRunSupport", "requiresGuardFlags"]));
  lines.push("");
  lines.push("## Deprecated Candidates", "");
  const deprecated = report.scripts.filter((entry) => entry.recommendedStatus === "deprecated-candidate");
  lines.push(...markdownTable(deprecated.map(compactScriptRow), ["path", "purpose", "phase", "dryRunSupport", "requiresGuardFlags"]));
  lines.push("");
  lines.push("## Script Index", "");
  lines.push(...markdownTable(report.scripts.map((entry) => ({
    path: entry.path,
    status: entry.recommendedStatus,
    phase: entry.relatedPhase,
    production: entry.modifiesProductionFiles ? "yes" : "no",
    dryRun: entry.dryRunSupport ? "yes" : "no",
    guard: entry.requiresGuardFlags ? "yes" : "no",
  })), ["path", "status", "phase", "production", "dryRun", "guard"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function compactScriptRow(entry) {
  return {
    path: entry.path,
    purpose: entry.purpose,
    phase: entry.relatedPhase,
    dryRunSupport: entry.dryRunSupport ? "yes" : "no",
    requiresGuardFlags: entry.requiresGuardFlags ? "yes" : "no",
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return ["None."];
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeCell(row[column])).join(" | ")} |`),
  ];
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function countBy(values, key) {
  const counts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
  for (const value of values) {
    const countKey = String(value[key] ?? "unknown-review-needed");
    counts[countKey] = (counts[countKey] ?? 0) + 1;
  }
  return counts;
}

function countWhere(values, key, expected) {
  return values.filter((value) => value[key] === expected).length;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
