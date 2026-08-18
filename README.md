# WAVE Runtime Registry

WAVE's curated index of the dsh-plugin ecosystem — the governed registry for agent-harness plugins (public, 2026-08-17).

The governed index of the agent-harness plugin ecosystem (repos tagged `dsh-plugin`). Every entry carries measured stars and a WAVE verdict — HARVEST, TRACK, ABUSE, or NOISE — so adopters see a curated view instead of raw topic results.

## What this is

A curated registry of dsh-plugin ecosystem repos. Each entry carries a verdict (HARVEST / TRACK / ABUSE / NOISE) that tells WAVE's dispatch system how to route signals from that repo. This is not a package manager — it's a routing table.

## Verdict rubric

| Verdict | Meaning |
|---------|---------|
| **HARVEST** | High-value repo — actively mine for patterns, APIs, and reusable ideas |
| **TRACK** | Worth monitoring — signals may become harvestable over time |
| **ABUSE** | Known abuse vector — route away, do not auto-integrate |
| **NOISE** | Low signal — default for newly discovered repos until human review |

## How sweep works

```bash
node bin/sweep.mjs          # live sweep — merges top-30 into registry.json
node bin/sweep.mjs --dry-run # preview without writing
```

- Queries GitHub API: `topic:dsh-plugin`, sorted by stars, top 30
- **Idempotent**: existing entries keep their verdict; new entries default to NOISE
- Updates `starsMeasuredAt` for all entries on each sweep

## How verify works

```bash
node bin/verify.mjs
```

- Validates schema: verdict enum, repo format (`owner/name`), `signedBy === "wave"`
- Spot-checks 3 repos resolve via `gh api repos/<owner>/<repo>`
- Exits non-zero on any violation — runs in CI on push/PR

## CI

GitHub Actions runs `node bin/verify.mjs` on every push and PR to `main`.

## Status: PUBLIC (2026-08-17, operator-approved)

The index is public. Entries carry measured stars + WAVE verdicts (HARVEST / TRACK / ABUSE /
NOISE). Metered serving via WAVE's x402 rail and signed-verification listings are the roadmap;
until they ship, this repo is the index of record — sweep (top-30 merge) + CI verify on every
push.

## File structure

```
registry.json              # the index (schema v1)
bin/sweep.mjs              # idempotent GitHub API sweep
bin/verify.mjs             # schema + spot-check validator
.github/workflows/verify.yml  # CI gate
README.md                  # this file
```
