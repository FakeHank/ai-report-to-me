import { Command } from 'commander'
import dayjs from 'dayjs'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { loadConfig } from '../../shared/config.js'
import { REPORTS_DIR, SESSION_LOG_PATH } from '../../shared/constants.js'
import { readJsonl, readMarkdown } from '../../shared/storage.js'
import type { SessionLogEntry } from '../../shared/types.js'

export const startupCheckCommand = new Command('startup-check')
  .description('Session startup context check (called by SessionStart hook)')
  .action(async () => {
    const config = loadConfig()
    if (!config.daily_reminder) return

    // Read stdin for session info (SessionStart hook provides session_id, cwd, etc.)
    let cwd = process.cwd()
    try {
      const stdinData = await readStdin()
      if (stdinData.cwd) cwd = stdinData.cwd as string
    } catch {
      // ignore stdin errors
    }

    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const projectName = basename(cwd)

    const output: string[] = []

    // Check yesterday's report
    const yesterdayReportPath = join(REPORTS_DIR, `${yesterday}.md`)
    const yesterdayReportExists = existsSync(yesterdayReportPath)

    if (!yesterdayReportExists) {
      // Count yesterday's sessions from session log
      const yesterdaySessionCount = countSessionsForDate(yesterday)
      if (yesterdaySessionCount > 0) {
        output.push(`[AI Report] 昨天有 ${yesterdaySessionCount} 个 session，日报尚未生成。输入 /dayreport 查看日报。`)
        output.push('')
      }
    }

    // Extract project-relevant sections from reports
    const yesterdayContext = yesterdayReportExists
      ? extractProjectSection(yesterdayReportPath, projectName)
      : null
    const todayReportPath = join(REPORTS_DIR, `${today}.md`)
    const todayContext = existsSync(todayReportPath)
      ? extractProjectSection(todayReportPath, projectName)
      : null

    if (yesterdayContext) {
      output.push(`[AI Report] 昨日日报 (${yesterday}) · ${projectName} 相关:`)
      output.push(yesterdayContext)
      output.push('')
    }

    if (todayContext) {
      output.push(`[AI Report] 今日日报 (${today}) · ${projectName} 相关:`)
      output.push(todayContext)
      output.push('')
    }

    if (output.length > 0) {
      process.stdout.write(output.join('\n'))
    }
  })

function countSessionsForDate(date: string): number {
  if (existsSync(SESSION_LOG_PATH)) {
    const entries = readJsonl<SessionLogEntry>(SESSION_LOG_PATH)
    return entries.filter((e) => e.timestamp.startsWith(date)).length
  }
  return 0
}

function extractProjectSection(reportPath: string, projectName: string): string | null {
  const markdown = readMarkdown(reportPath)
  if (!markdown) return null

  const lines = markdown.split('\n')
  const projectLines: string[] = []
  let inRelevantSection = false
  let sectionDepth = 0

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/)
    if (headingMatch) {
      const depth = headingMatch[1].length
      const title = headingMatch[2]

      if (title.toLowerCase().includes(projectName.toLowerCase())) {
        inRelevantSection = true
        sectionDepth = depth
        projectLines.push(line)
        continue
      }

      if (inRelevantSection && depth <= sectionDepth) {
        inRelevantSection = false
      }
    }

    if (inRelevantSection) {
      projectLines.push(line)
    }
  }

  if (projectLines.length === 0) {
    // Fallback: lines mentioning the project
    const mentionLines = lines.filter((l) =>
      l.toLowerCase().includes(projectName.toLowerCase()) && l.trim().length > 0
    )
    if (mentionLines.length > 0) {
      return mentionLines.slice(0, 5).join('\n')
    }
    return null
  }

  // Truncate to avoid flooding context
  const result = projectLines.slice(0, 30).join('\n').trim()
  return result || null
}

async function readStdin(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => { data += chunk })
    process.stdin.on('end', () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
    // Timeout after 500ms
    setTimeout(() => resolve({}), 500)
  })
}
