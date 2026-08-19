# @wave-av/dsh-plugin-wave-pay

Sidecar meter that appends usage-bearing session events to `wave-meter.jsonl` for observability — **INERT by design: zero charges, zero Stripe/x402 calls**.

## Inject

No specific services required. Listens on `session/event`.

## Env contract

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DSH_HOME` | no | `~/.dsh` | Directory for the meter file |

## Inert by design

This plugin writes meter lines only. Settlement and payment remain gateway-side concerns — the paid rail is never invoked from the dsh side.
