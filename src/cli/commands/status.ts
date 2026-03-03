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

    // Show webhook configuration
    const webhookEntries = Object.entries(config.webhooks).filter(([, v]) => v)
    console.log()
    if (webhookEntries.length > 0) {
      logger.info(`Webhooks: ${webhookEntries.length} configured`)
      for (const [key] of webhookEntries) {
        const platform = key.replace('_url', '')
        logger.success(`  ${platform}: configured`)
      }
    } else {
      logger.dim('Webhooks: none configured')
    }

    const reports = getExistingReportDates()
    console.log()
    if (reports.length > 0) {
      logger.info(`Reports: ${reports.length} daily reports (latest: ${reports[reports.length - 1]})`)
    } else {
      logger.dim('Reports: none generated yet')
    }

  })
