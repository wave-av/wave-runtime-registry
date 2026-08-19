# @wave-av/dsh-plugin-wave-mail

Registers a `wave_mail_send` tool on the dsh harness tool registry, sending email through the WAVE AgentMail inbox rail.

## Inject

Requires the `tools` service from the Cordis context.

## Env contract

| Variable | Required | Default | Notes |
|---|---|---|---|
| `WAVE_MAIL_INBOX` | no | `opencode@agents.wave.online` | AgentMail inbox address |
| `WAVE_MAIL_KEY_ENV` | no | `AGENTMAIL_API_KEY_OPENCODE` | Name of the env var holding the inbox-scoped API key (key resolved from env only, never inlined) |

## Inert by design

Sends email through AgentMail's draft+send flow only. No payment or billing action is taken by this plugin.
