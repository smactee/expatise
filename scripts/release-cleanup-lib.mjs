#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  DEFAULT_DATASET,
  ROOT,
  ensureDir,
  fileExists,
  parseArgs,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

export const RELEASE_OUTPUT_DIR = path.join(ROOT, "artifacts", "release-cleanup");
export const DEFAULT_RELEASE_ARCHIVE_ROOT = path.join(ROOT, "qbank-tools", "generated", "archive", "release-cleanup");

const MUST_KEEP_SECTION_ORDER = [
  "MUST_KEEP_ACTIVE",
  "MUST_KEEP_FOR_DEPLOY",
  "MUST_KEEP_FOR_ANDROID_RELEASE",
];

const MUST_KEEP_SECTION_TITLES = {
  MUST_KEEP_ACTIVE: "MUST_KEEP_ACTIVE",
  MUST_KEEP_FOR_DEPLOY: "MUST_KEEP_FOR_DEPLOY",
  MUST_KEEP_FOR_ANDROID_RELEASE: "MUST_KEEP_FOR_ANDROID_RELEASE",
};

const RECOMMENDED_VERCELIGNORE_PATTERNS = [
  "artifacts/",
  "imports/",
  "scripts/",
  "qbank-tools/lib/",
  "qbank-tools/generated/",
  "android/",
  "out/",
  "raw/",
  ".venv/",
  "public/qbank/2023-test1/questions.raw.json",
  "public/qbank/2023-test1/images/*.orig.jpeg",
  "**/.DS_Store",
];

export function parseReleaseCleanupArgs(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  return {
    dataset: String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET,
    dryRun: parseBooleanFlag(args["dry-run"], true),
    allowDelete: parseBooleanFlag(args["allow-delete"], false),
    checkWeb: parseBooleanFlag(args["check-web"], true),
    checkAndroid: parseBooleanFlag(args["check-android"], true),
    archiveRoot: String(args["archive-root"] ?? DEFAULT_RELEASE_ARCHIVE_ROOT).trim() || DEFAULT_RELEASE_ARCHIVE_ROOT,
    reportFile: String(args["report-file"] ?? "release_readiness_report.md").trim() || "release_readiness_report.md",
  };
}

export async function planReleaseCleanup({ dataset = DEFAULT_DATASET } = {}) {
  await ensureDir(RELEASE_OUTPUT_DIR);

  const manifest = await buildReleaseCleanupManifest({ dataset });
  const summary = buildReleaseCleanupSummaryMarkdown(manifest);

  await writeJson(path.join(RELEASE_OUTPUT_DIR, "release_cleanup_manifest.json"), manifest);
  await writeText(path.join(RELEASE_OUTPUT_DIR, "release_cleanup_summary.md"), summary);

  return {
    manifest,
    summaryPath: relativePath(path.join(RELEASE_OUTPUT_DIR, "release_cleanup_summary.md")),
    manifestPath: relativePath(path.join(RELEASE_OUTPUT_DIR, "release_cleanup_manifest.json")),
  };
}

export async function applyReleaseCleanup({
  dataset = DEFAULT_DATASET,
  dryRun = true,
  allowDelete = false,
  archiveRoot = DEFAULT_RELEASE_ARCHIVE_ROOT,
} = {}) {
  await ensureDir(RELEASE_OUTPUT_DIR);
  const manifest = await buildReleaseCleanupManifest({ dataset });
  const archiveStamp = timestampForPath();
  const archiveRunRoot = path.join(archiveRoot, archiveStamp);
  const operations = [];

  for (const group of manifest.groups) {
    if (group.recommendedAction !== "archive") {
      if (group.recommendedAction === "delete-only-after-archive" && allowDelete) {
        for (const rel of group.paths) {
          operations.push({
            type: "delete",
            path: rel,
            status: dryRun ? "would-delete" : "deleted",
          });
          if (!dryRun && fileExists(path.join(ROOT, rel))) {
            await removePath(path.join(ROOT, rel));
          }
        }
      }
      continue;
    }

    for (const rel of group.paths) {
      const sourcePath = path.join(ROOT, rel);
      if (!fileExists(sourcePath)) {
        continue;
      }

      const destinationPath = path.join(archiveRunRoot, rel);
      operations.push({
        type: "archive",
        from: rel,
        to: relativePath(destinationPath),
        status: dryRun ? "would-archive" : "archived",
      });

      if (!dryRun) {
        await movePathSafely(sourcePath, destinationPath);
      }
    }
  }

  const result = {
    dryRun,
    allowDelete,
    archiveRoot: relativePath(archiveRunRoot),
    operationCount: operations.length,
    operations,
  };

  const jsonFileName = dryRun ? "release_cleanup_dry_run.json" : "release_cleanup_applied.json";
  const summaryFileName = dryRun ? "release_cleanup_dry_run_summary.md" : "release_cleanup_applied_summary.md";
  await writeJson(path.join(RELEASE_OUTPUT_DIR, jsonFileName), result);
  await writeText(
    path.join(RELEASE_OUTPUT_DIR, summaryFileName),
    buildAppliedCleanupSummaryMarkdown({
      dataset,
      result,
      manifest,
    }),
  );

  return {
    ...result,
    jsonPath: relativePath(path.join(RELEASE_OUTPUT_DIR, jsonFileName)),
    summaryPath: relativePath(path.join(RELEASE_OUTPUT_DIR, summaryFileName)),
  };
}

