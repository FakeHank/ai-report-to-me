import dayjs from 'dayjs'
import type {
  NormalizedSession,
  DailyAggregation,
  WrappedAggregation,
  ProjectBreakdown,
  RetrySignal,
  ErrorRecord,
  FrictionRecord,
} from '../shared/types.js'
import { readMarkdown, getReportPath } from '../shared/storage.js'
import { detectFriction } from './analyzer/friction.js'
import { readProjectMemory } from '../adapters/claude-code/memory.js'

export class Aggregator {
  aggregateDaily(sessions: NormalizedSession[], date: string): DailyAggregation {
    const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
    const projectBreakdown = buildProjectBreakdown(sessions)
    const allToolCalls = mergeToolCalls(sessions)
    const allFilesChanged = mergeFilesChanged(sessions)
    const allRetrySignals = extractRetrySignals(sessions)
    const allErrors = extractErrors(sessions)

    // Try to read previous day highlights
    const prevDate = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')
    const prevReport = readMarkdown(getReportPath(prevDate))
    const previousDayHighlights = prevReport
      ? extractHighlights(prevReport)
      : undefined

    return {
      date,
      sessions,
      totalDuration,
      projectBreakdown,
      allToolCalls,
      allFilesChanged,
      allRetrySignals,
      allErrors,
      previousDayHighlights,
    }
  }

  aggregateWrapped(sessions: NormalizedSession[], days: number): WrappedAggregation {
    const totalSessions = sessions.length
    const totalMessages = sessions.reduce((sum, s) => sum + s.stats.messageCount, 0)
    const totalInputTokens = sessions.reduce((sum, s) => sum + s.stats.totalInputTokens, 0)
    const totalOutputTokens = sessions.reduce((sum, s) => sum + s.stats.totalOutputTokens, 0)
    const totalCacheTokens = sessions.reduce((sum, s) => sum + s.stats.totalCacheTokens, 0)
    const totalDurationMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)

    // Active days
    const activeDaySet = new Set(sessions.map((s) => dayjs(s.startTime).format('YYYY-MM-DD')))
    const activeDays = activeDaySet.size

    // Average and longest session
    const averageSessionMinutes = totalSessions > 0
      ? Math.round(totalDurationMinutes / totalSessions)
      : 0

    let longestSession = { sessionId: '', durationMinutes: 0, date: '', project: '' }
    for (const s of sessions) {
      if (s.durationMinutes > longestSession.durationMinutes) {
        longestSession = {
          sessionId: s.sessionId,
          durationMinutes: s.durationMinutes,
          date: dayjs(s.startTime).format('YYYY-MM-DD'),
          project: s.projectName,
        }
      }
    }

    // Hourly distribution
    const hourlyDistribution = new Array(24).fill(0)
    for (const s of sessions) {
      const hour = s.startTime.getHours()
      hourlyDistribution[hour]++
    }

    // Daily distribution
    const dailyDistribution: Record<string, number> = {}
    for (const day of activeDaySet) {
      dailyDistribution[day] = sessions.filter(
        (s) => dayjs(s.startTime).format('YYYY-MM-DD') === day
      ).length
    }

    // Tool call distribution
    const toolCallDistribution = mergeToolCalls(sessions)

    // CLI distribution
    const cliDistribution: Record<string, number> = {}
    for (const s of sessions) {
      cliDistribution[s.cli] = (cliDistribution[s.cli] || 0) + 1
    }

    // Top files edited
    const fileEditCounts: Record<string, number> = {}
    for (const s of sessions) {
      for (const msg of s.messages) {
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            if (tc.name === 'Edit' || tc.name === 'Write') {
              const file = (tc.input.file_path || tc.input.path) as string | undefined
              if (file) {
                fileEditCounts[file] = (fileEditCounts[file] || 0) + 1
              }
            }
          }
        }
      }
    }
    const topFilesEdited = Object.entries(fileEditCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([file, count]) => ({ file, count }))

    // Friction hotspots
    const frictionHotspots: FrictionRecord[] = []
    for (const s of sessions) {
      frictionHotspots.push(...detectFriction(s))
    }

    const startDate = sessions.length > 0
      ? dayjs(sessions[0].startTime).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    const endDate = sessions.length > 0
      ? dayjs(sessions[sessions.length - 1].startTime).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')

    return {
      days,
      startDate,
      endDate,
      sessions,
      totalSessions,
      totalMessages,
      totalInputTokens,
      totalOutputTokens,
      totalCacheTokens,
      activeDays,
      totalDurationMinutes,
      averageSessionMinutes,
      longestSession,
      projectBreakdown: buildProjectBreakdown(sessions),
      hourlyDistribution,
      dailyDistribution,
      toolCallDistribution,
      cliDistribution: cliDistribution as WrappedAggregation['cliDistribution'],
      topFilesEdited,
      frictionHotspots,
    }
  }
}

