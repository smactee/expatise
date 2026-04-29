#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULTS = {
  output: "expatise-snapshot.md",
  maxFiles: 28,
  maxTotalBytes: 300_000,
  maxFileBytes: 8_000,
};

const COMPACT_LIMITS = {
  maxFiles: 22,
  maxTotalBytes: 180_000,
  maxFileBytes: 5_000,
};

const CATEGORY_ORDER = [
  "Project Config",
  "Docs",
  "App Entry Points",
  "Core UI",
  "Business Logic",
  "Data Layer",
  "Scripts / Pipeline",
  "Other",
];

const SOFT_CATEGORY_CAPS = {
  "Project Config": 8,
  "Docs": 4,
  "App Entry Points": 7,
  "Core UI": 6,
  "Business Logic": 9,
  "Data Layer": 8,
  "Scripts / Pipeline": 10,
  "Other": 4,
};

const COMPACT_CATEGORY_CAPS = {
  "Project Config": 6,
  "Docs": 3,
  "App Entry Points": 5,
  "Core UI": 4,
  "Business Logic": 6,
  "Data Layer": 5,
  "Scripts / Pipeline": 8,
  "Other": 2,
};

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const IMPORTANT_ROOT_FILES = new Map([
  ["package.json", "project manifest, dependency map, and npm workflow entrypoints"],
  ["package-lock.json", "dependency lockfile for exact package resolution"],
  ["next.config.js", "root Next.js configuration"],
  ["next.config.ts", "root Next.js configuration"],
  ["next.config.mjs", "root Next.js configuration"],
  ["tsconfig.json", "TypeScript compiler and path alias configuration"],
  ["eslint.config.js", "lint rules and code quality configuration"],
  ["eslint.config.mjs", "lint rules and code quality configuration"],
  ["postcss.config.js", "PostCSS and styling pipeline configuration"],
  ["postcss.config.mjs", "PostCSS and styling pipeline configuration"],
  ["tailwind.config.js", "Tailwind theme and content configuration"],
  ["tailwind.config.ts", "Tailwind theme and content configuration"],
  ["prettier.config.js", "formatting rules configuration"],
  ["prettier.config.mjs", "formatting rules configuration"],
  [".prettierrc", "formatting rules configuration"],
  [".prettierrc.json", "formatting rules configuration"],
  ["capacitor.config.ts", "Capacitor mobile shell configuration"],
  ["README.md", "top-level product and architecture overview"],
  ["qbank-tools/README.md", "documented localization and matching workflow"],
  ["imports/README.md", "import batch structure and intake conventions"],
]);

const CURATED_PRIORITY_FILES = new Map([
  ["components/CapacitorOAuthBridge.client.tsx", "native OAuth callback bridge used by the app shell"],
  ["components/EntitlementsProvider.client.tsx", "root entitlement state provider used by premium gating"],
  ["components/UserProfile.tsx", "root user profile provider used by home and profile flows"],
  ["lib/auth/oauth.ts", "native-vs-web auth callback URL routing"],
  ["lib/billing/revenuecat.ts", "RevenueCat bootstrap and platform key selection"],
  ["lib/freeAccess/useUsageCap.ts", "free-tier gating logic used by the home flow"],
  ["lib/i18n/I18nProvider.tsx", "runtime locale provider used at the app shell boundary"],
  ["lib/routes.ts", "shared route map used by the home navigation flow"],
  ["lib/testModes.ts", "canonical quiz mode and dataset wiring"],
  ["lib/theme/theme.ts", "theme bootstrap logic injected from the root layout"],
  ["messages/index.ts", "locale registry and message source wiring"],
  ["qbank-tools/lib/feature-bridge.mjs", "feature extraction bridge used by qbank matching tools"],
  ["qbank-tools/lib/pipeline.mjs", "central localization pipeline library shared by batch scripts"],
  ["scripts/build-match-index.mjs", "builds the matcher index from the master qbank"],
  ["scripts/extract-screenshot-intake.mjs", "extracts structured intake records from screenshot batches"],
  ["scripts/process-screenshot-batch.mjs", "runs matching and review-needed bucketing for a batch"],
  ["scripts/generate-batch-workbench.mjs", "builds the unified reviewer workbench for existing-qid decisions"],
  ["scripts/apply-batch-workbench-decisions.mjs", "applies reviewed workbench decisions into staging outputs"],
  ["scripts/validate-localization-batch.mjs", "validates staging outputs before workbench/apply steps"],
  ["scripts/stage-new-question-candidates.mjs", "stages new-question candidates outside the existing-qid flow"],
  ["scripts/next-language-preflight-lib.mjs", "shared preflight checks used by next-language import pilots"],
  ["scripts/next-language-validation-lib.mjs", "shared validation checks used by next-language import pilots"],
]);

const ESSENTIAL_SELECTION_ORDER = [
  "package.json",
  "README.md",
  "qbank-tools/README.md",
  "imports/README.md",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "capacitor.config.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/providers.tsx",
  "app/test/[mode]/page.tsx",
];

const QBANK_SELECTION_ORDER = [
  "qbank-tools/lib/pipeline.mjs",
  "qbank-tools/lib/feature-bridge.mjs",
  "scripts/build-match-index.mjs",
  "scripts/extract-screenshot-intake.mjs",
  "scripts/process-screenshot-batch.mjs",
  "scripts/generate-batch-workbench.mjs",
  "scripts/apply-batch-workbench-decisions.mjs",
  "scripts/validate-localization-batch.mjs",
  "scripts/stage-new-question-candidates.mjs",
];

const PINNED_SELECTION_ORDER = [
  ...new Set([
    ...ESSENTIAL_SELECTION_ORDER,
    ...QBANK_SELECTION_ORDER,
    ...Array.from(CURATED_PRIORITY_FILES.keys()),
  ]),
];

const OMITTED_FOLDER_NOTES = [
  ".git/ — git internals",
  ".next/ — Next.js build output",
  "node_modules/ — installed dependencies",
  "android/ — native wrapper tree and build artifacts",
  "artifacts/ — generated research and pilot artifacts, except small recent markdown summaries",
  "imports/<lang>/batch-*/screenshots/ — screenshot batches",
  "imports/<lang>/batch-*/ — bulky generated intake/match/review dumps are skipped by size unless small",
  "public/qbank/**/images/ — large production image assets",
  "public/qbank/**/questions*.json and translations*.json — large production question/translation data",
  "qbank-tools/generated/ — generated reports, staging previews, indexes, and archives",
  "qbank-tools/manual-reviews/ — batch review exports and local review state",
];

