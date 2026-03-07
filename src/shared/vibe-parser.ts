/**
 * Shared vibe coder type parsing from Wrapped report markdown.
 * Used by save-wrapped and regen-vibe-card.
 */

export interface VibeParseResult {
  emoji: string
  typeName: string
  commentary: string | null
  closingQuote: string | null
}

/**
 * Parse vibe coder type info from a Wrapped report markdown.
 * Extracts emoji, type name, commentary body, and closing quote.
 */
export function parseVibeFromMarkdown(markdown: string): VibeParseResult | null {
  const section = extractSection7Content(markdown)
  if (!section) return null

  // Match **[emoji] [label]** pattern
  const match = section.match(/\*\*\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*(.+?)\s*\*\*/u)
  if (!match) return null

  const emoji = match[1]
  const typeName = match[2]

  // Extract commentary: everything between the type line and the closing quote (or end)
  const lines = section.split('\n')
  const typeLineIdx = lines.findIndex(l => l.includes(match[0]))
  if (typeLineIdx === -1) return { emoji, typeName, commentary: null, closingQuote: null }

  const afterTypeLines = lines.slice(typeLineIdx + 1)

  // Find closing quote: *"..."* or > "..." patterns
  let closingQuote: string | null = null
  let commentaryLines: string[] = []
  for (const line of afterTypeLines) {
    // *"..."* format (English reports)
    const quoteMatch1 = line.match(/^\s*\*"(.+?)"\*\s*$/)
    if (quoteMatch1) {
      closingQuote = quoteMatch1[1]
      break
    }
    // > "..." format (Chinese reports, with optional trailing text)
    const quoteMatch2 = line.match(/^\s*>\s*"(.+?)"/)
    if (quoteMatch2) {
      // Use the full line content after > as the quote
      closingQuote = line.replace(/^\s*>\s*/, '').trim()
      break
    }
    commentaryLines.push(line)
  }

  // Clean commentary
  let commentary = commentaryLines
    .join('\n')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (commentary.length < 10) commentary = null as any

  return {
    emoji,
    typeName,
    commentary: commentary || null,
    closingQuote,
  }
}

/**
 * Extract raw Section 7 content (the vibe coder type section).
 */
function extractSection7Content(markdown: string): string | null {
  const lines = markdown.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s.*(?:Vibe\s*Coder|vibe\s*coder|哪种)/i.test(lines[i])) {
      startIdx = i + 1
      break
    }
  }
  if (startIdx === -1) return null

  const contentLines: string[] = []
  const headingMatch = lines[startIdx - 1].match(/^(#{1,3})/)
  const headingLevel = headingMatch ? headingMatch[1].length : 2

  for (let i = startIdx; i < lines.length; i++) {
    const lineHeading = lines[i].match(/^(#{1,3})\s/)
    if (lineHeading && lineHeading[1].length <= headingLevel) break
    contentLines.push(lines[i])
  }

  const text = contentLines.join('\n').trim()
  return text.length > 10 ? text : null
}
