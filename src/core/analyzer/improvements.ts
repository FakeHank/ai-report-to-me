import type { NormalizedSession, FrictionRecord } from '../../shared/types.js'

export interface Improvement {
  title: string
  observation: string
  suggestion: string
}

export function generateImprovements(
  sessions: NormalizedSession[],
  frictions: FrictionRecord[]
): Improvement[] {
  const improvements: Improvement[] = []

  // 1. Detect "bash then new session" pattern
  const bashEndSessions = sessions.filter((s) => {
    const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant')
    return lastAssistant?.toolCalls?.some((tc) => tc.name === 'Bash')
  })
  if (bashEndSessions.length > sessions.length * 0.3 && bashEndSessions.length >= 3) {
    improvements.push({
      title: 'Premature session endings',
      observation: `${bashEndSessions.length} sessions ended with a Bash command, suggesting you often discover new issues at the end.`,
      suggestion: 'Before wrapping up, ask AI "is there anything I missed?" to catch loose ends.',
    })
  }

  // 2. High friction density on specific error types
  const retryFrictions = frictions.filter((f) => f.type === 'retry')
  if (retryFrictions.length >= 5) {
    improvements.push({
      title: 'Repeated debugging loops',
      observation: `${retryFrictions.length} instances of editing the same file 3+ times in a session.`,
      suggestion: 'Consider asking AI to explain the root cause before attempting fixes.',
    })
  }

  // 3. Late night productivity drop
  const nightSessions = sessions.filter((s) => s.startTime.getHours() >= 23)
  const daySessions = sessions.filter((s) => s.startTime.getHours() >= 9 && s.startTime.getHours() < 18)
  if (nightSessions.length >= 5 && daySessions.length >= 5) {
    const nightAvgDuration = nightSessions.reduce((s, sess) => s + sess.durationMinutes, 0) / nightSessions.length
    const dayAvgDuration = daySessions.reduce((s, sess) => s + sess.durationMinutes, 0) / daySessions.length
    if (nightAvgDuration < dayAvgDuration * 0.6) {
      improvements.push({
        title: 'Late night sessions are less productive',
        observation: `Sessions after 11pm average ${Math.round(nightAvgDuration)}min vs ${Math.round(dayAvgDuration)}min during the day (${Math.round((1 - nightAvgDuration / dayAvgDuration) * 100)}% shorter).`,
        suggestion: 'Avoid starting complex tasks late at night.',
      })
    }
  }

  // 4. Tool error rate
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.stats.toolCallCount, 0)
  const totalErrors = sessions.reduce((sum, s) => sum + s.stats.errorCount, 0)
  if (totalToolCalls > 50 && totalErrors / totalToolCalls > 0.1) {
    improvements.push({
      title: 'High tool error rate',
      observation: `${totalErrors} tool errors out of ${totalToolCalls} calls (${Math.round(totalErrors / totalToolCalls * 100)}%).`,
      suggestion: 'Review common error patterns — often they stem from stale context or incorrect assumptions.',
    })
  }

  return improvements
}
