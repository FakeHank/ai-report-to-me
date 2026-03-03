import type { NormalizedSession } from '../../shared/types.js'

export interface VibeCoderResult {
  type: string
  emoji: string
  label: string
  reason: string
}

export interface VibeSignals {
  nightSessionRatio: number
  medianSessionMinutes: number
  averageSessionMinutes: number
  readBashToolRatio: number
  userMsgPerToolCall: number
  refactorEditRatio: number
  peakDaySessions: number
  highEditRepeatSessions: number
  totalSessions: number
  totalEdits: number
  totalToolCalls: number
}

export function extractVibeSignals(sessions: NormalizedSession[]): VibeSignals {
  // Night session ratio (22:00-04:00)
  const nightCount = sessions.filter(
    (s) => s.startTime.getHours() >= 22 || s.startTime.getHours() < 4
  ).length
  const nightSessionRatio = sessions.length > 0 ? nightCount / sessions.length : 0

  // Session duration stats
  const durations = sessions.map((s) => s.durationMinutes).sort((a, b) => a - b)
  const medianSessionMinutes = durations.length > 0
    ? durations[Math.floor(durations.length / 2)]
    : 0
  const averageSessionMinutes = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length
    : 0

  // Read/Bash/Grep/Glob tool ratio
  let readBashCount = 0
  let totalToolCalls = 0
  for (const s of sessions) {
    for (const [name, count] of Object.entries(s.stats.toolCallsByName)) {
      totalToolCalls += count
      if (name === 'Read' || name === 'Bash' || name === 'Grep' || name === 'Glob') {
        readBashCount += count
      }
    }
  }
  const readBashToolRatio = totalToolCalls > 0 ? readBashCount / totalToolCalls : 0

  // User messages per tool call
  const totalUserMsgs = sessions.reduce((sum, s) => sum + s.stats.userMessageCount, 0)
  const userMsgPerToolCall = totalToolCalls > 0 ? totalUserMsgs / totalToolCalls : 0

  // Refactor edit ratio
  let refactorCount = 0
  let totalEdits = 0
  for (const s of sessions) {
    for (const msg of s.messages) {
      for (const tc of msg.toolCalls || []) {
        if (tc.name === 'Edit' || tc.name === 'Write') {
          totalEdits++
          const input = JSON.stringify(tc.input).toLowerCase()
          if (input.includes('refactor') || input.includes('rename') || input.includes('replace_all')) {
            refactorCount++
          }
        }
      }
    }
  }
  const refactorEditRatio = totalEdits > 0 ? refactorCount / totalEdits : 0

  // Peak day sessions
  const dailyCounts: Record<string, number> = {}
  for (const s of sessions) {
    const day = s.startTime.toISOString().slice(0, 10)
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
  }
  const peakDaySessions = Math.max(...Object.values(dailyCounts), 0)

  // High edit repeat sessions (same file edited 8+ times)
  const highEditRepeatSessions = sessions.filter((s) => {
    const fileEdits: Record<string, number> = {}
    for (const msg of s.messages) {
      for (const tc of msg.toolCalls || []) {
        if (tc.name === 'Edit') {
          const file = (tc.input.file_path || tc.input.path) as string | undefined
          if (file) fileEdits[file] = (fileEdits[file] || 0) + 1
        }
      }
    }
    return Object.values(fileEdits).some((c) => c > 8)
  }).length

  return {
    nightSessionRatio: Math.round(nightSessionRatio * 1000) / 1000,
    medianSessionMinutes: Math.round(medianSessionMinutes),
    averageSessionMinutes: Math.round(averageSessionMinutes),
    readBashToolRatio: Math.round(readBashToolRatio * 1000) / 1000,
    userMsgPerToolCall: Math.round(userMsgPerToolCall * 100) / 100,
    refactorEditRatio: Math.round(refactorEditRatio * 1000) / 1000,
    peakDaySessions,
    highEditRepeatSessions,
    totalSessions: sessions.length,
    totalEdits,
    totalToolCalls,
  }
}
