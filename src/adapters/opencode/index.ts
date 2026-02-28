import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import type { CLIAdapter, DetectResult, SessionFilter, SessionMeta } from '../adapter.interface.js'
import type { NormalizedSession } from '../../shared/types.js'
import { OPENCODE_DB_PATH } from '../../shared/constants.js'
import { parseOpenCodeMessages, type OpenCodeSessionInfo } from './parser.js'

export class OpenCodeAdapter implements CLIAdapter {
  readonly name = 'opencode'

  async detect(): Promise<DetectResult> {
    if (!existsSync(OPENCODE_DB_PATH)) {
      return { name: this.name, installed: false, dataPath: null, sessionCount: 0, hookSupport: 'none' }
    }

    let sessionCount = 0
    try {
      const db = new Database(OPENCODE_DB_PATH, { readonly: true })
      const row = db.prepare('SELECT COUNT(*) as count FROM session').get() as { count: number }
      sessionCount = row.count
      db.close()
    } catch {
      // ignore
    }

    return {
      name: this.name,
      installed: true,
      dataPath: OPENCODE_DB_PATH,
      sessionCount,
      hookSupport: 'none',
    }
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMeta[]> {
    if (!existsSync(OPENCODE_DB_PATH)) return []

    const db = new Database(OPENCODE_DB_PATH, { readonly: true })
    try {
      let query = `
        SELECT s.id, s.project_id, s.directory, s.title, s.time_created, s.time_updated,
               p.worktree, p.name as project_name
        FROM session s
        LEFT JOIN project p ON s.project_id = p.id
        WHERE 1=1
      `
      const params: unknown[] = []

      if (filter?.since) {
        query += ' AND s.time_created >= ?'
        params.push(filter.since.getTime())
      }
      if (filter?.until) {
        query += ' AND s.time_created <= ?'
        params.push(filter.until.getTime())
      }
      if (filter?.projectPath) {
        query += ' AND (s.directory = ? OR p.worktree = ?)'
        params.push(filter.projectPath, filter.projectPath)
      }

      query += ' ORDER BY s.time_created ASC'

      if (filter?.limit) {
        // Get the last N sessions
        query = `SELECT * FROM (${query}) sub ORDER BY time_created DESC LIMIT ?`
        params.push(filter.limit)
      }

      const rows = db.prepare(query).all(...params) as Array<{
        id: string
        project_id: string
        directory: string
        title: string
        time_created: number
        time_updated: number
        worktree: string | null
        project_name: string | null
      }>

      const sessions: SessionMeta[] = rows.map((row) => {
        const projectPath = row.directory || row.worktree || ''
        return {
          sessionId: row.id,
          projectPath,
          projectName: row.project_name || extractProjectName(projectPath),
          startTime: new Date(row.time_created),
          endTime: new Date(row.time_updated),
          filePath: OPENCODE_DB_PATH, // All data comes from the same DB
        }
      })

      if (filter?.limit) {
        sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      }

      return sessions
    } finally {
      db.close()
    }
  }

  async readSession(sessionId: string, meta: SessionMeta): Promise<NormalizedSession> {
    const db = new Database(OPENCODE_DB_PATH, { readonly: true })
    try {
      const sessionRow = db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId) as {
        id: string
        project_id: string
        directory: string
        title: string
        time_created: number
        time_updated: number
      } | undefined

      if (!sessionRow) {
        return emptySession(sessionId, meta.projectPath)
      }

      const projectRow = db.prepare('SELECT id, worktree, name FROM project WHERE id = ?').get(sessionRow.project_id) as {
        id: string
        worktree: string
        name: string | null
      } | undefined

      const messageRows = db.prepare(
        'SELECT id, session_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC'
      ).all(sessionId) as Array<{
        id: string
        session_id: string
        time_created: number
        data: string
      }>

      const partRows = db.prepare(
        'SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC'
      ).all(sessionId) as Array<{
        id: string
        message_id: string
        session_id: string
        time_created: number
        data: string
      }>

      const sessionInfo: OpenCodeSessionInfo = {
        session: sessionRow,
        project: projectRow ? { id: projectRow.id, worktree: projectRow.worktree, name: projectRow.name } : null,
      }

      return parseOpenCodeMessages(messageRows, partRows, sessionInfo)
    } finally {
      db.close()
    }
  }
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
}

function emptySession(sessionId: string, projectPath: string): NormalizedSession {
  return {
    sessionId,
    cli: 'opencode',
    projectPath,
    projectName: extractProjectName(projectPath),
    startTime: new Date(),
    endTime: new Date(),
    durationMinutes: 0,
    messages: [],
    stats: {
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheTokens: 0,
      toolCallCount: 0,
      toolCallsByName: {},
      filesTouched: [],
      editCount: 0,
      errorCount: 0,
    },
  }
}
