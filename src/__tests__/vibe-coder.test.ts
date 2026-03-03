import { describe, it, expect } from 'vitest'
import { extractVibeSignals } from '../core/analyzer/vibe-coder-type.js'
import type { NormalizedSession } from '../shared/types.js'

function makeSession(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    sessionId: 'test',
    cli: 'claude-code',
    projectPath: '/test',
    projectName: 'test',
    startTime: new Date('2026-02-28T14:00:00'),
    endTime: new Date('2026-02-28T15:00:00'),
    durationMinutes: 60,
    messages: [],
    stats: {
      messageCount: 10,
      userMessageCount: 4,
      assistantMessageCount: 6,
      totalInputTokens: 5000,
      totalOutputTokens: 3000,
      totalCacheTokens: 0,
      toolCallCount: 15,
      toolCallsByName: { Read: 5, Edit: 5, Bash: 5 },
      filesTouched: [],
      editCount: 5,
      errorCount: 0,
    },
    ...overrides,
  }
}

describe('extractVibeSignals', () => {
  it('should return correct signal structure', () => {
    const sessions = [makeSession(), makeSession(), makeSession()]
    const signals = extractVibeSignals(sessions)

    expect(signals.totalSessions).toBe(3)
    expect(signals.nightSessionRatio).toBe(0)
    expect(signals.medianSessionMinutes).toBe(60)
    expect(signals.averageSessionMinutes).toBe(60)
    expect(signals.totalToolCalls).toBe(45)
    expect(signals.totalEdits).toBe(0) // no Edit/Write tool calls in messages
    expect(typeof signals.readBashToolRatio).toBe('number')
    expect(typeof signals.userMsgPerToolCall).toBe('number')
    expect(typeof signals.refactorEditRatio).toBe('number')
    expect(typeof signals.peakDaySessions).toBe('number')
    expect(typeof signals.highEditRepeatSessions).toBe('number')
  })

  it('should detect high night session ratio', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSession({ startTime: new Date('2026-02-28T23:30:00') })
    )

    const signals = extractVibeSignals(sessions)
    expect(signals.nightSessionRatio).toBe(1)
  })

  it('should compute Read/Bash tool ratio from stats', () => {
    const sessions = [
      makeSession({
        stats: {
          messageCount: 10,
          userMessageCount: 2,
          assistantMessageCount: 8,
          totalInputTokens: 5000,
          totalOutputTokens: 3000,
          totalCacheTokens: 0,
          toolCallCount: 20,
          toolCallsByName: { Read: 10, Bash: 5, Grep: 3, Edit: 2 },
          filesTouched: [],
          editCount: 2,
          errorCount: 0,
        },
      }),
    ]

    const signals = extractVibeSignals(sessions)
    expect(signals.readBashToolRatio).toBe(0.9) // 18/20
    expect(signals.totalToolCalls).toBe(20)
  })

  it('should compute peak day sessions', () => {
    const sessions = [
      makeSession({ startTime: new Date('2026-02-28T09:00:00') }),
      makeSession({ startTime: new Date('2026-02-28T10:00:00') }),
      makeSession({ startTime: new Date('2026-02-28T11:00:00') }),
      makeSession({ startTime: new Date('2026-02-27T09:00:00') }),
    ]

    const signals = extractVibeSignals(sessions)
    expect(signals.peakDaySessions).toBe(3)
  })

  it('should handle empty sessions', () => {
    const signals = extractVibeSignals([])

    expect(signals.totalSessions).toBe(0)
    expect(signals.nightSessionRatio).toBe(0)
    expect(signals.medianSessionMinutes).toBe(0)
    expect(signals.averageSessionMinutes).toBe(0)
    expect(signals.readBashToolRatio).toBe(0)
    expect(signals.userMsgPerToolCall).toBe(0)
  })
})
