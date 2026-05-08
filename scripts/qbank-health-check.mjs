#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

import {
  REPORTS_DIR,
  ROOT,
  fileExists,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const REPORT_JSON_PATH = path.join(REPORTS_DIR, "qbank-health-check.json");
const REPORT_MD_PATH = path.join(REPORTS_DIR, "qbank-health-check.md");
const startedAt = new Date();

const checks = [
  {
    id: "qbank-integrity",
    label: "QBank integrity audit",
    command: "npm",
    args: ["run", "audit-qbank-integrity"],
    reportPath: path.join(REPORTS_DIR, "qbank-integrity-audit.json"),
    summarize: summarizeIntegrityAudit,
  },
  {
    id: "missing-qid-backfill",
    label: "Missing-QID backfill system audit",
    command: "node",
    args: ["scripts/audit-missing-qid-backfill-system.mjs"],
    reportPath: path.join(REPORTS_DIR, "missing-qid-backfill-system-audit.json"),
    summarize: summarizeMissingQidAudit,
  },
  {
    id: "phase-status",
    label: "QBank phase status audit",
    command: "node",
    args: ["scripts/audit-qbank-system-phase-status.mjs"],
    reportPath: path.join(REPORTS_DIR, "qbank-system-phase-status.json"),
    summarize: summarizePhaseStatusAudit,
  },
  {
    id: "workflow-command-index",
    label: "QBank workflow command index",
    command: "node",
    args: ["scripts/audit-qbank-workflow-commands.mjs"],
    reportPath: path.join(REPORTS_DIR, "qbank-workflow-command-index.json"),
    summarize: summarizeWorkflowCommandIndex,
  },
  {
    id: "production-build",
    label: "Production build",
    command: "npm",
    args: ["run", "build"],
    reportPath: null,
    summarize: () => ({ blockers: [], warnings: [], metrics: { build: "command-exit-code" } }),
  },
];

const report = {
  generatedAt: startedAt.toISOString(),
  finishedAt: null,
  durationMs: null,
  finalStatus: "failed",
  stoppedEarly: false,
  stopReason: null,
  checksRequested: checks.map((check) => ({
    id: check.id,
    command: commandText(check),
  })),
  checks: [],
  blockers: [],
  warnings: [],
  reportPaths: {
    json: relative(REPORT_JSON_PATH),
    markdown: relative(REPORT_MD_PATH),
  },
};

try {
  for (const check of checks) {
    console.log(`Running: ${commandText(check)}`);
    const result = await runCheck(check);
    report.checks.push(result);
    report.blockers.push(...result.blockers.map((message) => ({ checkId: check.id, message })));
    report.warnings.push(...result.warnings.map((message) => ({ checkId: check.id, message })));

    if (result.exitCode !== 0) {
      report.stoppedEarly = true;
      report.stopReason = `${check.id} exited with code ${result.exitCode}`;
      await finalizeAndWriteReport("failed");
      process.exitCode = 1;
      break;
    }

    if (result.criticalFailure) {
      report.stoppedEarly = true;
      report.stopReason = `${check.id} reported critical blocker(s)`;
      await finalizeAndWriteReport("failed");
      process.exitCode = 1;
      break;
    }

    await writeCurrentReport();
  }

  if (!report.stoppedEarly) {
    await finalizeAndWriteReport(report.blockers.length === 0 ? "passed" : "failed");
    if (report.finalStatus !== "passed") {
      process.exitCode = 1;
    }
  }
} catch (error) {
  report.blockers.push({
    checkId: "qbank-health-check",
    message: error?.stack || String(error),
  });
  report.stoppedEarly = true;
  report.stopReason = "health check threw an exception";
  await finalizeAndWriteReport("failed");
  process.exitCode = 1;
}

console.log(`QBank health check: ${report.finalStatus}`);
console.log(`Report: ${relative(REPORT_JSON_PATH)}`);

async function runCheck(check) {
  const started = new Date();
  const execution = await runCommand(check.command, check.args);
  const finished = new Date();
  const outputSummary = summarizeOutput(execution.stdout, execution.stderr);
  let parsedReport = null;
  let parsedSummary = { blockers: [], warnings: [], metrics: {} };
  const blockers = [];
  const warnings = [];

  if (check.reportPath) {
    if (fileExists(check.reportPath)) {
      parsedReport = readJson(check.reportPath);
      parsedSummary = check.summarize(parsedReport);
      blockers.push(...parsedSummary.blockers);
      warnings.push(...parsedSummary.warnings);
    } else {
      blockers.push(`Expected report was not written: ${relative(check.reportPath)}`);
    }
  } else {
    parsedSummary = check.summarize(null);
  }

  if (execution.exitCode !== 0) {
    blockers.push(`Command exited with code ${execution.exitCode}.`);
  }

  const criticalFailure = blockers.some((message) => /critical|blocker|exited|not written/i.test(message));

  return {
    id: check.id,
    label: check.label,
    command: commandText(check),
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    exitCode: execution.exitCode,
    signal: execution.signal,
    reportPath: check.reportPath ? relative(check.reportPath) : null,
    outputSummary,
    blockers,
    warnings,
    metrics: parsedSummary.metrics,
    criticalFailure,
  };
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode, signal, stdout, stderr });
    });
  });
}

