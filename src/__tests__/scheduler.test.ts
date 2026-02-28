import { describe, it, expect } from 'vitest'
import { ReportScheduler } from '../core/report-scheduler.js'
import type { NormalizedSession, SessionStats } from '../shared/types.js'

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
    const sessionsByDay = new Map([
      ['2026-02-26', [makeSession('s1', '2026-02-26')]],
      ['2026-02-27', [makeSession('s2', '2026-02-27')]],
      ['2026-02-28', [makeSession('s3', '2026-02-28')]],
    ])

    const pending = scheduler.getPendingDays(sessionsByDay)
    expect(pending).toHaveLength(3)
    expect(pending.map((p) => p.date)).toEqual(['2026-02-26', '2026-02-27', '2026-02-28'])
    expect(pending.every((p) => p.reason === 'new')).toBe(true)
  })

  it('should return empty array when no sessions', () => {
    const pending = scheduler.getPendingDays(new Map())
    expect(pending).toHaveLength(0)
  })
})
