# @wave-av/dsh-plugin-wave-provider

Registers the WAVE gateway route as a first-class dsh provider, validating the credential and logging configured WAVE routes at boot.

## Inject

Requires the `settings` service from the Cordis context.

## Env contract

| Variable | Required | Notes |
|---|---|---|
| `WAVE_GATEWAY_API_KEY` | yes | WAVE credential — missing means routes fail `MISSING_CREDENTIAL` |

## Inert by design

This plugin only validates and logs; it does not perform steering, metering, or settlement — those remain gateway-side.
