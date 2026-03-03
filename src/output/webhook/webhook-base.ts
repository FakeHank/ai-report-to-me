import type { OutputTarget, OutputMetadata } from '../output.interface.js'
import { parseReportMarkdown, type ParsedReport } from './markdown-parser.js'
import { logger } from '../../shared/logger.js'

export abstract class WebhookOutput implements OutputTarget {
  abstract readonly name: string
  protected readonly webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  protected abstract formatPayload(report: ParsedReport, metadata: OutputMetadata): unknown

  async send(content: string | Buffer, metadata: OutputMetadata): Promise<void> {
    const markdown = typeof content === 'string' ? content : content.toString('utf-8')
    const report = parseReportMarkdown(markdown, metadata.date)
    const payload = this.formatPayload(report, metadata)

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        logger.warn(`[${this.name}] Webhook failed (${response.status}): ${text.slice(0, 200)}`)
      } else {
        logger.success(`[${this.name}] Report pushed successfully`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.warn(`[${this.name}] Webhook error: ${message}`)
    }
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
