import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CLIAdapter, DetectResult, SessionFilter, SessionMeta } from '../adapter.interface.js'
import type { NormalizedSession } from '../../shared/types.js'
import { GEMINI_TMP_DIR } from '../../shared/constants.js'
import { parseGeminiSession } from './parser.js'

export class GeminiCliAdapter implements CLIAdapter {
  readonly name = 'gemini-cli'

  async detect(): Promise<DetectResult> {
    if (!existsSync(GEMINI_TMP_DIR)) {
      return { name: this.name, installed: false, dataPath: null, sessionCount: 0, hookSupport: 'partial' }
    }

    let sessionCount = 0
    try {
      sessionCount = countSessionFiles(GEMINI_TMP_DIR)
    } catch {
      // ignore
    }

    return {
      name: this.name,
      installed: sessionCount > 0,
      dataPath: GEMINI_TMP_DIR,
      sessionCount,
      hookSupport: 'partial',
    }
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMeta[]> {
    if (!existsSync(GEMINI_TMP_DIR)) return []

    const sessions: SessionMeta[] = []

    try {
      const hashDirs = readdirSync(GEMINI_TMP_DIR)
      for (const hashDir of hashDirs) {
        const chatsDir = join(GEMINI_TMP_DIR, hashDir, 'chats')
        if (!existsSync(chatsDir)) continue

        let chatFiles: string[]
        try {
          chatFiles = readdirSync(chatsDir).filter((f) => f.startsWith('session-') && f.endsWith('.json'))
        } catch {
          continue
        }

        for (const file of chatFiles) {
          const filePath = join(chatsDir, file)
          try {
            const stat = statSync(filePath)
            const startTime = stat.birthtime

            if (filter?.since && startTime < filter.since) continue
            if (filter?.until && startTime > filter.until) continue

            sessions.push({
              sessionId: file.replace('.json', ''),
              projectPath: '', // Gemini doesn't store project path in obvious location
              projectName: 'unknown',
              startTime,
              endTime: stat.mtime,
              filePath,
            })
          } catch {
            continue
          }
        }
      }
    } catch {
      // ignore
    }

    sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

    if (filter?.limit) {
      return sessions.slice(-filter.limit)
    }

    return sessions
  }

  async readSession(sessionId: string, meta: SessionMeta): Promise<NormalizedSession> {
    return parseGeminiSession(meta.filePath, meta.projectPath)
  }
}

function countSessionFiles(tmpDir: string): number {
  let count = 0
  try {
    const hashDirs = readdirSync(tmpDir)
    for (const hashDir of hashDirs) {
      const chatsDir = join(tmpDir, hashDir, 'chats')
      if (!existsSync(chatsDir)) continue
      try {
        count += readdirSync(chatsDir).filter((f) => f.startsWith('session-') && f.endsWith('.json')).length
      } catch {
        continue
      }
    }
  } catch {
    // ignore
  }
  return count
}
