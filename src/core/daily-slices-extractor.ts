import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readMarkdown, parseReportMeta } from '../shared/storage.js'

export interface DailySlice {
  date: string
  content: string
  sessionIds: string[]
}

export function extractExperienceSlicesFromReports(
  reportDir: string,
  startDate: string,
  endDate: string
): DailySlice[] {
  const slices: DailySlice[] = []

  let files: string[]
  try {
    files = readdirSync(reportDir).filter((f) => f.endsWith('.md')).sort()
  } catch {
    return []
  }

  for (const file of files) {
    const date = file.replace('.md', '')
    if (date < startDate || date > endDate) continue

    const markdown = readMarkdown(join(reportDir, file))
    if (!markdown) continue

    const sliceContent = extractSliceSection(markdown)
    if (sliceContent) {
      const meta = parseReportMeta(markdown)
      slices.push({ date, content: sliceContent, sessionIds: meta?.sessionIds || [] })
    }
  }

  return slices
}

const SLICE_HEADINGS = [
  '## 经验切片',       // zh
  '## Experience Slices', // en
  '## 経験スライス',     // ja
  '## 경험 슬라이스', // ko
  '## Срезы опыта',    // ru
]

function extractSliceSection(markdown: string): string | null {
  let sliceStart = -1
  for (const heading of SLICE_HEADINGS) {
    sliceStart = markdown.indexOf(heading)
    if (sliceStart !== -1) break
  }
  if (sliceStart === -1) return null

  // Find the next ## heading after the slice section
  const afterStart = markdown.indexOf('\n', sliceStart)
  if (afterStart === -1) return null

  const nextSection = markdown.indexOf('\n## ', afterStart)
  const content = nextSection === -1
    ? markdown.slice(afterStart).trim()
    : markdown.slice(afterStart, nextSection).trim()

  if (!content || content.length < 10) return null
  return content
}
