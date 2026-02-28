import { Command } from 'commander'
import Enquirer from 'enquirer'
import { existsSync, rmSync } from 'node:fs'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { AI_REPORT_DIR } from '../../shared/constants.js'

const { prompt } = Enquirer

export const uninstallCommand = new Command('uninstall')
  .description('Remove hooks and optionally delete data')
  .action(async () => {
    logger.bold('AI Report to Me · Uninstall\n')

    const registry = getRegistry()
    const adapters = registry.getAllAdapters()

    // Remove hooks
    for (const adapter of adapters) {
      if (adapter.uninstallHook) {
        try {
          await adapter.uninstallHook()
          logger.success(`Hook removed for ${adapter.name}`)
        } catch (e) {
          logger.warn(`Failed to remove hook for ${adapter.name}: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    // Ask about data deletion
    if (existsSync(AI_REPORT_DIR)) {
      const answer = await prompt<{ deleteData: boolean }>({
        type: 'confirm',
        name: 'deleteData',
        message: `Delete all data in ${AI_REPORT_DIR}? (reports, config, logs)`,
        initial: false,
      } as any)

      if (answer.deleteData) {
        rmSync(AI_REPORT_DIR, { recursive: true, force: true })
        logger.success('Data directory removed')
      } else {
        logger.info('Data preserved')
      }
    }

    logger.success('\nUninstall complete.')
  })
