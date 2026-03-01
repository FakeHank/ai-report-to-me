import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

export interface VibeCardOptions {
  emoji: string
  label: string
  reason: string
  periodLabel: string
  stats: {
    totalSessions: number
    totalHours: number
    activeDays: number
    topProject: string
  }
  /** LLM-generated Section 7 commentary (the roast/monologue) */
  commentary?: string
}

// Badge gradient colors per emoji
const BADGE_COLORS: Record<string, [string, string]> = {
  '🔁': ['#6366F1', '#8B5CF6'],
  '🌙': ['#1E293B', '#475569'],
  '🏃': ['#F59E0B', '#EF4444'],
  '🧱': ['#78716C', '#A8A29E'],
  '💬': ['#3B82F6', '#06B6D4'],
  '🧹': ['#10B981', '#34D399'],
  '🏔': ['#7C3AED', '#4F46E5'],
  '🔥': ['#EF4444', '#F97316'],
  '⚖️': ['#6B7280', '#9CA3AF'],
}

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim()
}

/**
 * Resolve a CJK TTF font file on the current system.
 * Returns the file path or null if not found.
 */
function findCjkFont(): string | null {
  // Preferred order: STHeiti TTF (macOS built-in), Microsoft YaHei, any Noto Sans SC
  const candidates = [
    // macOS AssetsV2 STHeiti (found via fc-match)
    () => {
      try {
        const result = execSync('fc-match "STHeiti" --format="%{file}"', { encoding: 'utf-8', timeout: 3000 }).trim()
        if (result && existsSync(result) && (result.endsWith('.ttf') || result.endsWith('.otf'))) return result
      } catch { /* ignore */ }
      return null
    },
    // PingFang SC via fc-match
    () => {
      try {
        const result = execSync('fc-match "PingFang SC" --format="%{file}"', { encoding: 'utf-8', timeout: 3000 }).trim()
        if (result && existsSync(result) && (result.endsWith('.ttf') || result.endsWith('.otf'))) return result
      } catch { /* ignore */ }
      return null
    },
    // Common user-installed locations
    () => {
      const paths = [
        `${process.env.HOME}/Library/Fonts/微软雅黑字体.ttf`,
        '/Library/Fonts/NotoSansSC-Regular.ttf',
        `${process.env.HOME}/Library/Fonts/NotoSansSC-Regular.ttf`,
      ]
      return paths.find((p) => existsSync(p)) || null
    },
    // Generic fc-match for any CJK
    () => {
      try {
        const result = execSync('fc-match ":lang=zh" --format="%{file}"', { encoding: 'utf-8', timeout: 3000 }).trim()
        if (result && existsSync(result) && (result.endsWith('.ttf') || result.endsWith('.otf'))) return result
      } catch { /* ignore */ }
      return null
    },
  ]

  for (const find of candidates) {
    const path = find()
    if (path) return path
  }
  return null
}

// satori element helper: plain object notation (no JSX needed)
type SatoriNode = { type: string; props: Record<string, unknown> }
function h(type: string, props: Record<string, unknown>, ...children: (string | SatoriNode | (string | SatoriNode)[])[]): SatoriNode {
  const flat = children.flat()
  return { type, props: { ...props, children: flat.length === 1 ? flat[0] : flat } }
}

