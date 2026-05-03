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

  const additiveViolations = [];
  assertAdditiveOnly(headJson, workingJson, IMAGE_TAGS_PATH, additiveViolations);
  if (additiveViolations.length > 0) {
    violations.push(`${IMAGE_TAGS_PATH} is additive-only, but non-additive changes were found:`);
    for (const violation of additiveViolations.slice(0, 50)) {
      violations.push(`  ${violation}`);
    }
    if (additiveViolations.length > 50) {
      violations.push(`  ... ${additiveViolations.length - 50} more violation(s) omitted`);
    }
  }
}

function assertAdditiveOnly(baseValue, nextValue, jsonPath, out) {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(nextValue)) {
      out.push(`${jsonPath}: array was replaced with ${typeName(nextValue)}`);
      return;
    }
    if (nextValue.length < baseValue.length) {
      out.push(`${jsonPath}: array length shrank from ${baseValue.length} to ${nextValue.length}`);
      return;
    }
    for (let index = 0; index < baseValue.length; index += 1) {
      assertAdditiveOnly(baseValue[index], nextValue[index], `${jsonPath}[${index}]`, out);
    }
    return;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(nextValue)) {
      out.push(`${jsonPath}: object was replaced with ${typeName(nextValue)}`);
      return;
    }
    for (const key of Object.keys(baseValue)) {
      if (!Object.prototype.hasOwnProperty.call(nextValue, key)) {
        out.push(`${jsonPath}.${key}: existing key was deleted`);
        continue;
      }
      assertAdditiveOnly(baseValue[key], nextValue[key], `${jsonPath}.${key}`, out);
    }
    return;
  }

  if (!deepEqual(baseValue, nextValue)) {
    out.push(`${jsonPath}: existing value changed from ${JSON.stringify(baseValue)} to ${JSON.stringify(nextValue)}`);
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

function typeName(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
