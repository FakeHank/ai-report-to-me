/**
 * Shared slash command content templates for all CLI adapters.
 * All CLIs use the same dayreport/qtreport logic: call save-daily/save-wrapped
 * to ensure webhooks are triggered.
 *
 * Content is read from static markdown files in commands/ directory,
 * which are also used directly by the Claude Code plugin system.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getCommandsDir(): string {
  // In dev (tsx): src/adapters/ → ../../commands/
  // In built (dist/cli/): dist/cli/ → ../../commands/
  // Both resolve to package root's commands/ directory
  return resolve(__dirname, '..', '..', 'commands')
}

export function getDayreportContent(): string {
  return readFileSync(resolve(getCommandsDir(), 'dayreport.md'), 'utf-8')
}

export function getQtreportContent(): string {
  return readFileSync(resolve(getCommandsDir(), 'qtreport.md'), 'utf-8')
}

