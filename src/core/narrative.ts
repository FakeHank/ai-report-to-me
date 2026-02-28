import type { NormalizedSession, NormalizedMessage, ToolCall, KeyDecision, ErrorResolution } from '../shared/types.js'

export interface SessionNarrative {
  intent: string
  timeline: TimelineEntry[]
  outcome: 'completed' | 'partial' | 'abandoned'
  keyFiles: FileChange[]
  keyDecisions: KeyDecision[]
  errorResolutions: ErrorResolution[]
  assistantInsights: string[]
}

export interface TimelineEntry {
  type: 'user-request' | 'tool-action' | 'error' | 'direction-change'
  summary: string
}

export interface FileChange {
  path: string
  changeType: 'created' | 'modified' | 'read-only'
  editCount: number
}

export function extractSessionNarrative(session: NormalizedSession): SessionNarrative {
  const intent = extractIntent(session.messages)
  const timeline = buildTimeline(session.messages)
  const outcome = detectOutcome(session.messages)
  const keyFiles = extractKeyFiles(session.messages)
  const keyDecisions = extractKeyDecisions(session.messages)
  const errorResolutions = extractErrorResolutions(session.messages)
  const assistantInsights = extractAssistantInsights(session.messages)

  return { intent, timeline, outcome, keyFiles, keyDecisions, errorResolutions, assistantInsights }
}

function extractIntent(messages: NormalizedMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return '(no user message)'
  return truncate(firstUser.content, 500)
}

