import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GEMINI_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

const GEMINI_SETTINGS_PATH = join(GEMINI_DIR, 'settings.json')

// Gemini CLI's AfterAgent hook was previously used for log-session,
// which has been removed. No hooks are currently needed.
// Keeping the structure for future use.

export async function installHook(): Promise<void> {
  // No hooks to install currently
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(GEMINI_SETTINGS_PATH)) return

  // Clean up any legacy aireport hooks
  const settings = readSettings()
  if (settings.hooks?.AfterAgent) {
    settings.hooks.AfterAgent = settings.hooks.AfterAgent.filter(
      (h: { command?: string }) => !h.command?.includes('aireport')
    )
    if (settings.hooks.AfterAgent.length === 0) {
      delete settings.hooks.AfterAgent
    }
    writeSettings(settings)
  }
}

export async function checkHookStatus(): Promise<HookStatus> {
  // No hooks needed currently, always report as installed
  return { installed: true, hookType: 'none', configPath: GEMINI_SETTINGS_PATH }
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
