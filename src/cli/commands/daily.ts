import { Command } from 'commander'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { SessionReader } from '../../core/session-reader.js'
import { ReportScheduler } from '../../core/report-scheduler.js'
import { Aggregator } from '../../core/aggregator.js'
import { buildDailyReportPrompt } from '../../core/prompts/daily-report.js'
import { renderDailyMarkdown } from '../../renderer/markdown/daily.js'
import { LocalFileOutput } from '../../output/local-file.js'

export const dailyCommand = new Command('daily')
  .description('Generate daily report(s)')
  .option('--dry-run', 'Output aggregation data without generating report')
  .option('--prompt-only', 'Output only the LLM prompt (for slash command use)')
  .option('--date <date>', 'Generate report for a specific date (YYYY-MM-DD)')
  .action(async (opts: { dryRun?: boolean; promptOnly?: boolean; date?: string }) => {
    const config = loadConfig()
    const registry = getRegistry()
    const adapters = await registry.getEnabledAdapters()

    if (adapters.length === 0) {
      logger.error('No CLI adapters detected. Run `aireport install` first.')
      return
    }

    const reader = new SessionReader(adapters)
    const scheduler = new ReportScheduler()
    const aggregator = new Aggregator()

    // Determine the time range
    const sinceDate = scheduler.getSinceDate()
    logger.info(`Scanning sessions since ${sinceDate.toISOString().slice(0, 10)}...`)

    const sessionsByDay = await reader.readSessionsByDay({ since: sinceDate })

    if (sessionsByDay.size === 0) {
      logger.info('No sessions found in the time range.')
      return
    }

    logger.info(`Found sessions across ${sessionsByDay.size} day(s)`)

    // Determine pending days
    const pending = scheduler.getPendingDays(sessionsByDay)

    if (pending.length === 0) {
      logger.success('All reports are up to date.')
      return
    }

    if (opts.date) {
      const filtered = pending.filter((p) => p.date === opts.date)
      if (filtered.length === 0) {
        logger.error(`No pending report for ${opts.date}`)
        return
      }
      pending.splice(0, pending.length, ...filtered)
    }

    logger.info(`${pending.length} day(s) need report generation`)

    if (pending.length > 1) {
      logger.warn(`Will generate reports for: ${pending.map((p) => p.date).join(', ')}`)
    }

    for (let i = 0; i < pending.length; i++) {
      const day = pending[i]
      logger.info(`\nProcessing ${day.date} (${day.sessions.length} sessions, ${day.reason})...`)

      const aggregation = aggregator.aggregateDaily(day.sessions, day.date)

      if (opts.dryRun) {
        console.log(JSON.stringify({
          date: aggregation.date,
          totalDuration: aggregation.totalDuration,
          sessionCount: aggregation.sessions.length,
          projectBreakdown: aggregation.projectBreakdown,
          toolCalls: aggregation.allToolCalls,
          retrySignals: aggregation.allRetrySignals,
          errorCount: aggregation.allErrors.length,
        }, null, 2))
        continue
      }

      // Build the prompt
      const prompt = buildDailyReportPrompt(aggregation, config.output_lang)

      if (opts.promptOnly) {
        // Clean output for slash command consumption
        console.log(prompt)
        console.log(`\n---\nSAVE_DATE=${day.date}`)
        console.log(`SESSION_IDS=${day.sessions.map(s => s.sessionId).join(',')}`)
      } else {
        console.log('\n' + '='.repeat(60))
        console.log('DAILY REPORT PROMPT')
        console.log('='.repeat(60))
        console.log(prompt)
        console.log('='.repeat(60))
        console.log('\nPlease generate the daily report based on the prompt above.')
        console.log('After the LLM generates the report, save it with:')
        console.log(`  aireport save-daily --date ${day.date}`)
        console.log('='.repeat(60) + '\n')
      }
    }
  })

export const saveDailyCommand = new Command('save-daily')
  .description('Save a generated daily report (internal use)')
  .requiredOption('--date <date>', 'Report date (YYYY-MM-DD)')
  .requiredOption('--content <content>', 'Report markdown content (or - for stdin)')
  .action(async (opts: { date: string; content: string }) => {
    let content = opts.content
    if (content === '-') {
      // Read from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer)
      }
      content = Buffer.concat(chunks).toString('utf-8')
    }

    const registry = getRegistry()
    const adapters = await registry.getEnabledAdapters()
    const reader = new SessionReader(adapters)
    const sessionsByDay = await reader.readSessionsByDay({
      since: new Date(opts.date + 'T00:00:00'),
      until: new Date(opts.date + 'T23:59:59'),
    })
    const sessions = sessionsByDay.get(opts.date) || []
    const sessionIds = sessions.map((s) => s.sessionId)

    const markdown = renderDailyMarkdown(content, opts.date, sessionIds)
    const output = new LocalFileOutput()
    await output.send(markdown, {
      type: 'daily',
      date: opts.date,
      fileName: `${opts.date}.md`,
    })

    logger.success(`Daily report saved to ~/.ai-report/reports/${opts.date}.md`)
  })
