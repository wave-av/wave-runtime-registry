import type { Context } from '@deepseek-ai/cordis'

// wave-mail — dsh tool that sends email through the WAVE AgentMail inbox rail (E3 T4).
//
// Proven recipe (2026-08-16, live): create a draft + POST /v0/inboxes/<inbox>/drafts/<id>/send
// with the inbox-scoped AgentMail key. This plugin registers a `wave_mail_send` tool on the
// harness tool registry. The key resolves from env only (AGENTMAIL_API_KEY_OPENCODE) — never a
// literal.

export const name = 'wave-mail'
export const inject = ['tools']

export function apply(ctx: any) {
  const inbox = process.env.WAVE_MAIL_INBOX || 'opencode@agents.wave.online'
  const keyEnv = process.env.WAVE_MAIL_KEY_ENV || 'AGENTMAIL_API_KEY_OPENCODE'
  const apiBase = 'https://api.agentmail.to/v0'

  ctx.tools.register({
    name: 'wave_mail_send',
    description: 'Send an email from the WAVE agent inbox. Returns message and thread ids.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string' },
        text: { type: 'string', description: 'Plain text body' },
      },
      required: ['to', 'subject', 'text'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          sent: { type: 'boolean' },
          message_id: { type: 'string' },
          thread_id: { type: 'string' },
        },
      },
      render: (result: any) => (typeof result === 'string' ? result : JSON.stringify(result)),
    },
    execute: async (args: any) => {
      const key = process.env[keyEnv]
      if (!key) throw new Error(`[wave-mail] ${keyEnv} not set`)
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${key}` }
      const draft = await fetch(`${apiBase}/inboxes/${inbox}/drafts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: [args.to], subject: args.subject, text: args.text }),
      })
      if (!draft.ok) throw new Error(`[wave-mail] draft failed: ${draft.status}`)
      const d = (await draft.json()) as { draft_id?: string; id?: string }
      const draftId = d.draft_id || d.id
      if (!draftId) throw new Error('[wave-mail] no draft id in response')
      const sent = await fetch(`${apiBase}/inboxes/${inbox}/drafts/${draftId}/send`, {
        method: 'POST',
        headers,
      })
      if (!sent.ok) throw new Error(`[wave-mail] send failed: ${sent.status}`)
      const s = (await sent.json()) as { message_id?: string; thread_id?: string }
      return JSON.stringify({ sent: true, message_id: s.message_id, thread_id: s.thread_id })
    },
  })
  console.log(`[wave-mail] registered wave_mail_send (inbox ${inbox}, key env ${keyEnv})`)
}
