import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CLIAdapter, DetectResult, SessionFilter, SessionMeta } from '../adapter.interface.js'
import type { NormalizedSession } from '../../shared/types.js'
import { CODEX_SESSIONS_DIR } from '../../shared/constants.js'
import { parseCodexSession, extractSessionId } from './parser.js'

export class CodexAdapter implements CLIAdapter {
  readonly name = 'codex'

  async detect(): Promise<DetectResult> {
    if (!existsSync(CODEX_SESSIONS_DIR)) {
      return { name: this.name, installed: false, dataPath: null, sessionCount: 0, hookSupport: 'none' }
    }

    let sessionCount = 0
    try {
      sessionCount = countJsonlFiles(CODEX_SESSIONS_DIR)
    } catch {
      // ignore
    }

    return {
      name: this.name,
      installed: true,
      dataPath: CODEX_SESSIONS_DIR,
      sessionCount,
      hookSupport: 'none',
    }
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMeta[]> {
    if (!existsSync(CODEX_SESSIONS_DIR)) return []

    const sessions: SessionMeta[] = []
    scanSessionDir(CODEX_SESSIONS_DIR, filter, sessions)

    sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

    if (filter?.limit) {
      return sessions.slice(-filter.limit)
    }

    return sessions
  }

  async readSession(sessionId: string, meta: SessionMeta): Promise<NormalizedSession> {
    return parseCodexSession(meta.filePath, meta.projectPath)
  }
}

/**
 * Recursively scan the Codex sessions directory structure: sessions/YYYY/MM/DD/rollout-*.jsonl
 */
function scanSessionDir(dir: string, filter: SessionFilter | undefined, sessions: SessionMeta[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        scanSessionDir(fullPath, filter, sessions)
      } else if (entry.endsWith('.jsonl')) {
        const startTime = extractTimestampFromFilename(entry) || stat.birthtime

        if (filter?.since && startTime < filter.since) continue
        if (filter?.until && startTime > filter.until) continue

        const sessionId = extractSessionId(fullPath)

        sessions.push({
          sessionId,
          projectPath: '', // Will be populated from session_meta during readSession
          projectName: 'unknown',
          startTime,
          endTime: stat.mtime,
          filePath: fullPath,
        })
      }
    } catch {
      continue
    }
  }
}

/**
 * Extract timestamp from Codex filename: rollout-2026-02-03T14-15-05-<uuid>.jsonl
 */
function extractTimestampFromFilename(filename: string): Date | null {
  const match = filename.match(/rollout-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [, date, h, m, s] = match
  return new Date(`${date}T${h}:${m}:${s}Z`)
}

function countJsonlFiles(dir: string): number {
  let count = 0
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          count += countJsonlFiles(fullPath)
        } else if (entry.endsWith('.jsonl')) {
          count++
        }
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return count
}
