import type { WrappedAggregation } from '../../shared/types.js'
import type { HabitsAnalysis } from '../analyzer/habits.js'
import type { VibeCoderResult } from '../analyzer/vibe-coder-type.js'
import type { Improvement } from '../analyzer/improvements.js'
import type { DailySlice } from '../daily-slices-extractor.js'

export function buildWrappedReportPrompt(
  aggregation: WrappedAggregation,
  habits: HabitsAnalysis,
  vibeType: VibeCoderResult,
  improvements: Improvement[],
  lang: string,
  dailySlices?: DailySlice[]
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

  const data = JSON.stringify({
    period: `${aggregation.startDate} to ${aggregation.endDate} (${aggregation.days} days)`,
    totalSessions: aggregation.totalSessions,
    totalMessages: aggregation.totalMessages,
    totalTokens: `~${Math.round((aggregation.totalInputTokens + aggregation.totalOutputTokens) / 1000)}K`,
    activeDays: aggregation.activeDays,
    totalHours: Math.round(aggregation.totalDurationMinutes / 60),
    averageSessionMinutes: aggregation.averageSessionMinutes,
    longestSession: aggregation.longestSession,
    projectBreakdown: aggregation.projectBreakdown.map((p) => ({
      project: p.project,
      sessions: p.sessions,
      hours: Math.round(p.duration / 60),
      frictionDensity: Math.round(p.frictionDensity * 100) / 100,
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
      content: s.content.slice(0, 2000),
    })) || [],
    habits,
    vibeCoderType: vibeType,
    improvements,
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

### Section 1: AI 眼中的这 ${aggregation.days} 天

A narrative paragraph in third person. Tell the story with a time arc and plot points — not a list. Mention specific projects, peak periods, and surprising patterns. Make the reader want to screenshot this section.

### Section 2: 关键数字仪表盘

A table with key metrics: total sessions, total messages, total tokens, average session duration, longest session, active days, top 3 tool calls, CLI distribution.

### Section 3: 项目地图

A table with per-project stats: sessions, hours, friction density, status (active/dormant). For dormant projects (no session in 30+ days), add a one-liner comment.

### Section 4: 使用习惯分析

Data-driven observations about:
- Startup style (cold vs contextual)
- Collaboration style (directive vs delegative)
- Tool preferences
- Ending patterns
- Debugging patterns

### Section 5: 应该改进的地方

3-5 specific, data-backed suggestions. Each must have: observation with numbers → actionable suggestion.

### Section 6: 经验沉淀

You have access to all daily experience slices (dailyExperienceSlices) and friction records from this period.

Your task:
1. From all daily experience slices, identify **recurring patterns** — similar problems appearing 2+ times, and synthesize them into systematic insights
2. From friction records, identify the **most valuable lessons** — not every friction is worth writing up, only those with cognitive value
3. Elevate scattered experience slices into **transferable universal principles**

Format for each insight:
### [Universal principle title]
- **频次**：Appeared M times across N days (or which projects were affected)
- **典型场景**：The most representative instance
- **通用原则**：The transferable insight abstracted from specific experiences
- **实操建议**：Concrete action for next time a similar situation arises

Write at most 5 insights. Quality over quantity — if there aren't enough meaningful patterns, write fewer.

### Section 7: 你是哪种 Vibe Coder

The user's vibe coder type: ${vibeType.label}

Write a roast/monologue from the AI's first-person perspective. It should be:
- Witty and slightly mean (but affectionate)
- Reference specific data points
- End with something memorable/quotable
- 3-5 sentences

### Section 8: 下一步

2-3 concrete next actions based on the analysis.

## Rules

1. Be specific — reference real numbers, projects, and patterns
2. The "AI 的思考" sections should be uncomfortably honest
3. Section 7 should be funny enough to screenshot
4. Do NOT pad with generic advice — every insight must be data-backed
5. Do NOT include the meta comment block`
}
