import { describe, it, expect } from 'vitest'
import { Aggregator } from '../core/aggregator.js'
import type { NormalizedSession, SessionStats } from '../shared/types.js'

function makeSession(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  const stats: SessionStats = {
    messageCount: 5,
    userMessageCount: 2,
    assistantMessageCount: 3,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCacheTokens: 200,
    toolCallCount: 8,
    toolCallsByName: { Read: 3, Edit: 3, Bash: 2 },
    filesTouched: ['/src/index.ts', '/src/utils.ts'],
    editCount: 3,
    errorCount: 1,
    ...overrides.stats,
  }

  return {
    sessionId: 'test-session-1',
    cli: 'claude-code',
    projectPath: '/home/user/my-project',
    projectName: 'my-project',
    startTime: new Date('2026-02-28T10:00:00'),
    endTime: new Date('2026-02-28T10:30:00'),
    durationMinutes: 30,
    messages: [
      {
        role: 'user',
        timestamp: new Date('2026-02-28T10:00:00'),
        content: 'Fix the bug',
      },
      {
        role: 'assistant',
        timestamp: new Date('2026-02-28T10:01:00'),
        content: 'Looking at the code...',
        toolCalls: [
          { name: 'Read', input: { file_path: '/src/index.ts' }, isError: false },
          { name: 'Edit', input: { file_path: '/src/index.ts' }, isError: false },
        ],
        usage: { inputTokens: 1000, outputTokens: 500 },
      },
    ],
    stats,
    ...overrides,
  }
}

describe('Aggregator', () => {
  const aggregator = new Aggregator()

  describe('aggregateDaily', () => {
    it('should aggregate sessions for a day', () => {
      const sessions = [
        makeSession({ sessionId: 's1', durationMinutes: 30 }),
        makeSession({
          sessionId: 's2',
          durationMinutes: 45,
          projectPath: '/home/user/other-project',
          projectName: 'other-project',
        }),
      ]

      const result = aggregator.aggregateDaily(sessions, '2026-02-28')

      expect(result.date).toBe('2026-02-28')
      expect(result.totalDuration).toBe(75)
      expect(result.sessions).toHaveLength(2)
      expect(result.projectBreakdown).toHaveLength(2)
      expect(result.allToolCalls).toHaveProperty('Read')
      expect(result.allToolCalls).toHaveProperty('Edit')
    })

    it('should return empty aggregation for no sessions', () => {
      const result = aggregator.aggregateDaily([], '2026-02-28')
      expect(result.totalDuration).toBe(0)
      expect(result.projectBreakdown).toHaveLength(0)
    })
  })

  describe('aggregateWrapped', () => {
    it('should aggregate sessions for wrapped report', () => {
      const sessions = [
        makeSession({ sessionId: 's1', startTime: new Date('2026-02-20T10:00:00') }),
        makeSession({ sessionId: 's2', startTime: new Date('2026-02-21T14:00:00') }),
        makeSession({ sessionId: 's3', startTime: new Date('2026-02-28T22:00:00') }),
      ]

      const result = aggregator.aggregateWrapped(sessions, 30)

      expect(result.totalSessions).toBe(3)
      expect(result.activeDays).toBe(3)
      expect(result.hourlyDistribution).toHaveLength(24)
      expect(result.projectBreakdown).toHaveLength(1)
      expect(result.totalDurationMinutes).toBe(90)
    })
  })
})
