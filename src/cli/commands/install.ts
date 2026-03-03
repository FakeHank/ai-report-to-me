import { Command } from 'commander'
import { loadConfig, saveConfig, type Config } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'

const VALID_LANGS = ['en', 'zh', 'ja', 'ko', 'ru'] as const

interface InstallOpts {
  yes?: boolean
  lang?: string
  sources?: string[]
  slackUrl?: string
  discordUrl?: string
  feishuUrl?: string
  dingtalkUrl?: string
  wecomUrl?: string
  teamsUrl?: string
}

export const installCommand = new Command('install')
  .description('Setup wizard. Use --yes for non-interactive mode (AI agent friendly)')
  .option('-y, --yes', 'Non-interactive mode: auto-detect sources, use defaults')
  .option('--lang <lang>', `Report language (${VALID_LANGS.join(', ')})`)
  .option('--sources <sources...>', 'Data sources to enable (e.g. claude-code gemini-cli)')
  .option('--slack-url <url>', 'Slack webhook URL')
  .option('--discord-url <url>', 'Discord webhook URL')
  .option('--feishu-url <url>', 'Feishu/Lark webhook URL')
  .option('--dingtalk-url <url>', 'DingTalk webhook URL')
  .option('--wecom-url <url>', 'WeCom webhook URL')
  .option('--teams-url <url>', 'Microsoft Teams webhook URL')
  .action(async (opts: InstallOpts) => {
    if (opts.yes) {
      await runNonInteractive(opts)
    } else {
      await runInteractive(opts)
    }
  })

async function runNonInteractive(opts: InstallOpts) {
  logger.bold('AI Report to Me · Setup (non-interactive)\n')

  const registry = getRegistry()
  const detectResults = await registry.detectAll()
  const detected = detectResults.filter((r) => r.installed)

  if (detected.length === 0) {
    logger.error('No supported CLI tools detected.')
    logger.info('Supported: Claude Code, Gemini CLI, OpenCode, Codex')
    process.exitCode = 1
    return
  }

  // Show detected CLIs
  logger.info('Detected CLI tools:')
  for (const r of detected) {
    logger.success(`  ${r.name}: ${r.sessionCount} sessions`)
  }
  console.log()

  // Resolve sources: use --sources if given, otherwise all detected
  let selectedSources: string[]
  if (opts.sources && opts.sources.length > 0) {
    const detectedNames = new Set(detected.map((r) => r.name))
    const invalid = opts.sources.filter((s) => !detectedNames.has(s))
    if (invalid.length > 0) {
      logger.warn(`Unknown or undetected sources ignored: ${invalid.join(', ')}`)
    }
    selectedSources = opts.sources.filter((s) => detectedNames.has(s))
    if (selectedSources.length === 0) {
      logger.info('No valid sources specified, using all detected')
      selectedSources = detected.map((r) => r.name)
    }
  } else {
    selectedSources = detected.map((r) => r.name)
  }
  logger.info(`Sources: ${selectedSources.join(', ')}`)

  // Resolve language
  const lang = opts.lang && VALID_LANGS.includes(opts.lang as any)
    ? (opts.lang as Config['output_lang'])
    : 'en'
  logger.info(`Language: ${lang}`)

  // Resolve webhook URLs
  const webhooks: Record<string, string> = {}
  if (opts.slackUrl) webhooks.slack_url = opts.slackUrl
  if (opts.discordUrl) webhooks.discord_url = opts.discordUrl
  if (opts.feishuUrl) webhooks.feishu_url = opts.feishuUrl
  if (opts.dingtalkUrl) webhooks.dingtalk_url = opts.dingtalkUrl
  if (opts.wecomUrl) webhooks.wecom_url = opts.wecomUrl
  if (opts.teamsUrl) webhooks.teams_url = opts.teamsUrl

  const webhookCount = Object.keys(webhooks).length
  if (webhookCount > 0) {
    logger.info(`Webhooks: ${webhookCount} configured`)
  }

  // Save config
  const config: Config = {
    ...loadConfig(),
    output_lang: lang,
    sources: selectedSources,
    daily_reminder: true,
    webhooks: { ...loadConfig().webhooks, ...webhooks },
  }

  saveConfig(config)
  logger.success('Configuration saved!')

  // Install hooks
  await installHooks(registry, selectedSources)

  console.log()
  logger.success('Setup complete!')
  printNextSteps()
}