const WALK_IGNORES = new Set([
  ".git",
  ".next",
  ".venv",
  ".vercel",
  "android",
  "artifacts",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const TOP_LEVEL_ALIASES = [
  "app",
  "components",
  "docs",
  "lib",
  "messages",
  "qbank-tools",
  "scripts",
];

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(String(args["repo-root"] ?? process.cwd()));
  const outputArg = String(args.output ?? DEFAULTS.output);
  const outputPath = path.resolve(repoRoot, outputArg);
  const outputRelativePath = toRepoRelativePath(repoRoot, outputPath);
  const compact = Boolean(args.compact);
  const limits = compact ? COMPACT_LIMITS : DEFAULTS;
  const config = {
    repoRoot,
    outputPath,
    outputRelativePath,
    compact,
    maxFiles: parsePositiveInt(args["max-files"], limits.maxFiles, "max-files"),
    maxTotalBytes: parsePositiveInt(args["max-total-bytes"], limits.maxTotalBytes, "max-total-bytes"),
    maxFileBytes: parsePositiveInt(args["max-file-bytes"], limits.maxFileBytes, "max-file-bytes"),
  };

  const repoFiles = await listRepoFiles(repoRoot);
  const { fileMeta, skippedFiles } = await buildFileMetadata(repoFiles, config);
  const textCache = new Map();
  const packageJson = await readJsonFile(path.join(repoRoot, "package.json"));
  const documentedScriptNames = await collectDocumentedScriptNames(fileMeta, repoRoot, textCache);
  const activeScriptPaths = collectLocalScriptPaths(packageJson?.scripts ?? {});
  const documentedScriptPaths = collectDocumentedScriptPaths(packageJson?.scripts ?? {}, documentedScriptNames);
  const importGraph = await buildImportGraph(fileMeta, repoRoot, textCache);
  const reverseImportCounts = buildReverseImportCounts(importGraph);
  const seedFiles = determineSeedFiles(fileMeta, packageJson?.scripts ?? {}, documentedScriptPaths);
  const seedDepths = computeSeedDepths(seedFiles, importGraph);
  const scoredFiles = scoreFiles({
    fileMeta,
    activeScriptPaths,
    documentedScriptPaths,
    importGraph,
    packageJson,
    reverseImportCounts,
    seedDepths,
  });

  const selectedFiles = await selectFiles({
    config,
    repoRoot,
    scoredFiles,
    skippedFiles,
    textCache,
  });

  const markdown = buildSnapshotMarkdown({
    config,
    fileMeta,
    packageJson,
    selectedFiles,
    skippedFiles,
  });

  const markdownBytes = Buffer.byteLength(markdown, "utf8");
  if (markdownBytes > config.maxTotalBytes) {
    throw new Error(
      `Snapshot still exceeded MAX_TOTAL_BYTES after selection (${markdownBytes} > ${config.maxTotalBytes}).`,
    );
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");

  const truncatedCount = selectedFiles.filter((item) => item.excerpt.truncated).length;
  console.log(
    `Wrote ${path.relative(repoRoot, outputPath)} with ${selectedFiles.length} files, ${markdownBytes.toLocaleString()} bytes total, ${truncatedCount} excerpted file(s).`,
  );
  const topSkipped = skippedFiles
    .filter((file) => file.size != null)
    .sort((left, right) => right.size - left.size)
    .slice(0, 8);
  if (topSkipped.length > 0) {
    console.log("Top skipped bulky paths:");
    for (const file of topSkipped) {
      console.log(`- ${file.path} (${file.size.toLocaleString()} bytes): ${file.reason}`);
    }
  }
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}". Expected named flags like --output <path>.`);
    }

    const name = token.slice(2);
    if (name === "compact") {
      args.compact = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }

    args[name] = value;
    index += 1;
  }

  return args;
}

