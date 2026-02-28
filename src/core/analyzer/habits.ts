import type { NormalizedSession } from '../../shared/types.js'

export interface HabitsAnalysis {
  collaborationStyle: 'directive' | 'delegative' | 'mixed'
  collaborationReason: string
  startupStyle: 'cold' | 'contextual' | 'mixed'
  endingStyle: 'task-complete' | 'interrupted' | 'mixed'
  peakHours: number[]
  nightOwl: boolean
  averageMessagesPerToolUse: number
}

export function analyzeHabits(sessions: NormalizedSession[]): HabitsAnalysis {
  return {
    collaborationStyle: detectCollaborationStyle(sessions),
    collaborationReason: getCollaborationReason(sessions),
    startupStyle: detectStartupStyle(sessions),
    endingStyle: detectEndingStyle(sessions),
    peakHours: detectPeakHours(sessions),
    nightOwl: detectNightOwl(sessions),
    averageMessagesPerToolUse: calcMessagesPerToolUse(sessions),
  }
}

function detectCollaborationStyle(sessions: NormalizedSession[]): 'directive' | 'delegative' | 'mixed' {
  if (sessions.length === 0) return 'mixed'

  let directiveSessions = 0
  let delegativeSessions = 0

  for (const s of sessions) {
    const userMsgs = s.messages.filter((m) => m.role === 'user')
    if (userMsgs.length === 0) continue

    const avgUserMsgLength = userMsgs.reduce((sum, m) => sum + m.content.length, 0) / userMsgs.length
    const msgRatio = s.stats.userMessageCount / Math.max(s.stats.assistantMessageCount, 1)

    // Directive: short messages, high frequency
    if (avgUserMsgLength < 100 && msgRatio > 0.5) {
      directiveSessions++
    }
    // Delegative: long messages, lower frequency
    else if (avgUserMsgLength > 300 && msgRatio < 0.4) {
      delegativeSessions++
    }
  }

  const total = directiveSessions + delegativeSessions
  if (total === 0) return 'mixed'
  if (directiveSessions / total > 0.6) return 'directive'
  if (delegativeSessions / total > 0.6) return 'delegative'
  return 'mixed'
}

function getCollaborationReason(sessions: NormalizedSession[]): string {
  const style = detectCollaborationStyle(sessions)
  switch (style) {
    case 'directive':
      return 'Short commands, high-frequency interaction — you prefer to stay in control'
    case 'delegative':
      return 'Long prompts, low-frequency check-ins — you trust AI with larger chunks'
    case 'mixed':
      return 'A mix of short directives and long delegations'
  }
}

function detectStartupStyle(sessions: NormalizedSession[]): 'cold' | 'contextual' | 'mixed' {
  if (sessions.length === 0) return 'mixed'

  let cold = 0
  let contextual = 0

  for (const s of sessions) {
    const firstUserMsg = s.messages.find((m) => m.role === 'user')
    if (!firstUserMsg) continue

    if (firstUserMsg.content.length > 200) {
      contextual++
    } else {
      cold++
    }
  }

  const total = cold + contextual
  if (total === 0) return 'mixed'
  if (cold / total > 0.7) return 'cold'
  if (contextual / total > 0.7) return 'contextual'
  return 'mixed'
}

function detectEndingStyle(sessions: NormalizedSession[]): 'task-complete' | 'interrupted' | 'mixed' {
  if (sessions.length === 0) return 'mixed'

  let complete = 0
  let interrupted = 0

  for (const s of sessions) {
    const lastMsg = s.messages[s.messages.length - 1]
    if (!lastMsg) continue

    if (lastMsg.role === 'assistant' && lastMsg.toolCalls?.some((tc) =>
      tc.name === 'Bash' && String(tc.input.command || '').includes('git commit')
    )) {
      complete++
    } else if (lastMsg.role === 'user') {
      interrupted++
    }
  }

  const total = complete + interrupted
  if (total === 0) return 'mixed'
  if (complete / total > 0.6) return 'task-complete'
  if (interrupted / total > 0.6) return 'interrupted'
  return 'mixed'
}

function detectPeakHours(sessions: NormalizedSession[]): number[] {
  const hourCounts = new Array(24).fill(0)
  for (const s of sessions) {
    hourCounts[s.startTime.getHours()]++
  }
  const max = Math.max(...hourCounts)
  if (max === 0) return []
  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count >= max * 0.7)
    .map((h) => h.hour)
}

function detectNightOwl(sessions: NormalizedSession[]): boolean {
  if (sessions.length === 0) return false
  const nightSessions = sessions.filter((s) => s.startTime.getHours() >= 22 || s.startTime.getHours() < 4)
  return nightSessions.length / sessions.length > 0.7
}

function calcMessagesPerToolUse(sessions: NormalizedSession[]): number {
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.stats.toolCallCount, 0)
  const totalUserMessages = sessions.reduce((sum, s) => sum + s.stats.userMessageCount, 0)
  if (totalToolCalls === 0) return 0
  return Math.round((totalUserMessages / totalToolCalls) * 10) / 10
}
