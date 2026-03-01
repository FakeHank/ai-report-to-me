import type { NormalizedSession, SemanticSummary, SessionSemanticSlice } from '../../shared/types.js'
import { extractKeyDecisions, extractErrorResolutions } from '../narrative.js'
import dayjs from 'dayjs'

const MAX_QUERY_LENGTH = 300
const MAX_RESPONSE_LENGTH = 300
const MAX_AI_RESPONSES_PER_SESSION = 5

// Patterns that indicate purely operational/boilerplate assistant text
const OPERATIONAL_PATTERNS = [
  /^(让我|let me|i'll|i will|looking at|reading|checking|searching|let's)/i,
  /^(好的|明白|了解|sure|ok|okay|alright|got it)/i,
  /^(我来|现在|接下来|now|next)/i,
]

function truncate(s: string, maxLen: number): string {
  const cleaned = s.replace(/\n+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen - 3) + '...'
}

function detectOutcome(session: NormalizedSession): 'completed' | 'partial' | 'abandoned' {
  const tail = session.messages.slice(-5)
  const lastContent = tail
    .filter((m) => m.role === 'assistant' || m.role === 'user')
    .map((m) => m.content.toLowerCase())
    .join(' ')

  const completionSignals = ['done', 'complete', 'finished', 'committed', 'git commit', 'lgtm', 'looks good', 'all tests pass', '完成', '搞定']
  if (completionSignals.some((s) => lastContent.includes(s))) {
    return 'completed'
  }

  const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant')
  if (lastAssistant?.toolCalls?.some((tc) => tc.isError)) {
    return 'partial'
  }

  if (session.messages.length < 3) {
    return 'abandoned'
  }

  return 'partial'
}

function isOperational(text: string): boolean {
  return OPERATIONAL_PATTERNS.some((p) => p.test(text.trim()))
}

function extractAnalyticalResponses(session: NormalizedSession): string[] {
  const responses: string[] = []

  for (const msg of session.messages) {
    if (msg.role !== 'assistant') continue
    if (!msg.content || msg.content.length < 50) continue

    const paragraphs = msg.content.split(/\n{2,}/)

    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed.length < 50) continue
      if (isOperational(trimmed)) continue

      // Keep paragraphs with analysis signals
      const hasAnalysis = /because|since|the reason|this means|the issue|the problem|tradeoff|trade-off|原因|因为|问题在于|这意味着|本质上|根本原因|需要注意/i.test(trimmed)
      if (!hasAnalysis) continue

      responses.push(truncate(trimmed, MAX_RESPONSE_LENGTH))

      if (responses.length >= MAX_AI_RESPONSES_PER_SESSION) return responses
    }
  }

  return responses
}

export function aggregateSemantics(sessions: NormalizedSession[]): SemanticSummary {
  // Build session slices
  const sessionSlices: SessionSemanticSlice[] = []

  for (const session of sessions) {
    const userQueries = session.messages
      .filter((m) => m.role === 'user')
      .map((m) => truncate(m.content, MAX_QUERY_LENGTH))

    const aiResponses = extractAnalyticalResponses(session)

    const keyDecisions = extractKeyDecisions(session.messages)
    const directionChanges = keyDecisions.map((d) => d.trigger)

    const outcome = detectOutcome(session)

    sessionSlices.push({
      sessionId: session.sessionId,
      project: session.projectName,
      date: dayjs(session.startTime).format('YYYY-MM-DD'),
      userQueries,
      aiResponses,
      directionChanges,
      outcome,
    })
  }

  // Aggregate error data
  const allErrors: { error: string; toolName: string; file?: string; resolution: string; resolved: boolean; sessionId: string }[] = []

  for (const session of sessions) {
    const errorResolutions = extractErrorResolutions(session.messages)
    for (const er of errorResolutions) {
      allErrors.push({ ...er, sessionId: session.sessionId })
    }
  }

  const totalErrors = allErrors.length
  const resolvedCount = allErrors.filter((e) => e.resolved).length

  const topUnresolved = allErrors
    .filter((e) => !e.resolved)
    .slice(0, 10)
    .map((e) => ({ error: e.error, file: e.file, sessionId: e.sessionId }))

  const topResolved = allErrors
    .filter((e) => e.resolved)
    .slice(0, 10)
    .map((e) => ({ error: e.error, resolution: e.resolution, sessionId: e.sessionId }))

  // Build debugging struggles: files with errors across multiple sessions
  const fileErrorMap = new Map<string, { errorCount: number; sessionIds: Set<string>; resolved: boolean }>()

  for (const e of allErrors) {
    if (!e.file) continue
    if (!fileErrorMap.has(e.file)) {
      fileErrorMap.set(e.file, { errorCount: 0, sessionIds: new Set(), resolved: true })
    }
    const entry = fileErrorMap.get(e.file)!
    entry.errorCount++
    entry.sessionIds.add(e.sessionId)
    if (!e.resolved) entry.resolved = false
  }

  const debuggingStruggles = [...fileErrorMap.entries()]
    .filter(([, v]) => v.errorCount >= 2)
    .sort((a, b) => b[1].errorCount - a[1].errorCount)
    .slice(0, 10)
    .map(([file, v]) => ({
      file,
      errorCount: v.errorCount,
      sessionIds: [...v.sessionIds],
      resolved: v.resolved,
    }))

  // Sort slices by duration descending for potential truncation
  const sortedSlices = [...sessionSlices].sort((a, b) => {
    const sessionA = sessions.find((s) => s.sessionId === a.sessionId)
    const sessionB = sessions.find((s) => s.sessionId === b.sessionId)
    return (sessionB?.durationMinutes || 0) - (sessionA?.durationMinutes || 0)
  })

  // Estimate token size and truncate if needed (rough: 1 char ≈ 0.3 tokens for mixed CJK/EN)
  const MAX_ESTIMATED_TOKENS = 30000
  let estimatedTokens = 0
  const keptSlices: SessionSemanticSlice[] = []

  for (const slice of sortedSlices) {
    const sliceSize = JSON.stringify(slice).length * 0.3
    if (estimatedTokens + sliceSize > MAX_ESTIMATED_TOKENS && keptSlices.length > 0) break
    keptSlices.push(slice)
    estimatedTokens += sliceSize
  }

  return {
    sessionSlices: keptSlices,
    errorSamples: {
      totalErrors,
      resolvedCount,
      topUnresolved,
      topResolved,
    },
    debuggingStruggles,
  }
}
