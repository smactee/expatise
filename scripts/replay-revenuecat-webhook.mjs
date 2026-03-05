#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/replay-revenuecat-webhook.mjs [payload.json]",
      "",
      "Env vars:",
      "  REVENUECAT_WEBHOOK_URL   Required. Full webhook URL.",
      "  REVENUECAT_WEBHOOK_AUTH  Optional. Raw secret or full 'Bearer ...' value.",
      "",
      "Examples:",
      "  REVENUECAT_WEBHOOK_URL='https://<ref>.functions.supabase.co/revenuecat-webhook' \\",
      "  REVENUECAT_WEBHOOK_AUTH='your-secret' \\",
      "  node scripts/replay-revenuecat-webhook.mjs scripts/fixtures/revenuecat-webhook.sample.json",
    ].join("\n")
  );
}

function toAuthHeader(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^bearer\s+/i.test(raw)) return raw;
  return `Bearer ${raw}`;
}

async function main() {
  const arg = process.argv[2];
  if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  }

  const payloadPath = arg || "scripts/fixtures/revenuecat-webhook.sample.json";
  const webhookUrl = String(process.env.REVENUECAT_WEBHOOK_URL ?? "").trim();
  const authValue = String(process.env.REVENUECAT_WEBHOOK_AUTH ?? "").trim();

  if (!webhookUrl) {
    console.error("Missing REVENUECAT_WEBHOOK_URL.");
    usage();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), payloadPath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const payload = JSON.parse(raw);

  const headers = {
    "content-type": "application/json",
  };
  const authHeader = toAuthHeader(authValue);
  if (authHeader) headers.authorization = authHeader;

  console.log(`POST ${webhookUrl}`);
  console.log(`payload: ${resolvedPath}`);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text
  }

  console.log(`status: ${res.status}`);
  if (parsed) {
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    console.log(text);
  }

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
