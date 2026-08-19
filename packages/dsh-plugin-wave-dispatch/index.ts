import type { Context } from '@deepseek-ai/cordis'

// wave-dispatch — out-of-process subagent provider delegating to the WAVE local pool (E3 T6).
//
// Implements the SubagentProvider seam (dsh-subagent types). The pool contract (measured
// 2026-08-17, frontdoor.py): POST /v1/subagent {model, prompt: string, tools?: string[], system?}
// -> compact digest. The route is armed via WAVE_DOOR_SUBAGENT=1 (404 otherwise).

export const name = 'wave-dispatch'
export const inject = ['subagents']

export function apply(ctx: Context) {
  const poolUrl = process.env.WAVE_POOL_URL || 'http://jakes-mac-studio.tail2cd79a.ts.net:8800'
  const poolModel = process.env.WAVE_POOL_MODEL || 'deepcoder:14b'

  ctx.subagents?.registerProvider({
    name: 'wave-pool',
    capabilities: {
      outputSchema: false,
      depthLimit: false,
      toolFilter: false,
      persona: false,
    },
    inheritsParentContext: false,
    async start(request: any) {
      const runId = `wave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const abort = new AbortController()
      const onAbort = () => abort.abort()
      request.signal?.addEventListener('abort', onAbort)

      const promptText = Array.isArray(request.prompt)
        ? request.prompt.map((b: any) => (b?.text ? b.text : JSON.stringify(b))).join('\n')
        : String(request.prompt ?? '')

      const result = (async () => {
        try {
          const res = await fetch(`${poolUrl}/v1/subagent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: poolModel, prompt: promptText }),
            signal: abort.signal,
          })
          if (!res.ok) return { output: [], stopReason: 'error' }
          const data = (await res.json()) as { digest?: string; error?: string }
          if (data.error) return { output: [], stopReason: 'error' }
          return {
            output: data.digest ? [{ type: 'text', text: data.digest }] : [],
            stopReason: 'completed',
          }
        } catch {
          return { output: [], stopReason: abort.signal.aborted ? 'aborted' : 'error' }
        } finally {
          request.signal?.removeEventListener('abort', onAbort)
        }
      })()

      return {
        id: runId,
        localAgent: undefined,
        result,
        async dispose() {
          abort.abort()
        },
      }
    },
  })
  console.log(`[wave-dispatch] registered wave-pool provider at ${poolUrl} (model ${poolModel})`)
}
