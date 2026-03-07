import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CODEX_DIR, CODEX_AGENTS_SKILLS_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'
import { getDayreportContent, getQtreportContent } from '../command-templates.js'

const DAYREPORT_SKILL_DIR = join(CODEX_AGENTS_SKILLS_DIR, 'dayreport')
const QTREPORT_SKILL_DIR = join(CODEX_AGENTS_SKILLS_DIR, 'qtreport')
const DAYREPORT_SKILL_FILE = join(DAYREPORT_SKILL_DIR, 'SKILL.md')
const QTREPORT_SKILL_FILE = join(QTREPORT_SKILL_DIR, 'SKILL.md')

// Legacy paths to clean up
const LEGACY_SKILL_DIR = join(CODEX_DIR, 'skills', 'ai-report')
const LEGACY_SKILL_FILE = join(LEGACY_SKILL_DIR, 'SKILL.md')
const CODEX_CONFIG_PATH = join(CODEX_DIR, 'config.toml')
const AIREPORT_MARKER = '# ai-report-hook'

function wrapSkill(name: string, description: string, content: string): string {
  return `---
name: ${name}
description: ${description}
---

${content}
`
}

export async function installHook(): Promise<void> {
  // Install two separate skills: $dayreport and $qtreport
  if (!existsSync(DAYREPORT_SKILL_DIR)) {
    mkdirSync(DAYREPORT_SKILL_DIR, { recursive: true })
  }
  if (!existsSync(QTREPORT_SKILL_DIR)) {
    mkdirSync(QTREPORT_SKILL_DIR, { recursive: true })
  }

  writeFileSync(
    DAYREPORT_SKILL_FILE,
    wrapSkill('dayreport', 'Generate a daily coding report from session data.', getDayreportContent()),
    'utf-8',
  )
  writeFileSync(
    QTREPORT_SKILL_FILE,
    wrapSkill('qtreport', 'Generate a 90-day Vibe Coding Wrapped report from session data.', getQtreportContent()),
    'utf-8',
  )

  // Clean up legacy single skill
  cleanupLegacySkill()
}

export async function uninstallHook(): Promise<void> {
  // Remove skill files and directories
  if (existsSync(DAYREPORT_SKILL_FILE)) unlinkSync(DAYREPORT_SKILL_FILE)
  try { rmdirSync(DAYREPORT_SKILL_DIR) } catch { /* non-empty or missing */ }

  if (existsSync(QTREPORT_SKILL_FILE)) unlinkSync(QTREPORT_SKILL_FILE)
  try { rmdirSync(QTREPORT_SKILL_DIR) } catch { /* non-empty or missing */ }

  // Clean up legacy
  cleanupLegacySkill()
}

export async function checkHookStatus(): Promise<HookStatus> {
  return {
    installed: existsSync(DAYREPORT_SKILL_FILE) && existsSync(QTREPORT_SKILL_FILE),
    hookType: 'skills ($dayreport, $qtreport)',
    configPath: CODEX_AGENTS_SKILLS_DIR,
  }
}

function cleanupLegacySkill(): void {
  // Remove old single-skill at ~/.codex/skills/ai-report/
  if (existsSync(LEGACY_SKILL_FILE)) unlinkSync(LEGACY_SKILL_FILE)
  try { rmdirSync(LEGACY_SKILL_DIR) } catch { /* ignore */ }
  try { rmdirSync(join(CODEX_DIR, 'skills')) } catch { /* ignore */ }

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
