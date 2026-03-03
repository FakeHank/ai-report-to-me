import type { CLIAdapter, DetectResult } from './adapter.interface.js'
import { ClaudeCodeAdapter } from './claude-code/index.js'
import { CodexAdapter } from './codex/index.js'
import { GeminiCliAdapter } from './gemini-cli/index.js'
import { OpenCodeAdapter } from './opencode/index.js'

export class AdapterRegistry {
  private adapters: CLIAdapter[] = []

  register(adapter: CLIAdapter) {
    this.adapters.push(adapter)
  }

  async detectAll(): Promise<DetectResult[]> {
    return Promise.all(this.adapters.map((a) => a.detect()))
  }

  async getEnabledAdapters(): Promise<CLIAdapter[]> {
    const results = await this.detectAll()
    return this.adapters.filter((_, i) => results[i].installed)
  }

  /**
   * Get adapters that are both installed AND listed in the config sources.
   * Use this for report generation commands (daily, wrapped, startup-check).
   */
  async getConfiguredAdapters(sources: string[]): Promise<CLIAdapter[]> {
    if (sources.length === 0) return this.getEnabledAdapters()
    const results = await this.detectAll()
    const sourceSet = new Set(sources)
    return this.adapters.filter((a, i) => results[i].installed && sourceSet.has(a.name))
  }

  getAdapter(name: string): CLIAdapter | undefined {
    return this.adapters.find((a) => a.name === name)
  }

  getAllAdapters(): CLIAdapter[] {
    return [...this.adapters]
  }
}

let registry: AdapterRegistry | null = null

export function getRegistry(): AdapterRegistry {
  if (!registry) {
    registry = new AdapterRegistry()
    registry.register(new ClaudeCodeAdapter())
    registry.register(new CodexAdapter())
    registry.register(new GeminiCliAdapter())
    registry.register(new OpenCodeAdapter())
  }
  return registry
}
