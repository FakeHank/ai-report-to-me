import { describe, it, expect } from 'vitest'
import { detectFriction } from '../core/analyzer/friction.js'
import type { NormalizedSession, NormalizedMessage, ToolCall } from '../shared/types.js'

function makeSessionWithEdits(editsPerFile: Record<string, number>): NormalizedSession {
  const toolCalls: ToolCall[] = []
  for (const [file, count] of Object.entries(editsPerFile)) {
    for (let i = 0; i < count; i++) {
      toolCalls.push({ name: 'Edit', input: { file_path: file }, isError: false })
    }
  }

  const messages: NormalizedMessage[] = [{
    role: 'assistant',
    timestamp: new Date(),
    content: 'Editing...',
    toolCalls,
  }]

  return {
    sessionId: 'test-session',
    cli: 'claude-code',
    projectPath: '/test',
    projectName: 'test',
    startTime: new Date(),
    endTime: new Date(),
    durationMinutes: 30,
    messages,
    stats: {
      messageCount: 1,
      userMessageCount: 0,
      assistantMessageCount: 1,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheTokens: 0,
      toolCallCount: toolCalls.length,
      toolCallsByName: { Edit: toolCalls.length },
      filesTouched: Object.keys(editsPerFile),
      editCount: toolCalls.length,
      errorCount: 0,
    },
  }
}

describe('Friction Detection', () => {
  it('should detect edit retries', () => {
    const session = makeSessionWithEdits({
      '/src/index.ts': 5,
      '/src/other.ts': 2,
    })

    const frictions = detectFriction(session)
    const retries = frictions.filter((f) => f.type === 'retry')

    expect(retries).toHaveLength(1)
    expect(retries[0].file).toBe('/src/index.ts')
    expect(retries[0].count).toBe(5)
  })

  it('should not flag files with few edits', () => {
    const session = makeSessionWithEdits({
      '/src/index.ts': 2,
      '/src/other.ts': 1,
    })

    const frictions = detectFriction(session)
    const retries = frictions.filter((f) => f.type === 'retry')
    expect(retries).toHaveLength(0)
  })
})
