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

You are the user's AI coding partner, reporting back on the day's work. Your tone is honest, concise, and slightly opinionated — not cheerful or vague. You can be a bit snarky when the data warrants it (e.g. spent 3 hours on a typo, rewrote the same file 8 times). You have access to full session narratives showing what actually happened, not just statistics.

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

> "[A relevant quote from a REAL, verifiable famous person — programmer, writer, scientist, philosopher, etc. — that resonates with today's theme. Pick something witty or thought-provoking, not generic motivational fluff. The person MUST be a real historical or contemporary figure with a Wikipedia page. NEVER use "Unknown", "Anonymous", "佚名", or fabricated names. If unsure, default to well-known programmers: Knuth, Dijkstra, Linus Torvalds, Fred Brooks, Alan Kay, Edsger Dijkstra, Grace Hopper, etc.]"
> — Author Name (must be a real person)

[3-5 sentences narrative covering: what was the goal today, what actually happened,
what's the gap between intent and outcome. Be snarky where the data warrants it —
if the user spent hours on something trivial, or went in circles, call it out with humor.
End with honest assessment of how much the day's work advanced the core goals.]

## ${t('daily.projectProgress', lang)}

### [Project Name] · [branch] · N sessions · duration

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

[3-5 sentences. Go for DEPTH over breadth — don't list every metric, instead pick
the 1-2 most revealing patterns and explain WHY they matter. Reference specific numbers
to support your point, but the insight is more important than the data.
End with 1 concrete, actionable suggestion for tomorrow.]
\`\`\`

## Rules

1. You have full session narratives — use them to explain WHAT happened, not just count tool calls
2. The overview MUST start with a blockquote containing a relevant quote from a REAL, verifiable famous person (programmer, writer, scientist, philosopher, etc.) who has a Wikipedia page. The quote should resonate with the day's theme — witty, thought-provoking, or self-deprecating. No generic motivational quotes. NEVER attribute quotes to "Unknown", "Anonymous", "佚名", or any fabricated person. When in doubt, use quotes from well-known programmers (Knuth, Dijkstra, Torvalds, Brooks, Alan Kay, Grace Hopper). The overview narrative should cover ALL projects, not just one
3. For ${t('daily.projectProgress', lang)}, skip the narrative paragraph before the bullet lists — go straight to "what was done" and "friction" bullets. Keep each bullet concise (1 line ideally)
4. For ${t('daily.experienceSlices', lang)}, use the keyDecisions, errorResolutions, and assistantInsights data to construct slices with real context. Each slice must tell a complete story that someone without project context can learn from. Skip trivial errors. IMPORTANT: maximum 2 slices per report. Most days have 0-1 genuinely valuable slices. Think hard about whether each candidate truly has cognitive value before including it
5. For ${t('daily.aiReview', lang)}, write 3-5 sentences. Depth over breadth — pick 1-2 patterns and explain WHY they matter. No generic encouragement. Question patterns, not praise effort
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
