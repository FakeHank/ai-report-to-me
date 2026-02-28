import type { ReportMeta } from '../../shared/types.js'
import { appendReportMeta } from '../../shared/storage.js'

export function renderDailyMarkdown(
  llmOutput: string,
  date: string,
  sessionIds: string[]
): string {
  const meta: ReportMeta = {
    generatedAt: new Date().toISOString(),
    date,
    sessionIds,
    sessionCount: sessionIds.length,
  }

  // Clean up LLM output
  let markdown = llmOutput.trim()

  // Remove any accidentally included meta blocks from LLM output
  markdown = markdown.replace(/<!--\s*ai-report-meta[\s\S]*?-->/g, '').trim()

  return appendReportMeta(markdown, meta)
}
