import { Command } from 'commander'
import { createRequire } from 'node:module'
import { statusCommand } from './commands/status.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json')
import { configCommand } from './commands/config.js'
import { dailyCommand, saveDailyCommand } from './commands/daily.js'
import { wrappedCommand, saveWrappedCommand } from './commands/wrapped.js'
import { installCommand } from './commands/install.js'
import { uninstallCommand } from './commands/uninstall.js'

import { startupCheckCommand } from './commands/startup-check.js'
import { regenVibeCardCommand } from './commands/regen-vibe-card.js'

const program = new Command()

program
  .name('aireport')
  .description('AI-powered daily reports and wrapped summaries from your coding CLI sessions')
  .version(version)
  .addHelpText('after', `
Getting Started:
  1. Run "aireport install" to detect CLI tools and configure settings
     (use "aireport install -y --lang zh" for non-interactive / AI agent use)
  2. Run "aireport daily" to generate daily report(s)
  3. Run "aireport wrapped" to generate a Vibe Coding Wrapped summary

Typical Workflow:
  aireport install                   # interactive setup wizard
  aireport install -y --lang zh      # non-interactive: auto-detect all, Chinese
  aireport status                    # verify installation and see session counts
  aireport daily                     # generate pending daily reports (outputs LLM prompt)
  aireport daily --date 2025-01-15   # generate report for a specific date
  aireport wrapped --days 90         # generate 90-day Wrapped summary

Data & Config:
  Config file:   ~/.ai-report/config.json
  Daily reports: ~/.ai-report/reports/YYYY-MM-DD.md
  Wrapped:       ~/.ai-report/wrapped/

Supported CLI Tools: Claude Code, Gemini CLI, OpenCode, Codex
`)

program.addCommand(statusCommand)
program.addCommand(configCommand)
program.addCommand(dailyCommand)
program.addCommand(saveDailyCommand)
program.addCommand(wrappedCommand)
program.addCommand(saveWrappedCommand)
program.addCommand(installCommand)
program.addCommand(uninstallCommand)

program.addCommand(startupCheckCommand)
program.addCommand(regenVibeCardCommand)

program.showHelpAfterError(true)

// Strip bare '--' from argv so that `pnpm dev -- --help` works correctly
const argv = process.argv.filter((arg, i) => !(arg === '--' && i >= 2))
program.parse(argv)
