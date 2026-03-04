<p align="center">
  <h1 align="center">AI Report to Me</h1>
  <p align="center">
    <strong>Let your coding agent report to you.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/ai-report-to-me"><img src="https://img.shields.io/npm/v/ai-report-to-me" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/FakeHank/ai-report-to-me" alt="license"></a>
    <a href="./package.json"><img src="https://img.shields.io/node/v/ai-report-to-me" alt="node version"></a>
    <br>
    English | <a href="./README.zh-CN.md">中文</a>
  </p>
</p>

`aireport` reads your local coding agent session logs, analyzes patterns, and generates **daily reports** and **90-day Wrapped summaries** — complete with friction analysis, habit profiling, and a "Vibe Coder" personality type.

It works with **Claude Code**, **Gemini CLI**, **OpenCode**, and **Codex**. All data stays on your machine.

## Features

- **Daily Reports** — Structured summaries of what you built, what broke, and what you learned. Includes "Experience Slices": distilled problem-solving stories with transferable insights.
- **90-Day Wrapped** — A Spotify Wrapped-style retrospective with session stats, hourly heatmaps, top projects, and a "Vibe Coder" personality classification (e.g. *Night Ghost*, *Flash Raider*, *Refactor Addict*).
- **Friction Detection** — Automatically identifies retry loops, error cascades, and direction switches in your sessions.
- **Startup Reminders** — Claude Code's SessionStart hook nudges you to generate yesterday's report. OpenCode gets a custom `ai_report_check` tool you can invoke in chat.
- **Webhook Push** — Send reports to Slack, Discord, Feishu, DingTalk, WeCom, or Microsoft Teams.
- **Multi-Language** — Reports generated in English, Chinese, Japanese, Korean, or Russian.

## Quick Start

**Highly Recommended: paste this into your coding agent** 

(Claude Code, Gemini CLI, OpenCode, or Codex) and let it handle everything:

```
Install and configure ai-report-to-me by following the instructions here:
curl -s https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/docs/agent-install.md
```

The agent will read the guide, ask for your preferences (language, webhooks), install the package, and configure hooks automatically.

Or install manually:

```bash
curl -fsSL https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/scripts/install.sh | bash
```

Once installed, use the built-in commands directly in your coding agent session:

| CLI Tool | Daily Report | 90-Day Wrapped |
|---|---|---|
| Claude Code | `/dayreport` | `/qtreport` |
| Gemini CLI | `/dayreport` | `/qtreport` |
| OpenCode | `/dayreport` | `/qtreport` |
| Codex | `$dayreport` | `$qtreport` |

## How It Works

```
┌─────────────┐     ┌───────────────┐     ┌────────────┐     ┌───────────┐
│   Adapters   │────▶│  Aggregator   │────▶│  Analyzers  │────▶│  Renderer  │
│              │     │               │     │             │     │           │
│ Claude Code  │     │ Group by day  │     │ Friction    │     │ Markdown  │
│ Gemini CLI   │     │ Project stats │     │ Habits      │     │ Vibe Card │
│ OpenCode     │     │ Token usage   │     │ Vibe Type   │     │ Webhooks  │
│ Codex        │     │ Tool calls    │     │ Suggestions │     │           │
└─────────────┘     └───────────────┘     └────────────┘     └───────────┘
```

1. **Adapters** parse session logs from each CLI tool into a normalized format
2. **Aggregator** groups sessions by date and computes per-project breakdowns
3. **Analyzers** detect friction patterns, classify coding habits, and extract personality signals
4. **Renderer** produces Markdown reports (with LLM-generated narrative) and PNG vibe cards

Reports are saved to `~/.ai-report/reports/` with embedded metadata for incremental regeneration — only new sessions trigger a rebuild.

## Supported CLIs

| CLI Tool | Session Source | Hook Support | Notes |
|---|---|---|---|
| [Claude Code](https://claude.ai/code) | `~/.claude/projects/` | Full | SessionStart hook (startup check) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `~/.gemini/tmp/` | None | Session data read directly |
| [OpenCode](https://github.com/opencode-ai/opencode) | `~/.local/share/opencode/opencode.db` | Partial | Plugin with custom `ai_report_check` tool |
| [Codex](https://github.com/openai/codex) | `~/.codex/sessions/` | None | Session data read directly |

## CLI Reference

```
aireport install           # interactive setup (select sources, language, webhooks)
aireport daily             # generate daily report(s)
aireport daily --date 2026-02-28   # generate for a specific date
aireport wrapped           # generate 90-day Wrapped
aireport wrapped --days 30         # custom period
aireport status            # show installation status and session stats
aireport config            # manage configuration
aireport uninstall         # remove hooks and clean up
```

## Configuration

Configuration lives at `~/.ai-report/config.json` and is created during `aireport install`:

```jsonc
{
  "output_lang": "en",           // en | zh | ja | ko | ru
  "sources": ["claude-code"],    // which CLIs to read from
  "daily_reminder": true,        // show startup reminder in Claude Code
  "backfill_limit": 7,           // days to look back for pending reports
  "privacy_mode": false,         // redact file paths and content in reports
  "wrapped_days": 90,            // default period for Wrapped
  "webhooks": {
    "slack_url": "",             // Slack Incoming Webhook URL
    "discord_url": "",           // Discord Webhook URL
    "feishu_url": "",            // Feishu/Lark Bot Webhook URL
    "dingtalk_url": "",          // DingTalk Robot Webhook URL
    "wecom_url": "",             // WeCom/WeChat Work Bot URL
    "teams_url": ""              // Microsoft Teams Webhook URL
  }
}
```

## Webhooks

When a webhook URL is configured, reports are automatically pushed after generation. Each platform gets a native-formatted message:

| Platform | Format |
|---|---|
| Slack | Block Kit |
| Discord | Embeds |
| Feishu / Lark | Interactive Card |
| DingTalk | ActionCard |
| WeCom | Markdown |
| Microsoft Teams | Adaptive Card |

## Data & Privacy

All session data is read from your local filesystem and never leaves your machine. Reports are stored locally at `~/.ai-report/`. The optional `privacy_mode` setting redacts file paths and code content from report data before it reaches the LLM.

Webhooks send the *generated report text* (not raw session data) to your configured endpoints.

## Contributing

```bash
git clone https://github.com/FakeHank/ai-report-to-me.git
cd ai-report-to-me
pnpm install
pnpm dev -- status         # run any CLI command in dev mode
pnpm test                  # run tests
pnpm typecheck             # type-check without emitting
```

The codebase is ESM-only TypeScript (Node 20+, strict mode). Tests use Vitest.

## License

[MIT](./LICENSE)
