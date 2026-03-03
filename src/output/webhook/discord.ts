import type { OutputMetadata } from '../output.interface.js'
import { WebhookOutput, truncate } from './webhook-base.js'
import type { ParsedReport } from './markdown-parser.js'

export class DiscordWebhookOutput extends WebhookOutput {
  readonly name = 'discord'

  protected formatPayload(report: ParsedReport, _metadata: OutputMetadata): unknown {
    const fields: { name: string; value: string; inline?: boolean }[] = []

    for (const section of report.sections) {
      if (section.level === 1 || !section.content) continue
      fields.push({
        name: truncate(section.heading, 256),
        value: truncate(section.content, 1024),
      })
    }

    // Discord embed description limit is 4096
    const firstSection = report.sections.find(s => s.level === 1 && s.content)
    const description = firstSection ? truncate(firstSection.content, 4096) : ''

    return {
      embeds: [
        {
          title: truncate(report.title, 256),
          description,
          fields: fields.slice(0, 25), // Discord max 25 fields
          color: 0x5865f2,
          footer: { text: `AI Report · ${report.date}` },
        },
      ],
    }
  }
}
