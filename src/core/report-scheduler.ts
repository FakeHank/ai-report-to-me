import dayjs from 'dayjs'
import type { NormalizedSession, ReportMeta } from '../shared/types.js'
import { readMarkdown, parseReportMeta, getExistingReportDates, getReportPath } from '../shared/storage.js'
import { loadConfig } from '../shared/config.js'

export interface PendingDay {
  date: string
  sessions: NormalizedSession[]
  existingMeta: ReportMeta | null
  reason: 'new' | 'updated'
}

export class ReportScheduler {
  getPendingDays(sessionsByDay: Map<string, NormalizedSession[]>): PendingDay[] {
    const config = loadConfig()
    const pending: PendingDay[] = []

    // Get all days that have sessions
    const allDays = [...sessionsByDay.keys()].sort()
    if (allDays.length === 0) return []

    // Apply backfill limit
    const backfillLimit = config.backfill_limit
    const daysToProcess = allDays.length > backfillLimit
      ? allDays.slice(-backfillLimit)
      : allDays

    for (const date of daysToProcess) {
      const sessions = sessionsByDay.get(date)!
      const sessionIds = sessions.map((s) => s.sessionId)

      const reportPath = getReportPath(date)
      const existingContent = readMarkdown(reportPath)
      const existingMeta = existingContent ? parseReportMeta(existingContent) : null

      if (shouldRegenerate(existingMeta, sessionIds)) {
        pending.push({
          date,
          sessions,
          existingMeta,
          reason: existingMeta ? 'updated' : 'new',
        })
      }
    }

    return pending
  }

  getLastReportDate(): string | null {
    const dates = getExistingReportDates()
    return dates.length > 0 ? dates[dates.length - 1] : null
  }

  getSinceDate(): Date {
    const lastDate = this.getLastReportDate()
    if (lastDate) {
      return dayjs(lastDate).startOf('day').toDate()
    }
    // Default: look back 7 days
    return dayjs().subtract(7, 'day').startOf('day').toDate()
  }
}

function shouldRegenerate(existingMeta: ReportMeta | null, currentSessionIds: string[]): boolean {
  if (!existingMeta) return true
  if (currentSessionIds.length > existingMeta.sessionCount) return true
  const hasNewSessions = currentSessionIds.some((id) => !existingMeta.sessionIds.includes(id))
  return hasNewSessions
}
