export type CLIName = 'claude-code' | 'gemini-cli' | 'opencode' | 'codex'

export interface NormalizedSession {
  sessionId: string
  cli: CLIName
  cliVersion?: string
  projectPath: string
  projectName: string
  gitBranch?: string
  startTime: Date
  endTime: Date
  durationMinutes: number
  messages: NormalizedMessage[]
  stats: SessionStats
}

export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'system'
  timestamp: Date
  content: string
  model?: string
  toolCalls?: ToolCall[]
  usage?: TokenUsage
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  result?: string
  durationMs?: number
  isError: boolean
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface SessionStats {
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  toolCallCount: number
  toolCallsByName: Record<string, number>
  filesTouched: string[]
  editCount: number
  errorCount: number
}

export interface SessionLogEntry {
  sessionId: string
  cli: string
  projectPath: string
  timestamp: string
}

export interface ReportMeta {
  generatedAt: string
  date: string
  sessionIds: string[]
  sessionCount: number
}

export interface DailyReport {
  date: string
  generatedAt: string
  lang: string
  sessions: NormalizedSession[]
  markdown: string
  meta: ReportMeta
}

export interface KeyDecision {
  trigger: string
  decision: string
  messageIndex: number
}

export interface ErrorResolution {
  error: string
  toolName: string
  file?: string
  resolution: string
  resolved: boolean
}

export interface FrictionRecord {
  type: 'retry' | 'error-loop' | 'direction-switch'
  description: string
  file?: string
  sessionId: string
  count: number
  resolution?: string
  resolved?: boolean
}

export interface RetrySignal {
  file: string
  editCount: number
  sessionId: string
}

export interface ErrorRecord {
  toolName: string
  message: string
  sessionId: string
  timestamp: Date
}

export interface ProjectBreakdown {
  project: string
  projectPath: string
  sessions: number
  duration: number
  toolCalls: Record<string, number>
  filesChanged: string[]
  frictionDensity: number
}

export interface DailyAggregation {
  date: string
  sessions: NormalizedSession[]
  totalDuration: number
  projectBreakdown: ProjectBreakdown[]
  allToolCalls: Record<string, number>
  allFilesChanged: string[]
  allRetrySignals: RetrySignal[]
  allErrors: ErrorRecord[]
  previousDayHighlights?: string
}

export interface SessionSemanticSlice {
  sessionId: string
  project: string
  date: string
  userQueries: string[]
  aiResponses: string[]
  directionChanges: string[]
  outcome: 'completed' | 'partial' | 'abandoned'
}

export interface SemanticSummary {
  sessionSlices: SessionSemanticSlice[]
  errorSamples: {
    totalErrors: number
    resolvedCount: number
    topUnresolved: { error: string; file?: string; sessionId: string }[]
    topResolved: { error: string; resolution: string; sessionId: string }[]
  }
  debuggingStruggles: { file: string; errorCount: number; sessionIds: string[]; resolved: boolean }[]
}

export interface WrappedAggregation {
  days: number
  startDate: string
  endDate: string
  sessions: NormalizedSession[]
  totalSessions: number
  totalMessages: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  activeDays: number
  totalDurationMinutes: number
  averageSessionMinutes: number
  longestSession: { sessionId: string; durationMinutes: number; date: string; project: string }
  projectBreakdown: ProjectBreakdown[]
  hourlyDistribution: number[]
  dailyDistribution: Record<string, number>
  toolCallDistribution: Record<string, number>
  cliDistribution: Record<CLIName, number>
  topFilesEdited: { file: string; count: number }[]
  frictionHotspots: FrictionRecord[]
}
