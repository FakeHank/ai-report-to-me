import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

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
      const text = section.level === 1
        ? section.content
        : `*${section.heading}*\n${section.content}`
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: truncate(text, 3000) },
      })
    }

    return { blocks }
  }
}
