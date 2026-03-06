import type { NormalizedSession } from '../../shared/types.js'

export interface ImprovementSignals {
  // Time patterns
  nightProductivityDrop: number // night avg duration / day avg duration (< 1 means drop)
  sessionGapMedianMinutes: number
  sessionGapStdDevMinutes: number
  burstiness: number // coefficient of variation of daily session counts

  // Work habits
  contextSwitchRate: number // ratio of active days with 2+ projects
  abandonmentRate: number // ratio of abandoned sessions
  reviewBeforeEndRate: number // ratio of sessions with Read/Grep in last 5 messages
  upfrontContextRate: number // ratio of sessions where first user msg has code block or file path

  // Collaboration quality
  firstTrySuccessRate: number // ratio of Edit/Write not immediately followed by same-file edit
  correctionToCompletionRatio: number // ratio of correction messages among user messages
  explorationBeforeEditRatio: number // ratio of sessions where Read/Grep precedes first Edit
}

const CORRECTION_PATTERNS = [
  /不对|不是|错了|别这样|不要|重新|换一个|改回/,
  /\bno[,.]?\s/i, /\bwrong\b/i, /\binstead\b/i, /\brevert\b/i,
  /\bundo\b/i, /\bactually\b/i, /\bnot what\b/i, /\bdon'?t\b/i,
]

const FILE_PATH_PATTERN = /(?:\/[\w.-]+){2,}|[\w.-]+\.(?:ts|js|py|go|rs|java|tsx|jsx|vue|css|html|json|yaml|yml|toml|md)\b/

export function extractImprovementSignals(sessions: NormalizedSession[]): ImprovementSignals {
  return {
    nightProductivityDrop: calcNightProductivityDrop(sessions),
    ...calcSessionGapStats(sessions),
    burstiness: calcBurstiness(sessions),
    contextSwitchRate: calcContextSwitchRate(sessions),
    abandonmentRate: calcAbandonmentRate(sessions),
    reviewBeforeEndRate: calcReviewBeforeEndRate(sessions),
    upfrontContextRate: calcUpfrontContextRate(sessions),
    firstTrySuccessRate: calcFirstTrySuccessRate(sessions),
    correctionToCompletionRatio: calcCorrectionRatio(sessions),
    explorationBeforeEditRatio: calcExplorationBeforeEditRatio(sessions),
  }
}

function calcNightProductivityDrop(sessions: NormalizedSession[]): number {
  const night = sessions.filter(
    (s) => s.startTime.getHours() >= 22 || s.startTime.getHours() < 4
  )
  const day = sessions.filter(
    (s) => s.startTime.getHours() >= 9 && s.startTime.getHours() < 18
  )
  if (night.length < 3 || day.length < 3) return -1 // insufficient data

  const nightAvg = night.reduce((sum, s) => sum + s.durationMinutes, 0) / night.length
  const dayAvg = day.reduce((sum, s) => sum + s.durationMinutes, 0) / day.length
  if (dayAvg === 0) return -1

  return round(nightAvg / dayAvg)
}

function calcSessionGapStats(
  sessions: NormalizedSession[]
): { sessionGapMedianMinutes: number; sessionGapStdDevMinutes: number } {
  if (sessions.length < 2) return { sessionGapMedianMinutes: -1, sessionGapStdDevMinutes: -1 }

  const sorted = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i].startTime.getTime() - sorted[i - 1].startTime.getTime()
    gaps.push(gapMs / 60000)
  }

  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length
  const stdDev = Math.sqrt(variance)

  return {
    sessionGapMedianMinutes: round(median),
    sessionGapStdDevMinutes: round(stdDev),
  }
}

function calcBurstiness(sessions: NormalizedSession[]): number {
  const dailyCounts: Record<string, number> = {}
  for (const s of sessions) {
    const day = s.startTime.toISOString().slice(0, 10)
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
  }

  const counts = Object.values(dailyCounts)
  if (counts.length < 2) return -1

  const mean = counts.reduce((s, c) => s + c, 0) / counts.length
  if (mean === 0) return -1

  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length
  return round(Math.sqrt(variance) / mean)
}

