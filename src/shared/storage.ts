import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ReportMeta } from './types.js'
import { REPORT_META_START, REPORT_META_END, REPORTS_DIR } from './constants.js'

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return []
  const content = readFileSync(path, 'utf-8').trim()
  if (!content) return []
  return content.split('\n').map((line) => JSON.parse(line) as T)
}

export function appendJsonl<T>(path: string, entry: T): void {
  ensureDir(dirname(path))
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8')
}

export function writeMarkdown(path: string, content: string): void {
  ensureDir(dirname(path))
  writeFileSync(path, content, 'utf-8')
}

export function readMarkdown(path: string): string | null {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf-8')
}

export function parseReportMeta(markdown: string): ReportMeta | null {
  const startIdx = markdown.lastIndexOf(REPORT_META_START)
  if (startIdx === -1) return null
  const endIdx = markdown.indexOf(REPORT_META_END, startIdx)
  if (endIdx === -1) return null
  const jsonStr = markdown.slice(startIdx + REPORT_META_START.length, endIdx).trim()
  try {
    return JSON.parse(jsonStr) as ReportMeta
  } catch {
    return null
  }
}

export function appendReportMeta(markdown: string, meta: ReportMeta): string {
  const metaBlock = `\n\n${REPORT_META_START}\n${JSON.stringify(meta)}\n${REPORT_META_END}\n`
  return markdown + metaBlock
}

export function getExistingReportDates(): string[] {
  if (!existsSync(REPORTS_DIR)) return []
  return readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''))
    .sort()
}

export function getReportPath(date: string): string {
  return join(REPORTS_DIR, `${date}.md`)
}
