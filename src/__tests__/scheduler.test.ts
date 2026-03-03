import { describe, it, expect } from 'vitest'
import { ReportScheduler } from '../core/report-scheduler.js'
import type { NormalizedSession, SessionStats } from '../shared/types.js'

/** Format a Date as YYYY-MM-DD */
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function makeSession(id: string, date: string): NormalizedSession {
  const stats: SessionStats = {
    messageCount: 2,
    userMessageCount: 1,
    assistantMessageCount: 1,
    totalInputTokens: 100,
    totalOutputTokens: 50,
    totalCacheTokens: 0,
    toolCallCount: 1,
    toolCallsByName: { Read: 1 },
    filesTouched: [],
    editCount: 0,
    errorCount: 0,
  }

  return {
    sessionId: id,
    cli: 'claude-code',
    projectPath: '/test',
    projectName: 'test',
    startTime: new Date(`${date}T10:00:00`),
    endTime: new Date(`${date}T10:30:00`),
    durationMinutes: 30,
    messages: [],
    stats,
  }
}

describe('ReportScheduler', () => {
  const scheduler = new ReportScheduler()

  it('should mark all days as pending when no reports exist', () => {
    // Use today as the session date — no report should exist for today yet
    const today = fmt(new Date())

    const sessionsByDay = new Map([
      [today, [makeSession('s1', today), makeSession('s2', today)]],
    ])

    const pending = scheduler.getPendingDays(sessionsByDay)
    expect(pending).toHaveLength(1)
    expect(pending[0].date).toBe(today)
    expect(pending[0].reason).toBe('new')
    expect(pending[0].sessions).toHaveLength(2)
  })

  it('should return empty array when no sessions', () => {
    const pending = scheduler.getPendingDays(new Map())
    expect(pending).toHaveLength(0)
  })
})