export async function verifyReleaseReadiness({
  dataset = DEFAULT_DATASET,
  checkWeb = true,
  checkAndroid = true,
  reportFileName = "release_readiness_report.md",
} = {}) {
  await ensureDir(RELEASE_OUTPUT_DIR);

  const manifest = await buildReleaseCleanupManifest({ dataset });
  const checks = [];

  checks.push({
    id: "dataset-runtime-files",
    label: "Runtime dataset files present",
    status: datasetRuntimeFilesPresent(dataset) ? "passed" : "failed",
    requiredFor: ["runtime", "deploy", "android-release"],
    note: datasetRuntimeFilesPresent(dataset)
      ? `Found runtime qbank files under public/qbank/${dataset}.`
      : `Missing one or more required runtime qbank files under public/qbank/${dataset}.`,
  });

  checks.push({
    id: "vercelignore",
    label: ".vercelignore deploy exclusions",
    status: manifest.deployExclusionCoverage.missingPatterns.length === 0 ? "passed" : "warning",
    requiredFor: ["deploy"],
    note:
      manifest.deployExclusionCoverage.missingPatterns.length === 0
        ? "Recommended non-runtime exclusions are present."
        : `Missing recommended patterns: ${manifest.deployExclusionCoverage.missingPatterns.join(", ")}`,
  });

  if (checkWeb) {
    checks.push(await runCommandCheck({
      id: "tsc-no-emit",
      label: "TypeScript check",
      cmd: "./node_modules/.bin/tsc",
      args: ["--noEmit"],
      requiredFor: ["build", "deploy"],
      summarySuccess: "TypeScript check passed.",
      summaryFailure: "TypeScript check failed.",
    }));

    checks.push(await runCommandCheck({
      id: "next-build-webpack",
      label: "Next.js build",
      cmd: "./node_modules/.bin/next",
      args: ["build", "--webpack"],
      requiredFor: ["build", "deploy", "android-release"],
      summarySuccess: "Next.js production build succeeded.",
      summaryFailure: "Next.js production build failed.",
    }));
  }

  const androidConfigPresent = androidReleaseConfigPresent();
  checks.push({
    id: "android-config",
    label: "Android release config files present",
    status: androidConfigPresent ? "passed" : "failed",
    requiredFor: ["android-release"],
    note: androidConfigPresent
      ? "Found Capacitor and Gradle project files required for Android packaging."
      : "Missing one or more Android project/config files required for Android packaging.",
  });

  if (checkAndroid) {
    checks.push(await runCommandCheck({
      id: "android-bundle-dry-run",
      label: "Android bundleRelease dry-run",
      cmd: "./android/gradlew",
      args: ["-p", "android", "app:bundleRelease", "-m"],
      requiredFor: ["android-release"],
      summarySuccess: "Gradle bundleRelease dry-run succeeded.",
      summaryFailure: "Gradle bundleRelease dry-run failed.",
    }));
  }

  const status = checks.some((check) => check.status === "failed")
    ? "not-ready"
    : checks.some((check) => check.status === "warning")
      ? "ready-with-warnings"
      : "ready";

  const report = buildReleaseReadinessMarkdown({
    dataset,
    manifest,
    checks,
    status,
  });

  await writeText(path.join(RELEASE_OUTPUT_DIR, reportFileName), report);

  return {
    status,
    checks,
    reportPath: relativePath(path.join(RELEASE_OUTPUT_DIR, reportFileName)),
  };
}

