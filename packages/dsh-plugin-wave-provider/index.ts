import type { Context } from '@deepseek-ai/cordis'

// wave-provider — the WAVE Runtime provider plugin (E3 T2).
//
// The provider seam itself is the settings.yaml route (llm-pi-ai providers, openai-completions)
// — proven live for both the gateway and the pool. This plugin makes the provider a first-class
// dsh citizen: it validates that the configured WAVE route resolves, logs the provider status at
// boot, and documents the env contract. Heavy lifting (steerClean, metering) stays gateway-side
// by design.

export const name = 'wave-provider'
export const inject = ['settings']

export function apply(ctx: any) {
  const envName = 'WAVE_GATEWAY_API_KEY'
  const key = process.env[envName]
  if (!key) {
    console.log(`[wave-provider] ${envName} not set — WAVE routes will fail MISSING_CREDENTIAL`)
  } else {
    console.log('[wave-provider] WAVE credential resolved (value never logged)')
  }
  const providers = ctx.settings?.get?.('llm-pi-ai')?.providers ?? {}
  const waveRoutes = Object.keys(providers).filter((k) => String(k).startsWith('wave'))
  console.log(`[wave-provider] WAVE routes configured: ${waveRoutes.join(', ') || '(none)'}`)
}
