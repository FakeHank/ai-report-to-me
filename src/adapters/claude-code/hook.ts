import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { CLAUDE_SETTINGS_PATH } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

const HOOK_COMMAND = 'aireport log-session --cli claude-code'

interface ClaudeSettings {
  hooks?: {
    SessionEnd?: Array<{
      matcher: string
      hooks: Array<{ type: string; command: string }>
    }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export async function installHook(): Promise<void> {
  const settings = readSettings()

  if (!settings.hooks) {
    settings.hooks = {}
  }

  if (!settings.hooks.SessionEnd) {
    settings.hooks.SessionEnd = []
  }

  // Check if already installed
  const exists = settings.hooks.SessionEnd.some((entry) =>
    entry.hooks?.some((h) => h.command === HOOK_COMMAND)
  )

  if (exists) return

  settings.hooks.SessionEnd.push({
    matcher: '*',
    hooks: [
      {
        type: 'command',
        command: HOOK_COMMAND,
      },
    ],
  })

  writeSettings(settings)
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return

  const settings = readSettings()
  if (!settings.hooks?.SessionEnd) return

  settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
    (entry) => !entry.hooks?.some((h) => h.command === HOOK_COMMAND)
  )

  if (settings.hooks.SessionEnd.length === 0) {
    delete settings.hooks.SessionEnd
  }

  writeSettings(settings)
}

export async function checkHookStatus(): Promise<HookStatus> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return { installed: false, hookType: 'SessionEnd', configPath: CLAUDE_SETTINGS_PATH }
  }

  const settings = readSettings()
  const installed = settings.hooks?.SessionEnd?.some((entry) =>
    entry.hooks?.some((h) => h.command === HOOK_COMMAND)
  ) || false

  return { installed, hookType: 'SessionEnd', configPath: CLAUDE_SETTINGS_PATH }
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
