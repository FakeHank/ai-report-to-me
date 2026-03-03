import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { GEMINI_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

const GEMINI_SETTINGS_PATH = join(GEMINI_DIR, 'settings.json')

function resolveAireportBin(): string {
  try {
    return execSync('which aireport', { encoding: 'utf-8' }).trim()
  } catch {
    return 'aireport'
  }
}

function matchesAireportCommand(cmd: string, suffix: string): boolean {
  return cmd === `aireport ${suffix}` || cmd.endsWith(`/aireport ${suffix}`)
}

interface HookEntry {
  type: string
  command: string
}

interface GeminiSettings {
  hooks?: {
    AfterAgent?: HookEntry[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

const LOG_SUFFIX = 'log-session --cli gemini-cli'

function hasAireportHook(entries: HookEntry[] | undefined, suffix: string): boolean {
  return entries?.some((h) => matchesAireportCommand(h.command, suffix)) || false
}

function removeAireportHook(entries: HookEntry[], suffix: string): HookEntry[] {
  return entries.filter((h) => !matchesAireportCommand(h.command, suffix))
}

export async function installHook(): Promise<void> {
  const settings = readSettings()
  const bin = resolveAireportBin()

  if (!settings.hooks) {
    settings.hooks = {}
  }

  if (!settings.hooks.AfterAgent) {
    settings.hooks.AfterAgent = []
  }

  if (!hasAireportHook(settings.hooks.AfterAgent, LOG_SUFFIX)) {
    settings.hooks.AfterAgent.push({ type: 'command', command: `${bin} ${LOG_SUFFIX}` })
    writeSettings(settings)
  }
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(GEMINI_SETTINGS_PATH)) return

  const settings = readSettings()

  if (settings.hooks?.AfterAgent) {
    settings.hooks.AfterAgent = removeAireportHook(settings.hooks.AfterAgent, LOG_SUFFIX)
    if (settings.hooks.AfterAgent.length === 0) {
      delete settings.hooks.AfterAgent
    }
  }

  writeSettings(settings)
}

export async function checkHookStatus(): Promise<HookStatus> {
  if (!existsSync(GEMINI_SETTINGS_PATH)) {
    return { installed: false, hookType: 'AfterAgent', configPath: GEMINI_SETTINGS_PATH }
  }

  const settings = readSettings()
  const installed = hasAireportHook(settings.hooks?.AfterAgent, LOG_SUFFIX)

  return { installed, hookType: 'AfterAgent', configPath: GEMINI_SETTINGS_PATH }
}

function readSettings(): GeminiSettings {
  if (!existsSync(GEMINI_SETTINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(GEMINI_SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSettings(settings: GeminiSettings): void {
  writeFileSync(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}
