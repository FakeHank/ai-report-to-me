import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { NormalizedSession, NormalizedMessage, ToolCall, SessionStats } from '../../shared/types.js'

interface RawEvent {
  timestamp: string
  type: string
  payload: Record<string, unknown>
}

interface SessionMetaPayload {
  id: string
  cwd: string
  cli_version: string
  model_provider?: string
  source?: string
}

interface FunctionCallPayload {
  type: 'function_call'
  name: string
  arguments: string
  call_id: string
}

interface FunctionCallOutputPayload {
  type: 'function_call_output'
  call_id: string
  output: string
}

interface MessagePayload {
  type: 'message'
  role: string
  content: Array<{ type: string; text?: string }>
}

interface TurnContextPayload {
  model: string
}

interface TokenUsage {
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
}

interface TokenCountInfo {
  total_token_usage: TokenUsage
}

export function parseCodexSession(filePath: string, projectPath: string): NormalizedSession {
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return emptySession(filePath, projectPath)

  const events: RawEvent[] = []
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      events.push(JSON.parse(line))
    } catch {
      // skip malformed
    }
  }

  if (events.length === 0) return emptySession(filePath, projectPath)

  // Extract session metadata
  const metaEvent = events.find((e) => e.type === 'session_meta')
  const meta = metaEvent?.payload as SessionMetaPayload | undefined
  const sessionId = meta?.id || extractSessionId(filePath)
  const cwd = meta?.cwd || projectPath
  const cliVersion = meta?.cli_version

  // Extract model from turn_context events
  const turnContext = events.find((e) => e.type === 'turn_context')
  const model = (turnContext?.payload as TurnContextPayload | undefined)?.model

  // Extract token usage from the last event_msg with token_count info
  const tokenUsage = extractTokenUsage(events)

  // Collect function call outputs by call_id
  const callOutputs = new Map<string, { output: string }>()
  for (const event of events) {
    if (event.type !== 'response_item') continue
    const payload = event.payload as { type?: string }
    if (payload.type === 'function_call_output') {
      const fco = payload as unknown as FunctionCallOutputPayload
      callOutputs.set(fco.call_id, { output: (fco.output || '').slice(0, 500) })
    }
  }

  // Build messages
  const messages: NormalizedMessage[] = []
  let currentToolCalls: ToolCall[] = []

  for (const event of events) {
    if (event.type === 'response_item') {
      const payload = event.payload as { type?: string; role?: string }

      if (payload.type === 'message') {
        const msg = payload as unknown as MessagePayload
        // Skip developer messages (system prompts)
        if (msg.role === 'developer') continue

        const textParts: string[] = []
        for (const block of msg.content || []) {
          if (block.type === 'input_text' && block.text) {
            // Skip system/permission/context preambles
            if (block.text.startsWith('<permissions') || block.text.startsWith('<app-context') || block.text.startsWith('<environment_context')) continue
            textParts.push(block.text)
          } else if (block.type === 'output_text' && block.text) {
            textParts.push(block.text)
          }
        }

        const text = textParts.join('\n').trim()
        if (!text) continue

        const role = msg.role === 'assistant' ? 'assistant' : 'user'

        // Flush pending tool calls to the last assistant message before adding a new message
        if (currentToolCalls.length > 0) {
          const lastAssistant = findLastAssistant(messages)
          if (lastAssistant) {
            lastAssistant.toolCalls = [...(lastAssistant.toolCalls || []), ...currentToolCalls]
          }
          currentToolCalls = []
        }

        messages.push({
          role,
          timestamp: new Date(event.timestamp),
          content: text.slice(0, 5000),
          model: role === 'assistant' ? model : undefined,
        })
      } else if (payload.type === 'function_call') {
        const fc = payload as unknown as FunctionCallPayload
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(fc.arguments)
        } catch {
          input = { raw: fc.arguments }
        }

        const output = callOutputs.get(fc.call_id)
        const isError = detectError(output?.output)

        currentToolCalls.push({
          name: fc.name,
          input,
          result: output?.output,
          isError,
        })
      }
    }
  }

  // Flush remaining tool calls
  if (currentToolCalls.length > 0) {
    const lastAssistant = findLastAssistant(messages)
    if (lastAssistant) {
      lastAssistant.toolCalls = [...(lastAssistant.toolCalls || []), ...currentToolCalls]
    }
  }

  // Compute timestamps
  const timestamps = events
    .filter((e) => e.timestamp)
    .map((e) => new Date(e.timestamp).getTime())
    .filter((t) => !isNaN(t))

  if (timestamps.length === 0) return emptySession(filePath, projectPath)

  const startTime = new Date(Math.min(...timestamps))
  const endTime = new Date(Math.max(...timestamps))
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  const stats = computeStats(messages, tokenUsage)

  return {
    sessionId,
    cli: 'codex',
    cliVersion,
    projectPath: cwd,
    projectName: extractProjectName(cwd),
    startTime,
    endTime,
    durationMinutes,
    messages,
    stats,
  }
}

