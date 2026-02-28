import { Command } from 'commander'
import { statusCommand } from './commands/status.js'
import { configCommand } from './commands/config.js'
import { dailyCommand, saveDailyCommand } from './commands/daily.js'
import { wrappedCommand } from './commands/wrapped.js'
import { installCommand } from './commands/install.js'
import { uninstallCommand } from './commands/uninstall.js'
import { logSessionCommand } from './commands/log-session.js'

const program = new Command()

program
  .name('aireport')
  .description('AI-powered daily reports and wrapped summaries from your coding CLI sessions')
  .version('0.1.0')

program.addCommand(statusCommand)
program.addCommand(configCommand)
program.addCommand(dailyCommand)
program.addCommand(saveDailyCommand)
program.addCommand(wrappedCommand)
program.addCommand(installCommand)
program.addCommand(uninstallCommand)
program.addCommand(logSessionCommand)

program.parse()
