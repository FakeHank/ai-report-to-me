import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { CLAUDE_SETTINGS_PATH } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

function resolveAireportBin(): string {
  try {
    return execSync('which aireport', { encoding: 'utf-8' }).trim()
  } catch {
    return 'aireport'
  }
}

function matchesAireportCommand(cmd: string, suffix: string): boolean {
  // Match both bare "aireport <suffix>" and absolute path "/…/aireport <suffix>"
  return cmd === `aireport ${suffix}` || cmd.endsWith(`/aireport ${suffix}`)
}

interface HookEntry {
  matcher?: string
  hooks: Array<{ type: string; command: string; timeout?: number }>
}

interface ClaudeSettings {
  hooks?: {
    SessionStart?: HookEntry[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

const STARTUP_SUFFIX = 'startup-check'

function hasAireportHook(entries: HookEntry[] | undefined, suffix: string): boolean {
  return entries?.some((entry) =>
    entry.hooks?.some((h) => matchesAireportCommand(h.command, suffix))
  ) || false
}

function removeAireportHook(entries: HookEntry[], suffix: string): HookEntry[] {
  return entries.filter(
    (entry) => !entry.hooks?.some((h) => matchesAireportCommand(h.command, suffix))
  )
}

export async function installHook(): Promise<void> {
  const settings = readSettings()
  const bin = resolveAireportBin()

  if (!settings.hooks) {
    settings.hooks = {}
  }

  // Install SessionStart hook for startup context
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = []
  }
  if (!hasAireportHook(settings.hooks.SessionStart, STARTUP_SUFFIX)) {
    settings.hooks.SessionStart.push({
      matcher: '*',
      hooks: [{ type: 'command', command: `${bin} ${STARTUP_SUFFIX}` }],
    })
    writeSettings(settings)
  }
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return

  const settings = readSettings()

  if (settings.hooks?.SessionStart) {
    settings.hooks.SessionStart = removeAireportHook(settings.hooks.SessionStart, STARTUP_SUFFIX)
    if (settings.hooks.SessionStart.length === 0) {
      delete settings.hooks.SessionStart
    }
  }

  writeSettings(settings)
}

export async function checkHookStatus(): Promise<HookStatus> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return { installed: false, hookType: 'SessionStart', configPath: CLAUDE_SETTINGS_PATH }
  }

  const settings = readSettings()
  const installed = hasAireportHook(settings.hooks?.SessionStart, STARTUP_SUFFIX)

  return {
    installed,
    hookType: 'SessionStart',
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