/**
 * Detect errors from function call output using exit code, not string matching.
 */
function detectError(output: string | undefined): boolean {
  if (!output) return false
  // Codex shell_command outputs start with "Exit code: N" on error
  const exitMatch = output.match(/^Exit code: (\d+)/)
  if (exitMatch) return exitMatch[1] !== '0'
  // Also check for explicit error prefixes from Codex sandbox
  if (output.startsWith('Error:') || output.startsWith('ENOENT:') || output.startsWith('EACCES:')) return true
  return false
}

/**
 * Extract cumulative token usage from the last event_msg with token_count info.
 */
function extractTokenUsage(events: RawEvent[]): TokenUsage | null {
  let lastUsage: TokenUsage | null = null
  for (const event of events) {
    if (event.type !== 'event_msg') continue
    const payload = event.payload as { type?: string; info?: TokenCountInfo | null }
    if (payload.type === 'token_count' && payload.info?.total_token_usage) {
      lastUsage = payload.info.total_token_usage
    }
  }
  return lastUsage
}

function findLastAssistant(messages: NormalizedMessage[]): NormalizedMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i]
  }
  return undefined
}

export function extractSessionId(filePath: string): string {
  // rollout-2026-02-03T14-15-05-019c2223-eb3c-7443-904a-54fc9c239ffb.jsonl
  const name = basename(filePath, '.jsonl')
  // Extract UUID portion after the timestamp
  const match = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
  return match ? match[1] : name
}

function computeStats(messages: NormalizedMessage[], tokenUsage: TokenUsage | null): SessionStats {
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

        if (tc.name === 'shell_command' || tc.name === 'shell') {
          const cmd = (tc.input.command || '') as string
          extractFilesFromShellCommand(cmd, filesTouchedSet)
          if (isEditCommand(cmd)) editCount++
        } else if (tc.name === 'read_file') {
          const filePath = (tc.input.file_path || tc.input.path) as string | undefined
          if (filePath) filesTouchedSet.add(filePath)
        } else if (tc.name === 'write_file') {
          editCount++
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
    totalInputTokens: tokenUsage?.input_tokens || 0,
    totalOutputTokens: tokenUsage?.output_tokens || 0,
    totalCacheTokens: tokenUsage?.cached_input_tokens || 0,
    toolCallCount,
    toolCallsByName,
    filesTouched: [...filesTouchedSet],
    editCount,
    errorCount,
  }
}

/**
 * Extract file paths from shell commands. Codex primarily uses shell_command
 * with patterns like `cat <<'EOF' > file`, `sed`, `echo >`, etc.
 */
function extractFilesFromShellCommand(cmd: string, files: Set<string>): void {
  // cat <<'EOF' > /path/to/file or cat > /path/to/file
  const catRedirect = cmd.match(/cat\s+(?:<<['"]?\w+['"]?\s+)?>\s*["']?([^\s"']+)/)
  if (catRedirect) { files.add(catRedirect[1]); return }

  // Direct redirect: > /path or >> /path
  const redirect = cmd.match(/>\s*["']?([^\s"'>]+\.[\w]+)/)
  if (redirect) { files.add(redirect[1]); return }

  // Read commands: cat, less, head, tail, vim, nano, code
  const readMatch = cmd.match(/(?:cat|less|head|tail|vim|nano|code|bat)\s+["']?([^\s"'|>]+\.[\w]+)/)
  if (readMatch) files.add(readMatch[1])

  // sed -i, patch
  const sedMatch = cmd.match(/sed\s+-i['".]?\s+.*?["']?\s+["']?([^\s"']+\.[\w]+)/)
  if (sedMatch) files.add(sedMatch[1])

  // grep/rg with file path
  const grepMatch = cmd.match(/(?:grep|rg)\s+.*?\s+["']?([^\s"'|>]+\.[\w]+)/)
  if (grepMatch) files.add(grepMatch[1])
}

/**
 * Detect if a shell command is a file-editing (write) operation.
 */
function isEditCommand(cmd: string): boolean {
  return /cat\s+<</.test(cmd) ||
    />\s*[^\s]/.test(cmd) ||
    /sed\s+-i/.test(cmd) ||
    /patch\s/.test(cmd) ||
    /tee\s/.test(cmd)
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
}

function emptySession(filePath: string, projectPath: string): NormalizedSession {
  return {
    sessionId: extractSessionId(filePath),
    cli: 'codex',
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
