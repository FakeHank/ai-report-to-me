import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { CONFIG_PATH, DEFAULT_BACKFILL_LIMIT } from './constants.js'

const WebhookConfigSchema = z.object({
  slack_url: z.string().url().optional(),
  discord_url: z.string().url().optional(),
  feishu_url: z.string().url().optional(),
  dingtalk_url: z.string().url().optional(),
  wecom_url: z.string().url().optional(),
  teams_url: z.string().url().optional(),
}).default({})

const ConfigSchema = z.object({
  output_lang: z.enum(['en', 'zh', 'ru', 'ja', 'ko']).default('en'),
  sources: z.array(z.string()).default([]),
  daily_reminder: z.boolean().default(true),
  backfill_limit: z.number().int().min(1).max(30).default(DEFAULT_BACKFILL_LIMIT),
  privacy_mode: z.boolean().default(true),
  wrapped_days: z.number().int().min(7).default(90),
  webhooks: WebhookConfigSchema,
})

export type Config = z.infer<typeof ConfigSchema>

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>

const DEFAULT_CONFIG: Config = {
  output_lang: 'en',
  sources: [],
  daily_reminder: true,
  backfill_limit: DEFAULT_BACKFILL_LIMIT,
  privacy_mode: true,
  wrapped_days: 90,
  webhooks: {},
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG }
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return ConfigSchema.parse(raw)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export function getConfigValue(key: string): unknown {
  const config = loadConfig()
  return (config as Record<string, unknown>)[key]
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig() as Record<string, unknown>
  // Try to parse as JSON for non-string values
  try {
    config[key] = JSON.parse(value)
  } catch {
    config[key] = value
  }
  saveConfig(ConfigSchema.parse(config))
}
