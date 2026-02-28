import { Command } from 'commander'
import { getConfigValue, setConfigValue, loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'

export const configCommand = new Command('config')
  .description('Read or write configuration')
  .argument('<key>', 'Configuration key')
  .argument('[value]', 'Value to set (omit to read)')
  .action((key: string, value?: string) => {
    if (value === undefined) {
      const current = getConfigValue(key)
      if (current === undefined) {
        logger.error(`Unknown config key: ${key}`)
        console.log('\nAvailable keys:')
        const config = loadConfig()
        for (const k of Object.keys(config)) {
          console.log(`  ${k} = ${JSON.stringify((config as Record<string, unknown>)[k])}`)
        }
      } else {
        console.log(JSON.stringify(current))
      }
    } else {
      try {
        setConfigValue(key, value)
        logger.success(`Set ${key} = ${value}`)
      } catch (e) {
        logger.error(`Failed to set config: ${e instanceof Error ? e.message : e}`)
      }
    }
  })
