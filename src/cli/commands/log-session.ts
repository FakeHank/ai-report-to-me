import { Command } from 'commander'
import { appendJsonl } from '../../shared/storage.js'
import { SESSION_LOG_PATH } from '../../shared/constants.js'
import type { SessionLogEntry } from '../../shared/types.js'

export const logSessionCommand = new Command('log-session')
  .description('Log a session end event (called by hooks)')
  .requiredOption('--cli <cli>', 'CLI name (e.g., claude-code)')
  .action(async (opts: { cli: string }) => {
    // Read hook data from stdin
    let stdinData: Record<string, unknown> = {}
    try {
      // Non-blocking stdin read with timeout
      const timeout = setTimeout(() => {}, 100)
      process.stdin.setEncoding('utf-8')

      await new Promise<void>((resolve) => {
        let data = ''
        process.stdin.on('data', (chunk) => {
          data += chunk
        })
        process.stdin.on('end', () => {
          if (data.trim()) {
            try {
              stdinData = JSON.parse(data)
            } catch {
              // ignore malformed stdin
            }
          }
          resolve()
        })
        // Timeout after 1 second
        setTimeout(resolve, 1000)
      })

      clearTimeout(timeout)
    } catch {
      // ignore stdin errors
    }

    const entry: SessionLogEntry = {
      sessionId: (stdinData.session_id as string) || 'unknown',
      cli: opts.cli,
      projectPath: (stdinData.cwd as string) || 'unknown',
      timestamp: new Date().toISOString(),
    }

    appendJsonl(SESSION_LOG_PATH, entry)
  })
