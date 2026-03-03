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

    // Extract Section 7 vibe type info from AI-generated content
    const vibeInfo = parseVibeFromSection7(markdown)
    const commentary = extractSection7Body(markdown)

    // Re-run lightweight pipeline for stats
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
    const topProject = aggregation.projectBreakdown[0]?.project || 'N/A'

    try {
      const pngBuffer = await generateVibeCardPng({
        emoji: vibeInfo.emoji,
        label: vibeInfo.label,
        reason: vibeInfo.reason,
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
 * Parse the AI-generated vibe coder type from Section 7.
 * Looks for the format: **[emoji] [类型名称]**
 * Falls back to defaults if parsing fails.
 */
function parseVibeFromSection7(markdown: string): { emoji: string; label: string; reason: string } {
  const section7 = extractSection7Content(markdown)
  if (!section7) {
    return { emoji: '⚡', label: '⚡ Vibe Coder', reason: '' }
  }

  // Match **[emoji] [label]** pattern
  const match = section7.match(/\*\*\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*(.+?)\s*\*\*/u)
  if (match) {
    const emoji = match[1]
    const typeName = match[2]
    // Use the rest of section 7 (after the type line) as reason
    const lines = section7.split('\n')
    const reasonLines: string[] = []
    let foundType = false
    for (const line of lines) {
      if (!foundType && line.includes(match[0])) {
        foundType = true
        continue
      }
      if (foundType && line.trim()) {
        reasonLines.push(line.trim())
      }
    }
    const reason = reasonLines.join(' ').slice(0, 200)
    return {
      emoji,
      label: `${emoji} ${typeName}`,
      reason: reason || typeName,
    }
  }

  return { emoji: '⚡', label: '⚡ Vibe Coder', reason: '' }
}

/**
 * Extract raw Section 7 content (including the type header line).
 */
function extractSection7Content(markdown: string): string | null {
  const lines = markdown.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s.*(?:Vibe\s*Coder|vibe\s*coder|哪种)/i.test(lines[i])) {
      startIdx = i + 1
      break
    }
  }
  if (startIdx === -1) return null

  const contentLines: string[] = []
  const headingMatch = lines[startIdx - 1].match(/^(#{1,3})/)
  const headingLevel = headingMatch ? headingMatch[1].length : 2

  for (let i = startIdx; i < lines.length; i++) {
    const lineHeading = lines[i].match(/^(#{1,3})\s/)
    if (lineHeading && lineHeading[1].length <= headingLevel) break
    contentLines.push(lines[i])
  }

  const text = contentLines.join('\n').trim()
  return text.length > 10 ? text : null
}

/**
 * Extract the Section 7 body text (cleaned, for commentary on the card).
 */
function extractSection7Body(markdown: string): string | null {
  const content = extractSection7Content(markdown)
  if (!content) return null

  let text = content
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.length > 10 ? text : null
}
