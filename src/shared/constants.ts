import { homedir } from 'node:os'
import { join } from 'node:path'

export const HOME_DIR = homedir()

export const AI_REPORT_DIR = join(HOME_DIR, '.ai-report')
export const CONFIG_PATH = join(AI_REPORT_DIR, 'config.json')

export const REPORTS_DIR = join(AI_REPORT_DIR, 'reports')
export const WRAPPED_DIR = join(AI_REPORT_DIR, 'wrapped')

export const CLAUDE_DIR = join(HOME_DIR, '.claude')
export const CLAUDE_PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
export const CLAUDE_SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')

export const GEMINI_DIR = join(HOME_DIR, '.gemini')
export const GEMINI_TMP_DIR = join(GEMINI_DIR, 'tmp')

export const CODEX_DIR = join(HOME_DIR, '.codex')
export const CODEX_SESSIONS_DIR = join(CODEX_DIR, 'sessions')
export const CODEX_HISTORY_PATH = join(CODEX_DIR, 'history.jsonl')

export const OPENCODE_DIR = join(HOME_DIR, '.local', 'share', 'opencode')
export const OPENCODE_DB_PATH = join(OPENCODE_DIR, 'opencode.db')

export const DEFAULT_BACKFILL_LIMIT = 7
export const DEFAULT_WRAPPED_DAYS = 90

export const REPORT_META_START = '<!-- ai-report-meta'
export const REPORT_META_END = '-->'
