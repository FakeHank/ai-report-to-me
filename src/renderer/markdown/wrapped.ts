import type { ReportMeta } from '../../shared/types.js'
import { appendReportMeta } from '../../shared/storage.js'

export function renderWrappedMarkdown(
  llmOutput: string,
  startDate: string,
  endDate: string,
  sessionIds: string[]
): string {
  const meta: ReportMeta = {
    generatedAt: new Date().toISOString(),
    date: `${startDate}_${endDate}`,
    sessionIds,
    sessionCount: sessionIds.length,
  }

  let markdown = llmOutput.trim()
  markdown = markdown.replace(/<!--\s*ai-report-meta[\s\S]*?-->/g, '').trim()

  return appendReportMeta(markdown, meta)
}
