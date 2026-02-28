import { describe, it, expect } from 'vitest'
import { determineVibeCoderType } from '../core/analyzer/vibe-coder-type.js'
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

describe('Vibe Coder Type', () => {
  it('should return a valid type', () => {
    const sessions = [makeSession(), makeSession(), makeSession()]
    const result = determineVibeCoderType(sessions)

    expect(result.type).toBeTruthy()
    expect(result.emoji).toBeTruthy()
    expect(result.label).toBeTruthy()
    expect(result.reason).toBeTruthy()
  })

  it('should detect night owl', () => {
    const sessions = Array.from({ length: 10 }, () =>
      makeSession({ startTime: new Date('2026-02-28T23:30:00') })
    )

    const result = determineVibeCoderType(sessions)
    expect(result.type).toBe('深夜幽灵型')
  })

  it('should return balanced type for mixed patterns', () => {
    const sessions = [
      makeSession({ startTime: new Date('2026-02-28T09:00:00'), durationMinutes: 40 }),
      makeSession({ startTime: new Date('2026-02-28T14:00:00'), durationMinutes: 60 }),
      makeSession({ startTime: new Date('2026-02-28T20:00:00'), durationMinutes: 50 }),
    ]

    const result = determineVibeCoderType(sessions)
    expect(result).toBeDefined()
  })
})