async function buildReleaseCleanupManifest({ dataset }) {
  const groups = [];
  const definitions = groupDefinitions({ dataset });

  for (const definition of definitions) {
    const resolvedPaths = await resolveDefinitionPaths(definition);
    if (resolvedPaths.length === 0) {
      continue;
    }
    groups.push(await materializeGroup(definition, resolvedPaths));
  }

  const mustKeep = {};
  for (const section of MUST_KEEP_SECTION_ORDER) {
    mustKeep[section] = groups
      .filter((group) => group.mustKeepSections.includes(section))
      .map((group) => ({
        id: group.id,
        label: group.label,
        paths: group.paths,
        whyMustStay: group.reason,
        breakageIfRemoved: group.breakageIfRemoved,
        requiredFor: group.requiredFor,
      }));
  }

  const deployExcludeGroups = groups
    .filter((group) => group.excludeFromDeployUpload === true)
    .map((group) => ({
      id: group.id,
      label: group.label,
      paths: group.paths,
      reason: group.reason,
    }));

  const currentVercelIgnore = fileExists(path.join(ROOT, ".vercelignore"))
    ? fs.readFileSync(path.join(ROOT, ".vercelignore"), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];

  const missingPatterns = RECOMMENDED_VERCELIGNORE_PATTERNS.filter((pattern) => !currentVercelIgnore.includes(pattern));

  return {
    generatedAt: stableNow(),
    dataset,
    dryRunOnly: true,
    archiveRootSuggestion: relativePath(DEFAULT_RELEASE_ARCHIVE_ROOT),
    notes: {
      totalsAreApproximate: "Group sizes are per-group estimates and are not additive because some groups overlap by design.",
      nonDestructive: "This manifest is a dry-run plan only. No files are deleted or moved automatically.",
    },
    mustKeep,
    deployExclusionCoverage: {
      recommendedPatterns: RECOMMENDED_VERCELIGNORE_PATTERNS,
      missingPatterns,
    },
    deployExcludeGroups,
    groups,
  };
}

