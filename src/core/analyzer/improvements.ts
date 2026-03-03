import type { NormalizedSession, FrictionRecord } from '../../shared/types.js'
import { t, tf } from '../../shared/i18n.js'

export interface Improvement {
  title: string
  observation: string
  suggestion: string
}

export function generateImprovements(
  sessions: NormalizedSession[],
  frictions: FrictionRecord[],
  lang = 'en'
): Improvement[] {
  const improvements: Improvement[] = []

  // 1. Detect "bash then new session" pattern
  const bashEndSessions = sessions.filter((s) => {
    const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant')
    return lastAssistant?.toolCalls?.some((tc) => tc.name === 'Bash')
  })
  if (bashEndSessions.length > sessions.length * 0.3 && bashEndSessions.length >= 3) {
    improvements.push({
      title: t('improvements.prematureEndings.title', lang),
      observation: tf('improvements.prematureEndings.observation', lang, { count: bashEndSessions.length }),
      suggestion: t('improvements.prematureEndings.suggestion', lang),
    })
  }

  // 2. High friction density on specific error types
  const retryFrictions = frictions.filter((f) => f.type === 'retry')
  if (retryFrictions.length >= 5) {
    improvements.push({
      title: t('improvements.debuggingLoops.title', lang),
      observation: tf('improvements.debuggingLoops.observation', lang, { count: retryFrictions.length }),
      suggestion: t('improvements.debuggingLoops.suggestion', lang),
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
        title: t('improvements.lateNight.title', lang),
        observation: tf('improvements.lateNight.observation', lang, {
          nightMin: Math.round(nightAvgDuration),
          dayMin: Math.round(dayAvgDuration),
          pctDrop: Math.round((1 - nightAvgDuration / dayAvgDuration) * 100),
        }),
        suggestion: t('improvements.lateNight.suggestion', lang),
      })
    }
  }

  // 4. Tool error rate
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.stats.toolCallCount, 0)
  const totalErrors = sessions.reduce((sum, s) => sum + s.stats.errorCount, 0)
  if (totalToolCalls > 50 && totalErrors / totalToolCalls > 0.1) {
    improvements.push({
      title: t('improvements.highErrorRate.title', lang),
      observation: tf('improvements.highErrorRate.observation', lang, {
        errors: totalErrors,
        total: totalToolCalls,
        pct: Math.round(totalErrors / totalToolCalls * 100),
      }),
      suggestion: t('improvements.highErrorRate.suggestion', lang),
    })
  }

  return improvements
}
