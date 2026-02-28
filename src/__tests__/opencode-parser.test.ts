import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import Database from 'better-sqlite3'
import { parseOpenCodeMessages, type OpenCodeSessionInfo } from '../adapters/opencode/parser.js'

const OPENCODE_DB_PATH = join(homedir(), '.local', 'share', 'opencode', 'opencode.db')

describe('OpenCode Parser', () => {
  it('should parse a real session from SQLite', () => {
    if (!existsSync(OPENCODE_DB_PATH)) {
      console.log('Skipping: no OpenCode database found')
      return
    }

    const db = new Database(OPENCODE_DB_PATH, { readonly: true })
    try {
      // Get the most recent session with messages
      const sessionRow = db.prepare(`
        SELECT s.id, s.project_id, s.directory, s.title, s.time_created, s.time_updated
        FROM session s
        WHERE EXISTS (SELECT 1 FROM message m WHERE m.session_id = s.id)
        ORDER BY s.time_created DESC
        LIMIT 1
      `).get() as {
        id: string
        project_id: string
        directory: string
        title: string
        time_created: number
        time_updated: number
      } | undefined

      if (!sessionRow) {
        console.log('Skipping: no sessions with messages found')
        return
      }

      const projectRow = db.prepare('SELECT id, worktree, name FROM project WHERE id = ?').get(sessionRow.project_id) as {
        id: string
        worktree: string
        name: string | null
      } | undefined

      const messageRows = db.prepare(
        'SELECT id, session_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC'
      ).all(sessionRow.id) as Array<{
        id: string
        session_id: string
        time_created: number
        data: string
      }>

      const partRows = db.prepare(
        'SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC'
      ).all(sessionRow.id) as Array<{
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

      const session = parseOpenCodeMessages(messageRows, partRows, sessionInfo)

      expect(session.sessionId).toBe(sessionRow.id)
      expect(session.cli).toBe('opencode')
      expect(session.startTime).toBeInstanceOf(Date)
      expect(session.endTime).toBeInstanceOf(Date)
      expect(session.stats).toBeDefined()
      expect(session.stats.messageCount).toBeGreaterThanOrEqual(0)
      expect(typeof session.stats.toolCallCount).toBe('number')
      expect(typeof session.stats.totalInputTokens).toBe('number')

      console.log(`Parsed OpenCode session ${session.sessionId}:`)
      console.log(`  Messages: ${session.stats.messageCount}`)
      console.log(`  Tool calls: ${session.stats.toolCallCount}`)
      console.log(`  Duration: ${session.durationMinutes}min`)
      console.log(`  Input tokens: ${session.stats.totalInputTokens}`)
      console.log(`  Project: ${session.projectPath}`)
    } finally {
      db.close()
    }
  })
})
