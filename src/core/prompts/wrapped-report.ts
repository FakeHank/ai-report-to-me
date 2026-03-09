import type { WrappedAggregation, SemanticSummary } from '../../shared/types.js'
import type { HabitsAnalysis } from '../analyzer/habits.js'
import type { VibeSignals } from '../analyzer/vibe-coder-type.js'
import type { Improvement } from '../analyzer/improvements.js'
import type { DailySlice } from '../daily-slices-extractor.js'
import type { ImprovementSignals } from '../analyzer/improvement-signals.js'
import { t } from '../../shared/i18n.js'

export function buildWrappedReportPrompt(
  aggregation: WrappedAggregation,
  habits: HabitsAnalysis,
  vibeSignals: VibeSignals,
  improvements: Improvement[],
  lang: string,
  dailySlices?: DailySlice[],
  semanticSummary?: SemanticSummary,
  improvementSignals?: ImprovementSignals
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
    ...(improvementSignals ? { improvementSignals } : {}),
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

Use \`improvementSignals\` to identify patterns (a value of -1 means insufficient data, skip it):
- **Time patterns**: \`nightProductivityDrop\` (< 1 = less productive at night), \`sessionGapMedianMinutes\` / \`sessionGapStdDevMinutes\` (session rhythm), \`burstiness\` (high = feast-or-famine pattern)
- **Work habits**: \`contextSwitchRate\` (high = frequently jumping between projects), \`abandonmentRate\` (high = many sessions started but dropped), \`reviewBeforeEndRate\` (low = not checking results), \`upfrontContextRate\` (low = not providing enough context upfront)
- **Collaboration quality**: \`firstTrySuccessRate\` (low = AI frequently needs to redo edits), \`correctionToCompletionRatio\` (high = lots of corrections), \`explorationBeforeEditRatio\` (low = jumping to edits without understanding code first)

Also use \`improvements\` (rule-based detections) and \`semanticData.errorSamples\` / \`semanticData.debuggingStruggles\` if available. Cross-reference signals to find the most impactful suggestions — e.g. low \`firstTrySuccessRate\` + low \`upfrontContextRate\` = "provide more context to get better first-try results".

### Section 6: Experience Accumulation

Mine insights from three data sources, in priority order:

**Source A: Daily experience slices** (\`dailyExperienceSlices\`) — pre-refined by previous LLM passes, highest quality. Look for recurring patterns across days.

**Source B: Resolved errors and friction** (\`frictionHotspots\` where resolved=true, \`semanticData.errorSamples.topResolved\`) — "problem → solution" arcs that represent hard-won lessons.

**Source C: Successful complex sessions** — from \`semanticData.sessionSlices\`, find sessions where \`outcome\`="completed" with many \`userQueries\` (5+). Their query sequence reveals effective approaches to complex/ambiguous tasks — e.g. "first did X, then Y, then Z" process knowledge. These are NOT errors or friction — they are reusable playbooks.

Your task:
1. From Source A, identify **recurring patterns** — similar insights appearing 2+ times across days
2. From Source B, identify the **most valuable lessons** — only those with cognitive value, not every error
3. From Source C, identify **effective approaches** — sessions where a good sequence of steps led to success on a complex task. Distill the approach into a reusable principle.

Format for each insight:
### [Universal principle title]
- **Frequency**: Appeared M times across N days (or which projects were affected)
- **Typical Scenario**: The most representative instance
- **General Principle**: The transferable insight abstracted from specific experiences
- **Actionable Advice**: Concrete action for next time a similar situation arises
- **Source**: session IDs [...] (from dailyExperienceSlices sessionIds or semanticData sessionIds)

Write at most 5 insights. Quality over quantity — if there aren't enough meaningful patterns, write fewer. Aim for a mix of failure-driven and success-driven insights, not just "things that went wrong".

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

**Inspiration examples** (feel free to invent your own): ${t('wrapped.vibeExamples', lang)}

${t('wrapped.vibeFormatRequirement', lang)}

Then write a monologue from the AI's first-person perspective. Follow this emotional arc — **roast → insight → earned respect**:

**Part 1 — The Roast (2-3 sentences):** Savage, specific, data-backed mockery. Think best friend who roasts you at your birthday party. Guidelines:
- Go hard. Mock their habits, call out their delusions, exaggerate their quirks. Aim for "uncomfortably accurate".
- Directly attack specific patterns with numbers: if they code at 2am, roast the life choices; if they refactor constantly, question if they ship anything; if sessions are short, call them a commitment-phobe.
- Cross-reference specific projects and events from Section 1's narrative — the more specific the callout, the funnier.

**Part 2 — The Insight (1-2 sentences):** Reveal a pattern the user probably never noticed about themselves. This should make them pause and think "wait, that's actually true". Examples:
- A hidden consistency beneath the chaos ("you abandoned 62% of sessions, but you never abandoned the same project twice in a row")
- A contradiction that reveals something deeper ("you write OKRs like a CEO but code like it's a hackathon — maybe you're not confused, you're just prototyping your life")
- A specific behavioral pattern that says something real about who they are

**Part 3 — The Earned Respect (1 sentence):** One genuine, specific observation that acknowledges something impressive. This is NOT a generic compliment — it must be backed by data. The user should feel "seen" rather than "flattered". This line makes them want to screenshot and share.

Total: 4-6 sentences. If \`semanticData.sessionSlices\` is available, quote or paraphrase a specific \`userQuery\` that exemplifies the vibe coder type.

### Section 8: Next Actions

2-3 concrete next actions based on the analysis.

## Rules

1. Be specific — reference real numbers, projects, and patterns
2. The "AI's Thinking" sections should be uncomfortably honest
3. Section 7 must follow the roast→insight→respect arc. The roast makes them laugh, the insight makes them think, and the earned respect makes them screenshot. If they don't feel "this AI knows me better than I know myself", you missed the mark
4. Do NOT pad with generic advice — every insight must be data-backed
5. Do NOT include the meta comment block`
}
