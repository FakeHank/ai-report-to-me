import type { NormalizedSession, FrictionRecord } from '../../shared/types.js'

const EDIT_RETRY_THRESHOLD = 3
const ERROR_RETRY_THRESHOLD = 2

export function detectFriction(session: NormalizedSession): FrictionRecord[] {
  const records: FrictionRecord[] = []
  records.push(...detectEditRetries(session))
  records.push(...detectErrorLoops(session))
  records.push(...detectDirectionSwitches(session))
  return records
}

function detectEditRetries(session: NormalizedSession): FrictionRecord[] {
  const fileEdits: Record<string, number> = {}
  for (const msg of session.messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.name === 'Edit') {
          const file = (tc.input.file_path || tc.input.path) as string | undefined
          if (file) {
            fileEdits[file] = (fileEdits[file] || 0) + 1
          }
        }
      }
    }
  }

  return Object.entries(fileEdits)
    .filter(([, count]) => count > EDIT_RETRY_THRESHOLD)
    .map(([file, count]) => {
      // Scan for resolution: look for successful Bash (test/build) after the edits
      const resolution = findResolutionForFile(session, file)
      return {
        type: 'retry' as const,
        description: `File edited ${count} times in single session (possible debugging loop)`,
        file,
        sessionId: session.sessionId,
        count,
        ...resolution,
      }
    })
}

function detectErrorLoops(session: NormalizedSession): FrictionRecord[] {
  const records: FrictionRecord[] = []
  const toolErrors: Record<string, { count: number; lastErrorIndex: number }> = {}

  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i]
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.isError) {
          const key = `${tc.name}:${tc.input.file_path || tc.input.command || 'unknown'}`
          if (!toolErrors[key]) toolErrors[key] = { count: 0, lastErrorIndex: i }
          toolErrors[key].count++
          toolErrors[key].lastErrorIndex = i
        }
      }
    }
  }

  for (const [key, { count, lastErrorIndex }] of Object.entries(toolErrors)) {
    if (count > ERROR_RETRY_THRESHOLD) {
      const [toolName, target] = key.split(':')
      // Scan forward from last error for resolution
      let resolved = false
      let resolution: string | undefined

      for (let j = lastErrorIndex + 1; j < session.messages.length; j++) {
        const laterMsg = session.messages[j]
        if (!laterMsg.toolCalls) continue
        for (const tc of laterMsg.toolCalls) {
          if (tc.isError) continue
          const tcTarget = String(tc.input.file_path || tc.input.command || '')
          if (tc.name === toolName && tcTarget === target) {
            resolved = true
            resolution = `${tc.name} on ${target} succeeded after ${count} failures`
            break
          }
        }
        if (resolved) break
      }

      records.push({
        type: 'error-loop',
        description: `Tool ${toolName} failed ${count} times on same target`,
        sessionId: session.sessionId,
        count,
        resolution,
        resolved,
      })
    }
  }

  return records
}

function detectDirectionSwitches(session: NormalizedSession): FrictionRecord[] {
  const records: FrictionRecord[] = []

  // Look for patterns where files are created then deleted or heavily rewritten
  const fileOps: Record<string, string[]> = {}
  for (const msg of session.messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        const file = (tc.input.file_path || tc.input.path) as string | undefined
        if (file) {
          if (!fileOps[file]) fileOps[file] = []
          fileOps[file].push(tc.name)
        }
      }
    }
  }

  for (const [file, ops] of Object.entries(fileOps)) {
    // Write followed by multiple Edits followed by Write (rewrite) suggests direction change
    const writeCount = ops.filter((o) => o === 'Write').length
    if (writeCount > 1) {
      records.push({
        type: 'direction-switch',
        description: `File was written ${writeCount} times (possible approach restart)`,
        file,
        sessionId: session.sessionId,
        count: writeCount,
      })
    }
  }

  return records
}

function findResolutionForFile(session: NormalizedSession, file: string): { resolution?: string; resolved?: boolean } {
  // Look at the last few messages for signs the file's issues were resolved
  const tail = session.messages.slice(-5)
  for (const msg of tail) {
    if (!msg.toolCalls) continue
    for (const tc of msg.toolCalls) {
      if (tc.isError) continue
      if (tc.name === 'Bash') {
        const cmd = String(tc.input.command || '')
        if (/test|build|lint|check/i.test(cmd)) {
          return { resolution: `Resolved after running: ${cmd.slice(0, 100)}`, resolved: true }
        }
      }
    }
  }
  return {}
}
