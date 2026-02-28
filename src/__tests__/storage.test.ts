import { describe, it, expect } from 'vitest'
import { parseReportMeta, appendReportMeta } from '../shared/storage.js'
import type { ReportMeta } from '../shared/types.js'

describe('Storage - Report Meta', () => {
  it('should append and parse report meta', () => {
    const meta: ReportMeta = {
      generatedAt: '2026-02-28T23:15:00+08:00',
      date: '2026-02-28',
      sessionIds: ['abc123', 'def456'],
      sessionCount: 2,
    }

    const markdown = '# Daily Report\n\nSome content here.'
    const withMeta = appendReportMeta(markdown, meta)

    expect(withMeta).toContain('ai-report-meta')
    expect(withMeta).toContain('abc123')

    const parsed = parseReportMeta(withMeta)
    expect(parsed).not.toBeNull()
    expect(parsed!.date).toBe('2026-02-28')
    expect(parsed!.sessionIds).toEqual(['abc123', 'def456'])
    expect(parsed!.sessionCount).toBe(2)
  })

  it('should return null for markdown without meta', () => {
    expect(parseReportMeta('# Just a report')).toBeNull()
  })
})