function groupDefinitions({ dataset }) {
  const datasetDir = `public/qbank/${dataset}`;
  const datasetImagesDir = `${datasetDir}/images`;

  return [
    {
      id: "web-app-source",
      label: "Web app source",
      classification: "KEEP_ACTIVE_RUNTIME",
      recommendedAction: "keep",
      reason: "This is the live Next.js/Capacitor application source. It must remain for runtime behavior, builds, deploys, and Android web bundle generation.",
      breakageIfRemoved: "The app stops building and the deployed/runtime UI breaks.",
      requiredFor: ["runtime", "build", "deploy", "android-release"],
      mustKeepSections: ["MUST_KEEP_ACTIVE", "MUST_KEEP_FOR_DEPLOY", "MUST_KEEP_FOR_ANDROID_RELEASE"],
      excludeFromDeployUpload: false,
      paths: ["app", "components", "lib", "messages"],
    },
    {
      id: "web-build-config",
      label: "Web/build config",
      classification: "KEEP_ACTIVE_RUNTIME",
      recommendedAction: "keep",
      reason: "These config files define the package graph, Next.js build, TypeScript compile, and Capacitor bridge setup.",
      breakageIfRemoved: "Build, deploy, or Android packaging commands stop working or produce the wrong output.",
      requiredFor: ["build", "deploy", "android-release"],
      mustKeepSections: ["MUST_KEEP_ACTIVE", "MUST_KEEP_FOR_DEPLOY", "MUST_KEEP_FOR_ANDROID_RELEASE"],
      excludeFromDeployUpload: false,
      paths: [
        "package.json",
        "package-lock.json",
        "next.config.ts",
        "tsconfig.json",
        "next-env.d.ts",
        "postcss.config.mjs",
        "capacitor.config.ts",
      ],
    },
    {
      id: "runtime-public-assets",
      label: "Runtime public assets",
      classification: "KEEP_ACTIVE_RUNTIME",
      recommendedAction: "keep",
      reason: "These files are fetched or rendered by the live app: qbank JSON, translations, image tags, and the public UI/media assets.",
      breakageIfRemoved: "Questions, translations, image search tags, or visible app assets fail at runtime.",
      requiredFor: ["runtime", "build", "deploy", "android-release"],
      mustKeepSections: ["MUST_KEEP_ACTIVE", "MUST_KEEP_FOR_DEPLOY", "MUST_KEEP_FOR_ANDROID_RELEASE"],
      excludeFromDeployUpload: false,
      paths: [
        `${datasetDir}/questions.json`,
        `${datasetDir}/translations.ja.json`,
        `${datasetDir}/translations.ko.json`,
        `${datasetDir}/image-color-tags.json`,
        `${datasetDir}/tags.patch.json`,
        datasetImagesDir,
        "public/assets",
        "public/images",
        "public/splash",
      ],
    },
    {
      id: "qbank-maintenance-source",
      label: "Qbank maintenance source files",
      classification: "EXCLUDE_FROM_DEPLOY_UPLOAD",
      recommendedAction: "keep-local-only",
      reason: "These files are used by qbank maintenance scripts and image/source workflows, but the deployed app does not fetch them.",
      breakageIfRemoved: "Qbank regeneration and maintenance workflows lose their local source-of-truth inputs.",
      requiredFor: ["maintenance"],
      mustKeepSections: ["MUST_KEEP_ACTIVE"],
      excludeFromDeployUpload: true,
      paths: [
        `${datasetDir}/questions.raw.json`,
      ],
    },
    {
      id: "workflow-scripts-and-tooling",
      label: "Workflow scripts and qbank tooling",
      classification: "EXCLUDE_FROM_DEPLOY_UPLOAD",
      recommendedAction: "keep-local-only",
      reason: "These scripts drive review, cleanup, validation, and qbank maintenance. They are developer tooling, not runtime code.",
      breakageIfRemoved: "You lose the ability to regenerate qbank artifacts, run review flows, or repeat release-cleanup validation locally.",
      requiredFor: ["maintenance"],
      mustKeepSections: ["MUST_KEEP_ACTIVE"],
      excludeFromDeployUpload: true,
      paths: ["scripts", "qbank-tools/lib"],
    },
    {
      id: "android-project",
      label: "Android project and local SDK binding",
      classification: "KEEP_ACTIVE_RELEASE",
      recommendedAction: "keep",
      reason: "This is the actual Capacitor Android project, Gradle wrapper, and local SDK binding used for release packaging.",
      breakageIfRemoved: "Android sync, bundle generation, and release packaging stop working.",
      requiredFor: ["android-release"],
      mustKeepSections: ["MUST_KEEP_FOR_ANDROID_RELEASE"],
      excludeFromDeployUpload: true,
      paths: ["android"],
    },
    {
      id: "ko-intake-lane",
      label: "Non-Japanese intake lane",
      classification: "KEEP_ACTIVE_RELEASE",
      recommendedAction: "keep",
      reason: "This is the only real next-language intake lane currently present in the repo, and it is tiny.",
      breakageIfRemoved: "Limited next-language pilot work cannot resume from the current repo state without recreating the KO intake lane.",
      requiredFor: ["maintenance"],
      mustKeepSections: ["MUST_KEEP_ACTIVE"],
      excludeFromDeployUpload: true,
      paths: ["imports/ko"],
    },
    {
      id: "japanese-review-intelligence",
      label: "Japanese review intelligence package",
      classification: "ARCHIVE_KEEP",
      recommendedAction: "keep-archived",
      reason: "This compact package is the reusable learning layer distilled from the Japanese workflow and should be preserved intact.",
      breakageIfRemoved: "You lose the compact supervision package used for future-language transfer and audit history.",
      requiredFor: ["maintenance"],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["artifacts/japanese-review-intelligence"],
    },
    {
      id: "next-language-pilot-artifacts",
      label: "Next-language pilot artifacts",
      classification: "ARCHIVE_KEEP",
      recommendedAction: "keep-archived",
      reason: "These pilot/adversarial/calibration artifacts are not runtime data, but they preserve the current transfer-validation history.",
      breakageIfRemoved: "You lose the validation trail behind the final-targeted next-language preflight profile.",
      requiredFor: ["maintenance"],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["artifacts/next-language-pilot"],
    },
    {
      id: "generated-archive-tree",
      label: "Generated archive tree",
      classification: "ARCHIVE_KEEP",
      recommendedAction: "keep-archived",
      reason: "This tree is already the long-term landing zone for archived review outputs and should remain preserved.",
      breakageIfRemoved: "Archived batch history and prior cleanup landings are lost.",
      requiredFor: ["maintenance"],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["qbank-tools/generated/archive"],
    },
    {
      id: "japanese-import-source-tree",
      label: "Japanese import source tree",
      classification: "SAFE_TO_ARCHIVE_NOW",
      recommendedAction: "archive",
      reason: "This is the heaviest completed review source material and is not needed for app runtime, web deploy, or Android release packaging.",
      breakageIfRemoved: "Nothing breaks in runtime or release; only deep historical Japanese source intake is no longer immediately at hand in the active workspace.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["imports/ja"],
    },
    {
      id: "generated-review-reports",
      label: "Generated review reports",
      classification: "SAFE_TO_ARCHIVE_NOW",
      recommendedAction: "archive",
      reason: "Workbench HTML and generated report files are historical review outputs and can move out of the active workspace.",
      breakageIfRemoved: "Nothing breaks in runtime or release; only local access to active generated reports is reduced until restored from archive.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["qbank-tools/generated/reports"],
    },
    {
      id: "generated-review-staging",
      label: "Generated review staging",
      classification: "SAFE_TO_ARCHIVE_NOW",
      recommendedAction: "archive",
      reason: "Staging decision/preview trees are valuable history but not part of runtime or release packaging.",
      breakageIfRemoved: "Nothing breaks in runtime or release; only staged review history becomes archive-only.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["qbank-tools/generated/staging"],
    },
    {
      id: "android-release-bundle-output",
      label: "Existing Android release bundle output",
      classification: "SAFE_TO_ARCHIVE_NOW",
      recommendedAction: "archive",
      reason: "The current AAB is a release artifact, not source. Archive it outside the active tree before generating the next one.",
      breakageIfRemoved: "Future source builds still work, but you lose the existing packaged bundle artifact unless it is archived elsewhere.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["android/app/release"],
    },
    {
      id: "public-orig-image-copies",
      label: "Unreferenced public .orig image copies",
      classification: "SAFE_TO_ARCHIVE_NOW",
      recommendedAction: "archive",
      reason: "These source-original copies live under public but are not referenced by questions.json. They are good archive candidates and should be excluded from deploy upload.",
      breakageIfRemoved: "The live app does not break, but you lose local source-image lineage unless the originals are archived first.",
      requiredFor: ["maintenance"],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      resolvePaths: async () => findRepoFiles((absolutePath, relative) =>
        relative.startsWith(`${datasetImagesDir}/`) && relative.includes(".orig."),
      ),
    },
    {
      id: "finder-clutter",
      label: "Finder/OS clutter",
      classification: "SAFE_TO_DELETE_AFTER_ARCHIVE",
      recommendedAction: "delete-only-after-archive",
      reason: "These files are pure OS clutter and provide no runtime or workflow value.",
      breakageIfRemoved: "Nothing.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      resolvePaths: async () => findRepoFiles((absolutePath, relative) => path.basename(relative) === ".DS_Store"),
    },
    {
      id: "local-web-export",
      label: "Local Next export output",
      classification: "SAFE_TO_DELETE_AFTER_ARCHIVE",
      recommendedAction: "delete-only-after-archive",
      reason: "The exported web bundle is generated by next build and can be regenerated at any time.",
      breakageIfRemoved: "Local exported output disappears until the next build regenerates it; source code and release config remain intact.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["out"],
    },
    {
      id: "android-copied-web-assets",
      label: "Copied Android web assets",
      classification: "SAFE_TO_DELETE_AFTER_ARCHIVE",
      recommendedAction: "delete-only-after-archive",
      reason: "This directory is generated by Capacitor sync/build and mirrors web assets into Android. It can be regenerated.",
      breakageIfRemoved: "An immediate Android build from the existing copied assets stops working until the next sync/build regenerates them.",
      requiredFor: [],
      mustKeepSections: [],
      excludeFromDeployUpload: true,
      paths: ["android/app/src/main/assets/public"],
    },
  ];
}

