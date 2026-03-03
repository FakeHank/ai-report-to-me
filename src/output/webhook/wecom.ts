import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

export class WecomWebhookOutput extends WebhookOutput {
  readonly name = 'wecom'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    // WeCom markdown message, content limit 4096 chars
    const content = truncate(report.rawMarkdown, 4096)

    return {
      msgtype: 'markdown',
      markdown: {
        content,
      },
    }
  }
}
