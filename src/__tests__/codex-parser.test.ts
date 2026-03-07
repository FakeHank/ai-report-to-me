import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCodexSession, extractSessionId } from '../adapters/codex/parser.js'

// Mock fs.readFileSync
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, readFileSync: vi.fn() }
})

import { readFileSync } from 'node:fs'
const mockReadFileSync = vi.mocked(readFileSync)

function jsonl(...events: object[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n')
}

function sessionMeta(cwd = '/test/project') {
  return { type: 'session_meta', timestamp: '2026-02-03T06:00:00Z', payload: { id: 'test-session-id', cwd, cli_version: '0.1.0' } }
}

function turnContext(model = 'o3') {
  return { type: 'turn_context', timestamp: '2026-02-03T06:00:01Z', payload: { model, cwd: '/test' } }
}

function userMessage(text: string, ts = '2026-02-03T06:01:00Z') {
  return { type: 'response_item', timestamp: ts, payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }
}

function assistantMessage(text: string, ts = '2026-02-03T06:01:30Z') {
  return { type: 'response_item', timestamp: ts, payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } }
}

function functionCall(name: string, args: object, callId: string, ts = '2026-02-03T06:01:45Z') {
  return { type: 'response_item', timestamp: ts, payload: { type: 'function_call', name, arguments: JSON.stringify(args), call_id: callId } }
}

function functionOutput(callId: string, output: string, ts = '2026-02-03T06:01:50Z') {
  return { type: 'response_item', timestamp: ts, payload: { type: 'function_call_output', call_id: callId, output } }
}

function tokenCountEvent(inputTokens: number, outputTokens: number, cachedTokens: number, ts = '2026-02-03T06:02:00Z') {
  return {
    type: 'event_msg', timestamp: ts,
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: inputTokens, cached_input_tokens: cachedTokens, output_tokens: outputTokens } },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractSessionId', () => {
  it('should extract UUID from Codex filename', () => {
    expect(extractSessionId('/sessions/2026/02/03/rollout-2026-02-03T14-15-05-019c2223-eb3c-7443-904a-54fc9c239ffb.jsonl'))
      .toBe('019c2223-eb3c-7443-904a-54fc9c239ffb')
  })

  it('should return full name if no UUID found', () => {
    expect(extractSessionId('/sessions/unknown-file.jsonl')).toBe('unknown-file')
  })
})