function calcContextSwitchRate(sessions: NormalizedSession[]): number {
  const dayProjects: Record<string, Set<string>> = {}
  for (const s of sessions) {
    const day = s.startTime.toISOString().slice(0, 10)
    if (!dayProjects[day]) dayProjects[day] = new Set()
    dayProjects[day].add(s.projectPath)
  }

  const days = Object.values(dayProjects)
  if (days.length === 0) return 0

  const multiProjectDays = days.filter((projects) => projects.size >= 2).length
  return round(multiProjectDays / days.length)
}

function calcAbandonmentRate(sessions: NormalizedSession[]): number {
  if (sessions.length === 0) return 0

  let abandoned = 0
  for (const s of sessions) {
    if (s.messages.length < 3) {
      abandoned++
      continue
    }
    // Session with last message being a user message (no AI response) = likely abandoned
    const last = s.messages[s.messages.length - 1]
    if (last.role === 'user' && s.durationMinutes < 2) {
      abandoned++
    }
  }

  return round(abandoned / sessions.length)
}

function calcReviewBeforeEndRate(sessions: NormalizedSession[]): number {
  if (sessions.length === 0) return 0

  const REVIEW_TOOLS = ['Read', 'Grep', 'Glob']
  let reviewCount = 0

  for (const s of sessions) {
    const tail = s.messages.slice(-5)
    const hasReview = tail.some((m) =>
      m.toolCalls?.some((tc) => REVIEW_TOOLS.includes(tc.name))
    )
    if (hasReview) reviewCount++
  }

  return round(reviewCount / sessions.length)
}

function calcUpfrontContextRate(sessions: NormalizedSession[]): number {
  if (sessions.length === 0) return 0

  let contextCount = 0
  for (const s of sessions) {
    const firstUser = s.messages.find((m) => m.role === 'user')
    if (!firstUser) continue

    const content = firstUser.content
    const hasCodeBlock = content.includes('```')
    const hasFilePath = FILE_PATH_PATTERN.test(content)

    if (hasCodeBlock || hasFilePath) contextCount++
  }

  return round(contextCount / sessions.length)
}

function calcFirstTrySuccessRate(sessions: NormalizedSession[]): number {
  let totalEdits = 0
  let needsRedo = 0

  for (const s of sessions) {
    // Flatten all tool calls in order
    const toolCalls: { name: string; file?: string }[] = []
    for (const msg of s.messages) {
      for (const tc of msg.toolCalls || []) {
        if (tc.name === 'Edit' || tc.name === 'Write') {
          const file = (tc.input.file_path || tc.input.path) as string | undefined
          toolCalls.push({ name: tc.name, file })
        }
      }
    }

    for (let i = 0; i < toolCalls.length; i++) {
      totalEdits++
      // Check if next edit targets the same file
      if (i + 1 < toolCalls.length && toolCalls[i].file && toolCalls[i].file === toolCalls[i + 1].file) {
        needsRedo++
      }
    }
  }

  if (totalEdits === 0) return -1
  return round((totalEdits - needsRedo) / totalEdits)
}

function calcCorrectionRatio(sessions: NormalizedSession[]): number {
  let totalUserMsgs = 0
  let corrections = 0

  for (const s of sessions) {
    for (const m of s.messages) {
      if (m.role !== 'user') continue
      totalUserMsgs++
      if (CORRECTION_PATTERNS.some((p) => p.test(m.content))) {
        corrections++
      }
    }
  }

  if (totalUserMsgs === 0) return 0
  return round(corrections / totalUserMsgs)
}

function calcExplorationBeforeEditRatio(sessions: NormalizedSession[]): number {
  let sessionsWithEdit = 0
  let exploredFirst = 0

  const EXPLORE_TOOLS = ['Read', 'Grep', 'Glob']

  for (const s of sessions) {
    let firstEditIndex = -1
    let hasExploreBeforeEdit = false
    let toolIndex = 0

    for (const msg of s.messages) {
      for (const tc of msg.toolCalls || []) {
        if ((tc.name === 'Edit' || tc.name === 'Write') && firstEditIndex === -1) {
          firstEditIndex = toolIndex
        }
        if (EXPLORE_TOOLS.includes(tc.name) && firstEditIndex === -1) {
          hasExploreBeforeEdit = true
        }
        toolIndex++
      }
    }

    if (firstEditIndex !== -1) {
      sessionsWithEdit++
      if (hasExploreBeforeEdit) exploredFirst++
    }
  }

  if (sessionsWithEdit === 0) return -1
  return round(exploredFirst / sessionsWithEdit)
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