function summarizeIntegrityAudit(audit) {
  const criticalBlockers = Number(audit?.summary?.criticalBlockers ?? audit?.criticalBlockers?.length ?? 0);
  const warnings = Number(audit?.summary?.warnings ?? audit?.warnings?.length ?? 0);
  return {
    blockers: criticalBlockers > 0 ? [`QBank integrity critical blockers: ${criticalBlockers}`] : [],
    warnings: warnings > 0 ? [`QBank integrity warnings: ${warnings}`] : [],
    metrics: {
      masterQids: audit?.summary?.masterQids ?? null,
      rawQids: audit?.summary?.rawQids ?? null,
      criticalBlockers,
      warnings,
      missingImageAssets: audit?.summary?.missingImageAssets ?? null,
    },
  };
}

function summarizeMissingQidAudit(audit) {
  const blockerEntries = (audit?.remainingBlockers ?? []).filter((entry) => entry.severity === "blocker");
  const riskEntries = (audit?.remainingBlockers ?? []).filter((entry) => entry.severity !== "blocker");
  return {
    blockers: blockerEntries.map((entry) => entry.issue),
    warnings: riskEntries.map((entry) => entry.issue),
    metrics: {
      recommendation: audit?.recommendation ?? null,
      masterQids: audit?.master?.qidCount ?? null,
      languages: Object.fromEntries(Object.entries(audit?.coverage ?? {}).map(([lang, entry]) => [lang, {
        coveragePercent: entry.coveragePercent,
        missingQids: entry.missingQids?.length ?? 0,
        extraQids: entry.extraQids?.length ?? 0,
      }])),
    },
  };
}

function summarizePhaseStatusAudit(audit) {
  const criticalBlockers = Number(audit?.summary?.criticalBlockersCount ?? 0);
  const phaseBlockers = (audit?.phases ?? []).flatMap((phase) => (phase.blockers ?? []).map((blocker) => `${phase.phase}: ${blocker}`));
  const phaseWarnings = (audit?.phases ?? []).flatMap((phase) => (phase.warnings ?? []).map((warning) => `${phase.phase}: ${warning}`));
  return {
    blockers: [
      ...(criticalBlockers > 0 ? [`Phase status critical blockers: ${criticalBlockers}`] : []),
      ...phaseBlockers,
    ],
    warnings: phaseWarnings,
    metrics: {
      recommendedNextPhase: audit?.summary?.recommendedNextPhase ?? null,
      criticalBlockers,
      phaseStatuses: Object.fromEntries((audit?.phases ?? []).map((phase) => [phase.phase, phase.status])),
    },
  };
}

function summarizeWorkflowCommandIndex(index) {
  const dangerous = Number(index?.summary?.dangerousProductionEditCount ?? 0);
  const unknown = Number(index?.summary?.unknownReviewNeededCount ?? 0);
  return {
    blockers: [],
    warnings: [
      ...(dangerous > 0 ? [`Dangerous production-edit scripts tracked: ${dangerous}`] : []),
      ...(unknown > 0 ? [`Workflow scripts still unknown-review-needed: ${unknown}`] : []),
    ],
    metrics: {
      scriptsAudited: index?.summary?.scriptsAudited ?? null,
      activeProductionCount: index?.summary?.activeProductionCount ?? null,
      activeReviewWorkflowCount: index?.summary?.activeReviewWorkflowCount ?? null,
      dangerousProductionEditCount: dangerous,
      unknownReviewNeededCount: unknown,
    },
  };
}

function summarizeOutput(stdout, stderr) {
  return {
    stdoutTail: tailLines(stdout, 30),
    stderrTail: tailLines(stderr, 30),
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
  };
}

function tailLines(value, count) {
  const lines = String(value ?? "").trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-count);
}

async function finalizeAndWriteReport(status) {
  report.finalStatus = status;
  report.finishedAt = new Date().toISOString();
  report.durationMs = new Date(report.finishedAt).getTime() - startedAt.getTime();
  await writeCurrentReport();
}

async function writeCurrentReport() {
  await writeJson(REPORT_JSON_PATH, report);
  await writeText(REPORT_MD_PATH, renderMarkdown(report));
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# QBank Health Check", "");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Finished: ${data.finishedAt ?? "in-progress"}`);
  lines.push(`Final status: ${data.finalStatus}`);
  lines.push(`Duration: ${data.durationMs ?? "in-progress"} ms`);
  lines.push(`Stopped early: ${data.stoppedEarly ? "yes" : "no"}`);
  if (data.stopReason) lines.push(`Stop reason: ${data.stopReason}`);
  lines.push("");
  lines.push("## Checks", "");
  lines.push("| Check | Exit | Duration ms | Blockers | Warnings |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const check of data.checks) {
    lines.push(`| ${escapeCell(check.label)} | ${check.exitCode} | ${check.durationMs} | ${check.blockers.length} | ${check.warnings.length} |`);
  }
  lines.push("");
  lines.push("## Blockers", "");
  if (data.blockers.length === 0) {
    lines.push("None.");
  } else {
    for (const blocker of data.blockers) lines.push(`- ${blocker.checkId}: ${blocker.message}`);
  }
  lines.push("");
  lines.push("## Warnings", "");
  if (data.warnings.length === 0) {
    lines.push("None.");
  } else {
    for (const warning of data.warnings.slice(0, 100)) lines.push(`- ${warning.checkId}: ${warning.message}`);
    if (data.warnings.length > 100) lines.push(`- ... ${data.warnings.length - 100} more warnings omitted from markdown`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function commandText(check) {
  return [check.command, ...check.args].join(" ");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
