import { Command } from 'commander'
import dayjs from 'dayjs'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { SessionReader } from '../../core/session-reader.js'
import { Aggregator } from '../../core/aggregator.js'
import { analyzeHabits } from '../../core/analyzer/habits.js'
import { determineVibeCoderType } from '../../core/analyzer/vibe-coder-type.js'
import { generateImprovements } from '../../core/analyzer/improvements.js'
import { detectFriction } from '../../core/analyzer/friction.js'
import { buildWrappedReportPrompt } from '../../core/prompts/wrapped-report.js'
import { extractExperienceSlicesFromReports } from '../../core/daily-slices-extractor.js'
import { REPORTS_DIR } from '../../shared/constants.js'
import type { FrictionRecord } from '../../shared/types.js'

export const wrappedCommand = new Command('wrapped')
  .description('Generate a Vibe Coding Wrapped report')
  .option('--days <number>', 'Number of days to analyze', '90')
  .option('--dry-run', 'Output aggregation data without generating report')
  .option('--prompt-only', 'Output only the LLM prompt (for slash command use)')
  .action(async (opts: { days: string; dryRun?: boolean; promptOnly?: boolean }) => {
    const config = loadConfig()
    const registry = getRegistry()
    const adapters = await registry.getEnabledAdapters()

    if (adapters.length === 0) {
      logger.error('No CLI adapters detected. Run `aireport install` first.')
      return
    }

    const days = parseInt(opts.days) || config.wrapped_days
    const since = dayjs().subtract(days, 'day').startOf('day').toDate()

    const reader = new SessionReader(adapters)
    logger.info(`Scanning sessions from the last ${days} days...`)

    const sessions = await reader.readSessions({ since })

    if (sessions.length === 0) {
      logger.info('No sessions found in the time range.')
      return
    }

    logger.info(`Found ${sessions.length} sessions`)

    const aggregator = new Aggregator()
    const aggregation = aggregator.aggregateWrapped(sessions, days)
    const habits = analyzeHabits(sessions)
    const vibeType = determineVibeCoderType(sessions)
    const allFrictions: FrictionRecord[] = []
    for (const s of sessions) {
      allFrictions.push(...detectFriction(s))
    }
    const improvements = generateImprovements(sessions, allFrictions)

    if (opts.dryRun) {
      console.log(JSON.stringify({
        period: `${aggregation.startDate} to ${aggregation.endDate}`,
        totalSessions: aggregation.totalSessions,
        totalMessages: aggregation.totalMessages,
        activeDays: aggregation.activeDays,
        totalHours: Math.round(aggregation.totalDurationMinutes / 60),
        averageSessionMinutes: aggregation.averageSessionMinutes,
        longestSession: aggregation.longestSession,
        projectBreakdown: aggregation.projectBreakdown,
        vibeCoderType: vibeType,
        habits,
        improvements,
        frictionCount: allFrictions.length,
      }, null, 2))
      return
    }

    const dailySlices = extractExperienceSlicesFromReports(
      REPORTS_DIR,
      aggregation.startDate,
      aggregation.endDate
    )

    const prompt = buildWrappedReportPrompt(aggregation, habits, vibeType, improvements, config.output_lang, dailySlices)

    if (opts.promptOnly) {
      // Clean output for slash command consumption
      console.log(prompt)
      console.log(`\n---\nSAVE_PERIOD=${aggregation.startDate}_${aggregation.endDate}`)
      console.log(`SESSION_IDS=${sessions.map(s => s.sessionId).join(',')}`)
    } else {
      console.log('\n' + '='.repeat(60))
      console.log('WRAPPED REPORT PROMPT')
      console.log('='.repeat(60))
      console.log(prompt)
      console.log('='.repeat(60))
      console.log('\nPlease generate the Wrapped report based on the prompt above.')
      console.log('='.repeat(60) + '\n')
    }
  })
