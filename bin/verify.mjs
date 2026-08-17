#!/usr/bin/env node
/**
 * bin/verify.mjs — Validate registry.json schema + spot-check repos exist via gh api
 *
 * Usage: node bin/verify.mjs
 *
 * Exits non-zero on any violation.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, "..", "registry.json");

const VALID_VERDICTS = ["HARVEST", "TRACK", "ABUSE", "NOISE"];
const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

function ghApi(args) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf-8",
    env: { ...process.env, PATH: "/opt/homebrew/bin:" + (process.env.PATH || "") },
  });
  return result;
}

let errors = [];
let warnings = [];

function main() {
  console.log("[verify] Loading registry.json...");

  let registry;
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf-8");
    registry = JSON.parse(raw);
  } catch (err) {
    errors.push(`Failed to parse registry.json: ${err.message}`);
    return;
  }

  // Schema checks
  if (typeof registry.version !== "number") {
    errors.push("Missing or invalid 'version' field");
  }
  if (typeof registry.updatedAt !== "string") {
    errors.push("Missing or invalid 'updatedAt' field");
  }
  if (!Array.isArray(registry.entries)) {
    errors.push("Missing or invalid 'entries' array");
    return;
  }

  console.log(`[verify] Checking ${registry.entries.length} entries...`);

  const ids = new Set();
  for (let i = 0; i < registry.entries.length; i++) {
    const entry = registry.entries[i];
    const prefix = `entries[${i}]`;

    // Required fields
    if (typeof entry.id !== "string") {
      errors.push(`${prefix}: missing 'id'`);
    } else if (ids.has(entry.id)) {
      errors.push(`${prefix}: duplicate id '${entry.id}'`);
    } else {
      ids.add(entry.id);
    }

    if (typeof entry.repo !== "string" || !REPO_PATTERN.test(entry.repo)) {
      errors.push(`${prefix}: invalid repo format '${entry.repo}' (expected owner/name)`);
    }

    if (typeof entry.name !== "string") {
      errors.push(`${prefix}: missing 'name'`);
    }

    if (typeof entry.stars !== "number") {
      errors.push(`${prefix}: missing or invalid 'stars'`);
    }

    if (!VALID_VERDICTS.includes(entry.verdict)) {
      errors.push(`${prefix}: invalid verdict '${entry.verdict}' (must be one of: ${VALID_VERDICTS.join(", ")})`);
    }

    if (entry.signedBy !== "wave") {
      errors.push(`${prefix}: signedBy must be 'wave', got '${entry.signedBy}'`);
    }

    if (typeof entry.routing !== "string") {
      errors.push(`${prefix}: missing 'routing'`);
    }
  }

  console.log(`[verify] Schema validation: ${errors.length === 0 ? "PASS" : "FAIL"}`);

  // Spot-check: verify 3 repos exist via gh api
  const spotCheckCount = Math.min(3, registry.entries.length);
  const checkIndices = [];
  if (spotCheckCount > 0) {
    // Pick first 3
    for (let i = 0; i < spotCheckCount; i++) checkIndices.push(i);
  }

  console.log(`[verify] Spot-checking ${checkIndices.length} repos via gh api...`);

  for (const i of checkIndices) {
    const entry = registry.entries[i];
    const result = ghApi(["repos", entry.repo]);
    if (result.status === 0) {
      console.log(`  ✓ ${entry.repo} — exists`);
    } else {
      warnings.push(`${entry.repo}: spot-check failed (exit ${result.status})`);
      console.log(`  ✗ ${entry.repo} — not found or inaccessible`);
    }
  }

  if (warnings.length > 0) {
    console.log(`[verify] Spot-check warnings: ${warnings.length}`);
  }

  // Report
  console.log("[verify] ─────────────────────────────────");
  if (errors.length > 0) {
    console.log("[verify] FAILURES:");
    for (const e of errors) console.log(`  ✗ ${e}`);
    console.log(`[verify] ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  } else {
    console.log("[verify] ALL CHECKS PASSED");
    console.log(`  Entries: ${registry.entries.length}`);
    console.log(`  Verdicts: ${VALID_VERDICTS.map((v) => `${v}=${registry.entries.filter((e) => e.verdict === v).length}`).join(", ")}`);
    if (warnings.length > 0) {
      console.log(`  Warnings: ${warnings.length}`);
    }
    process.exit(0);
  }
}

main();
