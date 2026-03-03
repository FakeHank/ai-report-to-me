import type { DailyAggregation } from '../../shared/types.js'
import { extractSessionNarrative } from '../narrative.js'
import { t } from '../../shared/i18n.js'

export function buildDailyReportPrompt(aggregation: DailyAggregation, lang: string): string {
  const data = serializeAggregation(aggregation)
  const langInstruction = lang === 'zh'
    ? '请用中文撰写报告。'
    : lang === 'ja'
    ? '日本語でレポートを書いてください。'
    : lang === 'ko'
    ? '보고서를 한국어로 작성해주세요.'
    : lang === 'ru'
    ? 'Напишите отчет на русском языке.'
    : 'Write the report in English.'

  return `You are generating a daily work report based on coding session data. ${langInstruction}

## Your Role

You are the user's AI coding partner, reporting back on the day's work. Your tone is honest, concise, and slightly opinionated — not cheerful or vague. You have access to full session narratives showing what actually happened, not just statistics.

## Data

Here is the aggregated session data for ${aggregation.date}:

\`\`\`json
${data}
\`\`\`

${aggregation.previousDayHighlights ? `## Previous Day Context\n\n${aggregation.previousDayHighlights}\n` : ''}

## Report Structure

Generate the report in this exact Markdown structure:

\`\`\`
# ${t('daily.title', lang)} · ${aggregation.date}

## ${t('daily.overview', lang)}

[3-5 sentences narrative covering: what was the goal today, what actually happened,
what's the gap between intent and outcome. End with honest assessment of how much
the day's work advanced the core goals.]

## ${t('daily.projectProgress', lang)}

### [Project Name] · [branch] · N sessions · duration

[2-4 sentence narrative: what was built/fixed/explored, key decisions made, current state.
Explain WHAT was achieved, not just what files were touched.]

**${t('daily.whatWasDone', lang)}**
- [Specific accomplishment with enough detail for a teammate to understand]
- [Another accomplishment]

**${t('daily.frictionAndResolution', lang)}**
- [Friction encountered] → [How it was resolved or left unresolved]

(repeat per project that had ≥5 minutes of activity, unless something notable happened in a shorter session)

## ${t('daily.experienceSlices', lang)}

${t('daily.experienceSlicesDesc', lang)}

${t('daily.sliceRequirement', lang)}

${t('daily.sliceFilterCriteria', lang)}

## ${t('daily.aiReview', lang)}

[5-8 sentences. Data-driven observations about work patterns.
Must reference specific numbers from the data (error rates, session durations, retry counts).
Compare across projects or sessions if possible.
End with 1-2 concrete, actionable suggestions for tomorrow.]
\`\`\`

## Rules

1. You have full session narratives — use them to explain WHAT happened, not just count tool calls
2. The overview must cover ALL projects, not just one
3. For ${t('daily.projectProgress', lang)}, write narrative per project. Explain what was achieved and the current state, not just list files
4. For ${t('daily.experienceSlices', lang)}, use the keyDecisions, errorResolutions, and assistantInsights data to construct slices with real context. Each slice must tell a complete story that someone without project context can learn from. Skip trivial errors
5. For ${t('daily.aiReview', lang)}, write 5-8 sentences with data-driven observations. Cite specific numbers. No generic encouragement. Question patterns, not praise effort
6. If there are retry signals (same file edited 3+ times), mention them as debugging loops in the relevant project section
7. Reference previous day context if available to create continuity
8. Be specific with numbers: sessions, duration, file counts, error rates
9. Skip projects with <5 minutes of activity unless something notable happened
10. Do NOT include the meta comment block — that will be added separately`
}

function serializeAggregation(agg: DailyAggregation): string {
  return JSON.stringify({
    date: agg.date,
    totalDuration: `${agg.totalDuration} minutes`,
    sessionCount: agg.sessions.length,
    projectBreakdown: agg.projectBreakdown.map((p) => ({
      project: p.project,
      sessions: p.sessions,
      duration: `${p.duration} minutes`,
      filesChanged: p.filesChanged.length,
      frictionDensity: Math.round(p.frictionDensity * 100) / 100,
      ...(p.memory ? { projectMemory: p.memory } : {}),
    })),
    toolCalls: agg.allToolCalls,
    filesChanged: agg.allFilesChanged.slice(0, 30),
    retrySignals: agg.allRetrySignals.map((r) => ({
      file: r.file,
      editCount: r.editCount,
    })),
    errors: agg.allErrors.slice(0, 15).map((e) => ({
      tool: e.toolName,
      message: e.message.slice(0, 500),
    })),
    sessionDetails: agg.sessions.map((s) => {
      const narrative = extractSessionNarrative(s)
      const errorRate = s.stats.toolCallCount > 0
        ? `${Math.round((s.stats.errorCount / s.stats.toolCallCount) * 1000) / 10}%`
        : '0%'

      return {
        project: s.projectName,
        branch: s.gitBranch || null,
        cli: s.cli,
        duration: `${s.durationMinutes} minutes`,
        errorRate,
        topTools: Object.entries(s.stats.toolCallsByName)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, count]) => `${name}(${count})`),
        narrative: {
          intent: narrative.intent,
          timeline: narrative.timeline,
          outcome: narrative.outcome,
          keyFiles: narrative.keyFiles,
          keyDecisions: narrative.keyDecisions,
          errorResolutions: narrative.errorResolutions,
          assistantInsights: narrative.assistantInsights,
        },
      }
    }),
  }, null, 2)
}
