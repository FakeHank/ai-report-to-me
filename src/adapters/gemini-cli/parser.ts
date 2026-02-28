import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { NormalizedSession, NormalizedMessage, ToolCall, SessionStats } from '../../shared/types.js'

interface GeminiMessage {
  role: string
  parts?: GeminiPart[]
}

interface GeminiPart {
  text?: string
  functionCall?: {
    name: string
    args: Record<string, unknown>
  }
  functionResponse?: {
    name: string
    response: {
      result?: unknown
      error?: string
    }
  }
}

interface GeminiSession {
  messages?: GeminiMessage[]
  history?: GeminiMessage[]
  createTime?: string
  updateTime?: string
  model?: string
}

export function parseGeminiSession(filePath: string, projectPath: string): NormalizedSession {
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return emptySession(filePath, projectPath)

  let sessionData: GeminiSession
  try {
    sessionData = JSON.parse(content)
  } catch {
    return emptySession(filePath, projectPath)
  }

  const rawMessages = sessionData.messages || sessionData.history || []
  if (rawMessages.length === 0) return emptySession(filePath, projectPath)

  const sessionId = basename(filePath, '.json')
  const messages: NormalizedMessage[] = []

  for (const msg of rawMessages) {
    const role = msg.role === 'model' || msg.role === 'gemini' ? 'assistant' : 'user'
    const textParts: string[] = []
    const toolCalls: ToolCall[] = []

    for (const part of msg.parts || []) {
      if (part.text) {
        textParts.push(part.text)
      }
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          input: part.functionCall.args || {},
          isError: false,
        })
      }
      if (part.functionResponse) {
        // Match function response to the last tool call with the same name
        const matchingCall = toolCalls.find((tc) => tc.name === part.functionResponse!.name && !tc.result)
        if (matchingCall) {
          matchingCall.result = JSON.stringify(part.functionResponse.response?.result || '').slice(0, 500)
          matchingCall.isError = !!part.functionResponse.response?.error
        }
      }
    }

    const content = textParts.join('\n').trim()
    if (!content && toolCalls.length === 0) continue

    messages.push({
      role,
      timestamp: new Date(), // Gemini CLI sessions don't have per-message timestamps
      content: content.slice(0, 5000),
      model: sessionData.model,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    })
  }

  const stats = computeStats(messages)

  // Use file stat for timestamps since Gemini doesn't provide them
  const startTime = sessionData.createTime ? new Date(sessionData.createTime) : new Date()
  const endTime = sessionData.updateTime ? new Date(sessionData.updateTime) : new Date()
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  return {
    sessionId,
    cli: 'gemini-cli',
    projectPath,
    projectName: extractProjectName(projectPath),
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

  for (const msg of messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        toolCallCount++
        toolCallsByName[tc.name] = (toolCallsByName[tc.name] || 0) + 1
        if (tc.isError) errorCount++

        // Extract files from common Gemini tool calls
        const filePath = (tc.input.file_path || tc.input.path || tc.input.filePath) as string | undefined
        if (filePath) {
          filesTouchedSet.add(filePath)
          if (tc.name.includes('edit') || tc.name.includes('write') || tc.name.includes('patch')) {
            editCount++
          }
        }
      }
    }
  }

  return {
    messageCount: messages.length,
    userMessageCount: messages.filter((m) => m.role === 'user').length,
    assistantMessageCount: messages.filter((m) => m.role === 'assistant').length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheTokens: 0,
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
    sessionId: basename(filePath, '.json'),
    cli: 'gemini-cli',
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
