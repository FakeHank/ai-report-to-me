import { Command } from 'commander'
import dayjs from 'dayjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../../shared/config.js'
import { logger } from '../../shared/logger.js'
import { getRegistry } from '../../adapters/registry.js'
import { SessionReader } from '../../core/session-reader.js'
import { Aggregator } from '../../core/aggregator.js'
import { determineVibeCoderType } from '../../core/analyzer/vibe-coder-type.js'
import { generateVibeCardPng } from '../../renderer/image/vibe-card.js'
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

    // Extract Section 7 commentary
    const commentary = extractSection7(markdown)
    if (!commentary) {
      logger.warn('Could not extract Section 7 from report, generating card without commentary')
    }

    // Re-run lightweight pipeline for vibe type + stats
    loadConfig() // ensure config is loaded
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
    const vibeType = determineVibeCoderType(sessions)
    const topProject = aggregation.projectBreakdown[0]?.project || 'N/A'

    try {
      const pngBuffer = await generateVibeCardPng({
        emoji: vibeType.emoji,
        label: vibeType.label,
        reason: vibeType.reason,
        periodLabel: `${aggregation.startDate} — ${aggregation.endDate}`,
        stats: {
          totalSessions: aggregation.totalSessions,
          totalHours: Math.round(aggregation.totalDurationMinutes / 60),
          activeDays: aggregation.activeDays,
          topProject,
        },
        commentary: commentary || undefined,
      })

      ensureDir(WRAPPED_DIR)
      const cardPath = join(WRAPPED_DIR, `vibe-card-${opts.period}.png`)
      writeFileSync(cardPath, pngBuffer)
      logger.success(`Vibe coder card saved to ${cardPath}`)
    } catch (err) {
      logger.error(`Failed to generate vibe card: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

/**
 * Extract the Section 7 ("你是哪种 Vibe Coder") body text from a wrapped report markdown.
 * Returns the commentary text (excluding the heading), or null if not found.
 */
function extractSection7(markdown: string): string | null {
  const lines = markdown.split('\n')

  // Find the Section 7 heading
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s.*(?:Vibe\s*Coder|vibe\s*coder|哪种)/i.test(lines[i])) {
      startIdx = i + 1
      break
    }
  }
  if (startIdx === -1) return null

  // Collect until next same-level-or-higher heading or end
  const contentLines: string[] = []
  const headingMatch = lines[startIdx - 1].match(/^(#{1,3})/)
  const headingLevel = headingMatch ? headingMatch[1].length : 2

  for (let i = startIdx; i < lines.length; i++) {
    const lineHeading = lines[i].match(/^(#{1,3})\s/)
    if (lineHeading && lineHeading[1].length <= headingLevel) break
    contentLines.push(lines[i])
  }

  let text = contentLines.join('\n').trim()
  if (text.length <= 10) return null

  // Clean markdown artifacts: headings, bold/italic markers, blockquotes
  text = text
    .replace(/^#{1,6}\s+.*$/gm, '')       // remove sub-headings (e.g. ### 🔁 反复横跳型)
    .replace(/^>\s*/gm, '')                // remove blockquote markers
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')           // *italic* → italic
    .replace(/`([^`]+)`/g, '$1')           // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\n{3,}/g, '\n\n')            // collapse multiple blank lines
    .trim()

  return text.length > 10 ? text : null
}