async function resolveDefinitionPaths(definition) {
  const rawPaths = definition.resolvePaths
    ? await definition.resolvePaths()
    : definition.paths.map((rel) => path.join(ROOT, rel));

  const unique = [];
  const seen = new Set();

  for (const absolutePath of rawPaths) {
    if (!absolutePath || !fileExists(absolutePath)) {
      continue;
    }
    const relative = relativePath(absolutePath);
    if (seen.has(relative)) {
      continue;
    }
    seen.add(relative);
    unique.push(absolutePath);
  }

  return unique.sort((left, right) => relativePath(left).localeCompare(relativePath(right)));
}

async function materializeGroup(definition, absolutePaths) {
  const stats = await Promise.all(absolutePaths.map((absolutePath) => collectPathStats(absolutePath)));
  const totalBytes = stats.reduce((sum, entry) => sum + entry.totalBytes, 0);
  const fileCount = stats.reduce((sum, entry) => sum + entry.fileCount, 0);

  return {
    id: definition.id,
    label: definition.label,
    classification: definition.classification,
    recommendedAction: definition.recommendedAction,
    reason: definition.reason,
    breakageIfRemoved: definition.breakageIfRemoved,
    requiredFor: definition.requiredFor,
    mustKeepSections: definition.mustKeepSections,
    excludeFromDeployUpload: definition.excludeFromDeployUpload,
    pathCount: absolutePaths.length,
    fileCount,
    totalBytes,
    totalMegabytes: roundNumber(totalBytes / (1024 * 1024)),
    paths: absolutePaths.map((absolutePath) => relativePath(absolutePath)),
  };
}