function parsePositiveInt(value, fallback, label) {
  if (value == null) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive integer.`);
  }

  return parsed;
}

function toRepoRelativePath(repoRoot, absolutePath) {
  const relative = path.relative(repoRoot, absolutePath);
  if (!relative || relative.startsWith("..")) {
    return null;
  }
  return normalizePath(relative);
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

async function listRepoFiles(repoRoot) {
  try {
    const tracked = execFileSync("git", ["ls-files"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return Array.from(new Set(`${tracked}\n${untracked}`.split("\n").map((line) => line.trim()).filter(Boolean))).sort();
  } catch {
    const results = [];
    await walkRepo(repoRoot, "", results);
    return results.sort();
  }
}

async function walkRepo(repoRoot, currentRelativePath, results) {
  const absolutePath = path.join(repoRoot, currentRelativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = normalizePath(path.join(currentRelativePath, entry.name));
    if (entry.isDirectory()) {
      if (WALK_IGNORES.has(entry.name)) {
        continue;
      }
      await walkRepo(repoRoot, relativePath, results);
      continue;
    }
    results.push(relativePath);
  }
}

async function buildFileMetadata(repoFiles, config) {
  const results = [];
  const skippedFiles = [];

  for (const relativePath of repoFiles) {
    const decision = shouldConsiderFile(relativePath, config.outputRelativePath, config);
    if (!decision.consider) {
      if (decision.reason) {
        skippedFiles.push({ path: relativePath, reason: decision.reason, size: null });
      }
      continue;
    }

    const absolutePath = path.join(config.repoRoot, relativePath);
    let fileStats;
    try {
      fileStats = await stat(absolutePath);
    } catch {
      continue;
    }
    if (!fileStats.isFile()) {
      continue;
    }

    if (fileStats.size > config.maxFileBytes && !isLargeFileWhitelisted(relativePath, config)) {
      skippedFiles.push({
        path: relativePath,
        reason: `above max file threshold (${fileStats.size.toLocaleString()} > ${config.maxFileBytes.toLocaleString()} bytes)`,
        size: fileStats.size,
      });
      continue;
    }

    results.push({
      path: relativePath,
      absolutePath,
      ext: path.extname(relativePath).toLowerCase(),
      size: fileStats.size,
    });
  }

  return { fileMeta: results, skippedFiles };
}

function shouldConsiderFile(relativePath, outputRelativePath, config) {
  const normalized = normalizePath(relativePath);

  if (normalized === outputRelativePath || normalized.endsWith(".tmp")) {
    return skipDecision("generated snapshot or temporary file");
  }

  if (
    normalized === "expatise-snapshot.md" ||
    normalized === "repo-snapshot.md" ||
    normalized.endsWith("-snapshot.md")
  ) {
    return skipDecision("generated snapshot output");
  }

  if (/\/?\.DS_Store$/i.test(normalized)) {
    return skipDecision("system metadata file");
  }

  if (/\/?\.env(?:\..+)?$/i.test(normalized) && !/\.env\.example$/i.test(normalized)) {
    return skipDecision("environment secret file");
  }

  if (/\.log$/i.test(normalized)) {
    return skipDecision("log file");
  }

  if (
    normalized.startsWith(".git/") ||
    normalized.startsWith(".next/") ||
    normalized.startsWith(".venv/") ||
    normalized.startsWith(".vercel/") ||
    normalized.startsWith("android/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("public/images/") ||
    normalized.startsWith("qbank-tools/generated/") ||
    normalized.startsWith("qbank-tools/manual-reviews/")
  ) {
    return skipDecision("bulky generated, build, cache, or local review folder");
  }

  if (
    normalized.startsWith("artifacts/") &&
    !/^artifacts\/(?:next-language-pilot|japanese-review-intelligence|release-cleanup)\/.*(?:summary|readiness|report)\.md$/.test(normalized)
  ) {
    return skipDecision("generated artifact that is not a compact workflow note");
  }

  if (normalized.startsWith("app/raw/") || normalized.startsWith("raw/")) {
    return skipDecision("raw source dump");
  }

  if (/^imports\/[^/]+\/batch-[^/]+\/screenshots\//.test(normalized)) {
    return skipDecision("screenshot batch image");
  }

  if (/^public\/qbank\/[^/]+\/images\//.test(normalized)) {
    return skipDecision("production qbank image asset");
  }

  if (/^public\/qbank\/[^/]+\/(?:questions(?:\.raw)?|translations\.[^.]+|image-color-tags)\.json$/.test(normalized)) {
    return skipDecision("large production qbank data or asset map");
  }

  if (config.compact && /^imports\/[^/]+\/batch-[^/]+\/intake\.json$/.test(normalized)) {
    return skipDecision("compact mode excludes detailed intake dumps");
  }

  const baseName = path.basename(normalized);
  const isRepoRootFile = !normalized.includes("/");
  if (IMPORTANT_ROOT_FILES.has(normalized) || (isRepoRootFile && IMPORTANT_ROOT_FILES.has(baseName))) {
    return includeDecision();
  }

  if (!TEXT_EXTENSIONS.has(path.extname(normalized).toLowerCase())) {
    return skipDecision("non-text or binary file");
  }

  return includeDecision();
}

function includeDecision() {
  return { consider: true, reason: null };
}

function skipDecision(reason) {
  return { consider: false, reason };
}

function isLargeFileWhitelisted(relativePath, config) {
  const normalized = normalizePath(relativePath);
  if (CURATED_PRIORITY_FILES.has(normalized)) {
    return true;
  }
  if (["README.md", "qbank-tools/README.md", "imports/README.md"].includes(normalized)) {
    return true;
  }
  if (normalized.startsWith("docs/") && normalized.endsWith(".md") && !config.compact) {
    return true;
  }
  if (/^app\/(?:layout|page|providers)\.tsx$/.test(normalized)) {
    return true;
  }
  if (/^app\/.+\/page\.tsx$/.test(normalized) || /^app\/api\/.+\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalized)) {
    return true;
  }
  if (/^qbank-tools\/lib\/.+\.mjs$/.test(normalized)) {
    return true;
  }
  if (normalized === "package.json") {
    return true;
  }
  return false;
}

async function collectDocumentedScriptNames(fileMeta, repoRoot, textCache) {
  const names = new Set();
  const docCandidates = fileMeta.filter((file) => file.path.endsWith(".md"));

  for (const file of docCandidates) {
    if (
      file.path !== "README.md" &&
      file.path !== "qbank-tools/README.md" &&
      file.path !== "imports/README.md" &&
      !file.path.startsWith("docs/")
    ) {
      continue;
    }

    const text = await readText(file, repoRoot, textCache);
    for (const match of text.matchAll(/\bnpm run ([a-z0-9:_-]+)/gi)) {
      names.add(match[1]);
    }
  }

  return names;
}

function collectLocalScriptPaths(scriptMap) {
  const paths = new Set();

  for (const command of Object.values(scriptMap)) {
    for (const localPath of extractLocalPathsFromCommand(String(command))) {
      paths.add(localPath);
    }
  }

  return paths;
}

function collectDocumentedScriptPaths(scriptMap, documentedScriptNames) {
  const paths = new Set();

  for (const scriptName of documentedScriptNames) {
    const command = scriptMap?.[scriptName];
    if (!command) {
      continue;
    }
    for (const localPath of extractLocalPathsFromCommand(String(command))) {
      paths.add(localPath);
    }
  }

  return paths;
}

function extractLocalPathsFromCommand(command) {
  const paths = new Set();
  const pattern = /(?:^|[\s"'`])((?:scripts|qbank-tools|app|lib|components|docs|messages)\/[A-Za-z0-9_./\-[\]]+\.(?:cjs|css|js|json|jsx|md|mjs|py|sh|sql|ts|tsx|ya?ml))/g;

  for (const match of command.matchAll(pattern)) {
    paths.add(normalizePath(match[1]));
  }

  return paths;
}

async function buildImportGraph(fileMeta, repoRoot, textCache) {
  const graph = new Map();
  const sourceFiles = new Set(
    fileMeta
      .filter((file) => SOURCE_EXTENSIONS.has(file.ext) || file.path.endsWith(".md"))
      .map((file) => file.path),
  );

  for (const file of fileMeta) {
    if (!sourceFiles.has(file.path)) {
      continue;
    }

    const text = await readText(file, repoRoot, textCache);
    const dependencies = new Set();
    const specifiers = extractImportSpecifiers(text);

    for (const specifier of specifiers) {
      const resolved = resolveLocalImport(file.path, specifier, sourceFiles, repoRoot);
      if (resolved) {
        dependencies.add(resolved);
      }
    }

    graph.set(file.path, dependencies);
  }

  return graph;
}

