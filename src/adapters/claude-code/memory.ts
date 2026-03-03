import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLAUDE_PROJECTS_DIR } from '../../shared/constants.js'

/**
 * Read the MEMORY.md file from a Claude Code project's auto memory directory.
 * Returns the first 200 lines of the file, or undefined if it doesn't exist.
 */
export function readProjectMemory(projectPath: string): string | undefined {
  const encoded = encodeProjectPath(projectPath)
  const memoryPath = join(CLAUDE_PROJECTS_DIR, encoded, 'memory', 'MEMORY.md')

  if (!existsSync(memoryPath)) return undefined

  try {
    const content = readFileSync(memoryPath, 'utf-8')
    const lines = content.split('\n')
    return lines.slice(0, 200).join('\n').trim() || undefined
  } catch {
    return undefined
  }
}

function encodeProjectPath(projectPath: string): string {
  // '/Users/foo/bar' → '-Users-foo-bar'
  return projectPath.replace(/\//g, '-')
}
