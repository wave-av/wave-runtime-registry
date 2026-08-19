# @wave-av/dsh-plugin-wave-memory

On `turn/end`, shells out to the `entire` CLI to flush session logs into Entire-style checkpoints for cross-session memory persistence.

## Inject

No specific services required. Listens on `session/event`.

## Env contract

| Variable | Required | Default | Notes |
|---|---|---|---|
| (none) | — | — | Requires `entire` CLI installed and on `$PATH`; workspace must be Entire-enabled |

## Inert by design

This plugin probes the Entire CLI for availability only. Full checkpoint persistence is gated on the workspace being Entire-enabled and the CLI being present.