function extractImportSpecifiers(text) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+[^'"]*?from\s+["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?from\s+["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /@import\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) {
        specifiers.add(match[1]);
      }
    }
  }

  return specifiers;
}

function resolveLocalImport(fromPath, specifier, knownFiles, repoRoot) {
  if (!specifier || specifier.startsWith("#")) {
    return null;
  }

  let candidateBase = null;
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    candidateBase = normalizePath(path.join(path.dirname(fromPath), specifier));
  } else if (specifier.startsWith("@/")) {
    candidateBase = specifier.slice(2);
  } else {
    const alias = TOP_LEVEL_ALIASES.find((entry) => specifier === entry || specifier.startsWith(`${entry}/`));
    if (alias) {
      candidateBase = specifier;
    }
  }

  if (!candidateBase) {
    return null;
  }

  const resolved = resolveKnownFile(candidateBase, knownFiles);
  if (resolved) {
    return resolved;
  }

  const absoluteBase = path.join(repoRoot, candidateBase);
  return resolveKnownFile(normalizePath(path.relative(repoRoot, absoluteBase)), knownFiles);
}

function resolveKnownFile(candidateBase, knownFiles) {
  const candidates = [];
  const ext = path.extname(candidateBase);

  if (ext) {
    candidates.push(candidateBase);
  } else {
    for (const extension of TEXT_EXTENSIONS) {
      candidates.push(`${candidateBase}${extension}`);
    }
    for (const extension of TEXT_EXTENSIONS) {
      candidates.push(`${candidateBase}/index${extension}`);
    }
  }

  for (const candidate of candidates) {
    if (knownFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildReverseImportCounts(importGraph) {
  const counts = new Map();

  for (const dependencies of importGraph.values()) {
    for (const dependency of dependencies) {
      counts.set(dependency, (counts.get(dependency) ?? 0) + 1);
    }
  }

  return counts;
}

function determineSeedFiles(fileMeta, scriptMap, documentedScriptPaths) {
  const available = new Set(fileMeta.map((file) => file.path));
  const seeds = new Set();
  const explicitSeeds = [
    "package.json",
    "README.md",
    "qbank-tools/README.md",
    "imports/README.md",
    "next.config.ts",
    "tsconfig.json",
    "eslint.config.mjs",
    "postcss.config.mjs",
    "capacitor.config.ts",
    "app/layout.tsx",
    "app/page.tsx",
    "app/providers.tsx",
    "app/test/[mode]/page.tsx",
    "app/(premium)/layout.tsx",
    "lib/routes.ts",
    "lib/testModes.ts",
    "qbank-tools/lib/pipeline.mjs",
  ];

  for (const filePath of explicitSeeds) {
    if (available.has(filePath)) {
      seeds.add(filePath);
    }
  }

  for (const filePath of CURATED_PRIORITY_FILES.keys()) {
    if (available.has(filePath)) {
      seeds.add(filePath);
    }
  }

  for (const filePath of documentedScriptPaths) {
    if (available.has(filePath)) {
      seeds.add(filePath);
    }
  }

  for (const command of Object.values(scriptMap)) {
    for (const localPath of extractLocalPathsFromCommand(String(command))) {
      if (available.has(localPath)) {
        seeds.add(localPath);
      }
    }
  }

  for (const file of fileMeta) {
    if (
      /^app\/api\/.+\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file.path) ||
      /^app\/[^/]+\/page\.tsx$/.test(file.path) ||
      /^app\/\(premium\)\/[^/]+\/page\.tsx$/.test(file.path)
    ) {
      seeds.add(file.path);
    }
  }

  return seeds;
}

function computeSeedDepths(seedFiles, importGraph) {
  const depths = new Map();
  const queue = [];

  for (const seed of seedFiles) {
    depths.set(seed, 0);
    queue.push(seed);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDepth = depths.get(current) ?? 0;
    const dependencies = importGraph.get(current) ?? new Set();

    for (const dependency of dependencies) {
      if (depths.has(dependency)) {
        continue;
      }
      depths.set(dependency, currentDepth + 1);
      queue.push(dependency);
    }
  }

  return depths;
}

function scoreFiles({
  fileMeta,
  activeScriptPaths,
  documentedScriptPaths,
  packageJson,
  reverseImportCounts,
  seedDepths,
}) {
  return fileMeta
    .map((file) => {
      const score = scoreSingleFile(file, {
        activeScriptPaths,
        documentedScriptPaths,
        packageJson,
        reverseImportCounts,
        seedDepths,
      });

      return {
        ...file,
        ...score,
      };
    })
    .filter((file) => file.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.category !== right.category) {
        return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
      }
      return left.path.localeCompare(right.path);
    });
}