function buildProjectBreakdown(sessions: NormalizedSession[]): ProjectBreakdown[] {
  const byProject = new Map<string, NormalizedSession[]>()
  for (const s of sessions) {
    const key = s.projectPath
    if (!byProject.has(key)) byProject.set(key, [])
    byProject.get(key)!.push(s)
  }

  const breakdowns: ProjectBreakdown[] = []
  for (const [projectPath, projectSessions] of byProject) {
    const duration = projectSessions.reduce((sum, s) => sum + s.durationMinutes, 0)
    const toolCalls = mergeToolCalls(projectSessions)
    const filesChanged = mergeFilesChanged(projectSessions)
    const frictionCount = projectSessions.reduce(
      (sum, s) => sum + detectFriction(s).length,
      0
    )

    // Read memory for Claude Code projects
    const hasClaudeCode = projectSessions.some((s) => s.cli === 'claude-code')
    const memory = hasClaudeCode ? readProjectMemory(projectPath) : undefined

    breakdowns.push({
      project: projectSessions[0].projectName,
      projectPath,
      sessions: projectSessions.length,
      duration,
      toolCalls,
      filesChanged,
      frictionDensity: projectSessions.length > 0 ? frictionCount / projectSessions.length : 0,
      memory,
    })
  }

  const sorted = breakdowns.sort((a, b) => b.sessions - a.sessions)

  // Cap total memory at 20KB — keep only top projects by session count
  const MAX_MEMORY_BYTES = 20 * 1024
  let totalMemorySize = 0
  for (const b of sorted) {
    if (b.memory) {
      totalMemorySize += Buffer.byteLength(b.memory, 'utf-8')
      if (totalMemorySize > MAX_MEMORY_BYTES) {
        b.memory = undefined
      }
    }
  }

  return sorted
}

function mergeToolCalls(sessions: NormalizedSession[]): Record<string, number> {
  const merged: Record<string, number> = {}
  for (const s of sessions) {
    for (const [name, count] of Object.entries(s.stats.toolCallsByName)) {
      merged[name] = (merged[name] || 0) + count
    }
  }
  return merged
}

function mergeFilesChanged(sessions: NormalizedSession[]): string[] {
  const files = new Set<string>()
  for (const s of sessions) {
    for (const f of s.stats.filesTouched) {
      files.add(f)
    }
  }
  return [...files]
}

function extractRetrySignals(sessions: NormalizedSession[]): RetrySignal[] {
  const signals: RetrySignal[] = []
  for (const s of sessions) {
    const fileEdits: Record<string, number> = {}
    for (const msg of s.messages) {
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.name === 'Edit') {
            const file = (tc.input.file_path || tc.input.path) as string | undefined
            if (file) {
              fileEdits[file] = (fileEdits[file] || 0) + 1
            }
          }
        }
      }
    }
    for (const [file, count] of Object.entries(fileEdits)) {
      if (count > 3) {
        signals.push({ file, editCount: count, sessionId: s.sessionId })
      }
    }
  }
  return signals
}

function extractErrors(sessions: NormalizedSession[]): ErrorRecord[] {
  const errors: ErrorRecord[] = []
  for (const s of sessions) {
    for (const msg of s.messages) {
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.isError) {
            errors.push({
              toolName: tc.name,
              message: tc.result?.slice(0, 200) || 'Unknown error',
              sessionId: s.sessionId,
              timestamp: msg.timestamp,
            })
          }
        }
      }
    }
  }
  return errors
}

function extractHighlights(markdown: string): string {
  // Extract the overview section for context
  const lines = markdown.split('\n')
  const overviewStart = lines.findIndex((l) => l.includes('## 概览') || l.includes('## Overview'))
  if (overviewStart === -1) return ''

  const nextSection = lines.findIndex((l, i) => i > overviewStart && l.startsWith('## '))
  const end = nextSection === -1 ? Math.min(overviewStart + 20, lines.length) : nextSection
  return lines.slice(overviewStart, end).join('\n').trim()
}
