#!/usr/bin/env node
/**
 * bin/license-truth.mjs — Prove every package that DECLARES a license SHIPS the matching text.
 *
 * npm only auto-includes a LICENSE file that lives inside the PACKAGE directory itself — never
 * one at a monorepo root — and an explicit `files` array excludes anything not listed. A package
 * can therefore declare `"license": "MIT"` in package.json while the published tarball contains
 * no MIT text anywhere. This gate closes that gap for every package in this repo.
 *
 * Checks, per `package.json` found under packages/*:
 *   1. If the manifest declares a `license` field, a `LICENSE` file MUST exist in the same
 *      directory.
 *   2. That LICENSE file's content MUST fingerprint-match the declared SPDX id (MIT / Apache-2.0
 *      are checked against known canonical markers; any other declared id falls back to a
 *      presence-only check, logged as such — never silently treated as a pass with no evidence).
 *   3. The `files` array (if present) MUST include "LICENSE", or the matching text above will not
 *      actually ship in the published tarball.
 *
 * Third state (the reason this script exists at all): if it cannot enumerate packages, or finds
 * zero license-declaring manifests, that is NOT a pass and NOT neutral — it is a measurement
 * failure, and a measurement failure exits non-zero. A "skipped" or silently-green run here would
 * satisfy a required check without proving anything, which is the exact defect this gate is built
 * to kill.
 *
 * Usage: node bin/license-truth.mjs
 * Exits 0 only if every declaring package's shipped text matches; exits non-zero otherwise,
 * including when nothing could be measured.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const FINGERPRINTS = {
  MIT: [/MIT License/i, /Permission is hereby granted, free of charge/i],
  "Apache-2.0": [/Apache License/i, /Version 2\.0/i],
};

function gitLsFiles(pattern) {
  const result = spawnSync("git", ["ls-files", pattern], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  return result;
}

function main() {
  const errors = [];
  const infos = [];

  // --- Enumerate packages. A failure to enumerate is a measurement failure, not a pass. ---
  const lsResult = gitLsFiles("packages/*/package.json");
  if (lsResult.status !== 0 || lsResult.error) {
    console.error(
      "::error::license-truth: could not enumerate packages via `git ls-files` " +
        `(exit ${lsResult.status}, error: ${lsResult.error ?? lsResult.stderr})`,
    );
    process.exit(1);
  }

  const manifestPaths = lsResult.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (manifestPaths.length === 0) {
    console.error(
      "::error::license-truth: found zero package.json files under packages/* — cannot measure " +
        "anything. Treating an empty measurement as FAILURE, never as a pass or a skip.",
    );
    process.exit(1);
  }

  console.log(`[license-truth] enumerated ${manifestPaths.length} package manifest(s)`);

  let declaringCount = 0;

  for (const relPath of manifestPaths) {
    const absPath = join(REPO_ROOT, relPath);
    const pkgDir = dirname(absPath);
    const pkgDirRel = dirname(relPath);

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(absPath, "utf-8"));
    } catch (err) {
      errors.push(`${relPath}: failed to parse JSON (${err.message})`);
      continue;
    }

    const license = pkg.license;
    if (!license || typeof license !== "string") {
      infos.push(`${relPath}: no "license" field declared — skipping (nothing to verify)`);
      continue;
    }

    declaringCount += 1;
    const licensePath = join(pkgDir, "LICENSE");
    const licensePathRel = join(pkgDirRel, "LICENSE");

    if (!existsSync(licensePath)) {
      errors.push(
        `${relPath}: declares license "${license}" but no LICENSE file exists at ${licensePathRel}`,
      );
      continue;
    }

    const licenseText = readFileSync(licensePath, "utf-8");
    if (licenseText.trim().length === 0) {
      errors.push(`${licensePathRel}: exists but is empty`);
      continue;
    }

    const fingerprints = FINGERPRINTS[license];
    if (fingerprints) {
      const missing = fingerprints.filter((re) => !re.test(licenseText));
      if (missing.length > 0) {
        errors.push(
          `${licensePathRel}: does not match expected "${license}" text ` +
            `(missing pattern(s): ${missing.map((r) => r.source).join(", ")})`,
        );
        continue;
      }
    } else {
      infos.push(
        `${relPath}: declares unrecognized SPDX id "${license}" — verified LICENSE file is ` +
          `present and non-empty only (no fingerprint check available for this id)`,
      );
    }

    // A LICENSE file that exists but is excluded from the published tarball via `files` is the
    // exact defect this gate exists to catch.
    if (Array.isArray(pkg.files) && !pkg.files.includes("LICENSE")) {
      errors.push(
        `${relPath}: LICENSE text matches declared "${license}" but "LICENSE" is missing from ` +
          `the "files" array — the published tarball will NOT ship it`,
      );
      continue;
    }

    console.log(`[license-truth] OK  ${relPath}  (${license}) — text matches, ships via "files"`);
  }

  if (declaringCount === 0) {
    console.error(
      "::error::license-truth: enumerated packages but zero declared a \"license\" field — " +
        "cannot measure anything. Treating an empty measurement as FAILURE, never a pass or a skip.",
    );
    process.exit(1);
  }

  for (const info of infos) {
    console.log(`[license-truth] info: ${info}`);
  }

  if (errors.length > 0) {
    console.error(`[license-truth] FAILED — ${errors.length} violation(s):`);
    for (const err of errors) {
      console.error(`::error::license-truth: ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `[license-truth] PASSED — ${declaringCount} license-declaring package(s), all ship matching text`,
  );
}

main();