function scoreSingleFile(file, context) {
  let score = 0;
  const reasons = [];
  const category = categorizeFile(file.path);
  const baseName = path.basename(file.path);
  const isRepoRootFile = !file.path.includes("/");

  if (IMPORTANT_ROOT_FILES.has(file.path) || (isRepoRootFile && IMPORTANT_ROOT_FILES.has(baseName))) {
    score += 10_000;
    reasons.push(IMPORTANT_ROOT_FILES.get(file.path) ?? IMPORTANT_ROOT_FILES.get(baseName));
  }

  if (CURATED_PRIORITY_FILES.has(file.path)) {
    score += 8_500;
    reasons.push(CURATED_PRIORITY_FILES.get(file.path));
  }

  if (file.path === "package-lock.json") {
    score += 800;
  }

  if (file.path.startsWith("docs/")) {
    score += 3_200;
    reasons.push("architecture or workflow documentation");
  }

  if (/^artifacts\/(?:next-language-pilot|japanese-review-intelligence|release-cleanup)\/.*(?:summary|readiness|report)\.md$/.test(file.path)) {
    score += 2_800;
    reasons.push("recent workflow note or validation summary");
  }

  if (file.path.startsWith("app/")) {
    if (file.path === "app/layout.tsx" || file.path === "app/page.tsx" || file.path === "app/providers.tsx") {
      score += 9_000;
      reasons.push("root app-router entrypoint");
    } else if (file.path === "app/test/[mode]/page.tsx") {
      score += 8_000;
      reasons.push("dynamic quiz route entrypoint");
    } else if (/^app\/api\/.+\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)) {
      score += 6_500;
      reasons.push("API route implementation");
    } else if (/^app\/\(premium\)\/layout\.tsx$/.test(file.path)) {
      score += 6_200;
      reasons.push("premium route group shell");
    } else if (/^app\/(?:\(premium\)\/)?[^/]+\/page\.tsx$/.test(file.path)) {
      score += 3_800;
      reasons.push("primary route page");
    } else if (/^app\/\(premium\)\/[^/]+\/page\.tsx$/.test(file.path)) {
      score += 3_600;
      reasons.push("premium route page");
    } else if (file.ext === ".css") {
      score += 500;
    }
  }

  if (file.path.startsWith("components/")) {
    score += 1_800;
    reasons.push("shared UI or provider used by app flows");
  }

  if (file.path.startsWith("lib/qbank/")) {
    score += 4_800;
    reasons.push("question-bank loading, typing, or tagging logic");
  } else if (
    file.path.startsWith("lib/supabase/") ||
    file.path.startsWith("lib/sync/") ||
    file.path.startsWith("lib/auth/") ||
    file.path === "lib/auth.ts" ||
    file.path.startsWith("lib/billing/")
  ) {
    score += 4_400;
    reasons.push("data access, auth, billing, or sync logic");
  } else if (file.path.startsWith("lib/")) {
    score += 3_400;
    reasons.push("shared business logic");
  }

  if (file.path.startsWith("messages/")) {
    score += 2_500;
    reasons.push("localization source or locale registry");
  }

  if (file.path === "qbank-tools/lib/pipeline.mjs") {
    score += 9_500;
    reasons.push("central localization pipeline library");
  } else if (file.path.startsWith("qbank-tools/")) {
    score += 3_200;
    reasons.push("pipeline support file");
  }

  if (/^imports\/[^/]+\/batch-[^/]+\/(?:extraction-report|matched|review-needed|unresolved)\.json$/.test(file.path)) {
    score += 4_200;
    reasons.push("small current import-batch status summary");
  } else if (/^imports\/[^/]+\/batch-[^/]+\/intake\.json$/.test(file.path)) {
    score += 1_000;
    reasons.push("small import intake summary");
  }

  if (file.path.startsWith("scripts/")) {
    score += 1_500;
  }

  if (context.activeScriptPaths.has(file.path)) {
    score += 4_800;
    reasons.push("wired to an npm script");
  }

  if (context.documentedScriptPaths.has(file.path)) {
    score += 6_000;
    reasons.push("referenced by the documented workflow");
  }

  const reverseImports = context.reverseImportCounts.get(file.path) ?? 0;
  if (reverseImports > 0) {
    score += Math.min(3_000, reverseImports * 180);
    reasons.push(`imported by ${reverseImports} tracked file(s)`);
  }

  const depth = context.seedDepths.get(file.path);
  if (depth != null) {
    score += Math.max(500, 3_500 - (depth * 350));
    if (depth > 0) {
      reasons.push(`reachable from a core entrypoint at depth ${depth}`);
    }
  }

  if (file.size > 120_000) {
    score -= 600;
  }
  if (file.size > 300_000) {
    score -= 1_000;
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    category,
    reason: uniqueReasons[0] ?? "useful source context",
    reasons: uniqueReasons,
    score,
  };
}

function categorizeFile(filePath) {
  const baseName = path.basename(filePath);
  const isRepoRootFile = !filePath.includes("/");
  if (IMPORTANT_ROOT_FILES.has(filePath) || (isRepoRootFile && IMPORTANT_ROOT_FILES.has(baseName))) {
    if (filePath.endsWith(".md")) {
      return "Docs";
    }
    return "Project Config";
  }

  if (filePath.endsWith(".md")) {
    return "Docs";
  }

  if (filePath.startsWith("scripts/") || filePath.startsWith("qbank-tools/")) {
    return "Scripts / Pipeline";
  }

  if (
    filePath.startsWith("lib/qbank/") ||
    filePath.startsWith("lib/supabase/") ||
    filePath.startsWith("lib/sync/") ||
    filePath.startsWith("messages/")
  ) {
    return "Data Layer";
  }

  if (filePath.startsWith("lib/")) {
    return "Business Logic";
  }

  if (filePath.startsWith("components/")) {
    return "Core UI";
  }

  if (filePath.startsWith("app/")) {
    return "App Entry Points";
  }

  return "Other";
}

async function selectFiles({ config, repoRoot, scoredFiles, skippedFiles, textCache }) {
  const reserveBytes = Math.max(24_000, Math.min(60_000, Math.floor(config.maxTotalBytes * 0.12)));
  const allowedExcerptBytes = config.maxTotalBytes - reserveBytes;
  const softCategoryCaps = config.compact ? COMPACT_CATEGORY_CAPS : SOFT_CATEGORY_CAPS;
  const categoryCounts = new Map();
  const selected = [];
  const deferred = [];
  const selectedPaths = new Set();
  let usedExcerptBytes = 0;

  const scoredByPath = new Map(scoredFiles.map((file) => [file.path, file]));
  const pinnedFiles = PINNED_SELECTION_ORDER
    .map((filePath) => scoredByPath.get(filePath))
    .filter(Boolean);

  const remainingFiles = scoredFiles.filter((file) => !PINNED_SELECTION_ORDER.includes(file.path));

  const trySelect = async (file, allowOverSoftCap = false) => {
    if (selected.length >= config.maxFiles) {
      skippedFiles.push({ path: file.path, reason: "not selected because MAX_FILES was reached", size: file.size });
      return false;
    }

    if (selectedPaths.has(file.path)) {
      return false;
    }

    const categoryCount = categoryCounts.get(file.category) ?? 0;
    const softCap = softCategoryCaps[file.category] ?? 5;
    if (!allowOverSoftCap && categoryCount >= softCap) {
      deferred.push(file);
      return false;
    }

    const excerpt = await buildExcerpt(file, repoRoot, config.maxFileBytes, textCache);
    const projectedBytes = usedExcerptBytes + excerpt.bytes + 240;
    if (projectedBytes > allowedExcerptBytes) {
      skippedFiles.push({
        path: file.path,
        reason: "not selected because the total byte budget was reserved for higher-priority files",
        size: file.size,
      });
      return false;
    }

    selected.push({ ...file, excerpt });
    selectedPaths.add(file.path);
    categoryCounts.set(file.category, categoryCount + 1);
    usedExcerptBytes += excerpt.bytes + 240;
    return true;
  };

  for (const file of pinnedFiles) {
    await trySelect(file, true);
  }

  for (const file of remainingFiles) {
    if (selected.length >= config.maxFiles) {
      break;
    }

    await trySelect(file);
  }

  for (const file of deferred) {
    if (selected.length >= config.maxFiles) {
      break;
    }

    const excerpt = await buildExcerpt(file, repoRoot, config.maxFileBytes, textCache);
    const projectedBytes = usedExcerptBytes + excerpt.bytes + 240;
    if (projectedBytes > allowedExcerptBytes) {
      skippedFiles.push({
        path: file.path,
        reason: "not selected because the total byte budget was already used",
        size: file.size,
      });
      continue;
    }

    selected.push({ ...file, excerpt });
    categoryCounts.set(file.category, (categoryCounts.get(file.category) ?? 0) + 1);
    usedExcerptBytes += excerpt.bytes + 240;
  }

  const ordered = selected.sort((left, right) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.path.localeCompare(right.path);
  });

  while (ordered.length > 0) {
    const markdown = buildSnapshotMarkdown({
      config,
      fileMeta: [],
      packageJson: null,
      selectedFiles: ordered,
    });
    if (Buffer.byteLength(markdown, "utf8") <= config.maxTotalBytes) {
      return ordered;
    }
    ordered.pop();
  }

  return ordered;
}

