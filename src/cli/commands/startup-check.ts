import { Command } from 'commander'
import dayjs from 'dayjs'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { loadConfig } from '../../shared/config.js'
import { REPORTS_DIR } from '../../shared/constants.js'
import { readMarkdown } from '../../shared/storage.js'
import { getRegistry } from '../../adapters/registry.js'
import { t, tf } from '../../shared/i18n.js'

export const startupCheckCommand = new Command('startup-check')
  .description('Session startup context check (called by SessionStart hook)')
  .action(async () => {
    try {
      await runStartupCheck()
    } catch {
      // Silently exit on any unexpected error to avoid polluting Claude Code session output
    }
  })

async function runStartupCheck() {
  const config = loadConfig()
  const lang = config.output_lang

  // If sources not configured yet, remind user to run install wizard
  if (config.sources.length === 0) {
    const msg = t('startup.notConfigured', lang)
    process.stdout.write(msg)
    process.stderr.write(msg)
    return
  }

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
    // Count yesterday's sessions by scanning actual session files via adapters
    const yesterdaySessionCount = await countSessionsForDate(yesterday, config.sources)
    if (yesterdaySessionCount > 0) {
      output.push(tf('startup.yesterdayPending', lang, { count: yesterdaySessionCount }))
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
    output.push(tf('startup.yesterdayReport', lang, { date: yesterday, project: projectName }))
    output.push(yesterdayContext)
    output.push('')
  }

  if (todayContext) {
    output.push(tf('startup.todayReport', lang, { date: today, project: projectName }))
    output.push(todayContext)
    output.push('')
  }

  if (output.length > 0) {
    const text = output.join('\n')
    process.stdout.write(text)
    process.stderr.write(text + '\n')
  }
}

async function countSessionsForDate(date: string, sources: string[]): Promise<number> {
  const registry = getRegistry()
  const adapters = await registry.getConfiguredAdapters(sources)
  let count = 0
  const since = new Date(`${date}T00:00:00`)
  const until = new Date(`${date}T23:59:59`)
  for (const adapter of adapters) {
    try {
      const metas = await adapter.listSessions({ since, until })
      count += metas.length
    } catch {
      // skip adapter errors
    }
  }
  return count
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
