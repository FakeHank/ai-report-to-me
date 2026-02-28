import { readFileSync } from 'node:fs'
import type { NormalizedSession, NormalizedMessage, ToolCall, TokenUsage, SessionStats } from '../../shared/types.js'
import { basename } from 'node:path'

interface RawEntry {
  type: string
  sessionId?: string
  cwd?: string
  version?: string
  gitBranch?: string
  timestamp?: string
  uuid?: string
  message?: RawMessage
  [key: string]: unknown
}

interface RawMessage {
  role: string
  content: unknown
  model?: string
  usage?: RawUsage
  [key: string]: unknown
}

interface RawUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface RawToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface RawToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: unknown
  is_error?: boolean
}

export function parseClaudeCodeSession(filePath: string, projectPath: string): NormalizedSession {
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) {
    return emptySession(filePath, projectPath)
  }

  const entries: RawEntry[] = []
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // skip malformed lines
    }
  }

  if (entries.length === 0) {
    return emptySession(filePath, projectPath)
  }

  const sessionId = entries[0].sessionId || basename(filePath, '.jsonl')
  const cliVersion = entries[0].version
  const gitBranch = entries[0].gitBranch
  const cwd = entries[0].cwd || projectPath

  const messages: NormalizedMessage[] = []
  const toolResults = new Map<string, { result?: string; isError: boolean }>()

  // First pass: collect tool results
  for (const entry of entries) {
    if (entry.type === 'user' && entry.message?.content) {
      const contentArr = Array.isArray(entry.message.content) ? entry.message.content : []
      for (const block of contentArr) {
        if (block && typeof block === 'object' && (block as RawToolResult).type === 'tool_result') {
          const tr = block as RawToolResult
          const resultText = typeof tr.content === 'string'
            ? tr.content
            : Array.isArray(tr.content)
              ? (tr.content as Array<{ text?: string }>).map((c) => c.text || '').join('')
              : ''
          toolResults.set(tr.tool_use_id, {
            result: resultText.slice(0, 500),
            isError: tr.is_error || false,
          })
        }
      }
    }
  }

  // Second pass: build messages, dedup by uuid
  const seenUuids = new Set<string>()
  // Track the latest assistant message content per requestId to handle streaming
  const assistantMessages = new Map<string, { entry: RawEntry; textParts: string[]; toolCalls: ToolCall[]; usage: TokenUsage | undefined }>()

  for (const entry of entries) {
    if (entry.uuid && seenUuids.has(entry.uuid)) continue
    if (entry.uuid) seenUuids.add(entry.uuid)

    if (entry.type === 'user' && entry.message) {
      const text = extractTextContent(entry.message.content)
      if (text) {
        messages.push({
          role: 'user',
          timestamp: new Date(entry.timestamp || 0),
          content: text,
        })
      }
    } else if (entry.type === 'assistant' && entry.message) {
      const requestId = (entry.message as Record<string, unknown>).id as string | undefined || entry.uuid || ''

      if (!assistantMessages.has(requestId)) {
        assistantMessages.set(requestId, { entry, textParts: [], toolCalls: [], usage: undefined })
      }

      const am = assistantMessages.get(requestId)!
      const contentArr = Array.isArray(entry.message.content) ? entry.message.content : []

      for (const block of contentArr) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>

        if (b.type === 'text' && typeof b.text === 'string') {
          am.textParts.push(b.text)
        } else if (b.type === 'tool_use') {
          const tu = b as unknown as RawToolUse
          const result = toolResults.get(tu.id)
          am.toolCalls.push({
            name: tu.name,
            input: tu.input || {},
            result: result?.result,
            isError: result?.isError || false,
          })
        }
      }

      if (entry.message.usage) {
        am.usage = parseUsage(entry.message.usage)
      }
    }
  }

  // Convert collected assistant messages to NormalizedMessages
  for (const [, am] of assistantMessages) {
    const text = am.textParts.join('')
    if (!text && am.toolCalls.length === 0) continue
    messages.push({
      role: 'assistant',
      timestamp: new Date(am.entry.timestamp || 0),
      content: text,
      model: am.entry.message?.model,
      toolCalls: am.toolCalls.length > 0 ? am.toolCalls : undefined,
      usage: am.usage,
    })
  }

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const timestamps = entries
    .filter((e) => e.timestamp)
    .map((e) => new Date(e.timestamp!).getTime())

  const startTime = new Date(Math.min(...timestamps))
  const endTime = new Date(Math.max(...timestamps))
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  const stats = computeStats(messages)
  const projectName = extractProjectName(cwd)

  return {
    sessionId,
    cli: 'claude-code',
    cliVersion,
    projectPath: cwd,
    projectName,
    gitBranch: gitBranch || undefined,
    startTime,
    endTime,
    durationMinutes,
    messages,
    stats,
  }
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b): b is Record<string, unknown> => b && typeof b === 'object')
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
  }
  return ''
}

function parseUsage(usage: RawUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
  }
}

function computeStats(messages: NormalizedMessage[]): SessionStats {
  const toolCallsByName: Record<string, number> = {}
  const filesTouchedSet = new Set<string>()
  let toolCallCount = 0
  let editCount = 0
  let errorCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheTokens = 0

  for (const msg of messages) {
    if (msg.usage) {
      totalInputTokens += msg.usage.inputTokens
      totalOutputTokens += msg.usage.outputTokens
      totalCacheTokens += (msg.usage.cacheReadTokens || 0) + (msg.usage.cacheWriteTokens || 0)
    }

    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        toolCallCount++
        toolCallsByName[tc.name] = (toolCallsByName[tc.name] || 0) + 1

        if (tc.isError) errorCount++

        if (tc.name === 'Edit' || tc.name === 'Write') {
          editCount++
          const filePath = (tc.input.file_path || tc.input.path) as string | undefined
          if (filePath) filesTouchedSet.add(filePath)
        } else if (tc.name === 'Read' || tc.name === 'Grep' || tc.name === 'Glob') {
          const filePath = (tc.input.file_path || tc.input.path) as string | undefined
          if (filePath) filesTouchedSet.add(filePath)
        }
      }
    }
  }

  return {
    messageCount: messages.length,
    userMessageCount: messages.filter((m) => m.role === 'user').length,
    assistantMessageCount: messages.filter((m) => m.role === 'assistant').length,
    totalInputTokens,
    totalOutputTokens,
    totalCacheTokens,
    toolCallCount,
    toolCallsByName,
    filesTouched: [...filesTouchedSet],
    editCount,
    errorCount,
  }
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
}

function emptySession(filePath: string, projectPath: string): NormalizedSession {
  return {
    sessionId: basename(filePath, '.jsonl'),
    cli: 'claude-code',
    projectPath,
    projectName: extractProjectName(projectPath),
    startTime: new Date(),
    endTime: new Date(),
    durationMinutes: 0,
    messages: [],
    stats: {
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheTokens: 0,
      toolCallCount: 0,
      toolCallsByName: {},
      filesTouched: [],
      editCount: 0,
      errorCount: 0,
    },
  }
}