async function buildExcerpt(file, repoRoot, maxFileBytes, textCache) {
  const text = await readText(file, repoRoot, textCache);
  const originalBytes = Buffer.byteLength(text, "utf8");

  if (originalBytes <= maxFileBytes) {
    return {
      content: text.trimEnd(),
      bytes: originalBytes,
      originalBytes,
      truncated: false,
      strategy: "full file",
    };
  }

  if (SOURCE_EXTENSIONS.has(file.ext)) {
    const excerpt = buildCodeExcerpt(text, maxFileBytes);
    return {
      content: excerpt.content.trimEnd(),
      bytes: Buffer.byteLength(excerpt.content, "utf8"),
      originalBytes,
      truncated: true,
      strategy: excerpt.strategy,
    };
  }

  if (file.ext === ".md") {
    const content = sliceTextByBytes(text, maxFileBytes);
    return {
      content: `${content.trimEnd()}\n\n... truncated after the opening section ...`,
      bytes: Buffer.byteLength(content, "utf8"),
      originalBytes,
      truncated: true,
      strategy: "opening documentation section",
    };
  }

  if (file.ext === ".json") {
    const excerpt = buildJsonExcerpt(file.path, text, maxFileBytes);
    return {
      content: excerpt.content.trimEnd(),
      bytes: Buffer.byteLength(excerpt.content, "utf8"),
      originalBytes,
      truncated: true,
      strategy: excerpt.strategy,
    };
  }

  if (file.ext === ".yaml" || file.ext === ".yml") {
    const content = sliceTextByBytes(text, maxFileBytes);
    return {
      content: `${content.trimEnd()}\n\n... truncated config excerpt ...`,
      bytes: Buffer.byteLength(content, "utf8"),
      originalBytes,
      truncated: true,
      strategy: "top-of-file config excerpt",
    };
  }

  const content = sliceTextByBytes(text, maxFileBytes);
  return {
    content: `${content.trimEnd()}\n\n... truncated excerpt ...`,
    bytes: Buffer.byteLength(content, "utf8"),
    originalBytes,
    truncated: true,
    strategy: "leading excerpt",
  };
}

function buildCodeExcerpt(text, maxBytes) {
  const lines = text.split("\n");
  const windows = [];
  const maxTopLines = 80;
  windows.push([0, Math.min(lines.length - 1, maxTopLines - 1)]);

  const interestingPatterns = [
    /^\s*export\s+default\s+(async\s+)?function\b/,
    /^\s*export\s+(async\s+)?function\b/,
    /^\s*export\s+const\b/,
    /^\s*export\s+class\b/,
    /^\s*(async\s+)?function\s+[A-Za-z0-9_]+\b/,
    /^\s*const\s+[A-Za-z0-9_]+\s*=\s*(async\s*)?\(/,
    /^\s*type\s+[A-Z][A-Za-z0-9_]+\b/,
    /^\s*interface\s+[A-Z][A-Za-z0-9_]+\b/,
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!interestingPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    windows.push([Math.max(0, index - 2), Math.min(lines.length - 1, index + 18)]);
    if (windows.length >= 14) {
      break;
    }
  }

  const mergedWindows = mergeWindows(windows);
  const outputLines = [];

  for (const [start, end] of mergedWindows) {
    if (outputLines.length > 0) {
      outputLines.push(`... (${Math.max(0, start - 1)} lines omitted) ...`);
    }

    for (let index = start; index <= end; index += 1) {
      outputLines.push(lines[index]);
    }
  }

  let content = outputLines.join("\n").trimEnd();
  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    content = sliceTextByBytes(content, maxBytes);
  }

  return {
    content: `${content.trimEnd()}\n\n... truncated to header and key export blocks ...`,
    strategy: "header plus key export/function blocks",
  };
}

function buildJsonExcerpt(filePath, text, maxBytes) {
  if (filePath === "package-lock.json") {
    return buildPackageLockExcerpt(text, maxBytes);
  }

  try {
    const parsed = JSON.parse(text);
    const summary = summarizeJsonValue(parsed, 0);
    let content = JSON.stringify(summary, null, 2);
    if (Buffer.byteLength(content, "utf8") > maxBytes) {
      content = sliceTextByBytes(content, maxBytes);
    }
    return {
      content: `${content.trimEnd()}\n\n... truncated structured JSON summary ...`,
      strategy: "structured JSON summary",
    };
  } catch {
    const content = sliceTextByBytes(text, maxBytes);
    return {
      content: `${content.trimEnd()}\n\n... truncated config/data excerpt ...`,
      strategy: "top-of-file config excerpt",
    };
  }
}

