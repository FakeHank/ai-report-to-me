import type { DailyAggregation } from '../../shared/types.js'
import { extractSessionNarrative } from '../narrative.js'

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
# 日报 · ${aggregation.date}

## 概览

[3-5 sentences narrative covering: what was the goal today, what actually happened,
what's the gap between intent and outcome. End with honest assessment of how much
the day's work advanced the core goals.]

## 项目进展

### [Project Name] · [branch] · N sessions · duration

[2-4 sentence narrative: what was built/fixed/explored, key decisions made, current state.
Explain WHAT was achieved, not just what files were touched.]

**做了什么：**
- [Specific accomplishment with enough detail for a teammate to understand]
- [Another accomplishment]

**卡点和解决：**
- [Friction encountered] → [How it was resolved or left unresolved]

(repeat per project that had ≥5 minutes of activity, unless something notable happened in a shorter session)

## 经验切片

> 经验切片 = 一个完整的"问题→探索→解决"故事，读者无需项目背景也能获得认知增量

每个切片必须包含：

### [具体描述性标题，不要泛泛的"XX问题的处理"]
- **背景**：用 1-2 句话说明在做什么、用什么技术栈、想达成什么目标（让没有项目上下文的人能理解场景）
- **问题**：具体遇到了什么问题，表现是什么（错误信息、异常行为、性能问题等）
- **踩坑过程**：尝试了什么方案、为什么没有用、关键的转折点是什么
- **解决方案**：最终怎么解决的，具体到命令、配置、代码模式
- **可迁移的认知**：这个经验背后的通用原则是什么，在什么类似场景下可以复用

筛选标准：
- 只保留有"认知增量"的切片 — 读者看完后学到了之前不知道的东西
- 跳过纯操作性内容（安装依赖、创建文件、修复 typo）
- 跳过没有解决过程的简单错误（file not found、import 路径错误）
- 优先选择：调试过程有转折的、方案选择有 tradeoff 的、技术发现有深度的
- 如果当天没有值得写的经验切片，写"今天的工作以常规开发为主，没有特别值得记录的经验切片。"，不要硬凑

## AI 复盘

[5-8 sentences. Data-driven observations about work patterns.
Must reference specific numbers from the data (error rates, session durations, retry counts).
Compare across projects or sessions if possible.
End with 1-2 concrete, actionable suggestions for tomorrow.]
\`\`\`

## Rules

1. You have full session narratives — use them to explain WHAT happened, not just count tool calls
2. The overview must cover ALL projects, not just one
3. For 项目进展, write narrative per project. Explain what was achieved and the current state, not just list files
4. For 经验切片, use the keyDecisions, errorResolutions, and assistantInsights data to construct slices with real context. Each slice must tell a complete story that someone without project context can learn from. Skip trivial errors
5. For AI 复盘, write 5-8 sentences with data-driven observations. Cite specific numbers. No generic encouragement. Question patterns, not praise effort
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
