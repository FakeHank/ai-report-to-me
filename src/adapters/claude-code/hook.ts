import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { CLAUDE_SETTINGS_PATH } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

const HOOK_COMMAND = 'aireport log-session --cli claude-code'
const STARTUP_HOOK_COMMAND = 'aireport startup-check'

interface HookEntry {
  matcher?: string
  hooks: Array<{ type: string; command: string; timeout?: number }>
}

interface ClaudeSettings {
  hooks?: {
    SessionEnd?: HookEntry[]
    SessionStart?: HookEntry[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

function hasCommand(entries: HookEntry[] | undefined, command: string): boolean {
  return entries?.some((entry) => entry.hooks?.some((h) => h.command === command)) || false
}

export async function installHook(): Promise<void> {
  const settings = readSettings()

  if (!settings.hooks) {
    settings.hooks = {}
  }

  let changed = false

  // Install SessionEnd hook for session logging
  if (!settings.hooks.SessionEnd) {
    settings.hooks.SessionEnd = []
  }
  if (!hasCommand(settings.hooks.SessionEnd, HOOK_COMMAND)) {
    settings.hooks.SessionEnd.push({
      matcher: '*',
      hooks: [{ type: 'command', command: HOOK_COMMAND }],
    })
    changed = true
  }

  // Install SessionStart hook for startup context
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = []
  }
  if (!hasCommand(settings.hooks.SessionStart, STARTUP_HOOK_COMMAND)) {
    settings.hooks.SessionStart.push({
      matcher: '*',
      hooks: [{ type: 'command', command: STARTUP_HOOK_COMMAND }],
    })
    changed = true
  }

  if (changed) {
    writeSettings(settings)
  }
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return

  const settings = readSettings()

  if (settings.hooks?.SessionEnd) {
    settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
      (entry) => !entry.hooks?.some((h) => h.command === HOOK_COMMAND)
    )
    if (settings.hooks.SessionEnd.length === 0) {
      delete settings.hooks.SessionEnd
    }
  }

  if (settings.hooks?.SessionStart) {
    settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
      (entry) => !entry.hooks?.some((h) => h.command === STARTUP_HOOK_COMMAND)
    )
    if (settings.hooks.SessionStart.length === 0) {
      delete settings.hooks.SessionStart
    }
  }

  writeSettings(settings)
}

export async function checkHookStatus(): Promise<HookStatus> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return { installed: false, hookType: 'SessionEnd+SessionStart', configPath: CLAUDE_SETTINGS_PATH }
  }

  const settings = readSettings()
  const sessionEndInstalled = hasCommand(settings.hooks?.SessionEnd, HOOK_COMMAND)
  const startupInstalled = hasCommand(settings.hooks?.SessionStart, STARTUP_HOOK_COMMAND)

  return {
    installed: sessionEndInstalled && startupInstalled,
    hookType: 'SessionEnd+SessionStart',
    configPath: CLAUDE_SETTINGS_PATH,
  }
}

function readSettings(): ClaudeSettings {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSettings(settings: ClaudeSettings): void {
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}
