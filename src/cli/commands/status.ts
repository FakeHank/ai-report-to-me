import { Command } from 'commander'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getExistingReportDates } from '../../shared/storage.js'
import { getRegistry } from '../../adapters/registry.js'

export const statusCommand = new Command('status')
  .description('Show installation status and session statistics')
  .action(async () => {
    logger.bold('AI Report to Me · Status\n')

    const config = loadConfig()
    logger.info(`Language: ${config.output_lang}`)
    logger.info(`Backfill limit: ${config.backfill_limit} days`)

    const registry = getRegistry()
    const results = await registry.detectAll()

    console.log()
    for (const result of results) {
      if (result.installed) {
        logger.success(`${result.name}: ${result.dataPath} (${result.sessionCount} sessions)`)
      } else {
        logger.dim(`${result.name}: not detected`)
      }
    }

    const reports = getExistingReportDates()
    console.log()
    if (reports.length > 0) {
      logger.info(`Reports: ${reports.length} daily reports (latest: ${reports[reports.length - 1]})`)
    } else {
      logger.dim('Reports: none generated yet')
    }

    if (config.webhook_slack) logger.success('Webhook: Slack configured')
    if (config.webhook_discord) logger.success('Webhook: Discord configured')
    if (config.webhook_feishu) logger.success('Webhook: Feishu configured')
    if (!config.webhook_slack && !config.webhook_discord && !config.webhook_feishu) {
      logger.dim('Webhook: not configured (optional)')
    }
  })
