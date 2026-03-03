import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CODEX_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'

const CODEX_CONFIG_PATH = `${CODEX_DIR}/config.toml`
const AIREPORT_MARKER = '# ai-report-hook'

// Codex notify was previously used for log-session, which has been removed.
// No hooks are currently needed. Keeping the structure for future use.

export async function installHook(): Promise<void> {
  // No hooks to install currently
}

export async function uninstallHook(): Promise<void> {
  if (!existsSync(CODEX_CONFIG_PATH)) return

  // Clean up any legacy aireport notify lines
  const content = readFileSync(CODEX_CONFIG_PATH, 'utf-8')
  if (content.includes(AIREPORT_MARKER)) {
    const lines = content.split('\n')
    const filtered = lines.filter((line) => !line.includes(AIREPORT_MARKER))
    const result = filtered.join('\n').replace(/\n{3,}$/g, '\n')
    writeFileSync(CODEX_CONFIG_PATH, result, 'utf-8')
  }
}

export async function checkHookStatus(): Promise<HookStatus> {
  // No hooks needed currently, always report as installed
  return { installed: true, hookType: 'none', configPath: CODEX_CONFIG_PATH }
}
