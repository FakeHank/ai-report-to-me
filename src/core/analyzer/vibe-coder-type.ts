import type { NormalizedSession } from '../../shared/types.js'

export interface VibeCoderResult {
  type: string
  emoji: string
  label: string
  reason: string
}

interface TypeCandidate {
  emoji: string
  label: string
  check: (sessions: NormalizedSession[]) => { match: boolean; reason: string }
}

const TYPES: TypeCandidate[] = [
  {
    emoji: '🔁',
    label: '反复横跳型',
    check: (sessions) => {
      const count = sessions.filter((s) => {
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
        match: count >= 3,
        reason: `${count} sessions with same file edited 8+ times`,
      }
    },
  },
  {
    emoji: '🌙',
    label: '深夜幽灵型',
    check: (sessions) => {
      const nightCount = sessions.filter((s) => s.startTime.getHours() >= 22 || s.startTime.getHours() < 4).length
      const ratio = sessions.length > 0 ? nightCount / sessions.length : 0
      return {
        match: ratio > 0.7,
        reason: `${Math.round(ratio * 100)}% sessions started after 10pm`,
      }
    },
  },
  {
    emoji: '🏃',
    label: '闪现游击型',
    check: (sessions) => {
      const durations = sessions.map((s) => s.durationMinutes).sort((a, b) => a - b)
      const median = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0
      return {
        match: median < 20 && sessions.length >= 5,
        reason: `Median session length is ${median} minutes`,
      }
    },
  },
  {
    emoji: '🧱',
    label: '砌墙专家型',
    check: (sessions) => {
      let readBash = 0
      let total = 0
      for (const s of sessions) {
        for (const [name, count] of Object.entries(s.stats.toolCallsByName)) {
          total += count
          if (name === 'Read' || name === 'Bash' || name === 'Grep' || name === 'Glob') {
            readBash += count
          }
        }
      }
      const ratio = total > 0 ? readBash / total : 0
      return {
        match: ratio > 0.7 && total > 20,
        reason: `${Math.round(ratio * 100)}% tool calls are Read/Bash (rarely Edit)`,
      }
    },
  },
  {
    emoji: '💬',
    label: '话痨驱动型',
    check: (sessions) => {
      const totalToolCalls = sessions.reduce((sum, s) => sum + s.stats.toolCallCount, 0)
      const totalUserMsgs = sessions.reduce((sum, s) => sum + s.stats.userMessageCount, 0)
      const ratio = totalToolCalls > 0 ? totalUserMsgs / totalToolCalls : 0
      return {
        match: ratio > 3,
        reason: `${ratio.toFixed(1)} user messages per tool call`,
      }
    },
  },
  {
    emoji: '🧹',
    label: '重构上瘾型',
    check: (sessions) => {
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
      const ratio = totalEdits > 0 ? refactorCount / totalEdits : 0
      return {
        match: ratio > 0.3 && totalEdits > 10,
        reason: `${Math.round(ratio * 100)}% edits are refactoring/renaming`,
      }
    },
  },
  {
    emoji: '🏔',
    label: '史诗任务型',
    check: (sessions) => {
      const avgDuration = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length
        : 0
      return {
        match: avgDuration > 90,
        reason: `Average session is ${Math.round(avgDuration)} minutes`,
      }
    },
  },
  {
    emoji: '🔥',
    label: '全栈冲刺型',
    check: (sessions) => {
      const dailyCounts: Record<string, number> = {}
      for (const s of sessions) {
        const day = s.startTime.toISOString().slice(0, 10)
        dailyCounts[day] = (dailyCounts[day] || 0) + 1
      }
      const maxDaily = Math.max(...Object.values(dailyCounts), 0)
      return {
        match: maxDaily > 8,
        reason: `Peak day had ${maxDaily} sessions`,
      }
    },
  },
]

export function determineVibeCoderType(sessions: NormalizedSession[]): VibeCoderResult {
  for (const type of TYPES) {
    const result = type.check(sessions)
    if (result.match) {
      return {
        type: type.label,
        emoji: type.emoji,
        label: `${type.emoji} ${type.label}`,
        reason: result.reason,
      }
    }
  }

  // Default
  return {
    type: '均衡务实型',
    emoji: '⚖️',
    label: '⚖️ 均衡务实型',
    reason: 'A balanced, practical coder — no single extreme pattern detected',
  }
}