function buildTimeline(messages: NormalizedMessage[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const writtenFiles = new Set<string>()

  for (const msg of messages) {
    if (msg.role === 'user') {
      entries.push({
        type: 'user-request',
        summary: truncate(msg.content, 200),
      })
      continue
    }

    if (msg.role !== 'assistant' || !msg.toolCalls?.length) continue

    // Group consecutive tool calls by type
    const grouped = groupToolCalls(msg.toolCalls)

    for (const group of grouped) {
      if (group.hasErrors) {
        for (const tc of group.calls.filter((c) => c.isError)) {
          entries.push({
            type: 'error',
            summary: `${tc.name}: ${truncate(tc.result || 'Unknown error', 500)}`,
          })
        }
      }

      // Detect direction changes: file written again (approach restart)
      for (const tc of group.calls) {
        if (tc.name !== 'Write') continue
        const file = extractFilePath(tc)
        if (file && writtenFiles.has(file)) {
          entries.push({
            type: 'direction-change',
            summary: `Rewrote ${file} (approach restart)`,
          })
        }
        if (file) writtenFiles.add(file)
      }

      // Non-error tool actions
      const nonErrorCalls = group.calls.filter((c) => !c.isError)
      if (nonErrorCalls.length === 0) continue

      const summary = summarizeToolGroup(group.type, nonErrorCalls)
      if (summary) {
        entries.push({ type: 'tool-action', summary })
      }
    }
  }

  return entries
}

interface ToolGroup {
  type: string
  calls: ToolCall[]
  hasErrors: boolean
}

function groupToolCalls(toolCalls: ToolCall[]): ToolGroup[] {
  const groups: ToolGroup[] = []
  let current: ToolGroup | null = null

  for (const tc of toolCalls) {
    const type = normalizeToolType(tc.name)
    if (current && current.type === type) {
      current.calls.push(tc)
      if (tc.isError) current.hasErrors = true
    } else {
      current = { type, calls: [tc], hasErrors: tc.isError }
      groups.push(current)
    }
  }

  return groups
}

function normalizeToolType(name: string): string {
  if (name === 'Edit' || name === 'Write') return 'Edit/Write'
  if (name === 'Grep' || name === 'Glob') return 'Search'
  return name
}

function summarizeToolGroup(type: string, calls: ToolCall[]): string | null {
  switch (type) {
    case 'Edit/Write': {
      const files = [...new Set(calls.map(extractFilePath).filter(Boolean))]
      if (files.length === 0) return null
      if (files.length <= 3) return `Edited ${files.join(', ')}`
      return `Edited ${files.slice(0, 3).join(', ')} and ${files.length - 3} more files`
    }
    case 'Read': {
      const files = [...new Set(calls.map(extractFilePath).filter(Boolean))]
      if (files.length === 0) return null
      if (files.length <= 3) return `Read ${files.join(', ')}`
      return `Read ${files.slice(0, 3).join(', ')} and ${files.length - 3} more files`
    }
    case 'Bash': {
      const cmds = calls.map((tc) => truncate(String(tc.input.command || ''), 100)).filter(Boolean)
      if (cmds.length === 0) return null
      if (cmds.length === 1) return `Bash: ${cmds[0]}`
      return `Bash: ${cmds[0]} (+${cmds.length - 1} more)`
    }
    case 'Search': {
      const patterns = calls.map((tc) => String(tc.input.pattern || tc.input.glob || '')).filter(Boolean)
      if (patterns.length === 0) return null
      return `Searched for: ${patterns.slice(0, 3).join(', ')}`
    }
    case 'Task': {
      const descriptions = calls.map((tc) => truncate(String(tc.input.description || tc.input.prompt || ''), 100)).filter(Boolean)
      if (descriptions.length === 0) return `Launched ${calls.length} sub-agent(s)`
      return `Sub-agent: ${descriptions[0]}${calls.length > 1 ? ` (+${calls.length - 1} more)` : ''}`
    }
    default: {
      return `${type} ×${calls.length}`
    }
  }
}

function extractFilePath(tc: ToolCall): string | null {
  const path = (tc.input.file_path || tc.input.path) as string | undefined
  return path || null
}

function detectOutcome(messages: NormalizedMessage[]): 'completed' | 'partial' | 'abandoned' {
  // Look at the last few messages
  const tail = messages.slice(-5)
  const lastContent = tail
    .filter((m) => m.role === 'assistant' || m.role === 'user')
    .map((m) => m.content.toLowerCase())
    .join(' ')

  const completionSignals = ['done', 'complete', 'finished', 'committed', 'git commit', 'lgtm', 'looks good', 'all tests pass', '完成', '搞定']
  if (completionSignals.some((s) => lastContent.includes(s))) {
    return 'completed'
  }

  // Check if last assistant message has tool calls that errored
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  if (lastAssistant?.toolCalls?.some((tc) => tc.isError)) {
    return 'partial'
  }

  // Check if session is very short (< 3 messages) — likely abandoned
  if (messages.length < 3) {
    return 'abandoned'
  }

  return 'partial'
}

function extractKeyFiles(messages: NormalizedMessage[]): FileChange[] {
  const fileActions = new Map<string, { writes: number; edits: number; reads: number }>()

  for (const msg of messages) {
    if (!msg.toolCalls) continue
    for (const tc of msg.toolCalls) {
      if (tc.isError) continue
      const file = extractFilePath(tc)
      if (!file) continue

      if (!fileActions.has(file)) {
        fileActions.set(file, { writes: 0, edits: 0, reads: 0 })
      }
      const entry = fileActions.get(file)!

      if (tc.name === 'Write') entry.writes++
      else if (tc.name === 'Edit') entry.edits++
      else if (tc.name === 'Read') entry.reads++
    }
  }

  const results: FileChange[] = []
  for (const [path, actions] of fileActions) {
    let changeType: FileChange['changeType']
    const editCount = actions.writes + actions.edits

    if (actions.writes > 0 && actions.edits === 0) {
      changeType = 'created'
    } else if (editCount > 0) {
      changeType = 'modified'
    } else {
      changeType = 'read-only'
    }

    results.push({ path, changeType, editCount })
  }

  // Sort by editCount descending, then by changeType priority
  return results
    .sort((a, b) => b.editCount - a.editCount)
    .slice(0, 20)
}

// --- Decision signal patterns ---
const DECISION_SIGNALS_ZH = ['不对', '换个', '改成', '其实应该', '别用', '我的意思是', '不是这样', '你还是没理解', '用.*方案', '不要.*', '改为']
const DECISION_SIGNALS_EN = ['actually', 'instead', 'no,', 'don\'t use', 'switch to', 'let\'s use', 'I meant', 'that\'s not', 'wrong approach', 'use .* instead']
const DECISION_PATTERN = new RegExp(`(${[...DECISION_SIGNALS_ZH, ...DECISION_SIGNALS_EN].join('|')})`, 'i')

export function extractKeyDecisions(messages: NormalizedMessage[]): KeyDecision[] {
  const decisions: KeyDecision[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    if (!DECISION_PATTERN.test(msg.content)) continue

    decisions.push({
      trigger: truncate(msg.content, 500),
      decision: truncate(msg.content, 500),
      messageIndex: i,
    })
  }

  return decisions
}

export function extractErrorResolutions(messages: NormalizedMessage[]): ErrorResolution[] {
  const resolutions: ErrorResolution[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.toolCalls) continue

    for (const tc of msg.toolCalls) {
      if (!tc.isError) continue

      const errorFile = extractFilePath(tc)
      const errorKey = `${tc.name}:${errorFile || ''}`

      // Scan forward for resolution
      let resolved = false
      let resolution = ''

      for (let j = i + 1; j < messages.length; j++) {
        const laterMsg = messages[j]
        if (laterMsg.role !== 'assistant' || !laterMsg.toolCalls) continue

        for (const laterTc of laterMsg.toolCalls) {
          if (laterTc.isError) continue
          const laterFile = extractFilePath(laterTc)
          const laterKey = `${laterTc.name}:${laterFile || ''}`

          // Same tool+file success, or same file with different tool
          if (laterKey === errorKey || (errorFile && laterFile === errorFile && !laterTc.isError)) {
            resolved = true
            resolution = `${laterTc.name} on ${laterFile || 'unknown'} succeeded`
            break
          }
        }
        if (resolved) break
      }

      if (!resolved) {
        resolution = 'Unresolved in this session'
      }

      // Deduplicate: skip if same error already recorded
      const errorDesc = truncate(tc.result || 'Unknown error', 300)
      if (resolutions.some((r) => r.error === errorDesc && r.toolName === tc.name)) continue

      resolutions.push({
        error: errorDesc,
        toolName: tc.name,
        file: errorFile || undefined,
        resolution,
        resolved,
      })
    }
  }

  return resolutions
}

// Patterns that indicate purely operational/boilerplate assistant text
const OPERATIONAL_PATTERNS = [
  /^(让我|let me|i'll|i will|looking at|reading|checking|searching|let's)/i,
  /^(好的|明白|了解|sure|ok|okay|alright|got it)/i,
  /^(我来|现在|接下来|now|next)/i,
]

export function extractAssistantInsights(messages: NormalizedMessage[]): string[] {
  const insights: string[] = []

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    if (!msg.content || msg.content.length < 50) continue

    // Split into paragraphs
    const paragraphs = msg.content.split(/\n{2,}/)

    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed.length < 50) continue

      // Skip purely operational text
      if (OPERATIONAL_PATTERNS.some((p) => p.test(trimmed))) continue

      // Keep paragraphs with analysis signals
      const hasAnalysis = /because|since|the reason|this means|the issue|the problem|tradeoff|trade-off|原因|因为|问题在于|这意味着|本质上|根本原因|需要注意/i.test(trimmed)
      if (!hasAnalysis) continue

      insights.push(truncate(trimmed, 300))

      if (insights.length >= 5) return insights
    }
  }

  return insights
}

function truncate(s: string, maxLen: number): string {
  const cleaned = s.replace(/\n+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen - 3) + '...'
}
