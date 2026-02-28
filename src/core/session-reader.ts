import dayjs from 'dayjs'
import type { CLIAdapter, SessionFilter } from '../adapters/adapter.interface.js'
import type { NormalizedSession } from '../shared/types.js'

export class SessionReader {
  constructor(private adapters: CLIAdapter[]) {}

  async readSessions(filter?: SessionFilter): Promise<NormalizedSession[]> {
    const sessions: NormalizedSession[] = []

    for (const adapter of this.adapters) {
      const metas = await adapter.listSessions(filter)
      for (const meta of metas) {
        try {
          const session = await adapter.readSession(meta.sessionId, meta)
          if (session.messages.length > 0) {
            sessions.push(session)
          }
        } catch {
          // skip unreadable sessions
        }
      }
    }

    sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    return sessions
  }

  async readSessionsByDay(filter?: SessionFilter): Promise<Map<string, NormalizedSession[]>> {
    const sessions = await this.readSessions(filter)
    const byDay = new Map<string, NormalizedSession[]>()

    for (const session of sessions) {
      // Session belongs to the day of its start time (local timezone)
      const day = dayjs(session.startTime).format('YYYY-MM-DD')
      if (!byDay.has(day)) {
        byDay.set(day, [])
      }
      byDay.get(day)!.push(session)
    }

    return byDay
  }
}
