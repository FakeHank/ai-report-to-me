import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

export class TeamsWebhookOutput extends WebhookOutput {
  readonly name = 'teams'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    const bodyItems: unknown[] = [
      {
        type: 'TextBlock',
        text: report.title,
        size: 'Large',
        weight: 'Bolder',
        wrap: true,
      },
    ]

    for (const section of report.sections) {
      if (section.level > 1) {
        bodyItems.push({
          type: 'TextBlock',
          text: section.heading,
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
        })
      }
      if (section.content) {
        bodyItems.push({
          type: 'TextBlock',
          text: truncate(section.content, 5000),
          wrap: true,
        })
      }
    }

    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: bodyItems,
          },
        },
      ],
    }
  }
}
