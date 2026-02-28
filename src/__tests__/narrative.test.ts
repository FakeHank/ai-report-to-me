import { describe, it, expect } from 'vitest'
import { extractSessionNarrative, extractKeyDecisions, extractErrorResolutions, extractAssistantInsights } from '../core/narrative.js'
import type { NormalizedSession, NormalizedMessage, ToolCall, SessionStats } from '../shared/types.js'

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    messageCount: 5,
    userMessageCount: 2,
    assistantMessageCount: 3,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCacheTokens: 200,
    toolCallCount: 8,
    toolCallsByName: { Read: 3, Edit: 3, Bash: 2 },
    filesTouched: ['/src/index.ts'],
    editCount: 3,
    errorCount: 0,
    ...overrides,
  }
}

function makeSession(messages: NormalizedMessage[], overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    sessionId: 'test-session',
    cli: 'claude-code',
    projectPath: '/home/user/project',
    projectName: 'project',
    startTime: new Date('2026-02-28T10:00:00'),
    endTime: new Date('2026-02-28T10:30:00'),
    durationMinutes: 30,
    messages,
    stats: makeStats(),
    ...overrides,
  }
}

function userMsg(content: string, ts = '2026-02-28T10:00:00'): NormalizedMessage {
  return { role: 'user', timestamp: new Date(ts), content }
}

function assistantMsg(content: string, toolCalls: ToolCall[] = [], ts = '2026-02-28T10:01:00'): NormalizedMessage {
  return { role: 'assistant', timestamp: new Date(ts), content, toolCalls }
}

function toolCall(name: string, input: Record<string, unknown> = {}, opts: { isError?: boolean; result?: string } = {}): ToolCall {
  return { name, input, isError: opts.isError ?? false, result: opts.result }
}