describe('parseCodexSession', () => {
  it('should return empty session for empty file', () => {
    mockReadFileSync.mockReturnValue('')
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.messages).toEqual([])
    expect(session.stats.messageCount).toBe(0)
    expect(session.cli).toBe('codex')
  })

  it('should return empty session for malformed content', () => {
    mockReadFileSync.mockReturnValue('not json at all\n{broken')
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.messages).toEqual([])
  })

  it('should parse basic session with user and assistant messages', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Hello'),
      assistantMessage('Hi there!'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    expect(session.sessionId).toBe('test-session-id')
    expect(session.cli).toBe('codex')
    expect(session.cliVersion).toBe('0.1.0')
    expect(session.projectPath).toBe('/test/project')
    expect(session.stats.messageCount).toBe(2)
    expect(session.stats.userMessageCount).toBe(1)
    expect(session.stats.assistantMessageCount).toBe(1)
    expect(session.messages[0].role).toBe('user')
    expect(session.messages[0].content).toBe('Hello')
    expect(session.messages[1].role).toBe('assistant')
    expect(session.messages[1].content).toBe('Hi there!')
    expect(session.messages[1].model).toBe('o3')
  })

  it('should skip developer messages', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      { type: 'response_item', timestamp: '2026-02-03T06:00:00Z', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'system prompt' }] } },
      userMessage('Hello'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.stats.messageCount).toBe(1)
    expect(session.messages[0].role).toBe('user')
  })

  it('should skip system preamble content blocks', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      { type: 'response_item', timestamp: '2026-02-03T06:01:00Z', payload: { type: 'message', role: 'user', content: [
        { type: 'input_text', text: '<permissions>allow all</permissions>' },
        { type: 'input_text', text: '<app-context>...</app-context>' },
        { type: 'input_text', text: 'Real user message' },
      ] } },
    ))
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.messages[0].content).toBe('Real user message')
  })

  it('should attach tool calls to the correct assistant message', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('List files', '2026-02-03T06:01:00Z'),
      assistantMessage('Let me check', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: 'ls' }, 'call-1', '2026-02-03T06:01:15Z'),
      functionOutput('call-1', 'file1.ts\nfile2.ts', '2026-02-03T06:01:16Z'),
      userMessage('Thanks', '2026-02-03T06:02:00Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    // Tool calls should be on the assistant message, not on the user message
    const assistant = session.messages.find((m) => m.role === 'assistant')!
    expect(assistant.toolCalls).toHaveLength(1)
    expect(assistant.toolCalls![0].name).toBe('shell_command')
    expect(assistant.toolCalls![0].result).toBe('file1.ts\nfile2.ts')
    expect(assistant.toolCalls![0].isError).toBe(false)
  })

  it('should flush tool calls at end of session to last assistant', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Do it', '2026-02-03T06:01:00Z'),
      assistantMessage('Working on it', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: 'echo done' }, 'call-1', '2026-02-03T06:01:15Z'),
      functionOutput('call-1', 'done', '2026-02-03T06:01:16Z'),
      // No more messages after the tool call
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    const assistant = session.messages.find((m) => m.role === 'assistant')!
    expect(assistant.toolCalls).toHaveLength(1)
  })

  it('should flush tool calls before any new message, not just user messages', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Step 1', '2026-02-03T06:01:00Z'),
      assistantMessage('First response', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: 'ls' }, 'call-1', '2026-02-03T06:01:15Z'),
      functionOutput('call-1', 'ok', '2026-02-03T06:01:16Z'),
      // Another assistant message without an intervening user message
      assistantMessage('Second response', '2026-02-03T06:01:20Z'),
      functionCall('shell_command', { command: 'pwd' }, 'call-2', '2026-02-03T06:01:25Z'),
      functionOutput('call-2', '/test', '2026-02-03T06:01:26Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    const assistants = session.messages.filter((m) => m.role === 'assistant')
    expect(assistants).toHaveLength(2)
    // First assistant should have `ls` tool call
    expect(assistants[0].toolCalls).toHaveLength(1)
    expect(assistants[0].toolCalls![0].input).toEqual({ command: 'ls' })
    // Second assistant should have `pwd` tool call (flushed at end)
    expect(assistants[1].toolCalls).toHaveLength(1)
    expect(assistants[1].toolCalls![0].input).toEqual({ command: 'pwd' })
  })

  it('should detect errors by exit code, not by string matching', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Run test', '2026-02-03T06:01:00Z'),
      assistantMessage('Running', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: 'false' }, 'call-err', '2026-02-03T06:01:15Z'),
      functionOutput('call-err', 'Exit code: 1\ncommand failed', '2026-02-03T06:01:16Z'),
      functionCall('shell_command', { command: 'echo ok' }, 'call-ok', '2026-02-03T06:01:20Z'),
      functionOutput('call-ok', 'Exit code: 0\nok', '2026-02-03T06:01:21Z'),
      // Output that mentions "Error" in the middle — should NOT be an error
      functionCall('shell_command', { command: 'grep Error log' }, 'call-fp', '2026-02-03T06:01:25Z'),
      functionOutput('call-fp', 'Log line: Error: something happened in module X', '2026-02-03T06:01:26Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    const tc = session.messages.find((m) => m.role === 'assistant')!.toolCalls!
    expect(tc[0].isError).toBe(true)   // Exit code: 1
    expect(tc[1].isError).toBe(false)  // Exit code: 0
    expect(tc[2].isError).toBe(false)  // No exit code prefix, "Error:" is content not error
  })

  it('should extract file paths from shell_command cat heredoc writes', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Create file', '2026-02-03T06:01:00Z'),
      assistantMessage('Creating', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: "cat <<'EOF' > /project/src/app.ts\nconsole.log('hi')\nEOF" }, 'call-1', '2026-02-03T06:01:15Z'),
      functionOutput('call-1', '', '2026-02-03T06:01:16Z'),
      functionCall('shell_command', { command: 'cat /project/src/app.ts' }, 'call-2', '2026-02-03T06:01:20Z'),
      functionOutput('call-2', "console.log('hi')", '2026-02-03T06:01:21Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    expect(session.stats.filesTouched).toContain('/project/src/app.ts')
    expect(session.stats.editCount).toBe(1) // Only the cat heredoc is an edit
  })

  it('should extract token usage from event_msg token_count events', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Hello'),
      tokenCountEvent(1000, 200, 800, '2026-02-03T06:01:30Z'),
      assistantMessage('Hi'),
      tokenCountEvent(2500, 500, 1800, '2026-02-03T06:02:00Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    // Should use the last (cumulative) token count
    expect(session.stats.totalInputTokens).toBe(2500)
    expect(session.stats.totalOutputTokens).toBe(500)
    expect(session.stats.totalCacheTokens).toBe(1800)
  })

  it('should leave token stats as 0 when no token_count info available', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      // token_count event with null info (as seen in some sessions)
      { type: 'event_msg', timestamp: '2026-02-03T06:01:30Z', payload: { type: 'token_count', info: null, rate_limits: {} } },
      userMessage('Hello'),
      assistantMessage('Hi'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    expect(session.stats.totalInputTokens).toBe(0)
    expect(session.stats.totalOutputTokens).toBe(0)
    expect(session.stats.totalCacheTokens).toBe(0)
  })

  it('should use fallback session ID from filename when no session_meta', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      turnContext(),
      userMessage('Hello'),
      assistantMessage('Hi'),
    ))
    const session = parseCodexSession(
      '/sessions/rollout-2026-02-03T14-15-05-019c2223-eb3c-7443-904a-54fc9c239ffb.jsonl',
      '/project',
    )
    expect(session.sessionId).toBe('019c2223-eb3c-7443-904a-54fc9c239ffb')
  })

  it('should handle session with only function calls and no messages', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      functionCall('shell_command', { command: 'ls' }, 'call-1'),
      functionOutput('call-1', 'file.txt'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')

    // No messages, so tool calls have nowhere to attach
    expect(session.stats.messageCount).toBe(0)
    expect(session.stats.toolCallCount).toBe(0)
  })

  it('should compute correct duration from timestamps', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      userMessage('Start', '2026-02-03T06:00:00Z'),
      assistantMessage('End', '2026-02-03T06:30:00Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.durationMinutes).toBe(30)
  })

  it('should count error tool calls in stats', () => {
    mockReadFileSync.mockReturnValue(jsonl(
      sessionMeta(),
      turnContext(),
      userMessage('Run', '2026-02-03T06:01:00Z'),
      assistantMessage('Ok', '2026-02-03T06:01:10Z'),
      functionCall('shell_command', { command: 'bad' }, 'c1', '2026-02-03T06:01:15Z'),
      functionOutput('c1', 'Exit code: 127\nnot found', '2026-02-03T06:01:16Z'),
      functionCall('shell_command', { command: 'good' }, 'c2', '2026-02-03T06:01:20Z'),
      functionOutput('c2', 'Exit code: 0\nok', '2026-02-03T06:01:21Z'),
    ))
    const session = parseCodexSession('/test.jsonl', '/project')
    expect(session.stats.errorCount).toBe(1)
    expect(session.stats.toolCallCount).toBe(2)
  })
})
