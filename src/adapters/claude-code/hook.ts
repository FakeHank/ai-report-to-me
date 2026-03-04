import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { CLAUDE_SETTINGS_PATH, CLAUDE_COMMANDS_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'
import { getDayreportContent, getQtreportContent } from '../command-templates.js'

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

function isAireportHookEntry(entry: HookEntry): boolean {
  return entry.hooks?.some((h) =>
    h.command === 'aireport' || h.command.endsWith('/aireport') ||
    /(?:^|\/)aireport\s/.test(h.command)
  ) || false
}

interface HookEntry {
  matcher?: string
  hooks: Array<{ type: string; command: string; timeout?: number }>
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>
  [key: string]: unknown
}

const STARTUP_SUFFIX = 'startup-check'

function hasAireportHook(entries: HookEntry[] | undefined, suffix: string): boolean {
  return entries?.some((entry) =>
    entry.hooks?.some((h) => matchesAireportCommand(h.command, suffix))
  ) || false
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

  // Install slash commands
  installCommands()
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return

  const settings = readSettings()

  if (settings.hooks) {
    // Clean ALL aireport-related hooks from every hook type
    // (SessionStart, SessionEnd, etc.) to handle both current and legacy hooks
    for (const hookType of Object.keys(settings.hooks)) {
      const entries = settings.hooks[hookType]
      if (!Array.isArray(entries)) continue

      const cleaned = entries.filter((entry) => !isAireportHookEntry(entry))
      if (cleaned.length === 0) {
        delete settings.hooks[hookType]
      } else if (cleaned.length !== entries.length) {
        settings.hooks[hookType] = cleaned
      }
    }
  }

  writeSettings(settings)

  // Remove slash commands
  uninstallCommands()
}

export async function checkHookStatus(): Promise<HookStatus> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return { installed: false, hookType: 'SessionStart', configPath: CLAUDE_SETTINGS_PATH }
  }

  const settings = readSettings()
  const hookInstalled = hasAireportHook(settings.hooks?.SessionStart, STARTUP_SUFFIX)
  const cmdsInstalled = commandsInstalled()

  return {
    installed: hookInstalled && cmdsInstalled,
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

const DAYREPORT_PATH = join(CLAUDE_COMMANDS_DIR, 'dayreport.md')
const QTREPORT_PATH = join(CLAUDE_COMMANDS_DIR, 'qtreport.md')

function installCommands(): void {
  if (!existsSync(CLAUDE_COMMANDS_DIR)) {
    mkdirSync(CLAUDE_COMMANDS_DIR, { recursive: true })
  }
  writeFileSync(DAYREPORT_PATH, getDayreportContent(), 'utf-8')
  writeFileSync(QTREPORT_PATH, getQtreportContent(), 'utf-8')
}

function uninstallCommands(): void {
  if (existsSync(DAYREPORT_PATH)) unlinkSync(DAYREPORT_PATH)
  if (existsSync(QTREPORT_PATH)) unlinkSync(QTREPORT_PATH)
}

function commandsInstalled(): boolean {
  return existsSync(DAYREPORT_PATH) && existsSync(QTREPORT_PATH)
}
