import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import { CODEX_DIR, CODEX_SKILL_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'
import { getCodexSkillContent } from '../command-templates.js'

const CODEX_CONFIG_PATH = `${CODEX_DIR}/config.toml`
const AIREPORT_MARKER = '# ai-report-hook'
const SKILL_FILE = join(CODEX_SKILL_DIR, 'SKILL.md')

export async function installHook(): Promise<void> {
  // Install slash commands as a Codex skill
  if (!existsSync(CODEX_SKILL_DIR)) {
    mkdirSync(CODEX_SKILL_DIR, { recursive: true })
  }
  writeFileSync(SKILL_FILE, getCodexSkillContent(), 'utf-8')
}

export async function uninstallHook(): Promise<void> {
  // Clean up skill file and directory
  if (existsSync(SKILL_FILE)) unlinkSync(SKILL_FILE)
  try { rmdirSync(CODEX_SKILL_DIR) } catch { /* non-empty or missing, ignore */ }

  // Clean up legacy aireport notify lines from config.toml
  if (!existsSync(CODEX_CONFIG_PATH)) return
  const content = readFileSync(CODEX_CONFIG_PATH, 'utf-8')
  if (content.includes(AIREPORT_MARKER)) {
    const lines = content.split('\n')
    const filtered = lines.filter((line) => !line.includes(AIREPORT_MARKER))
    const result = filtered.join('\n').replace(/\n{3,}$/g, '\n')
    writeFileSync(CODEX_CONFIG_PATH, result, 'utf-8')
  }
}

export async function checkHookStatus(): Promise<HookStatus> {
  return {
    installed: existsSync(SKILL_FILE),
    hookType: 'skill (slash commands)',
    configPath: SKILL_FILE,
  }
}
