import { Command } from 'commander'
import Enquirer from 'enquirer'
import { loadConfig, saveConfig, type Config } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'

const { prompt } = Enquirer

export const installCommand = new Command('install')
  .description('Interactive setup wizard')
  .action(async () => {
    logger.bold('AI Report to Me · Setup Wizard\n')

    const registry = getRegistry()
    const detectResults = await registry.detectAll()
    const detected = detectResults.filter((r) => r.installed)

    if (detected.length === 0) {
      logger.error('No supported CLI tools detected.')
      logger.info('Supported: Claude Code, Gemini CLI, OpenCode, Codex')
      return
    }

    // Step 1: Show detected CLIs
    logger.info('Detected CLI tools:')
    for (const r of detected) {
      logger.success(`  ${r.name}: ${r.sessionCount} sessions`)
    }
    console.log()

    // Step 2: Select data sources
    const sourceChoices = detected.map((r) => ({
      name: r.name,
      message: `${r.name} (${r.sessionCount} sessions)`,
      value: r.name,
    }))

    let selectedSources: string[]
    if (detected.length === 1) {
      selectedSources = [detected[0].name]
      logger.info(`Using ${detected[0].name} as data source`)
    } else {
      const sourceAnswer = await prompt<{ sources: string[] }>({
        type: 'multiselect',
        name: 'sources',
        message: 'Select data sources:',
        choices: sourceChoices,
        initial: sourceChoices.map((_, i) => i),
      } as any)
      selectedSources = sourceAnswer.sources
    }

    // Step 3: Select language
    const langAnswer = await prompt<{ lang: string }>({
      type: 'select',
      name: 'lang',
      message: 'Report language:',
      choices: [
        { name: 'en', message: 'English' },
        { name: 'zh', message: '中文' },
        { name: 'ja', message: '日本語' },
        { name: 'ko', message: '한국어' },
        { name: 'ru', message: 'Русский' },
      ],
    })

    // Step 4: Preview data
    console.log()
    const totalSessions = detected
      .filter((r) => selectedSources.includes(r.name))
      .reduce((sum, r) => sum + r.sessionCount, 0)
    logger.info(`Found ${totalSessions} total sessions across ${selectedSources.length} source(s)`)

    // Step 5: Wrapped time range
    const rangeAnswer = await prompt<{ range: string }>({
      type: 'select',
      name: 'range',
      message: 'Generate initial Wrapped report?',
      choices: [
        { name: '90', message: '90 days (Recommended)' },
        { name: '30', message: '30 days' },
        { name: '365', message: '365 days' },
        { name: '0', message: 'Skip for now' },
      ],
    })

    // Step 6: Daily reminder
    const reminderAnswer = await prompt<{ reminder: boolean }>({
      type: 'confirm',
      name: 'reminder',
      message: 'Enable session startup reminder for pending reports?',
      initial: true,
    } as any)

    // Step 7: Webhook (optional)
    const webhookAnswer = await prompt<{ webhook: string }>({
      type: 'select',
      name: 'webhook',
      message: 'Daily report delivery (local file is always saved):',
      choices: [
        { name: 'none', message: 'Local file only' },
        { name: 'slack', message: 'Also send to Slack' },
        { name: 'discord', message: 'Also send to Discord' },
        { name: 'feishu', message: 'Also send to Feishu' },
      ],
    })

    let webhookUrl: string | undefined
    if (webhookAnswer.webhook !== 'none') {
      const urlAnswer = await prompt<{ url: string }>({
        type: 'input',
        name: 'url',
        message: `Enter ${webhookAnswer.webhook} webhook URL:`,
      })
      webhookUrl = urlAnswer.url
    }

    // Save config
    const config: Config = {
      ...loadConfig(),
      output_lang: langAnswer.lang as Config['output_lang'],
      sources: selectedSources,
      daily_reminder: reminderAnswer.reminder,
      wrapped_days: parseInt(rangeAnswer.range) || 90,
    }

    if (webhookAnswer.webhook === 'slack' && webhookUrl) config.webhook_slack = webhookUrl
    if (webhookAnswer.webhook === 'discord' && webhookUrl) config.webhook_discord = webhookUrl
    if (webhookAnswer.webhook === 'feishu' && webhookUrl) config.webhook_feishu = webhookUrl

    saveConfig(config)
    logger.success('Configuration saved!')

    // Install hooks
    console.log()
    for (const source of selectedSources) {
      const adapter = registry.getAdapter(source)
      if (adapter?.installHook) {
        try {
          await adapter.installHook()
          logger.success(`Hook installed for ${source}`)
        } catch (e) {
          logger.warn(`Failed to install hook for ${source}: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    console.log()
    logger.success('Setup complete!')
    logger.info('Run `aireport status` to verify.')

    if (rangeAnswer.range !== '0') {
      const days = parseInt(rangeAnswer.range) || 90
      console.log()
      logger.info(`Generating your ${days}-day Wrapped report...`)
      try {
        const { execFileSync } = await import('node:child_process')
        execFileSync(process.execPath, [...process.execArgv, ...getAireportArgs(), 'wrapped', '--days', String(days), '--prompt-only'], {
          stdio: 'inherit',
          env: process.env,
        })
      } catch {
        logger.warn('Auto-generation failed. You can run it manually:')
        logger.bold(`  aireport wrapped --days ${days}`)
      }
    }

    logger.info('To generate daily reports, run:')
    logger.bold('  aireport daily')
  })

function getAireportArgs(): string[] {
  // If running via the built binary, use it directly; otherwise fall back to current script
  const script = process.argv[1]
  if (script) return [script]
  return []
}