describe('extractSessionNarrative', () => {
  describe('intent', () => {
    it('should extract first user message as intent', () => {
      const session = makeSession([
        userMsg('Fix the authentication bug in login flow'),
        assistantMsg('Looking at the code...'),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.intent).toBe('Fix the authentication bug in login flow')
    })

    it('should truncate long intents to 500 chars', () => {
      const longMsg = 'A'.repeat(600)
      const session = makeSession([userMsg(longMsg), assistantMsg('OK')])
      const narrative = extractSessionNarrative(session)
      expect(narrative.intent.length).toBeLessThanOrEqual(500)
      expect(narrative.intent).toMatch(/\.\.\.$/u)
    })

    it('should handle no user messages', () => {
      const session = makeSession([assistantMsg('Hello')])
      const narrative = extractSessionNarrative(session)
      expect(narrative.intent).toBe('(no user message)')
    })
  })

  describe('timeline', () => {
    it('should include user requests in timeline', () => {
      const session = makeSession([
        userMsg('Implement login'),
        assistantMsg('Working on it...'),
        userMsg('Also add logout'),
      ])
      const narrative = extractSessionNarrative(session)
      const userEntries = narrative.timeline.filter((e) => e.type === 'user-request')
      expect(userEntries).toHaveLength(2)
      expect(userEntries[0].summary).toBe('Implement login')
      expect(userEntries[1].summary).toBe('Also add logout')
    })

    it('should summarize Edit/Write tool actions with file paths', () => {
      const session = makeSession([
        userMsg('Edit files'),
        assistantMsg('Editing...', [
          toolCall('Edit', { file_path: '/src/auth.ts' }),
          toolCall('Edit', { file_path: '/src/login.ts' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      const actions = narrative.timeline.filter((e) => e.type === 'tool-action')
      expect(actions).toHaveLength(1)
      expect(actions[0].summary).toContain('/src/auth.ts')
      expect(actions[0].summary).toContain('/src/login.ts')
    })

    it('should summarize Bash commands', () => {
      const session = makeSession([
        userMsg('Run tests'),
        assistantMsg('Running...', [
          toolCall('Bash', { command: 'pnpm test' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      const actions = narrative.timeline.filter((e) => e.type === 'tool-action')
      expect(actions[0].summary).toContain('pnpm test')
    })

    it('should capture errors with tool name and message', () => {
      const session = makeSession([
        userMsg('Build'),
        assistantMsg('Building...', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Module not found: @/lib/auth' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      const errors = narrative.timeline.filter((e) => e.type === 'error')
      expect(errors).toHaveLength(1)
      expect(errors[0].summary).toContain('Bash')
      expect(errors[0].summary).toContain('Module not found')
    })

    it('should detect direction changes when a file is written twice', () => {
      const session = makeSession([
        userMsg('Create the component'),
        assistantMsg('Creating...', [
          toolCall('Write', { file_path: '/src/component.tsx' }),
        ], '2026-02-28T10:01:00'),
        userMsg('Actually, use a different approach', '2026-02-28T10:05:00'),
        assistantMsg('Rewriting...', [
          toolCall('Write', { file_path: '/src/component.tsx' }),
        ], '2026-02-28T10:06:00'),
      ])
      const narrative = extractSessionNarrative(session)
      const dirChanges = narrative.timeline.filter((e) => e.type === 'direction-change')
      expect(dirChanges).toHaveLength(1)
      expect(dirChanges[0].summary).toContain('component.tsx')
    })

    it('should group consecutive same-type tool calls', () => {
      const session = makeSession([
        userMsg('Read files'),
        assistantMsg('Reading...', [
          toolCall('Read', { file_path: '/src/a.ts' }),
          toolCall('Read', { file_path: '/src/b.ts' }),
          toolCall('Read', { file_path: '/src/c.ts' }),
          toolCall('Read', { file_path: '/src/d.ts' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      const actions = narrative.timeline.filter((e) => e.type === 'tool-action')
      expect(actions).toHaveLength(1)
      expect(actions[0].summary).toContain('and 1 more')
    })

    it('should summarize search patterns', () => {
      const session = makeSession([
        userMsg('Find usage'),
        assistantMsg('Searching...', [
          toolCall('Grep', { pattern: 'handleLogin' }),
          toolCall('Glob', { pattern: '**/*.test.ts' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      const actions = narrative.timeline.filter((e) => e.type === 'tool-action')
      expect(actions).toHaveLength(1)
      expect(actions[0].summary).toContain('handleLogin')
    })
  })

  describe('outcome', () => {
    it('should detect completed when last messages mention done/commit', () => {
      const session = makeSession([
        userMsg('Fix bug'),
        assistantMsg('Fixed! All tests pass and I\'ve committed the changes.'),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.outcome).toBe('completed')
    })

    it('should detect partial when last tool call errored', () => {
      const session = makeSession([
        userMsg('Build'),
        assistantMsg('Trying...', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Build failed' }),
        ]),
        assistantMsg('The build is failing due to...'),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.outcome).toBe('partial')
    })

    it('should detect abandoned for very short sessions', () => {
      const session = makeSession([
        userMsg('Hello'),
        assistantMsg('Hi!'),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.outcome).toBe('abandoned')
    })
  })

  describe('keyFiles', () => {
    it('should extract files with correct change types', () => {
      const session = makeSession([
        userMsg('Work on files'),
        assistantMsg('Working...', [
          toolCall('Write', { file_path: '/src/new-file.ts' }),
          toolCall('Edit', { file_path: '/src/existing.ts' }),
          toolCall('Edit', { file_path: '/src/existing.ts' }),
          toolCall('Read', { file_path: '/src/readme.md' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)

      const newFile = narrative.keyFiles.find((f) => f.path === '/src/new-file.ts')
      expect(newFile?.changeType).toBe('created')
      expect(newFile?.editCount).toBe(1)

      const edited = narrative.keyFiles.find((f) => f.path === '/src/existing.ts')
      expect(edited?.changeType).toBe('modified')
      expect(edited?.editCount).toBe(2)

      const readOnly = narrative.keyFiles.find((f) => f.path === '/src/readme.md')
      expect(readOnly?.changeType).toBe('read-only')
      expect(readOnly?.editCount).toBe(0)
    })

    it('should sort by editCount descending', () => {
      const session = makeSession([
        userMsg('Edit'),
        assistantMsg('Editing...', [
          toolCall('Edit', { file_path: '/src/a.ts' }),
          toolCall('Edit', { file_path: '/src/b.ts' }),
          toolCall('Edit', { file_path: '/src/b.ts' }),
          toolCall('Edit', { file_path: '/src/b.ts' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.keyFiles[0].path).toBe('/src/b.ts')
      expect(narrative.keyFiles[0].editCount).toBe(3)
    })

    it('should skip error tool calls', () => {
      const session = makeSession([
        userMsg('Edit'),
        assistantMsg('Editing...', [
          toolCall('Edit', { file_path: '/src/fail.ts' }, { isError: true, result: 'Failed' }),
        ]),
      ])
      const narrative = extractSessionNarrative(session)
      expect(narrative.keyFiles).toHaveLength(0)
    })
  })

  describe('keyDecisions', () => {
    it('should detect Chinese decision signals', () => {
      const messages: NormalizedMessage[] = [
        userMsg('实现登录功能'),
        assistantMsg('好的'),
        userMsg('不对，改成用 JWT 方案'),
        assistantMsg('好的，切换到 JWT'),
      ]
      const decisions = extractKeyDecisions(messages)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].trigger).toContain('改成')
      expect(decisions[0].messageIndex).toBe(2)
    })

    it('should detect English decision signals', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Add auth'),
        assistantMsg('Adding...'),
        userMsg('Actually, let\'s use OAuth instead'),
        assistantMsg('Switching to OAuth'),
      ]
      const decisions = extractKeyDecisions(messages)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].trigger).toContain('Actually')
    })

    it('should return empty array when no decisions', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Fix the bug'),
        assistantMsg('Fixed'),
      ]
      const decisions = extractKeyDecisions(messages)
      expect(decisions).toHaveLength(0)
    })

    it('should truncate long decision messages to 500 chars', () => {
      const longContent = '不对，' + 'A'.repeat(600)
      const messages: NormalizedMessage[] = [
        userMsg(longContent),
      ]
      const decisions = extractKeyDecisions(messages)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].trigger.length).toBeLessThanOrEqual(500)
    })
  })

  describe('errorResolutions', () => {
    it('should pair error with subsequent resolution', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Build'),
        assistantMsg('Building...', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Module not found' }),
        ]),
        assistantMsg('Fixed', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: false }),
        ]),
      ]
      const resolutions = extractErrorResolutions(messages)
      expect(resolutions).toHaveLength(1)
      expect(resolutions[0].error).toContain('Module not found')
      expect(resolutions[0].resolved).toBe(true)
    })

    it('should mark unresolved errors', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Build'),
        assistantMsg('Trying...', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Build failed' }),
        ]),
        assistantMsg('I cannot resolve this'),
      ]
      const resolutions = extractErrorResolutions(messages)
      expect(resolutions).toHaveLength(1)
      expect(resolutions[0].resolved).toBe(false)
      expect(resolutions[0].resolution).toContain('Unresolved')
    })

    it('should resolve via same file with different tool', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Fix'),
        assistantMsg('Trying...', [
          toolCall('Edit', { file_path: '/src/app.ts' }, { isError: true, result: 'Edit failed' }),
        ]),
        assistantMsg('Writing instead...', [
          toolCall('Write', { file_path: '/src/app.ts' }, { isError: false }),
        ]),
      ]
      const resolutions = extractErrorResolutions(messages)
      expect(resolutions).toHaveLength(1)
      expect(resolutions[0].resolved).toBe(true)
    })

    it('should deduplicate same error', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Build'),
        assistantMsg('Try 1', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Module not found' }),
        ]),
        assistantMsg('Try 2', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: true, result: 'Module not found' }),
        ]),
        assistantMsg('Fixed', [
          toolCall('Bash', { command: 'pnpm build' }, { isError: false }),
        ]),
      ]
      const resolutions = extractErrorResolutions(messages)
      expect(resolutions).toHaveLength(1)
    })
  })

  describe('assistantInsights', () => {
    it('should extract analytical paragraphs', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Why is this failing?'),
        assistantMsg('The problem is with the import resolution. The reason this fails is because TypeScript cannot resolve the path alias when running outside of the build system. This means the alias configuration in tsconfig.json is not being picked up by the test runner.'),
      ]
      const insights = extractAssistantInsights(messages)
      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0]).toContain('reason')
    })

    it('should skip purely operational messages', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Read the file'),
        assistantMsg('Let me read the file and check what is inside.'),
      ]
      const insights = extractAssistantInsights(messages)
      expect(insights).toHaveLength(0)
    })

    it('should limit to 5 insights', () => {
      const analyticalMsg = 'This is a significant finding. The reason this happens is because the bundler treats ESM and CJS differently, which means we need to handle both cases.'
      const messages: NormalizedMessage[] = [
        userMsg('Analyze'),
        assistantMsg(analyticalMsg),
        assistantMsg('Another issue: the problem is that the cache invalidation is incorrect because the TTL is too short.'),
        assistantMsg('The root cause is that since the middleware runs before auth, the request context is missing.'),
        assistantMsg('This error occurs because TypeScript strict mode requires explicit null checks. The reason is type narrowing.'),
        assistantMsg('The performance issue: the problem is N+1 queries since each resolver makes a separate DB call.'),
        assistantMsg('Security concern: the reason XSS works here is because the template uses innerHTML directly.'),
      ]
      const insights = extractAssistantInsights(messages)
      expect(insights.length).toBeLessThanOrEqual(5)
    })

    it('should truncate long insights to 300 chars', () => {
      const longAnalysis = 'The reason this fails is because ' + 'A'.repeat(500)
      const messages: NormalizedMessage[] = [
        userMsg('Explain'),
        assistantMsg(longAnalysis),
      ]
      const insights = extractAssistantInsights(messages)
      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0].length).toBeLessThanOrEqual(300)
    })

    it('should skip short messages', () => {
      const messages: NormalizedMessage[] = [
        userMsg('Fix'),
        assistantMsg('Done.'),
      ]
      const insights = extractAssistantInsights(messages)
      expect(insights).toHaveLength(0)
    })
  })
})
