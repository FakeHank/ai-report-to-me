import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

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
          content: truncate(section.content, 5000),
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
