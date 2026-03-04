import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { OPENCODE_COMMANDS_DIR } from '../../shared/constants.js'
import type { HookStatus } from '../adapter.interface.js'
import { getDayreportContent, getQtreportContent } from '../command-templates.js'

const OPENCODE_PLUGINS_DIR = join(homedir(), '.config', 'opencode', 'plugins')
const PLUGIN_FILE = join(OPENCODE_PLUGINS_DIR, 'ai-report.js')
const DAYREPORT_PATH = join(OPENCODE_COMMANDS_DIR, 'dayreport.md')
const QTREPORT_PATH = join(OPENCODE_COMMANDS_DIR, 'qtreport.md')

function resolveAireportBin(): string {
  try {
    return execSync('which aireport', { encoding: 'utf-8' }).trim()
  } catch {
    return 'aireport'
  }
}

function generatePluginSource(bin: string): string {
  return `import { tool } from "@opencode-ai/plugin";
const plugin = async ({ $ }) => {
  let startupContext = "";
  // Run startup check immediately so context is ready
  try {
    const result = await $\`${bin} startup-check\`.nothrow().quiet();
    startupContext = result.stdout.toString().trim();
  } catch {}
  return {
    tool: {
      ai_report_check: tool({
        description: "Show AI Report status: yesterday's pending reports and context for current project. Call this tool at the start of every session.",
        args: {},
        async execute(_args, ctx) {
          if (startupContext) return startupContext;
          try {
            const result = await $\`${bin} startup-check\`.nothrow().quiet();
            return result.stdout.toString() || "No pending reports.";
          } catch {
            return "No pending reports.";
          }
        },
      }),
    },
    event: async ({ event }) => {
      if (event.type === "session.created") {
        try {
          const result = await $\`${bin} startup-check\`.nothrow().quiet();
          startupContext = result.stdout.toString().trim();
        } catch {}
      }
    },
  };
};
export default plugin;
`
}

export async function installHook(): Promise<void> {
  const bin = resolveAireportBin()

  if (!existsSync(OPENCODE_PLUGINS_DIR)) {
    mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true })
  }

  writeFileSync(PLUGIN_FILE, generatePluginSource(bin), 'utf-8')

  // Install slash commands
  if (!existsSync(OPENCODE_COMMANDS_DIR)) {
    mkdirSync(OPENCODE_COMMANDS_DIR, { recursive: true })
  }
  writeFileSync(DAYREPORT_PATH, getDayreportContent(), 'utf-8')
  writeFileSync(QTREPORT_PATH, getQtreportContent(), 'utf-8')
}

export async function uninstallHook(): Promise<void> {
  if (existsSync(PLUGIN_FILE)) unlinkSync(PLUGIN_FILE)
  if (existsSync(DAYREPORT_PATH)) unlinkSync(DAYREPORT_PATH)
  if (existsSync(QTREPORT_PATH)) unlinkSync(QTREPORT_PATH)
}

export async function checkHookStatus(): Promise<HookStatus> {
  const pluginOk = existsSync(PLUGIN_FILE)
  const cmdsOk = existsSync(DAYREPORT_PATH) && existsSync(QTREPORT_PATH)
  return {
    installed: pluginOk && cmdsOk,
    hookType: 'plugin (custom tool)',
    configPath: PLUGIN_FILE,
  }
}