function buildCard(options: VibeCardOptions): SatoriNode {
  const { emoji, reason, periodLabel, stats, commentary } = options
  const label = stripEmoji(options.label)
  const [color1, color2] = BADGE_COLORS[emoji] || ['#6366F1', '#8B5CF6']
  const badgeText = label.slice(0, 2)
  const topProject = stats.topProject.length > 18 ? stats.topProject.slice(0, 16) + '...' : stats.topProject

  const statItems = [
    { value: String(stats.totalSessions), unit: 'sessions' },
    { value: `${stats.totalHours}h`, unit: 'coding' },
    { value: String(stats.activeDays), unit: 'active days' },
    { value: topProject, unit: 'top project' },
  ]

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#FFFFFF',
      fontFamily: 'CJK, sans-serif',
      padding: '48px 64px',
      border: '2px solid #E5E7EB',
      borderRadius: '24px',
    },
  },
    // Period label
    h('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        fontSize: '16px',
        color: '#9CA3AF',
        letterSpacing: '2px',
      },
    }, periodLabel),

    // Badge + label row
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: '28px',
      },
    },
      // Gradient circle badge
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '108px',
          height: '108px',
          borderRadius: '54px',
          backgroundImage: `linear-gradient(135deg, ${color1}, ${color2})`,
          color: '#FFFFFF',
          fontSize: '40px',
          fontWeight: 700,
        },
      }, badgeText),
      // Label pill
      h('div', {
        style: {
          display: 'flex',
          marginTop: '16px',
          padding: '8px 24px',
          backgroundColor: '#F3F4F6',
          borderRadius: '20px',
          fontSize: '22px',
          fontWeight: 600,
          color: '#1F2937',
        },
      }, label),
    ),

    // Reason
    h('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: '16px',
        fontSize: '17px',
        color: '#6B7280',
        textAlign: 'center',
      },
    }, reason),

    // Commentary (Section 7 roast) — only if available
    ...(commentary ? [
      h('div', {
        style: {
          display: 'flex',
          marginTop: '20px',
          padding: '20px 24px',
          backgroundColor: '#F9FAFB',
          borderRadius: '12px',
          borderLeft: `4px solid ${color1}`,
          fontSize: '15px',
          lineHeight: '24px',
          color: '#374151',
          whiteSpace: 'pre-wrap' as const,
        },
      }, commentary.length > 500 ? commentary.slice(0, 497) + '...' : commentary),
    ] : []),

    // Spacer
    h('div', { style: { display: 'flex', flexGrow: 1 } }),

    // Divider
    h('div', {
      style: {
        display: 'flex',
        width: '100%',
        height: '1px',
        backgroundColor: '#E5E7EB',
        marginBottom: '28px',
      },
    }),

    // Stats row
    h('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
      },
    }, ...statItems.map((s) =>
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
        },
      },
        h('div', {
          style: {
            fontSize: s.unit === 'top project' ? '20px' : '28px',
            fontWeight: 700,
            color: '#111827',
          },
        }, s.value),
        h('div', {
          style: {
            fontSize: '13px',
            color: '#9CA3AF',
            marginTop: '4px',
          },
        }, s.unit),
      ),
    )),

    // Brand footer
    h('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: '24px',
        fontSize: '13px',
        color: '#D1D5DB',
        letterSpacing: '3px',
      },
    }, 'AI REPORT TO ME'),
  )
}

let fontCache: { name: string; data: Buffer; weight: number; style: string }[] | null = null

function loadFonts(): { name: string; data: Buffer; weight: number; style: string }[] {
  if (fontCache) return fontCache

  const fonts: { name: string; data: Buffer; weight: number; style: string }[] = []

  // Load CJK font
  const cjkPath = findCjkFont()
  if (cjkPath) {
    fonts.push({
      name: 'CJK',
      data: readFileSync(cjkPath),
      weight: 400,
      style: 'normal',
    })
  }

  if (fonts.length === 0) {
    throw new Error('No CJK font found. Install Noto Sans SC or ensure STHeiti/PingFang SC is available via fc-match.')
  }

  fontCache = fonts
  return fonts
}

export async function generateVibeCardPng(options: VibeCardOptions): Promise<Buffer> {
  const fonts = loadFonts()
  const hasCommentary = !!options.commentary
  const commentaryLen = options.commentary?.length || 0
  // Scale height based on commentary length
  const height = hasCommentary ? Math.min(1000, 700 + Math.ceil(commentaryLen / 40) * 24) : 630

  const element = buildCard(options)

  const svg = await satori(element as any, {
    width: 1200,
    height,
    fonts: fonts as any,
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })

  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}
