import type { NormalizedSession } from '../shared/types.js'

export interface SessionFilter {
  since?: Date
  until?: Date
  projectPath?: string
  limit?: number
}

export interface SessionMeta {
  sessionId: string
  projectPath: string
  projectName: string
  startTime: Date
  endTime?: Date
  filePath: string
}

export interface DetectResult {
  name: string
  installed: boolean
  dataPath: string | null
  sessionCount: number
  hookSupport: 'full' | 'partial' | 'none'
}

export interface HookStatus {
  installed: boolean
  hookType: string
  configPath: string
}

export interface CLIAdapter {
  readonly name: string

  detect(): Promise<DetectResult>

  listSessions(filter?: SessionFilter): Promise<SessionMeta[]>

  readSession(sessionId: string, meta: SessionMeta): Promise<NormalizedSession>

  installHook?(): Promise<void>

  uninstallHook?(): Promise<void>

  checkHookStatus?(): Promise<HookStatus>
}