async function collectPathStats(targetPath) {
  const stat = await fsp.lstat(targetPath);
  if (!stat.isDirectory()) {
    return {
      fileCount: 1,
      totalBytes: stat.size,
    };
  }

  let fileCount = 0;
  let totalBytes = 0;
  const entries = await fsp.readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const childPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      const childStats = await collectPathStats(childPath);
      fileCount += childStats.fileCount;
      totalBytes += childStats.totalBytes;
      continue;
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      const childStat = await fsp.lstat(childPath);
      fileCount += 1;
      totalBytes += childStat.size;
    }
  }

  return {
    fileCount,
    totalBytes,
  };
}

async function findRepoFiles(predicate) {
  const matches = [];
  await walk(ROOT, async (absolutePath, relative, dirent) => {
    if (!dirent.isFile()) {
      return;
    }
    if (predicate(absolutePath, relative)) {
      matches.push(absolutePath);
    }
  }, {
    skipDirs: new Set([".git", "node_modules"]),
  });
  return matches;
}

async function walk(dirPath, onEntry, { skipDirs = new Set() } = {}) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relative = relativePath(absolutePath);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      await walk(absolutePath, onEntry, { skipDirs });
      continue;
    }
    await onEntry(absolutePath, relative, entry);
  }
}

function buildReleaseCleanupSummaryMarkdown(manifest) {
  const lines = [
    "# Release Cleanup Summary",
    "",
    `Generated at ${manifest.generatedAt}.`,
    "",
    "This is a dry-run cleanup/archive plan. No files were moved or deleted.",
    "",
  ];

  for (const section of MUST_KEEP_SECTION_ORDER) {
    lines.push(`## ${MUST_KEEP_SECTION_TITLES[section]}`, "");
    const entries = manifest.mustKeep[section];
    if (!entries || entries.length === 0) {
      lines.push("- None.", "");
      continue;
    }
    for (const entry of entries) {
      lines.push(`- ${entry.label}: ${formatPathList(entry.paths)}`);
      lines.push(`  Why it must stay: ${entry.whyMustStay}`);
      lines.push(`  What breaks if removed/excluded: ${entry.breakageIfRemoved}`);
      lines.push(`  Required for: ${entry.requiredFor.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## SAFE_TO_ARCHIVE_NOW", "");
  for (const group of manifest.groups.filter((group) => group.classification === "SAFE_TO_ARCHIVE_NOW")) {
    lines.push(`- ${group.label}: ${formatPathList(group.paths)} (${group.totalMegabytes} MB)`);
    lines.push(`  Reason: ${group.reason}`);
  }
  lines.push("");

  lines.push("## ARCHIVE_KEEP", "");
  for (const group of manifest.groups.filter((group) => group.classification === "ARCHIVE_KEEP")) {
    lines.push(`- ${group.label}: ${formatPathList(group.paths)} (${group.totalMegabytes} MB)`);
    lines.push(`  Reason: ${group.reason}`);
  }
  lines.push("");

  lines.push("## EXCLUDE_FROM_DEPLOY_UPLOAD", "");
  for (const group of manifest.deployExcludeGroups) {
    lines.push(`- ${group.label}: ${formatPathList(group.paths)}`);
    lines.push(`  Reason: ${group.reason}`);
  }
  lines.push("");

  lines.push("## SAFE_TO_DELETE_AFTER_ARCHIVE", "");
  for (const group of manifest.groups.filter((group) => group.classification === "SAFE_TO_DELETE_AFTER_ARCHIVE")) {
    lines.push(`- ${group.label}: ${formatPathList(group.paths)} (${group.totalMegabytes} MB)`);
    lines.push(`  Reason: ${group.reason}`);
  }
  lines.push("");

  lines.push("## Vercel Upload Notes", "");
  lines.push(
    manifest.deployExclusionCoverage.missingPatterns.length === 0
      ? "- The recommended .vercelignore patterns are present."
      : `- Missing recommended .vercelignore patterns: ${manifest.deployExclusionCoverage.missingPatterns.join(", ")}`,
  );
  lines.push("");

  return lines.join("\n");
}

function buildReleaseReadinessMarkdown({ dataset, manifest, checks, status }) {
  const lines = [
    "# Release Readiness Report",
    "",
    `Generated at ${stableNow()} for dataset \`${dataset}\`.`,
    "",
    `Overall status: **${status}**`,
    "",
    "## Checks",
    "",
  ];

  for (const check of checks) {
    lines.push(`- ${check.label}: ${check.status.toUpperCase()}`);
    lines.push(`  Required for: ${check.requiredFor.join(", ")}`);
    lines.push(`  Note: ${check.note}`);
    if (check.command) {
      lines.push(`  Command: \`${check.command}\``);
    }
  }

  lines.push("", "## MUST_KEEP_ACTIVE", "");
  for (const entry of manifest.mustKeep.MUST_KEEP_ACTIVE) {
    lines.push(`- ${entry.label}: ${formatPathList(entry.paths)}`);
    lines.push(`  Why it must stay: ${entry.whyMustStay}`);
    lines.push(`  What breaks if removed/excluded: ${entry.breakageIfRemoved}`);
    lines.push(`  Required for: ${entry.requiredFor.join(", ")}`);
  }

  lines.push("", "## MUST_KEEP_FOR_DEPLOY", "");
  for (const entry of manifest.mustKeep.MUST_KEEP_FOR_DEPLOY) {
    lines.push(`- ${entry.label}: ${formatPathList(entry.paths)}`);
    lines.push(`  Why it must stay: ${entry.whyMustStay}`);
    lines.push(`  What breaks if removed/excluded: ${entry.breakageIfRemoved}`);
    lines.push(`  Required for: ${entry.requiredFor.join(", ")}`);
  }

  lines.push("", "## MUST_KEEP_FOR_ANDROID_RELEASE", "");
  for (const entry of manifest.mustKeep.MUST_KEEP_FOR_ANDROID_RELEASE) {
    lines.push(`- ${entry.label}: ${formatPathList(entry.paths)}`);
    lines.push(`  Why it must stay: ${entry.whyMustStay}`);
    lines.push(`  What breaks if removed/excluded: ${entry.breakageIfRemoved}`);
    lines.push(`  Required for: ${entry.requiredFor.join(", ")}`);
  }

  lines.push("", "## Archive / Exclude Candidates", "");
  for (const group of manifest.groups.filter((group) =>
    ["SAFE_TO_ARCHIVE_NOW", "SAFE_TO_DELETE_AFTER_ARCHIVE", "ARCHIVE_KEEP", "EXCLUDE_FROM_DEPLOY_UPLOAD"].includes(group.classification),
  )) {
    lines.push(`- ${group.label}: ${group.classification} (${group.totalMegabytes} MB)`);
    lines.push(`  Paths: ${formatPathList(group.paths)}`);
    lines.push(`  Recommended action: ${group.recommendedAction}`);
    lines.push(`  Reason: ${group.reason}`);
  }
  lines.push("");

  return lines.join("\n");
}

function buildAppliedCleanupSummaryMarkdown({ dataset, result, manifest }) {
  const archivedOps = result.operations.filter((operation) => operation.type === "archive");
  const deletedOps = result.operations.filter((operation) => operation.type === "delete");
  const archivedRoots = uniqueTopLevelPaths(archivedOps.map((operation) => operation.from));

  return [
    "# Release Cleanup Applied Summary",
    "",
    `Generated at ${stableNow()} for dataset \`${dataset}\`.`,
    "",
    `Mode: ${result.dryRun ? "dry-run" : "applied"}`,
    `Archive root: ${result.archiveRoot}`,
    `Archived operations: ${archivedOps.length}`,
    `Delete operations: ${deletedOps.length}`,
    "",
    "## Archived / Moved",
    "",
    ...(archivedRoots.length > 0
      ? archivedRoots.map((pathValue) => `- ${pathValue}`)
      : ["- None."]),
    "",
    "## Stayed Active",
    "",
    ...manifest.mustKeep.MUST_KEEP_ACTIVE.map((entry) => `- ${entry.label}: ${formatPathList(entry.paths)}`),
    "",
    "## Still Excluded From Deploy Upload",
    "",
    ...manifest.deployExcludeGroups.map((group) => `- ${group.label}: ${formatPathList(group.paths)}`),
    "",
    "## Notes",
    "",
    result.allowDelete
      ? "- Delete-after-archive actions were allowed."
      : "- Delete-after-archive candidates were intentionally left untouched in this run.",
    result.dryRun
      ? "- No files were moved in this run."
      : "- Only manifest-approved archive moves were applied; no hard deletions were performed by default.",
    "",
  ].join("\n");
}

async function runCommandCheck({
  id,
  label,
  cmd,
  args,
  requiredFor,
  summarySuccess,
  summaryFailure,
}) {
  const { exitCode, output } = await runCommand(cmd, args);
  const success = exitCode === 0;
  return {
    id,
    label,
    status: success ? "passed" : "failed",
    requiredFor,
    note: success ? summarySuccess : `${summaryFailure} ${summarizeOutput(output)}`,
    command: [cmd, ...args].join(" "),
  };
}

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        output: `${stdout}\n${stderr}`.trim(),
      });
    });

    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        output: String(error?.message ?? error),
      });
    });
  });
}

