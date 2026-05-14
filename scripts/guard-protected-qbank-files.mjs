#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const QUESTIONS_PATH = "public/qbank/2023-test1/questions.json";
const IMAGE_TAGS_PATH = "public/qbank/2023-test1/image-color-tags.json";

const args = parseArgs();
const allowQuestionsMasterEdit = booleanArg(args, "allow-questions-master-edit", false);
const allowImageTagCorrection = booleanArg(args, "allow-image-tag-correction", false);
const allowImageTagStructuralCorrection = booleanArg(args, "allow-image-tag-structural-correction", false);
const violations = [];

guardQuestionsJson();
guardImageColorTags();

if (violations.length > 0) {
  console.error("Protected qbank file guard failed.");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Protected qbank file guard passed.");

function guardQuestionsJson() {
  if (!isPathModified(QUESTIONS_PATH)) return;
  if (allowQuestionsMasterEdit) {
    console.log("questions.json modification allowed by --allow-questions-master-edit true.");
    return;
  }
  violations.push("questions.json is human-locked. Do not edit it in localization/pipeline tasks.");
}

function guardImageColorTags() {
  if (!isPathModified(IMAGE_TAGS_PATH)) return;

  const headText = readHeadFile(IMAGE_TAGS_PATH);
  const workingPath = path.join(ROOT, IMAGE_TAGS_PATH);
  const workingText = fs.readFileSync(workingPath, "utf8");
  let headJson;
  let workingJson;

  try {
    headJson = JSON.parse(headText);
  } catch (error) {
    violations.push(`${IMAGE_TAGS_PATH}: HEAD version is not valid JSON: ${error.message}`);
    return;
  }
  try {
    workingJson = JSON.parse(workingText);
  } catch (error) {
    violations.push(`${IMAGE_TAGS_PATH}: working tree version is not valid JSON: ${error.message}`);
    return;
  }

  const imageTagViolations = collectImageTagViolations(headJson, workingJson, IMAGE_TAGS_PATH);

  if (imageTagViolations.destructive.length > 0) {
    if (allowImageTagCorrection && allowImageTagStructuralCorrection) {
      console.warn(
        [
          "WARNING: image-color-tags.json structural corrections are explicitly allowed.",
          `Affected structural/deletion/reorder checks: ${imageTagViolations.destructive.length}.`,
          "This override applies only to public/qbank/2023-test1/image-color-tags.json.",
        ].join(" "),
      );
      for (const violation of imageTagViolations.destructive.slice(0, 10)) {
        console.warn(`  allowed: ${violation}`);
      }
      if (imageTagViolations.destructive.length > 10) {
        console.warn(`  ... ${imageTagViolations.destructive.length - 10} more structural correction(s) allowed`);
      }
    } else {
      if (allowImageTagStructuralCorrection && !allowImageTagCorrection) {
        violations.push(
          "image-color-tags.json structural corrections require both --allow-image-tag-correction true and --allow-image-tag-structural-correction true.",
        );
      }
      violations.push(`${IMAGE_TAGS_PATH} has deletions or structural changes that are not allowed:`);
      for (const violation of imageTagViolations.destructive.slice(0, 50)) {
        violations.push(`  ${violation}`);
      }
      if (imageTagViolations.destructive.length > 50) {
        violations.push(`  ... ${imageTagViolations.destructive.length - 50} more violation(s) omitted`);
      }
    }
  }

  if (imageTagViolations.changedValues.length > 0) {
    if (allowImageTagCorrection) {
      console.log("image-color-tags.json value corrections allowed by --allow-image-tag-correction true.");
    } else {
      violations.push(
        "image-color-tags.json changed existing values. This is blocked unless --allow-image-tag-correction true is provided.",
      );
      for (const violation of imageTagViolations.changedValues.slice(0, 50)) {
        violations.push(`  ${violation}`);
      }
      if (imageTagViolations.changedValues.length > 50) {
        violations.push(`  ... ${imageTagViolations.changedValues.length - 50} more violation(s) omitted`);
      }
    }
  }
}

function collectImageTagViolations(baseValue, nextValue, jsonPath) {
  const out = {
    changedValues: [],
    destructive: [],
  };
  assertImageTagsSafe(baseValue, nextValue, jsonPath, out);
  return out;
}

function assertImageTagsSafe(baseValue, nextValue, jsonPath, out) {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(nextValue)) {
      out.destructive.push(`${jsonPath}: array was replaced with ${typeName(nextValue)}`);
      return;
    }
    if (nextValue.length < baseValue.length) {
      out.destructive.push(`${jsonPath}: array length shrank from ${baseValue.length} to ${nextValue.length}`);
      return;
    }
    if (isPrimitiveArray(baseValue) && hasSamePrimitiveMultiset(baseValue, nextValue.slice(0, baseValue.length))) {
      for (let index = 0; index < baseValue.length; index += 1) {
        if (!deepEqual(baseValue[index], nextValue[index])) {
          out.destructive.push(`${jsonPath}: existing array entries were reordered`);
          break;
        }
      }
    }
    for (let index = 0; index < baseValue.length; index += 1) {
      assertImageTagsSafe(baseValue[index], nextValue[index], `${jsonPath}[${index}]`, out);
    }
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(nextValue)) {
      out.destructive.push(`${jsonPath}: object was replaced with ${typeName(nextValue)}`);
      return;
    }
    for (const key of Object.keys(baseValue)) {
      if (!Object.prototype.hasOwnProperty.call(nextValue, key)) {
        out.destructive.push(`${jsonPath}.${key}: existing key was deleted`);
        continue;
      }
      assertImageTagsSafe(baseValue[key], nextValue[key], `${jsonPath}.${key}`, out);
    }
    return;
  }

  if (typeName(baseValue) !== typeName(nextValue)) {
    out.destructive.push(`${jsonPath}: existing value type changed from ${typeName(baseValue)} to ${typeName(nextValue)}`);
    return;
  }

  if (!deepEqual(baseValue, nextValue)) {
    out.changedValues.push(`${jsonPath}: existing value changed from ${JSON.stringify(baseValue)} to ${JSON.stringify(nextValue)}`);
  }
}

function isPathModified(relativePath) {
  const output = git(["diff", "--name-only", "HEAD", "--", relativePath]);
  return output.split(/\r?\n/).filter(Boolean).includes(relativePath);
}

function readHeadFile(relativePath) {
  return git(["show", `HEAD:${relativePath}`]);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseArgs() {
  const parsed = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function booleanArg(source, key, fallback = false) {
  const value = source[key];
  if (value === undefined) return fallback;
  if (value === true) return true;
  return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitiveArray(value) {
  return Array.isArray(value) && value.every((entry) => !entry || typeof entry !== "object");
}

function hasSamePrimitiveMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const entry of left) {
    const key = JSON.stringify(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const entry of right) {
    const key = JSON.stringify(entry);
    const count = counts.get(key) ?? 0;
    if (count === 0) return false;
    if (count === 1) {
      counts.delete(key);
    } else {
      counts.set(key, count - 1);
    }
  }
  return counts.size === 0;
}

function typeName(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
