import type { WrappedAggregation, SemanticSummary } from '../../shared/types.js'
import type { HabitsAnalysis } from '../analyzer/habits.js'
import type { VibeSignals } from '../analyzer/vibe-coder-type.js'
import type { Improvement } from '../analyzer/improvements.js'
import type { DailySlice } from '../daily-slices-extractor.js'

export function buildWrappedReportPrompt(
  aggregation: WrappedAggregation,
  habits: HabitsAnalysis,
  vibeSignals: VibeSignals,
  improvements: Improvement[],
  lang: string,
  dailySlices?: DailySlice[],
  semanticSummary?: SemanticSummary
): string {
  const langInstruction = lang === 'zh'
    ? '请用中文撰写报告。'
    : lang === 'ja'
    ? '日本語でレポートを書いてください。'
    : lang === 'ko'
    ? '보고서를 한국어로 작성해주세요.'
    : lang === 'ru'
    ? 'Напишите отчет на русском языке.'
    : 'Write the report in English.'

  // Determine which CLIs provide token data
  const cliNames = Object.keys(aggregation.cliDistribution) as (keyof typeof aggregation.cliDistribution)[]
  const TOKEN_CAPABLE_CLIS = ['claude-code', 'opencode']
  const tokenSource = cliNames.filter((cli) => TOKEN_CAPABLE_CLIS.includes(cli))
  const hasNonTokenCli = cliNames.some((cli) => !TOKEN_CAPABLE_CLIS.includes(cli))

  const data = JSON.stringify({
    period: `${aggregation.startDate} to ${aggregation.endDate} (${aggregation.days} days)`,
    totalSessions: aggregation.totalSessions,
    totalMessages: aggregation.totalMessages,
    totalTokens: `~${Math.round((aggregation.totalInputTokens + aggregation.totalOutputTokens) / 1000)}K`,
    tokenSource,
    hasNonTokenCli,
    activeDays: aggregation.activeDays,
    totalHours: Math.round(aggregation.totalDurationMinutes / 60),
    averageSessionMinutes: aggregation.averageSessionMinutes,
    longestSession: aggregation.longestSession,
    projectBreakdown: aggregation.projectBreakdown.map((p) => ({
      project: p.project,
      sessions: p.sessions,
      hours: Math.round(p.duration / 60),
      frictionDensity: Math.round(p.frictionDensity * 100) / 100,
      ...(p.memory ? { projectMemory: p.memory } : {}),
    })),
    hourlyDistribution: aggregation.hourlyDistribution,
    toolCallDistribution: aggregation.toolCallDistribution,
    cliDistribution: aggregation.cliDistribution,
    topFilesEdited: aggregation.topFilesEdited.slice(0, 10),
    frictionHotspots: aggregation.frictionHotspots.slice(0, 10).map((f) => ({
      type: f.type,
      description: f.description,
      resolution: f.resolution,
      resolved: f.resolved,
    })),
    dailyExperienceSlices: dailySlices?.map((s) => ({
      date: s.date,
      sessionIds: s.sessionIds,
      content: s.content.slice(0, 2000),
    })) || [],
    habits,
    vibeSignals,
    improvements,
    ...(semanticSummary ? {
      semanticData: {
        sessionSlices: semanticSummary.sessionSlices,
        errorSamples: semanticSummary.errorSamples,
        debuggingStruggles: semanticSummary.debuggingStruggles,
      },
    } : {}),
  }, null, 2)

  return `You are generating a "Vibe Coding Wrapped" report — a comprehensive retrospective of the user's coding sessions over ${aggregation.days} days. ${langInstruction}

## Your Role

You are the user's AI coding partner, reflecting on your shared journey with wit, honesty, and a touch of snark. Think Spotify Wrapped meets code review.

## Data

\`\`\`json
${data}
\`\`\`

## Report Structure (8 Sections)

Generate the report in this exact Markdown structure:

### Section 1: AI's Perspective on the Last ${aggregation.days} Days

Write 3-5 short paragraphs (separated by blank lines) in third person. Structure them as a narrative arc:
- Opening: set the scene — how the journey began
- Early phase: initial projects and working style
- Turning point: a shift in focus, a breakthrough, or a new pattern
- Climax: peak productivity, most ambitious project, or biggest struggle
- Present: where things stand now

Each paragraph should be 2-4 sentences. Mention specific projects, peak periods, and surprising patterns. If \`semanticData.sessionSlices\` is available, use the \`userQueries\` to understand what the user was actually working on and weave specific tasks into the narrative arc. Make the reader want to screenshot this section.

### Section 2: Key Metrics Dashboard

A table with key metrics: total sessions, total messages, total tokens, average session duration, longest session, active days, top 3 tool calls, CLI distribution.

If \`hasNonTokenCli\` is true, add a footnote below the table: "* Token 消耗数仅反映 ${tokenSource.length > 0 ? tokenSource.join(' / ') : 'N/A'} 的数据，其他 CLI 不提供 token 统计。"

### Section 3: Project Map

A table with per-project stats: sessions, hours, friction density, status (active/dormant). A project is dormant if it has no session in the last 7 days. For dormant projects, add a one-liner comment.

### Section 4: Usage Habits Analysis

Data-driven observations about:
- Startup style (cold vs contextual)
- Collaboration style (directive vs delegative)
- Tool preferences
- Ending patterns
- Debugging patterns

If \`semanticData\` is available, go beyond statistical indicators: use \`directionChanges\` and \`aiResponses\` to analyze the user's thinking patterns, how they correct the AI, and their decision-making style. Quote specific examples where they reveal interesting cognitive patterns.

### Section 5: Areas for Improvement

3-5 specific, data-backed suggestions. Each must have: observation with numbers → actionable suggestion.

If \`semanticData.errorSamples\` and \`semanticData.debuggingStruggles\` are available, use them to give targeted improvement advice — reference real error messages and struggling files rather than generic patterns.

### Section 6: Experience Accumulation

You have access to all daily experience slices (dailyExperienceSlices) and friction records from this period.

Your task:
1. From all daily experience slices, identify **recurring patterns** — similar problems appearing 2+ times, and synthesize them into systematic insights
2. From friction records, identify the **most valuable lessons** — not every friction is worth writing up, only those with cognitive value
3. Elevate scattered experience slices into **transferable universal principles**

Format for each insight:
### [Universal principle title]
- **Frequency**：Appeared M times across N days (or which projects were affected)
- **Typical Scenario**：The most representative instance
- **General Principle**：The transferable insight abstracted from specific experiences
- **Actionable Advice**：Concrete action for next time a similar situation arises
- **Source**：session IDs [...] (use the sessionIds from the dailyExperienceSlices entries that contributed to this insight)

Write at most 5 insights. Quality over quantity — if there aren't enough meaningful patterns, write fewer.

### Section 7: What Kind of Vibe Coder Are You?

Based on the \`vibeSignals\` data, **invent a creative vibe coder type** for this user. You have full creative freedom — do NOT use a fixed set of categories.

Here are the signal metrics to analyze:
- \`nightSessionRatio\`: ${vibeSignals.nightSessionRatio} (ratio of sessions started between 22:00-04:00)
- \`medianSessionMinutes\`: ${vibeSignals.medianSessionMinutes}
- \`averageSessionMinutes\`: ${vibeSignals.averageSessionMinutes}
- \`readBashToolRatio\`: ${vibeSignals.readBashToolRatio} (ratio of Read/Bash/Grep/Glob vs all tool calls)
- \`userMsgPerToolCall\`: ${vibeSignals.userMsgPerToolCall} (higher = more talkative)
- \`refactorEditRatio\`: ${vibeSignals.refactorEditRatio} (ratio of refactoring edits)
- \`peakDaySessions\`: ${vibeSignals.peakDaySessions} (most sessions in a single day)
- \`highEditRepeatSessions\`: ${vibeSignals.highEditRepeatSessions} (sessions where same file was edited 8+ times)
- \`totalSessions\`: ${vibeSignals.totalSessions}
- \`totalEdits\`: ${vibeSignals.totalEdits}
- \`totalToolCalls\`: ${vibeSignals.totalToolCalls}

**Inspiration examples** (feel free to invent your own): "深夜幽灵型"、"反复横跳型"、"闪现游击型"、"砌墙专家型"、"话痨驱动型"、"重构上瘾型"

**Format requirement**: Start the section body with exactly this format on the first line:
\`**[emoji] [类型名称]**\`
For example: \`**🌙 深夜幽灵型**\` or \`**⚡ 闪电迭代者**\`

Then write a roast/monologue from the AI's first-person perspective. It should be:
- Witty and slightly mean (but affectionate)
- Cross-reference specific projects and events from Section 1's narrative
- Reference the collaboration style, startup patterns, and peak hours from the habits analysis
- Mention at least one specific project name by name
- Use concrete signal data to back up the classification
- If \`semanticData.sessionSlices\` is available, quote or paraphrase a specific \`userQuery\` that perfectly exemplifies the vibe coder type
- End with something memorable/quotable
- 3-5 sentences

### Section 8: Next Actions

2-3 concrete next actions based on the analysis.

## Rules

1. Be specific — reference real numbers, projects, and patterns
2. The "AI's Thinking" sections should be uncomfortably honest
3. Section 7 should be funny enough to screenshot
4. Do NOT pad with generic advice — every insight must be data-backed
5. Do NOT include the meta comment block`
}