function buildPackageLockExcerpt(text, maxBytes) {
  try {
    const parsed = JSON.parse(text);
    const rootPackage = parsed?.packages?.[""] ?? {};
    const dependencyNames = Object.keys(rootPackage.dependencies ?? {}).sort();
    const devDependencyNames = Object.keys(rootPackage.devDependencies ?? {}).sort();
    const packageEntries = typeof parsed?.packages === "object" && parsed.packages
      ? Object.keys(parsed.packages).length
      : 0;

    const summary = {
      name: parsed?.name ?? null,
      version: parsed?.version ?? null,
      lockfileVersion: parsed?.lockfileVersion ?? null,
      requires: parsed?.requires ?? null,
      packageEntries,
      rootDependencies: {
        count: dependencyNames.length,
        names: dependencyNames.slice(0, 60),
      },
      rootDevDependencies: {
        count: devDependencyNames.length,
        names: devDependencyNames.slice(0, 60),
      },
    };

    let content = JSON.stringify(summary, null, 2);
    if (Buffer.byteLength(content, "utf8") > maxBytes) {
      content = sliceTextByBytes(content, maxBytes);
    }
    return {
      content: `${content.trimEnd()}\n\n... truncated lockfile summary ...`,
      strategy: "lockfile metadata and root dependency summary",
    };
  } catch {
    const content = sliceTextByBytes(text, maxBytes);
    return {
      content: `${content.trimEnd()}\n\n... truncated config/data excerpt ...`,
      strategy: "top-of-file config excerpt",
    };
  }
}

function summarizeJsonValue(value, depth) {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 1) {
      return `[array(${value.length}) omitted]`;
    }
    return {
      type: "array",
      length: value.length,
      sample: value.slice(0, 3).map((item) => summarizeJsonValue(item, depth + 1)),
    };
  }

  const entries = Object.entries(value);
  const limit = depth === 0 ? 18 : 8;
  const summary = {};
  for (const [key, nestedValue] of entries.slice(0, limit)) {
    if (Array.isArray(nestedValue)) {
      summary[key] = depth >= 1
        ? `[array(${nestedValue.length}) omitted]`
        : {
            length: nestedValue.length,
            sample: nestedValue.slice(0, 3).map((item) => summarizeJsonValue(item, depth + 1)),
          };
      continue;
    }

    if (nestedValue && typeof nestedValue === "object") {
      const nestedKeys = Object.keys(nestedValue);
      summary[key] = depth >= 1
        ? `[object(${nestedKeys.length} keys) omitted]`
        : summarizeJsonValue(nestedValue, depth + 1);
      continue;
    }

    summary[key] = nestedValue;
  }

  if (entries.length > limit) {
    summary.__truncatedKeys = entries.length - limit;
  }

  return summary;
}

function mergeWindows(windows) {
  const sorted = windows
    .filter((window) => Number.isInteger(window[0]) && Number.isInteger(window[1]) && window[1] >= window[0])
    .sort((left, right) => left[0] - right[0]);

  if (sorted.length === 0) {
    return [];
  }

  const merged = [sorted[0]];
  for (const window of sorted.slice(1)) {
    const current = merged[merged.length - 1];
    if (window[0] <= current[1] + 3) {
      current[1] = Math.max(current[1], window[1]);
    } else {
      merged.push([...window]);
    }
  }

  return merged;
}

function sliceTextByBytes(text, maxBytes) {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.byteLength <= maxBytes) {
    return text;
  }

  let end = maxBytes;
  while (end > 0 && (buffer[end] & 0b1100_0000) === 0b1000_0000) {
    end -= 1;
  }

  return buffer.subarray(0, end).toString("utf8");
}

