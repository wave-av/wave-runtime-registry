#!/usr/bin/env node
/**
 * bin/sweep.mjs — Idempotent sweep of top-30 dsh-plugin repos into registry.json
 *
 * Usage: node bin/sweep.mjs [--dry-run]
 *
 * Merges top-30 repos (by stars, topic:dsh-plugin) into registry.json.
 * Existing entries keep their verdict; new entries default to NOISE.
 * No external deps — uses `gh api` via spawnSync.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, "..", "registry.json");
const DRY_RUN = process.argv.includes("--dry-run");

const VERDICT_ENUM = ["HARVEST", "TRACK", "ABUSE", "NOISE"];

function ghApi(args) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf-8",
    env: { ...process.env, PATH: "/opt/homebrew/bin:" + (process.env.PATH || "") },
  });
  if (result.error) throw new Error(`gh api failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`gh api exited ${result.status}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function loadRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
}

function saveRegistry(registry) {
  registry.updatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
}

function main() {
  console.log(`[sweep] Dry run: ${DRY_RUN}`);
  console.log(`[sweep] Searching topic:dsh-plugin sorted by stars (top 30)...`);

  const data = ghApi([
    "search/repositories?q=topic:dsh-plugin&sort=stars&order=desc&per_page=30",
  ]);

  const repos = data.items || [];
  console.log(`[sweep] Found ${repos.length} repos from GitHub API`);

  const registry = loadRegistry();
  const existingIds = new Set(registry.entries.map((e) => e.id));
  const now = new Date().toISOString().slice(0, 10);

  let added = 0;
  let updated = 0;

  for (const repo of repos) {
    const repoName = repo.full_name;
    const id = `wave:${repoName}`;
    const entry = {
      id,
      repo: repoName,
      name: repo.name,
      description: (repo.description || "").slice(0, 200),
      stars: repo.stargazers_count,
      starsMeasuredAt: now,
      verdict: existingIds.has(id) ? undefined : "NOISE",
      routing: "default",
      signedBy: "wave",
    };

    if (existingIds.has(id)) {
      // Existing entry: only update stars, keep verdict
      const existing = registry.entries.find((e) => e.id === id);
      existing.stars = repo.stargazers_count;
      existing.starsMeasuredAt = now;
      updated++;
    } else {
      registry.entries.push(entry);
      added++;
    }
  }

  console.log(`[sweep] Added ${added} new entries, updated ${updated} existing entries`);
  console.log(`[sweep] Total entries: ${registry.entries.length}`);

  if (DRY_RUN) {
    console.log("[sweep] Dry run — not writing registry.json");
    console.log("[sweep] Would-add entries:");
    for (const repo of repos) {
      const id = `wave:${repo.full_name}`;
      if (!existingIds.has(id)) {
        console.log(`  - ${id} (${repo.stargazers_count} stars, verdict: NOISE)`);
      }
    }
  } else {
    saveRegistry(registry);
    console.log("[sweep] Registry written to registry.json");
  }
}

try {
  main();
  console.log("[sweep] Done — exit 0");
  process.exit(0);
} catch (err) {
  console.error("[sweep] Fatal:", err.message);
  process.exit(1);
}
