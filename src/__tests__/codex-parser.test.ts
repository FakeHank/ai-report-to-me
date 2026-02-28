import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parseCodexSession } from '../adapters/codex/parser.js'

const CODEX_SESSIONS_DIR = join(homedir(), '.codex', 'sessions')

describe('Codex Parser', () => {
  it('should parse a real session file', () => {
    if (!existsSync(CODEX_SESSIONS_DIR)) {
      console.log('Skipping: no Codex sessions directory found')
      return
    }

    // Find the first .jsonl file recursively
    const testFile = findFirstJsonl(CODEX_SESSIONS_DIR)

    if (!testFile) {
      console.log('Skipping: no .jsonl files found in Codex sessions')
      return
    }

    const session = parseCodexSession(testFile, '/test/project')

    expect(session.sessionId).toBeTruthy()
    expect(session.cli).toBe('codex')
    expect(session.startTime).toBeInstanceOf(Date)
    expect(session.endTime).toBeInstanceOf(Date)
    expect(session.stats).toBeDefined()
    expect(session.stats.messageCount).toBeGreaterThanOrEqual(0)
    expect(typeof session.stats.toolCallCount).toBe('number')

    console.log(`Parsed Codex session ${session.sessionId}:`)
    console.log(`  Messages: ${session.stats.messageCount}`)
    console.log(`  Tool calls: ${session.stats.toolCallCount}`)
    console.log(`  Duration: ${session.durationMinutes}min`)
    console.log(`  Project: ${session.projectPath}`)
    if (session.cliVersion) console.log(`  CLI version: ${session.cliVersion}`)
  })
})

function findFirstJsonl(dir: string): string | null {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        const found = findFirstJsonl(fullPath)
        if (found) return found
      } else if (entry.endsWith('.jsonl')) {
        return fullPath
      }
    }
  } catch {
    // ignore
  }
  return null
}
