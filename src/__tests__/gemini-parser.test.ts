import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { parseGeminiSession } from '../adapters/gemini-cli/parser.js'

const GEMINI_TMP_DIR = join(homedir(), '.gemini', 'tmp')

describe('Gemini CLI Parser', () => {
  it('should parse a real session file', () => {
    if (!existsSync(GEMINI_TMP_DIR)) {
      console.log('Skipping: no Gemini CLI tmp directory found')
      return
    }

    // Find first session-*.json file
    const testFile = findFirstSessionJson(GEMINI_TMP_DIR)

    if (!testFile) {
      console.log('Skipping: no session JSON files found in Gemini CLI')
      return
    }

    const session = parseGeminiSession(testFile, '/test/project')

    expect(session.sessionId).toBeTruthy()
    expect(session.cli).toBe('gemini-cli')
    expect(session.startTime).toBeInstanceOf(Date)
    expect(session.endTime).toBeInstanceOf(Date)
    expect(session.stats).toBeDefined()
    expect(session.stats.messageCount).toBeGreaterThanOrEqual(0)

    console.log(`Parsed Gemini session ${session.sessionId}:`)
    console.log(`  Messages: ${session.stats.messageCount}`)
    console.log(`  Tool calls: ${session.stats.toolCallCount}`)
  })
})

function findFirstSessionJson(tmpDir: string): string | null {
  try {
    const hashDirs = readdirSync(tmpDir)
    for (const hashDir of hashDirs) {
      const chatsDir = join(tmpDir, hashDir, 'chats')
      if (!existsSync(chatsDir)) continue
      try {
        const files = readdirSync(chatsDir).filter((f) => f.startsWith('session-') && f.endsWith('.json'))
        if (files.length > 0) return join(chatsDir, files[0])
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return null
}
