import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

/**
 * Feishu card markdown does not support inline code (backticks).
 * Convert `code` to *code* (italic) as a visual fallback.
 * @see https://open.feishu.cn/document/common-capabilities/message-card/message-cards-content/using-markdown-tags
 */
function stripInlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, '*$1*')
}

export class FeishuWebhookOutput extends WebhookOutput {
  readonly name = 'feishu'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    const elements: unknown[] = []

    for (const section of report.sections) {
      if (section.level > 1) {
        elements.push({
          tag: 'markdown',
          content: `**${section.heading}**`,
        })
      }
      if (section.content) {
        elements.push({
          tag: 'markdown',
          content: stripInlineCode(truncate(section.content, 5000)),
        })
      }
    }

    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: truncate(report.title, 200) },
          template: 'blue',
        },
        elements,
      },
    }
  }
}