async function readText(file, repoRoot, textCache) {
  if (textCache.has(file.path)) {
    return textCache.get(file.path);
  }

  const text = await readFile(path.join(repoRoot, file.path), "utf8");
  textCache.set(file.path, text);
  return text;
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildSnapshotMarkdown({ config, packageJson, selectedFiles, skippedFiles = [] }) {
  const now = new Date().toISOString();
  const grouped = groupByCategory(selectedFiles);
  const summaryLines = buildProjectSummary(packageJson, grouped);
  const topSkipped = summarizeSkippedFiles(skippedFiles, 18);
  const truncatedCount = selectedFiles.filter((file) => file.excerpt.truncated).length;
  const content = [];

  content.push("# Curated Project Snapshot");
  content.push("");
  content.push(`Generated: \`${now}\``);
  content.push(`Snapshot policy: ${config.compact ? "compact, " : ""}up to ${config.maxFiles} files, ${config.maxTotalBytes.toLocaleString()} bytes total, ${config.maxFileBytes.toLocaleString()} bytes per file excerpt.`);
  content.push("");

  content.push("## Project Summary");
  content.push("");
  for (const line of summaryLines) {
    content.push(`- ${line}`);
  }
  content.push("");

  content.push("## Key Commands");
  content.push("");
  content.push("- `npm run build-match-index` — rebuild the qbank match index used by screenshot matching.");
  content.push("- `npm run extract-screenshot-intake -- --lang <lang> --batch <batch>` — extract structured intake records from a screenshot batch.");
  content.push("- `npm run process-screenshot-batch -- --lang <lang> --batch <batch>` — match extracted screenshots against the master qbank and split matched/review/unresolved buckets.");
  content.push("- `npm run generate-batch-workbench -- --lang <lang> --batch <batch>` — create the reviewer workbench for human decisions.");
  content.push("- `npm run validate-localization-batch -- --lang <lang> --batch <batch>` — validate staged localization outputs.");
  content.push("- `./make-snapshot.sh --compact` — generate this smaller project-context snapshot.");
  content.push("");

  content.push("## Selected Files");
  content.push("");
  for (const category of CATEGORY_ORDER) {
    const files = grouped.get(category) ?? [];
    if (files.length === 0) {
      continue;
    }
    content.push(`### ${category}`);
    for (const file of files) {
      content.push(`- \`${file.path}\``);
    }
    content.push("");
  }

  content.push("## Manifest");
  content.push("");
  for (const category of CATEGORY_ORDER) {
    const files = grouped.get(category) ?? [];
    if (files.length === 0) {
      continue;
    }
    content.push(`### ${category}`);
    for (const file of files) {
      const excerptLabel = file.excerpt.truncated
        ? `excerpted (${file.excerpt.strategy})`
        : "full file";
      content.push(`- \`${file.path}\` — ${file.reason}; ${excerptLabel}.`);
    }
    content.push("");
  }

  content.push("## Omitted High-Volume Folders");
  content.push("");
  for (const note of OMITTED_FOLDER_NOTES) {
    content.push(`- ${note}`);
  }
  content.push("");

  content.push("## Skipped Files Summary");
  content.push("");
  if (topSkipped.length === 0) {
    content.push("- No skipped files were recorded.");
  } else {
    for (const file of topSkipped) {
      const sizeLabel = file.size == null ? "" : ` (${file.size.toLocaleString()} bytes)`;
      content.push(`- \`${file.path}\`${sizeLabel} — ${file.reason}`);
    }
  }
  content.push("");

  content.push("## Snapshot Contents");
  content.push("");
  content.push(`Included ${selectedFiles.length} file(s); ${truncatedCount} excerpted to stay within the byte budget.`);
  content.push("");

  for (const category of CATEGORY_ORDER) {
    const files = grouped.get(category) ?? [];
    if (files.length === 0) {
      continue;
    }

    content.push(`### ${category}`);
    content.push("");

    for (const file of files) {
      const language = markdownLanguageForFile(file.path);
      const mode = file.excerpt.truncated
        ? `excerpt of ${file.excerpt.originalBytes.toLocaleString()} bytes via ${file.excerpt.strategy}`
        : `full file, ${file.excerpt.originalBytes.toLocaleString()} bytes`;
      content.push(`#### \`${file.path}\``);
      content.push("");
      content.push(`Reason: ${file.reason}`);
      content.push("");
      content.push(`Mode: ${mode}`);
      content.push("");
      content.push(`\`\`\`${language}`);
      content.push(file.excerpt.content);
      content.push("```");
      content.push("");
    }
  }

  return `${content.join("\n").trimEnd()}\n`;
}

function buildProjectSummary(packageJson, grouped) {
  const lines = [];
  const dependencyNames = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);

  lines.push("Project purpose: Expatise is a Next.js app for Korean exam practice, qbank-driven quizzes, localization, premium access, and mobile packaging.");
  lines.push("Current qbank/import workflow: screenshot batches live under `imports/<lang>/batch-*`; tools extract intake JSON, match against the qbank index, split matched/review-needed/unresolved items, generate workbenches, and stage reviewed localization or new-question outputs.");
  lines.push("Recent known changes represented here: the active snapshot now focuses on current source, pipeline code, small batch summaries, and recent workflow notes while excluding generated archives, reports, raw qbank dumps, images, screenshots, and local review exports.");
  lines.push("Current problems/open TODOs: large Russian import batches still produce bulky `review-needed.json`/`unresolved.json` files; those are summarized as skipped unless they are small enough for project-context upload.");

  if (dependencyNames.has("next")) {
    lines.push(`Next.js app-router app detected in \`app/\` with shared providers and premium/test route groups.`);
  }
  if (dependencyNames.has("@capacitor/core")) {
    lines.push(`Capacitor is present, so the web app is also packaged as a mobile shell.`);
  }
  if (dependencyNames.has("@supabase/supabase-js")) {
    lines.push(`Supabase-backed auth/data integration is part of the active stack.`);
  }
  if (dependencyNames.has("@revenuecat/purchases-capacitor")) {
    lines.push(`RevenueCat entitlement and premium-gating flows are active in the app.`);
  }
  if (dependencyNames.has("openai")) {
    lines.push(`OpenAI-backed coaching/content tooling is part of the current implementation direction.`);
  }

  const pipelineFiles = grouped.get("Scripts / Pipeline") ?? [];
  if (pipelineFiles.some((file) => file.path.startsWith("qbank-tools/") || file.path.startsWith("scripts/"))) {
    const scriptList = pipelineFiles
      .filter((file) => file.path.startsWith("scripts/") || file.path.startsWith("qbank-tools/lib/"))
      .slice(0, 10)
      .map((file) => `\`${file.path}\``)
      .join(", ");
    lines.push(`Key scripts and pipeline files selected here: ${scriptList}.`);
  }

  const businessLogicFiles = grouped.get("Business Logic") ?? [];
  if (businessLogicFiles.length > 0) {
    lines.push(`Core shared logic currently lives under \`lib/\`, with quiz flow, stats, coach, entitlements, and study-state helpers selected here.`);
  }

  lines.push(`This bundle is intentionally curated for AI handoff: it favors architecture, active workflows, and central dependencies over completeness.`);
  return lines;
}

function groupByCategory(selectedFiles) {
  const grouped = new Map();

  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }

  for (const file of selectedFiles) {
    if (!grouped.has(file.category)) {
      grouped.set(file.category, []);
    }
    grouped.get(file.category).push(file);
  }

  return grouped;
}

function summarizeSkippedFiles(skippedFiles, limit) {
  const byPath = new Map();
  for (const file of skippedFiles) {
    if (!file?.path || byPath.has(file.path)) {
      continue;
    }
    byPath.set(file.path, file);
  }

  const entries = Array.from(byPath.values());
  const bulky = entries
    .filter((file) => file.size != null)
    .sort((left, right) => right.size - left.size);
  const policy = entries
    .filter((file) => file.size == null)
    .sort((left, right) => prioritySkippedFile(left) - prioritySkippedFile(right) || left.path.localeCompare(right.path));

  const bulkyLimit = Math.max(0, limit - 6);
  return [
    ...bulky.slice(0, bulkyLimit),
    ...policy.slice(0, limit - Math.min(bulky.length, bulkyLimit)),
  ];
}

function prioritySkippedFile(file) {
  if (/^(?:public\/qbank|qbank-tools\/generated|imports\/[^/]+\/batch-[^/]+\/screenshots|raw\/|app\/raw\/)/.test(file.path)) {
    return 0;
  }
  if (/qbank|screenshot|image|raw/i.test(file.reason)) {
    return 1;
  }
  if (/secret|environment/i.test(file.reason)) {
    return 2;
  }
  return 3;
}

function markdownLanguageForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "tsx";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "js";
    case ".json":
      return "json";
    case ".css":
      return "css";
    case ".md":
      return "md";
    case ".sh":
      return "bash";
    case ".py":
      return "python";
    case ".sql":
      return "sql";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return "";
  }
}