async function runInteractive(_opts: InstallOpts) {
  const Enquirer = (await import('enquirer')).default
  const { prompt } = Enquirer

  logger.bold('AI Report to Me · Setup Wizard\n')

  const registry = getRegistry()
  const detectResults = await registry.detectAll()
  const detected = detectResults.filter((r) => r.installed)

  if (detected.length === 0) {
    logger.error('No supported CLI tools detected.')
    logger.info('Supported: Claude Code, Gemini CLI, OpenCode, Codex')
    return
  }

  // Step 1: Show detected CLIs and use all as sources
  logger.info('Detected CLI tools:')
  for (const r of detected) {
    logger.success(`  ${r.name}: ${r.sessionCount} sessions`)
  }
  console.log()
  const selectedSources = detected.map((r) => r.name)

  // Step 2: Select language
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

  // Step 3: Preview data
  console.log()
  const totalSessions = detected
    .filter((r) => selectedSources.includes(r.name))
    .reduce((sum, r) => sum + r.sessionCount, 0)
  logger.info(`Found ${totalSessions} total sessions across ${selectedSources.length} source(s)`)

  // Step 4: Daily reminder
  const reminderAnswer = await prompt<{ reminder: boolean }>({
    type: 'confirm',
    name: 'reminder',
    message: 'Enable session startup reminder for pending reports?',
    initial: true,
  } as any)

  // Step 5: Configure webhooks
  const webhookAnswer = await prompt<{ configure: boolean }>({
    type: 'confirm',
    name: 'configure',
    message: 'Configure webhook notifications?',
    initial: false,
  } as any)

  const webhooks: Record<string, string> = {}
  if (webhookAnswer.configure) {
    const platforms = [
      { key: 'slack_url', label: 'Slack' },
      { key: 'discord_url', label: 'Discord' },
      { key: 'feishu_url', label: 'Feishu/Lark' },
      { key: 'dingtalk_url', label: 'DingTalk' },
      { key: 'wecom_url', label: 'WeCom' },
      { key: 'teams_url', label: 'Microsoft Teams' },
    ]
    for (const { key, label } of platforms) {
      const urlAnswer = await prompt<{ url: string }>({
        type: 'input',
        name: 'url',
        message: `${label} webhook URL (leave empty to skip):`,
      })
      if (urlAnswer.url.trim()) {
        webhooks[key] = urlAnswer.url.trim()
      }
    }
    const count = Object.keys(webhooks).length
    if (count > 0) {
      logger.success(`${count} webhook(s) configured`)
    }
  }

  // Save config
  const config: Config = {
    ...loadConfig(),
    output_lang: langAnswer.lang as Config['output_lang'],
    sources: selectedSources,
    daily_reminder: reminderAnswer.reminder,
    webhooks: { ...loadConfig().webhooks, ...webhooks },
  }

  saveConfig(config)
  logger.success('Configuration saved!')

  // Install hooks
  await installHooks(registry, selectedSources)

  console.log()
  logger.success('Setup complete!')
  printNextSteps()
}

async function installHooks(registry: ReturnType<typeof getRegistry>, sources: string[]) {
  console.log()
  const detectResults = await registry.detectAll()
  const detectMap = new Map(detectResults.map((r) => [r.name, r]))

  for (const source of sources) {
    const adapter = registry.getAdapter(source)
    const detect = detectMap.get(source)
    const hookSupport = detect?.hookSupport || 'none'

    if (hookSupport === 'none') {
      logger.info(`${source}: no hook support. Reports are generated from session data directly.`)
      continue
    }

    if (adapter?.installHook) {
      try {
        await adapter.installHook()
        if (hookSupport === 'full') {
          logger.success(`Hook installed for ${source} (startup check on session start)`)
        } else {
          const limitations: Record<string, string> = {
            'opencode': 'custom tool only — invoke ai_report_check manually in chat',
          }
          const detail = limitations[source] || 'limited hook support'
          logger.success(`Hook installed for ${source} (partial: ${detail})`)
        }
      } catch (e) {
        logger.warn(`Failed to install hook for ${source}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }
}

function printNextSteps() {
  console.log()
  logger.info('Next steps:')
  logger.info('  Open your coding CLI (Claude Code, OpenCode, Codex, etc.) and type:')
  logger.bold('    /dayreport    — generate a daily report')
  logger.bold('    /qtreport     — generate a 90-day Wrapped summary')
  console.log()
  logger.dim('  Or run from terminal:  aireport status')
}
