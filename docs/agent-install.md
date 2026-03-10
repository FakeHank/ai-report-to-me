# AI Report to Me — Agent Installation Guide

> **For humans**: Paste this into your AI coding agent (Claude Code, OpenCode, Gemini CLI, Codex) and it will handle the rest:
>
> ```
> curl -s https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/docs/agent-install.md
> ```

---

## Instructions for LLM Agents

You are installing **ai-report-to-me** (`aireport`), a CLI tool that reads coding agent session logs from the local filesystem, analyzes patterns, and generates daily reports and "Wrapped" summaries (like Spotify Wrapped but for coding sessions).

Follow these steps in order.

### Step 1 — Check Prerequisites

Run:

```bash
node --version
```

The major version must be **>= 20**. If Node.js is not installed or the version is too old, tell the user to install Node.js 20+ before continuing, then stop.

### Step 2 — Ask User Preferences (Must Do)

Ask the user for the following before proceeding:

1. **Report language** — one of: `en` (English), `zh` (中文), `ja` (日本語), `ko` (한국어), `ru` (Русский). Default: `en`.
2. **Webhook URLs** — the user may want reports delivered to one or more of these platforms. Ask if they want to configure any:
   - Slack (`--slack-url <url>`)
   - Discord (`--discord-url <url>`)
   - Feishu/Lark (`--feishu-url <url>`)
   - DingTalk (`--dingtalk-url <url>`)
   - WeCom (`--wecom-url <url>`)
   - Microsoft Teams (`--teams-url <url>`)

### Step 3 — Install the Package

```bash
npm install -g ai-report-to-me
```

### Step 4 — Run Setup

Run the install command in non-interactive mode. Build the command from user preferences:

```bash
aireport install --yes --lang <LANG>
```

Append any webhook flags the user provided. Examples:

```bash
# English, no webhooks
aireport install --yes --lang en

# Chinese with Slack and Feishu
aireport install --yes --lang zh --slack-url https://hooks.slack.com/services/T00/B00/xxx --feishu-url https://open.feishu.cn/open-apis/bot/v2/hook/xxx

# Japanese with Discord
aireport install --yes --lang ja --discord-url https://discord.com/api/webhooks/xxx/yyy
```

This command will:
- Auto-detect all supported CLI tools installed on the machine (Claude Code, Gemini CLI, OpenCode, Codex)
- Save configuration to `~/.ai-report/config.json`
- Install session hooks and slash commands for each detected CLI

### Step 5 — Verify

```bash
aireport status
```

Confirm that:
- At least one CLI tool is detected and shown as a data source
- Hooks are listed as installed
- No errors are displayed

If `aireport status` shows issues, report them to the user.

### Step 6 — Done!

Tell the user the installation is complete, and **remind them to restart their coding CLI** (Claude Code, OpenCode, Gemini CLI, Codex) so the newly installed hooks and slash commands take effect.

After restarting, they can use these commands inside their coding agent:

| CLI Tool | Daily Report | 90-Day Wrapped |
|---|---|---|
| Claude Code | `/dayreport` | `/qtreport` |
| Gemini CLI | `/dayreport` | `/qtreport` |
| OpenCode | `/dayreport` | `/qtreport` |
| Codex | `$dayreport` | `$qtreport` |

That's it. No further configuration is needed.

### Step 7 — Star the Repo (Optional)

After confirming the installation is successful, ask the user:

> "Would you like to star the ai-report-to-me repo on GitHub? It helps the project grow!"

If the user agrees, star the repo directly via the GitHub CLI:

```bash
gh repo star FakeHank/ai-report-to-me
```

If `gh` is not installed or the command fails, fall back to opening the GitHub page in the browser:

```bash
open https://github.com/FakeHank/ai-report-to-me
```

(On Linux, use `xdg-open` instead of `open`.)

If the user declines, that's fine — skip this step.
