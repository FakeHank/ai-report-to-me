import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parseClaudeCodeSession } from '../adapters/claude-code/parser.js'

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects')

describe('Claude Code Parser', () => {
  it('should parse a real session file', () => {
    if (!existsSync(CLAUDE_PROJECTS_DIR)) {
      console.log('Skipping: no Claude Code projects directory found')
      return
    }

    // Find first project with a .jsonl file
    const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR)
    let testFile: string | null = null
    let projectPath = ''

    for (const dir of projectDirs) {
      const dirPath = join(CLAUDE_PROJECTS_DIR, dir)
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'))
        if (files.length > 0) {
          testFile = join(dirPath, files[0])
          projectPath = dir.replace(/-/g, '/')
          break
        }
      } catch {
        continue
      }
    }

    if (!testFile) {
      console.log('Skipping: no .jsonl files found')
      return
    }

    const session = parseClaudeCodeSession(testFile, projectPath)

    expect(session.sessionId).toBeTruthy()
    expect(session.cli).toBe('claude-code')
    expect(session.startTime).toBeInstanceOf(Date)
    expect(session.endTime).toBeInstanceOf(Date)
    expect(session.stats).toBeDefined()
    expect(session.stats.messageCount).toBeGreaterThanOrEqual(0)
    expect(typeof session.stats.toolCallCount).toBe('number')
    expect(typeof session.stats.totalInputTokens).toBe('number')

    console.log(`Parsed session ${session.sessionId}:`)
    console.log(`  Messages: ${session.stats.messageCount}`)
    console.log(`  Tool calls: ${session.stats.toolCallCount}`)
    console.log(`  Duration: ${session.durationMinutes}min`)
    console.log(`  Input tokens: ${session.stats.totalInputTokens}`)
  })
})
