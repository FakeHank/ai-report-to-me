export interface ReportSection {
  heading: string
  level: 1 | 2 | 3
  content: string
}

export interface ParsedReport {
  title: string
  date: string
  sections: ReportSection[]
  rawMarkdown: string
}

export function parseReportMarkdown(markdown: string, date: string): ParsedReport {
  // Strip HTML comment metadata blocks
  const cleaned = markdown.replace(/<!--\s*ai-report-meta[\s\S]*?-->/g, '').trim()

  const lines = cleaned.split('\n')
  const sections: ReportSection[] = []
  let title = ''
  let currentSection: ReportSection | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      if (currentSection) {
        currentSection.content = currentSection.content.trim()
        sections.push(currentSection)
      }
      const level = headingMatch[1].length as 1 | 2 | 3
      const heading = headingMatch[2].trim()
      if (!title && level === 1) {
        title = heading
      }
      currentSection = { heading, level, content: '' }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }
  }

  if (currentSection) {
    currentSection.content = currentSection.content.trim()
    sections.push(currentSection)
  }

  return {
    title: title || `Daily Report ${date}`,
    date,
    sections,
    rawMarkdown: cleaned,
  }
}
