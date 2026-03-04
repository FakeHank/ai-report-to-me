import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { GEMINI_DIR, GEMINI_COMMANDS_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'
import { getDayreportContent, getQtreportContent } from '../command-templates.js'

const GEMINI_SETTINGS_PATH = join(GEMINI_DIR, 'settings.json')
const DAYREPORT_PATH = join(GEMINI_COMMANDS_DIR, 'dayreport.md')
const QTREPORT_PATH = join(GEMINI_COMMANDS_DIR, 'qtreport.md')

export async function installHook(): Promise<void> {
  // Install slash commands
  if (!existsSync(GEMINI_COMMANDS_DIR)) {
    mkdirSync(GEMINI_COMMANDS_DIR, { recursive: true })
  }
  writeFileSync(DAYREPORT_PATH, getDayreportContent(), 'utf-8')
  writeFileSync(QTREPORT_PATH, getQtreportContent(), 'utf-8')
}

export async function uninstallHook(): Promise<void> {
  // Remove slash commands
  if (existsSync(DAYREPORT_PATH)) unlinkSync(DAYREPORT_PATH)
  if (existsSync(QTREPORT_PATH)) unlinkSync(QTREPORT_PATH)

  // Clean up any legacy aireport hooks from settings.json (all hook types)
  if (!existsSync(GEMINI_SETTINGS_PATH)) return
  const settings = readSettings()
  if (settings.hooks) {
    let changed = false
    for (const hookType of Object.keys(settings.hooks)) {
      const entries = settings.hooks[hookType]
      if (!Array.isArray(entries)) continue
      const cleaned = entries.filter(
        (h: { command?: string }) => !h.command?.includes('aireport')
      )
      if (cleaned.length !== entries.length) {
        changed = true
        if (cleaned.length === 0) {
          delete settings.hooks[hookType]
        } else {
          settings.hooks[hookType] = cleaned
        }
      }
    }
    if (changed) writeSettings(settings)
  }
}

export async function checkHookStatus(): Promise<HookStatus> {
  return {
    installed: existsSync(DAYREPORT_PATH) && existsSync(QTREPORT_PATH),
    hookType: 'commands (slash commands)',
    configPath: GEMINI_COMMANDS_DIR,
  }
}

function readSettings(): Record<string, any> {
  if (!existsSync(GEMINI_SETTINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(GEMINI_SETTINGS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, any>): void {
  writeFileSync(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}
