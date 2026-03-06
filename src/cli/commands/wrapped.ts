import { Command } from 'commander'
import dayjs from 'dayjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { SessionReader } from '../../core/session-reader.js'
import { Aggregator } from '../../core/aggregator.js'
import { analyzeHabits } from '../../core/analyzer/habits.js'
import { extractVibeSignals } from '../../core/analyzer/vibe-coder-type.js'
import { generateImprovements } from '../../core/analyzer/improvements.js'
import { extractImprovementSignals } from '../../core/analyzer/improvement-signals.js'
import { aggregateSemantics } from '../../core/analyzer/semantic-aggregator.js'
import { buildWrappedReportPrompt } from '../../core/prompts/wrapped-report.js'
import { extractExperienceSlicesFromReports } from '../../core/daily-slices-extractor.js'
import { renderWrappedMarkdown } from '../../renderer/markdown/wrapped.js'
import { LocalFileOutput } from '../../output/local-file.js'
import { resolveWebhookOutputs } from '../../output/webhook/index.js'
import { generateVibeCardPng } from '../../renderer/image/vibe-card.js'
import { REPORTS_DIR, WRAPPED_DIR } from '../../shared/constants.js'
import { ensureDir } from '../../shared/storage.js'
export const wrappedCommand = new Command('wrapped')
  .description('Generate a Vibe Coding Wrapped report')
  .option('--days <number>', 'Number of days to analyze', '90')
  .option('--dry-run', 'Output aggregation data without generating report')
  .option('--prompt-only', 'Output only the LLM prompt (for slash command use)')
  .action(async (opts: { days: string; dryRun?: boolean; promptOnly?: boolean }) => {
    const config = loadConfig()
    const registry = getRegistry()
    const adapters = await registry.getConfiguredAdapters(config.sources)

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
    const habits = analyzeHabits(sessions, config.output_lang)
    const vibeSignals = extractVibeSignals(sessions)
    const allFrictions = aggregation.frictionHotspots
    const improvements = generateImprovements(sessions, allFrictions, config.output_lang)

    const improvementSignals = extractImprovementSignals(sessions)
    const semanticSummary = aggregateSemantics(sessions)

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
        vibeSignals,
        habits,
        improvements,
        frictionCount: allFrictions.length,
        improvementSignals,
        semanticSummary,
      }, null, 2))
      return
    }

    const dailySlices = extractExperienceSlicesFromReports(
      REPORTS_DIR,
      aggregation.startDate,
      aggregation.endDate
    )

    const prompt = buildWrappedReportPrompt(aggregation, habits, vibeSignals, improvements, config.output_lang, dailySlices, semanticSummary, improvementSignals)

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

export const saveWrappedCommand = new Command('save-wrapped')
  .description('Save a generated wrapped report (internal use)')
  .requiredOption('--period <period>', 'Report period (YYYY-MM-DD_YYYY-MM-DD)')
  .requiredOption('--content <content>', 'Report markdown content (or - for stdin)')
  .option('--session-ids <ids>', 'Comma-separated session IDs')
  .action(async (opts: { period: string; content: string; sessionIds?: string }) => {
    const [startDate, endDate] = opts.period.split('_')
    if (!startDate || !endDate) {
      logger.error('Invalid period format. Expected: YYYY-MM-DD_YYYY-MM-DD')
      return
    }

    let content = opts.content
    if (content === '-') {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer)
      }
      content = Buffer.concat(chunks).toString('utf-8')
    }

    const markdown = renderWrappedMarkdown(content)

    const output = new LocalFileOutput()
    const fileName = `${opts.period}.md`
    await output.send(markdown, {
      type: 'wrapped',
      date: opts.period,
      fileName,
    })

    logger.success(`Wrapped report saved to ~/.ai-report/wrapped/${fileName}`)

    // Try to generate vibe card PNG
    const config = loadConfig()
    try {
      const vibeInfo = parseVibeType(content)
      if (vibeInfo) {
        const registry = getRegistry()
        const adapters = await registry.getConfiguredAdapters(config.sources)
        const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
        const since = dayjs(startDate).startOf('day').toDate()
        const reader = new SessionReader(adapters)
        const sessions = await reader.readSessions({ since })
        const aggregator = new Aggregator()
        const aggregation = aggregator.aggregateWrapped(sessions, days)
        const topProject = aggregation.projectBreakdown[0]?.project || 'N/A'

        const pngBuffer = await generateVibeCardPng({
          emoji: vibeInfo.emoji,
          label: vibeInfo.label,
          reason: vibeInfo.reason,
          periodLabel: `${startDate} — ${endDate}`,
          stats: {
            totalSessions: aggregation.totalSessions,
            totalHours: Math.round(aggregation.totalDurationMinutes / 60),
            activeDays: aggregation.activeDays,
            topProject,
          },
          lang: config.output_lang,
        })

        ensureDir(WRAPPED_DIR)
        const cardPath = join(WRAPPED_DIR, `vibe-card-${opts.period}.png`)
        writeFileSync(cardPath, pngBuffer)
        logger.success(`Vibe card saved to ${cardPath}`)
      }
    } catch (err) {
      logger.warn(`Vibe card generation failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Push to configured webhooks
    const webhookOutputs = resolveWebhookOutputs(config)
    if (webhookOutputs.length > 0) {
      const metadata = { type: 'wrapped' as const, date: opts.period, fileName }
      const results = await Promise.allSettled(
        webhookOutputs.map(o => o.send(markdown, metadata))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        logger.warn(`${failed.length} webhook(s) failed to send`)
      }
    }
  })

function parseVibeType(markdown: string): { emoji: string; label: string; reason: string } | null {
  const match = markdown.match(/\*\*\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*(.+?)\s*\*\*/u)
  if (!match) return null
  return {
    emoji: match[1],
    label: `${match[1]} ${match[2]}`,
    reason: match[2],
  }
}
