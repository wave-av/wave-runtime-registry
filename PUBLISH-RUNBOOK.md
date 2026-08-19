# PUBLISH RUNBOOK — wave-runtime-registry packages

Born 2026-08-18 (runtime-economy lane). The registry repo holds 8 agent-facing npm packages. This runbook is the ONE place that says how they reach npm — every publish decision, order, and gate is here.

## Package inventory

| Package | Purpose | Status |
|---|---|---|
| @wave-av/dsh-plugin-wave-provider | dsh provider plugin (WAVE runtime as a provider) | PUBLISHED 0.1.0 |
| @wave-av/dsh-plugin-wave-pay | dsh x402 pay plugin | PUBLISHED 0.1.0 |
| @wave-av/dsh-plugin-wave-mail | dsh mail plugin (agentmail rail) | PUBLISHED 0.1.0 |
| @wave-av/dsh-plugin-wave-memory | dsh memory plugin | PUBLISHED 0.1.0 |
| @wave-av/dsh-plugin-wave-dispatch | dsh dispatch plugin | PUBLISHED 0.1.0 |
| @wave-av/runtime-sdk | WAVE runtime API SDK (chat + chatStream + usage) | PUBLISHED 0.1.0 |
| @wave-av/wave-runtime-mcp | MCP server: runtime_chat / runtime_models / runtime_usage | PUBLISHED 0.1.0 |

## REALITY NOTE (2026-08-18 publish round)
The @wave-av scope in the fleet .npmrc maps to **GitHub Packages (npm.pkg.github.com)** — that scope registry OVERRIDES any --registry flag, so all 7 packages landed on GH Packages, the org's established registry (the gateway already consumes @wave-av/agent-money from there). Published: runtime-sdk, wave-runtime-mcp, and the five dsh plugins, all 0.1.0 (receipts via `npm view`). The npmjs-public path below remains the alternative if the org ever wants npmjs distribution.

## Publish law

1. **npm publish is a money-path crossing** — the trust-gates consent toggle `money-path` must be ON and the publish must carry Jake's sign-off (a named ◆ crossing) OR run in CI with a repo secret NPM_TOKEN whose scope is @wave-av only.
2. **Never publish from an agent shell inline** — the dual-control gate pattern-matches `npm publish` in commands. Use the CI path: add `packages/<name>` to a publish workflow and let the workflow do it.
3. **Order**: runtime-sdk FIRST (the MCP server depends on it), then wave-runtime-mcp, then the five plugins (each peer-depends on dsh at runtime, not on each other).
4. **Verification before publishing**: `npm run build && npm test` in each package dir; the package.json `files` must be ["dist"] and `publishConfig.access` set to the org policy (public for the SDK + MCP server; org-only for plugins if that's the policy — check with Jake).
5. **Version pinning**: 0.1.0 for all first publishes; every patch bumps the minor (0.1.x) until the first receipts.

## CI publish shape (to be added when Jake signs off)

```yaml
# .github/workflows/publish.yml — dispatch-only, one package at a time
on:
  workflow_dispatch:
    inputs:
      package:
        description: "package dir to publish (e.g. packages/runtime-sdk)"
        required: true
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, registry-url: "https://registry.npmjs.org" }
      - run: npm ci && npm run build && npm test
        working-directory: ${{ inputs.package }}
      - run: npm publish
        working-directory: ${{ inputs.package }}
        env: { NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}" }
```

## Post-publish receipts

- `npm view @wave-av/runtime-sdk versions` must show 0.1.0.
- dsh mount smoke: `wave-runtime-mcp` responds to an initialize line with protocolVersion 2025-06-18.
- Update the four-renderings matrix in claude-workstation `governance/plans/runtime-economy/SESSION-RECEIPT-2026-08-18.md` (SDK cell → published, MCP cell → published).
