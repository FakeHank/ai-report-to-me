export function renderWrappedMarkdown(
  llmOutput: string,
): string {
  return llmOutput.trim().replace(/<!--\s*ai-report-meta[\s\S]*?-->/g, '').trim()
}
