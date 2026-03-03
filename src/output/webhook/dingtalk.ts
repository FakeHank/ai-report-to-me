import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

export class DingtalkWebhookOutput extends WebhookOutput {
  readonly name = 'dingtalk'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    // DingTalk actionCard supports markdown in text field, limit ~20000 chars
    const markdownText = truncate(report.rawMarkdown, 20000)

    return {
      msgtype: 'actionCard',
      actionCard: {
        title: truncate(report.title, 200),
        text: markdownText,
        btnOrientation: '0',
        singleTitle: 'View Report',
        singleURL: '',
      },
    }
  }
}
