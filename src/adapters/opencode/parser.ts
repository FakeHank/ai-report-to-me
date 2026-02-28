import type { NormalizedSession, NormalizedMessage, ToolCall, TokenUsage, SessionStats } from '../../shared/types.js'

interface OpenCodeMessageData {
  role: 'user' | 'assistant'
  time: {
    created: number
    completed?: number
  }
  modelID?: string
  providerID?: string
  agent?: string
  tokens?: {
    total?: number
    input?: number
    output?: number
    reasoning?: number
    cache?: {
      read?: number
      write?: number
    }
  }
}

interface OpenCodePartData {
  type: string
  // text part
  text?: string
  // tool part
  callID?: string
  tool?: string
  state?: {
    status?: string
    input?: Record<string, unknown>
    output?: string
    title?: string
    time?: {
      start?: number
      end?: number
    }
  }
  // step-finish part
  tokens?: {
    total?: number
    input?: number
    output?: number
    reasoning?: number
    cache?: {
      read?: number
      write?: number
    }
  }
}

interface MessageRow {
  id: string
  session_id: string
  time_created: number
  data: string
}

interface PartRow {
  id: string
  message_id: string
  session_id: string
  time_created: number
  data: string
}

interface SessionRow {
  id: string
  project_id: string
  directory: string
  title: string
  time_created: number
  time_updated: number
}

interface ProjectRow {
  id: string
  worktree: string
  name: string | null
}

export interface OpenCodeSessionInfo {
  session: SessionRow
  project: ProjectRow | null
}

export function parseOpenCodeMessages(
  messageRows: MessageRow[],
  partRows: PartRow[],
  sessionInfo: OpenCodeSessionInfo
): NormalizedSession {
  const { session, project } = sessionInfo
  const projectPath = session.directory || project?.worktree || ''
  const projectName = project?.name || extractProjectName(projectPath)

  // Group parts by message_id
  const partsByMessage = new Map<string, PartRow[]>()
  for (const part of partRows) {
    const existing = partsByMessage.get(part.message_id) || []
    existing.push(part)
    partsByMessage.set(part.message_id, existing)
  }

  const messages: NormalizedMessage[] = []

  for (const msgRow of messageRows) {
    let msgData: OpenCodeMessageData
    try {
      msgData = JSON.parse(msgRow.data)
    } catch {
      continue
    }

    const parts = partsByMessage.get(msgRow.id) || []
    parts.sort((a, b) => a.time_created - b.time_created)

    const textParts: string[] = []
    const toolCalls: ToolCall[] = []
    let usage: TokenUsage | undefined

    // Use message-level tokens if available
    if (msgData.tokens) {
      usage = {
        inputTokens: msgData.tokens.input || 0,
        outputTokens: msgData.tokens.output || 0,
        cacheReadTokens: msgData.tokens.cache?.read || 0,
        cacheWriteTokens: msgData.tokens.cache?.write || 0,
      }
    }

    for (const partRow of parts) {
      let partData: OpenCodePartData
      try {
        partData = JSON.parse(partRow.data)
      } catch {
        continue
      }

      if (partData.type === 'text' && partData.text) {
        textParts.push(partData.text)
      } else if (partData.type === 'tool' && partData.tool) {
        const durationMs = partData.state?.time?.start && partData.state?.time?.end
          ? partData.state.time.end - partData.state.time.start
          : undefined

        toolCalls.push({
          name: partData.tool,
          input: partData.state?.input || {},
          result: partData.state?.output ? partData.state.output.slice(0, 500) : undefined,
          durationMs,
          isError: partData.state?.status === 'error',
        })
      } else if (partData.type === 'step-finish' && partData.tokens && !usage) {
        usage = {
          inputTokens: partData.tokens.input || 0,
          outputTokens: partData.tokens.output || 0,
          cacheReadTokens: partData.tokens.cache?.read || 0,
          cacheWriteTokens: partData.tokens.cache?.write || 0,
        }
      }
    }

    const content = textParts.join('\n').trim()
    if (!content && toolCalls.length === 0) continue

    const role = msgData.role === 'assistant' ? 'assistant' : 'user'

    messages.push({
      role,
      timestamp: new Date(msgData.time.created),
      content: content.slice(0, 5000),
      model: msgData.modelID,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    })
  }

  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  const startTime = new Date(session.time_created)
  const endTime = new Date(session.time_updated)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  const stats = computeStats(messages)

  return {
    sessionId: session.id,
    cli: 'opencode',
    projectPath,
    projectName,
    startTime,
    endTime,
    durationMinutes,
    messages,
    stats,
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

        if (tc.name === 'edit' || tc.name === 'write' || tc.name === 'patch') {
          editCount++
          const filePath = (tc.input.filePath || tc.input.file_path || tc.input.path) as string | undefined
          if (filePath) filesTouchedSet.add(filePath)
        } else if (tc.name === 'read') {
          const filePath = (tc.input.filePath || tc.input.file_path) as string | undefined
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