function datasetRuntimeFilesPresent(dataset) {
  const datasetDir = path.join(ROOT, "public", "qbank", dataset);
  return [
    "questions.json",
    "translations.ja.json",
    "translations.ko.json",
    "image-color-tags.json",
    "tags.patch.json",
  ].every((fileName) => fileExists(path.join(datasetDir, fileName)));
}

function androidReleaseConfigPresent() {
  return [
    "android/gradlew",
    "android/build.gradle",
    "android/settings.gradle",
    "android/local.properties",
    "capacitor.config.ts",
  ].every((rel) => fileExists(path.join(ROOT, rel)));
}

function summarizeOutput(output) {
  const compact = String(output ?? "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "No command output.";
  }
  return compact.length > 280 ? `${compact.slice(0, 277)}...` : compact;
}

function formatPathList(paths, maxItems = 6) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return "(none)";
  }
  if (paths.length <= maxItems) {
    return paths.join(", ");
  }
  return `${paths.slice(0, maxItems).join(", ")} ... (+${paths.length - maxItems} more)`;
}

function uniqueTopLevelPaths(paths) {
  const seen = new Set();
  const values = [];
  for (const rel of paths) {
    const normalized = String(rel ?? "").trim();
    if (!normalized) {
      continue;
    }
    const [top, second] = normalized.split(path.sep);
    const key = top === "public" || top === "qbank-tools" || top === "android"
      ? [top, second].filter(Boolean).join(path.sep)
      : top;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(key);
  }
  return values;
}

async function movePathSafely(sourcePath, destinationPath) {
  await ensureDir(path.dirname(destinationPath));
  if (fileExists(destinationPath)) {
    throw new Error(`Archive destination already exists: ${relativePath(destinationPath)}`);
  }
  await fsp.rename(sourcePath, destinationPath);
}

async function removePath(targetPath) {
  await fsp.rm(targetPath, { recursive: true, force: true });
}

function relativePath(targetPath) {
  return path.relative(ROOT, targetPath) || ".";
}

function roundNumber(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function timestampForPath() {
  return stableNow().replace(/[:.]/g, "-");
}

function parseBooleanFlag(value, defaultValue) {
  if (value == null) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}
