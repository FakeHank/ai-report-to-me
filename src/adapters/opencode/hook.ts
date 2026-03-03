import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { HookStatus } from '../adapter.interface.js'

const OPENCODE_PLUGINS_DIR = join(homedir(), '.config', 'opencode', 'plugins')
const PLUGIN_FILE = join(OPENCODE_PLUGINS_DIR, 'ai-report.js')

function resolveAireportBin(): string {
  try {
    return execSync('which aireport', { encoding: 'utf-8' }).trim()
  } catch {
    return 'aireport'
  }
}

function generatePluginSource(bin: string): string {
  return `import { tool } from "@opencode-ai/plugin";
const plugin = async ({ $ }) => ({
  tool: {
    ai_report_check: tool({
      description: "Show AI Report status: yesterday's pending reports and context for current project",
      args: {},
      async execute(_args, ctx) {
        const result = await $\`${bin} startup-check\`.nothrow().quiet();
        return result.stdout.toString() || "No pending reports.";
      },
    }),
  },
});
export default plugin;
`
}

export async function installHook(): Promise<void> {
  const bin = resolveAireportBin()

  if (!existsSync(OPENCODE_PLUGINS_DIR)) {
    mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true })
  }

  writeFileSync(PLUGIN_FILE, generatePluginSource(bin), 'utf-8')
}

export async function uninstallHook(): Promise<void> {
  if (existsSync(PLUGIN_FILE)) {
    unlinkSync(PLUGIN_FILE)
  }
}

export async function checkHookStatus(): Promise<HookStatus> {
  return {
    installed: existsSync(PLUGIN_FILE),
    hookType: 'plugin (custom tool)',
    configPath: PLUGIN_FILE,
  }
}
