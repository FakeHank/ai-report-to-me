import { Command } from 'commander'
import dayjs from 'dayjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { SessionReader } from '../../core/session-reader.js'
import { Aggregator } from '../../core/aggregator.js'
import { generateVibeCardPng } from '../../renderer/image/vibe-card.js'
import { parseVibeFromMarkdown } from '../../shared/vibe-parser.js'
import { readMarkdown, ensureDir } from '../../shared/storage.js'
import { WRAPPED_DIR } from '../../shared/constants.js'

export const regenVibeCardCommand = new Command('regen-vibe-card')
  .description('Regenerate vibe coder card PNG with Section 7 commentary from saved report')
  .requiredOption('--period <period>', 'Report period (e.g. 2026-01-08_2026-03-01)')
  .action(async (opts: { period: string }) => {
    const [startDate, endDate] = opts.period.split('_')
    if (!startDate || !endDate) {
      logger.error('Invalid period format. Expected: YYYY-MM-DD_YYYY-MM-DD')
      return
    }

    // Read the saved wrapped report
    const reportPath = join(WRAPPED_DIR, `${opts.period}.md`)
    const markdown = readMarkdown(reportPath)
    if (!markdown) {
      logger.error(`Wrapped report not found: ${reportPath}`)
      return
    }

    const vibeInfo = parseVibeFromMarkdown(markdown)
    if (!vibeInfo) {
      logger.error('Could not parse vibe coder type from report.')
      return
    }

    // Re-run lightweight pipeline for stats
    const registry = getRegistry()
    const adapters = await registry.getEnabledAdapters()

    if (adapters.length === 0) {
      logger.error('No CLI adapters detected.')
      return
    }

    const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
    const since = dayjs(startDate).startOf('day').toDate()
    const reader = new SessionReader(adapters)
    const sessions = await reader.readSessions({ since })

    if (sessions.length === 0) {
      logger.error('No sessions found for this period.')
      return
    }

    const aggregator = new Aggregator()
    const aggregation = aggregator.aggregateWrapped(sessions, days)
    const topProject = aggregation.projectBreakdown[0]?.project || 'N/A'

    const config = loadConfig()
    try {
      const pngBuffer = await generateVibeCardPng({
        emoji: vibeInfo.emoji,
        typeName: vibeInfo.typeName,
        periodLabel: `${aggregation.startDate} — ${aggregation.endDate}`,
        stats: {
          totalSessions: aggregation.totalSessions,
          totalHours: Math.round(aggregation.totalDurationMinutes / 60),
          activeDays: aggregation.activeDays,
          topProject,
          totalTokens: aggregation.totalInputTokens + aggregation.totalOutputTokens,
        },
        commentary: vibeInfo.commentary || undefined,
        closingQuote: vibeInfo.closingQuote || undefined,
        lang: config.output_lang,
      })

      ensureDir(WRAPPED_DIR)
      const cardPath = join(WRAPPED_DIR, `vibe-card-${opts.period}.png`)
      writeFileSync(cardPath, pngBuffer)
      logger.success(`Vibe coder card saved to ${cardPath}`)
    } catch (err) {
      logger.error(`Failed to generate vibe card: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
