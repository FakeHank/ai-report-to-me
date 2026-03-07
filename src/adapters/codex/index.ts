import { existsSync, openSync, readSync, closeSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CLIAdapter, DetectResult, SessionFilter, SessionMeta } from '../adapter.interface.js'
import type { NormalizedSession } from '../../shared/types.js'
import { CODEX_SESSIONS_DIR } from '../../shared/constants.js'
import { parseCodexSession, extractSessionId } from './parser.js'
import { installHook, uninstallHook, checkHookStatus } from './hook.js'

export class CodexAdapter implements CLIAdapter {
  readonly name = 'codex'

  async detect(): Promise<DetectResult> {
    if (!existsSync(CODEX_SESSIONS_DIR)) {
      return { name: this.name, installed: false, dataPath: null, sessionCount: 0, hookSupport: 'partial' }
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
      hookSupport: 'partial',
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

  installHook = installHook
  uninstallHook = uninstallHook
  checkHookStatus = checkHookStatus
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
        const { cwd, projectName } = extractCwdFromFirstLine(fullPath)

        if (filter?.projectPath && cwd && cwd !== filter.projectPath) continue

        sessions.push({
          sessionId,
          projectPath: cwd,
          projectName,
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
 * Read only the first line of a Codex JSONL file to extract cwd from session_meta event.
 * Uses a small fixed buffer instead of reading the entire file.
 */
function extractCwdFromFirstLine(filePath: string): { cwd: string; projectName: string } {
  try {
    const fd = openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(4096)
      const bytesRead = readSync(fd, buf, 0, 4096, 0)
      if (bytesRead === 0) return { cwd: '', projectName: 'unknown' }

      const chunk = buf.toString('utf-8', 0, bytesRead)
      const newlineIdx = chunk.indexOf('\n')
      const firstLine = newlineIdx === -1 ? chunk : chunk.slice(0, newlineIdx)
      if (!firstLine.trim()) return { cwd: '', projectName: 'unknown' }

      const event = JSON.parse(firstLine) as { type?: string; payload?: { cwd?: string } }
      if (event.type === 'session_meta' && event.payload?.cwd) {
        const cwd = event.payload.cwd
        const parts = cwd.split('/')
        const name = parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
        return { cwd, projectName: name }
      }
    } finally {
      closeSync(fd)
    }
  } catch {
    // ignore parse errors
  }
  return { cwd: '', projectName: 'unknown' }
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
