import type { Config } from '../../shared/config.js'
import type { OutputTarget } from '../output.interface.js'
import { SlackWebhookOutput } from './slack.js'
import { DiscordWebhookOutput } from './discord.js'
import { FeishuWebhookOutput } from './feishu.js'
import { DingtalkWebhookOutput } from './dingtalk.js'
import { WecomWebhookOutput } from './wecom.js'
import { TeamsWebhookOutput } from './teams.js'

const PLATFORM_MAP = {
  slack_url: SlackWebhookOutput,
  discord_url: DiscordWebhookOutput,
  feishu_url: FeishuWebhookOutput,
  dingtalk_url: DingtalkWebhookOutput,
  wecom_url: WecomWebhookOutput,
  teams_url: TeamsWebhookOutput,
} as const

export function resolveWebhookOutputs(config: Config): OutputTarget[] {
  const outputs: OutputTarget[] = []
  const webhooks = config.webhooks

  for (const [key, OutputClass] of Object.entries(PLATFORM_MAP)) {
    const url = webhooks[key as keyof typeof PLATFORM_MAP]
    if (url) {
      outputs.push(new OutputClass(url))
    }
  }

  return outputs
}
