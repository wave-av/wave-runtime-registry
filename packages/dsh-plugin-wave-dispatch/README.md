# @wave-av/dsh-plugin-wave-dispatch

Registers a `wave-pool` subagent provider that delegates to the WAVE local pool via POST `/v1/subagent`.

## Inject

Requires the `subagents` service from the Cordis context.

## Env contract

| Variable | Required | Default | Notes |
|---|---|---|---|
| `WAVE_POOL_URL` | no | `{env:WAVE_POOL_URL}` — the pool frontdoor is INTERNAL; never hardcode a tailnet URL | Pool frontdoor URL |
| `WAVE_POOL_MODEL` | no | `deepcoder:14b` | Model identifier sent to the pool |

## Inert by design

This plugin is a client of the pool's subagent endpoint. It does not perform model hosting, inference, or billing — those are pool-side concerns.

## Roadmap note (rc.7, 2026-08-17)

rc.7 ships ACP (`@deepseek-ai/dsh-acp`). The upgrade path: replace the HTTP /v1/subagent call
with an ACP child session (session/new + prompt over stdio) — out-of-process children become
trace-enumerable and gain session/request_permission. Blocked only on the vLLM content flake
(root-cause receipts in BRIDGE-FINDINGS.md); the HTTP pool contract remains the working fallback.
