#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_DATASET,
  GENERATED_DIR,
  IMPORTS_DIR,
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensureDir,
  fileExists,
  parseArgs,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const apply = String(args.apply ?? "false").trim().toLowerCase() === "true";

const archiveRoot = path.join(GENERATED_DIR, "archive", lang, batchId);
const archiveReportsDir = path.join(archiveRoot, "reports");
const archiveStagingDir = path.join(archiveRoot, "staging");
const cleanupManifestPath = path.join(archiveRoot, "cleanup-manifest.json");
const batchDir = path.join(IMPORTS_DIR, lang, batchId);
const productionTranslationPath = path.join(process.cwd(), "public", "qbank", dataset, `translations.${lang}.json`);

const keepGeneratedBasenames = new Set([
  `production-merge-${lang}-${batchId}.json`,
  `production-merge-${lang}-${batchId}.md`,
  `new-question-candidates.${lang}.${batchId}.json`,
]);

const keepImportRelativePaths = new Set([
  "intake.json",
  "extraction-report.json",
  "matched.json",
  "review-needed.json",
  "unresolved.json",
]);

const reportFiles = (await listFiles(REPORTS_DIR)).filter((filePath) =>
  isBatchGeneratedArtifact(path.basename(filePath), lang, batchId),
);
const stagingFiles = (await listFiles(STAGING_DIR)).filter((filePath) =>
  isBatchGeneratedArtifact(path.basename(filePath), lang, batchId),
);
const importFiles = await listFilesRecursive(batchDir);

const keepActive = [
  ...importFiles.filter((filePath) => shouldKeepImportFile(batchDir, filePath, keepImportRelativePaths)),
  ...reportFiles.filter((filePath) => shouldKeepGeneratedFile(path.basename(filePath))),
  ...stagingFiles.filter((filePath) => shouldKeepGeneratedFile(path.basename(filePath))),
].filter((filePath, index, all) => all.indexOf(filePath) === index);

if (fileExists(productionTranslationPath)) {
  keepActive.push(productionTranslationPath);
}

const archiveCandidates = [
  ...reportFiles.filter((filePath) => !shouldKeepGeneratedFile(path.basename(filePath))),
  ...stagingFiles.filter((filePath) => !shouldKeepGeneratedFile(path.basename(filePath))),
];

const deleteCandidates = importFiles.filter((filePath) => path.basename(filePath) === ".DS_Store");

const keepSet = new Set(keepActive);
const archiveSet = new Set(archiveCandidates);
const deleteSet = new Set(deleteCandidates);

const overlap = [...keepSet].filter((filePath) => archiveSet.has(filePath) || deleteSet.has(filePath));
if (overlap.length > 0) {
  throw new Error(`Cleanup policy conflict detected for ${overlap.join(", ")}`);
}

const manifest = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  apply,
  policy: {
    keep: [
      "Raw screenshot inputs and batch intake/audit JSON remain active in imports/<lang>/<batch>/.",
      "Final decision JSON files remain active, including unresolved/existing-qid/single-item answer-key decisions.",
      "Staged new-question candidate files remain active and untouched.",
      "Final production merge reports remain active.",
      "Production translations.<lang>.json remains untouched and active.",
    ],
    archive: [
      "Review HTML files and manifests.",
      "Template decision files.",
      "Preview and dry-run staging files that can be regenerated.",
      "Intermediate validation and batch-processing reports.",
      "Follow-up staging artifacts and other regenerable scratch outputs.",
    ],
    delete: [
      "Finder/OS clutter like .DS_Store.",
    ],
  },
  keepActive: keepActive.map(relativePath),
  archiveCandidates: archiveCandidates.map(relativePath),
  deleteCandidates: deleteCandidates.map(relativePath),
  archived: [],
  deleted: [],
};

if (!apply) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

await ensureDir(archiveReportsDir);
await ensureDir(archiveStagingDir);

for (const sourcePath of archiveCandidates) {
  const destinationPath = path.join(
    sourcePath.startsWith(REPORTS_DIR) ? archiveReportsDir : archiveStagingDir,
    path.basename(sourcePath),
  );
  const result = await moveFileSafely(sourcePath, destinationPath);
  if (result) {
    manifest.archived.push(result);
  }
}

for (const sourcePath of deleteCandidates) {
  if (!fileExists(sourcePath)) {
    continue;
  }
  await fs.unlink(sourcePath);
  manifest.deleted.push(relativePath(sourcePath));
}

await writeJson(cleanupManifestPath, manifest);

console.log(
  JSON.stringify(
    {
      lang,
      batchId,
      archivedCount: manifest.archived.length,
      deletedCount: manifest.deleted.length,
      keepCount: manifest.keepActive.length,
      archiveRoot: relativePath(archiveRoot),
      cleanupManifestPath: relativePath(cleanupManifestPath),
    },
    null,
    2,
  ),
);

function isBatchGeneratedArtifact(name, currentLang, currentBatchId) {
  return name.includes(`${currentLang}-${currentBatchId}`) || name.includes(`.${currentLang}.${currentBatchId}.`);
}

function shouldKeepGeneratedFile(name) {
  if (keepGeneratedBasenames.has(name)) {
    return true;
  }

  if (name.endsWith(".template.json") || name.endsWith(".template.csv")) {
    return false;
  }

  return name.includes("decision") && name.endsWith(".json");
}

async function listFiles(dirPath) {
  if (!fileExists(dirPath)) {
    return [];
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

async function listFilesRecursive(dirPath) {
  if (!fileExists(dirPath)) {
    return [];
  }

  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function shouldKeepImportFile(baseBatchDir, filePath, keepRelativePaths) {
  const relative = path.relative(baseBatchDir, filePath);
  if (keepRelativePaths.has(relative)) {
    return true;
  }
  if (relative.startsWith(`screenshots${path.sep}`)) {
    return true;
  }
  return false;
}

async function moveFileSafely(sourcePath, destinationPath) {
  if (!fileExists(sourcePath)) {
    return null;
  }

  await ensureDir(path.dirname(destinationPath));

  if (fileExists(destinationPath)) {
    const same = await filesEqual(sourcePath, destinationPath);
    if (!same) {
      throw new Error(
        `Archive destination already exists with different content: ${relativePath(sourcePath)} -> ${relativePath(destinationPath)}`,
      );
    }
    await fs.unlink(sourcePath);
    return {
      from: relativePath(sourcePath),
      to: relativePath(destinationPath),
      status: "deduped-into-existing-archive",
    };
  }

  await fs.rename(sourcePath, destinationPath);
  return {
    from: relativePath(sourcePath),
    to: relativePath(destinationPath),
    status: "archived",
  };
}

async function filesEqual(leftPath, rightPath) {
  const [left, right] = await Promise.all([fs.readFile(leftPath), fs.readFile(rightPath)]);
  return left.equals(right);
}

function relativePath(targetPath) {
  return path.relative(process.cwd(), targetPath);
}
