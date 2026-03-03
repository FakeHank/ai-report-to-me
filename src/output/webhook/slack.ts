import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

/**
 * Convert standard Markdown to Slack mrkdwn format.
 * Key differences:
 * - **bold** → *bold*
 * - *italic* → _italic_
 * - `code` stays `code`
 * - ```code blocks``` stay as-is
 * - ### headings → *heading* (bold)
 * - [text](url) → <url|text>
 */
function toSlackMrkdwn(md: string): string {
  let text = md

  // Preserve code blocks from transformation
  const codeBlocks: string[] = []
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `\x00CB${codeBlocks.length - 1}\x00`
  })

  // Preserve inline code
  const inlineCode: string[] = []
  text = text.replace(/`([^`]+)`/g, (match) => {
    inlineCode.push(match)
    return `\x00IC${inlineCode.length - 1}\x00`
  })

  // Links: [text](url) → <url|text>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')

  // Bold+italic first: ***text*** → *_text_* (Slack bold+italic)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '*_$1_*')

  // Bold: **text** → *text* (must happen before italic)
  // Use placeholder to protect from italic pass
  const boldMatches: string[] = []
  text = text.replace(/\*\*(.+?)\*\*/g, (_, inner) => {
    boldMatches.push(inner)
    return `\x00BD${boldMatches.length - 1}\x00`
  })

  // Italic: *text* → _text_
  text = text.replace(/\*(.+?)\*/g, '_$1_')

  // Restore bold as Slack *bold*
  text = text.replace(/\x00BD(\d+)\x00/g, (_, i) => `*${boldMatches[Number(i)]}*`)

  // Sub-headings inside content: ### text → *text*
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*')

  // Bullet points: - item → • item (Slack doesn't render - as bullets)
  text = text.replace(/^(\s*)- /gm, '$1• ')

  // Restore inline code
  text = text.replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCode[Number(i)])

  // Restore code blocks
  text = text.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)])

  return text
}

export class SlackWebhookOutput extends WebhookOutput {
  readonly name = 'slack'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: truncate(report.title, 150) },
      },
    ]

    for (const section of report.sections) {
      if (!section.content) continue
      const slackContent = toSlackMrkdwn(section.content)
      const text = section.level === 1
        ? slackContent
        : `*${section.heading}*\n${slackContent}`

      // Slack section blocks have a 3000 char limit; split if needed
      const chunks = splitText(text, 3000)
      for (const chunk of chunks) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: chunk },
        })
      }
    }

    return { blocks: blocks.slice(0, 50) } // Slack limit: 50 blocks
  }
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf('\n', maxLen)
    if (splitAt < maxLen * 0.5) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).replace(/^\n/, '')
  }
  return chunks
}
