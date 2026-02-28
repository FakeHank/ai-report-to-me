import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CLIAdapter, DetectResult, SessionFilter, SessionMeta } from '../adapter.interface.js'
import type { NormalizedSession } from '../../shared/types.js'
import { CLAUDE_PROJECTS_DIR } from '../../shared/constants.js'
import { parseClaudeCodeSession } from './parser.js'
import { installHook, uninstallHook, checkHookStatus } from './hook.js'

interface SessionIndexEntry {
  sessionId: string
  fullPath: string
  fileMtime: number
  firstPrompt?: string
  messageCount?: number
  created: string
  modified: string
  gitBranch?: string
  projectPath?: string
  isSidechain?: boolean
}

interface SessionIndex {
  version: number
  entries: SessionIndexEntry[]
  originalPath?: string
}

export class ClaudeCodeAdapter implements CLIAdapter {
  readonly name = 'claude-code'

  async detect(): Promise<DetectResult> {
    if (!existsSync(CLAUDE_PROJECTS_DIR)) {
      return { name: this.name, installed: false, dataPath: null, sessionCount: 0, hookSupport: 'full' }
    }

    let sessionCount = 0
    try {
      const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR)
      for (const dir of projectDirs) {
        const projectDir = join(CLAUDE_PROJECTS_DIR, dir)
        if (!statSync(projectDir).isDirectory()) continue
        const indexPath = join(projectDir, 'sessions-index.json')
        if (existsSync(indexPath)) {
          try {
            const index: SessionIndex = JSON.parse(readFileSync(indexPath, 'utf-8'))
            sessionCount += index.entries.length
          } catch {
            // Fall back to counting .jsonl files
            sessionCount += readdirSync(projectDir).filter((f) => f.endsWith('.jsonl')).length
          }
        } else {
          sessionCount += readdirSync(projectDir).filter((f) => f.endsWith('.jsonl')).length
        }
      }
    } catch {
      // ignore
    }

    return {
      name: this.name,
      installed: true,
      dataPath: CLAUDE_PROJECTS_DIR,
      sessionCount,
      hookSupport: 'full',
    }
  }

  async listSessions(filter?: SessionFilter): Promise<SessionMeta[]> {
    if (!existsSync(CLAUDE_PROJECTS_DIR)) return []

    const sessions: SessionMeta[] = []
    const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR)

    for (const dir of projectDirs) {
      const projectDir = join(CLAUDE_PROJECTS_DIR, dir)
      if (!statSync(projectDir).isDirectory()) continue

      const projectPath = decodeProjectPath(dir)
      if (filter?.projectPath && projectPath !== filter.projectPath) continue

      const indexPath = join(projectDir, 'sessions-index.json')
      if (existsSync(indexPath)) {
        try {
          const index: SessionIndex = JSON.parse(readFileSync(indexPath, 'utf-8'))
          for (const entry of index.entries) {
            if (entry.isSidechain) continue

            const created = new Date(entry.created)
            if (filter?.since && created < filter.since) continue
            if (filter?.until && created > filter.until) continue

            sessions.push({
              sessionId: entry.sessionId,
              projectPath: entry.projectPath || projectPath,
              projectName: extractProjectName(entry.projectPath || projectPath),
              startTime: created,
              endTime: entry.modified ? new Date(entry.modified) : undefined,
              filePath: entry.fullPath || join(projectDir, `${entry.sessionId}.jsonl`),
            })
          }
        } catch {
          // Fall back to scanning .jsonl files
          await this.scanJsonlFiles(projectDir, projectPath, filter, sessions)
        }
      } else {
        await this.scanJsonlFiles(projectDir, projectPath, filter, sessions)
      }
    }

    sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

    if (filter?.limit) {
      return sessions.slice(-filter.limit)
    }

    return sessions
  }

  private async scanJsonlFiles(
    projectDir: string,
    projectPath: string,
    filter: SessionFilter | undefined,
    sessions: SessionMeta[]
  ): Promise<void> {
    const files = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))
    for (const file of files) {
      const filePath = join(projectDir, file)
      const stat = statSync(filePath)
      const startTime = stat.birthtime
      if (filter?.since && startTime < filter.since) continue
      if (filter?.until && startTime > filter.until) continue

      sessions.push({
        sessionId: file.replace('.jsonl', ''),
        projectPath,
        projectName: extractProjectName(projectPath),
        startTime,
        filePath,
      })
    }
  }

  async readSession(sessionId: string, meta: SessionMeta): Promise<NormalizedSession> {
    return parseClaudeCodeSession(meta.filePath, meta.projectPath)
  }

  installHook = installHook
  uninstallHook = uninstallHook
  checkHookStatus = checkHookStatus
}

function decodeProjectPath(dirName: string): string {
  // Claude Code encodes project paths: '-Users-hankyuan-project' → '/Users/hankyuan/project'
  if (dirName === '-') return '/'
  return dirName.replace(/-/g, '/')
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown'
}
