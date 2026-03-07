import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { t } from '../../shared/i18n.js'

export interface VibeCardOptions {
  emoji: string
  typeName: string
  periodLabel: string
  stats: {
    totalSessions: number
    totalHours: number
    activeDays: number
    topProject: string
    totalTokens: number
  }
  commentary?: string
  closingQuote?: string
  lang?: string
}

// Gradient palette — selected by hashing the type name
const COLOR_PALETTE: [string, string][] = [
  ['#6366F1', '#8B5CF6'],
  ['#3B82F6', '#06B6D4'],
  ['#F59E0B', '#EF4444'],
  ['#10B981', '#34D399'],
  ['#EC4899', '#F43F5E'],
  ['#7C3AED', '#4F46E5'],
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim()
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}

function hasCjkChars(text: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text)
}

function findCjkFont(): string | null {
  const candidates = [
    () => {
      try {
        const result = execSync('fc-match "STHeiti" --format="%{file}"', { encoding: 'utf-8', timeout: 3000 }).trim()
        if (result && existsSync(result) && (result.endsWith('.ttf') || result.endsWith('.otf'))) return result
      } catch { /* ignore */ }
      return null
    },
    () => {
      try {
        const result = execSync('fc-match "PingFang SC" --format="%{file}"', { encoding: 'utf-8', timeout: 3000 }).trim()
        if (result && existsSync(result) && (result.endsWith('.ttf') || result.endsWith('.otf'))) return result
      } catch { /* ignore */ }
      return null
    },
    () => {
      const paths = [
        `${process.env.HOME}/Library/Fonts/NotoSansSC-Regular.ttf`,
        '/Library/Fonts/NotoSansSC-Regular.ttf',
      ]
      return paths.find((p) => existsSync(p)) || null
    },
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

type SatoriNode = { type: string; props: Record<string, unknown> }
function h(type: string, props: Record<string, unknown>, ...children: (string | SatoriNode | (string | SatoriNode)[])[]): SatoriNode {
  const flat = children.flat()
  return { type, props: { ...props, children: flat.length === 1 ? flat[0] : flat } }
}

/** Convert emoji string to Twemoji CDN code point path */
function emojiToTwemojiUrl(emoji: string): string {
  const codePoints = [...emoji]
    .map(c => c.codePointAt(0)!)
    .filter(cp => cp !== 0xfe0f) // remove variation selector
    .map(cp => cp.toString(16))
    .join('-')
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints}.svg`
}

/** Fetch emoji as SVG data URI from Twemoji CDN */
async function fetchEmojiSvg(emoji: string): Promise<string | null> {
  try {
    const url = emojiToTwemojiUrl(emoji)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
      const svgText = await res.text()
      return `data:image/svg+xml,${encodeURIComponent(svgText)}`
    }
  } catch { /* network unavailable, fall back gracefully */ }
  return null
}

const GITHUB_ICON_URI = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#94A3B8"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>')}`

function buildCard(options: VibeCardOptions): SatoriNode {
  const { typeName, periodLabel, stats, commentary, closingQuote, lang = 'en' } = options
  const colorIndex = hashString(typeName) % COLOR_PALETTE.length
  const [color1, color2] = COLOR_PALETTE[colorIndex]
  const topProject = stats.topProject.length > 14 ? stats.topProject.slice(0, 12) + '..' : stats.topProject

  const statItems = [
    { value: String(stats.totalSessions), label: t('vibeCard.sessions', lang) },
    { value: `${stats.totalHours}h`, label: t('vibeCard.coding', lang) },
    { value: String(stats.activeDays), label: t('vibeCard.activeDays', lang) },
    { value: topProject, label: t('vibeCard.topProject', lang) },
  ]

  const displayCommentary = commentary ? commentary : null

  // Section label style (shared by YOUR VIBE TYPE and WHAT AI WANTS TO TELL YOU)
  const sectionLabelStyle = {
    display: 'flex',
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748B',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
  }

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#0F172A',
      fontFamily: 'CJK, sans-serif',
      color: '#F8FAFC',
      position: 'relative',
      overflow: 'hidden',
    },
  },
    // Gradient top bar
    h('div', {
      style: {
        display: 'flex',
        width: '100%',
        height: '6px',
        backgroundImage: `linear-gradient(90deg, ${color1}, ${color2})`,
      },
    }),

    // Content area
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        padding: '36px 56px 0',
      },
    },
      // Title
      h('div', {
        style: {
          display: 'flex',
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '6px',
          backgroundImage: `linear-gradient(135deg, ${color1}, ${color2})`,
          backgroundClip: 'text',
          color: 'transparent',
        },
      }, t('vibeCard.title', lang)),

      // Period label
      h('div', {
        style: {
          display: 'flex',
          marginTop: '8px',
          fontSize: '15px',
          color: '#64748B',
          letterSpacing: '3px',
        },
      }, periodLabel),

      // Hero: total tokens consumed
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '36px',
          width: '100%',
        },
      },
        h('div', {
          style: {
            display: 'flex',
            fontSize: '80px',
            fontWeight: 700,
            backgroundImage: `linear-gradient(135deg, ${color1}, ${color2})`,
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-2px',
            lineHeight: '1',
          },
        }, formatTokens(stats.totalTokens)),
        h('div', {
          style: {
            display: 'flex',
            fontSize: '15px',
            color: '#64748B',
            letterSpacing: '4px',
            textTransform: 'uppercase' as const,
            marginTop: '12px',
          },
        }, t('vibeCard.tokensConsumed', lang)),
      ),

      // Divider
      h('div', {
        style: {
          display: 'flex',
          width: '100%',
          height: '1px',
          backgroundImage: `linear-gradient(90deg, transparent, ${color1}40, transparent)`,
          marginTop: '32px',
        },
      }),

      // Stats row
      h('div', {
        style: {
          display: 'flex',
          marginTop: '24px',
          gap: '0px',
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
              fontSize: '24px',
              fontWeight: 700,
              color: '#F1F5F9',
            },
          }, s.value),
          h('div', {
            style: {
              fontSize: '11px',
              color: '#475569',
              marginTop: '4px',
              letterSpacing: '1px',
              textTransform: 'uppercase' as const,
            },
          }, s.label),
        ),
      )),

      // Divider before vibe type
      h('div', {
        style: {
          display: 'flex',
          width: '100%',
          height: '1px',
          backgroundImage: `linear-gradient(90deg, transparent, ${color1}40, transparent)`,
          marginTop: '28px',
        },
      }),

      // YOUR VIBE TYPE label
      h('div', {
        style: { ...sectionLabelStyle, marginTop: '24px' },
      }, t('vibeCard.vibeType', lang)),

      // Emoji + Type name row
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          marginTop: '16px',
          gap: '14px',
        },
      },
        h('div', {
          style: {
            display: 'flex',
            fontSize: '40px',
            lineHeight: '1',
          },
        }, options.emoji),
        h('div', {
          style: {
            display: 'flex',
            fontSize: '32px',
            fontWeight: 700,
            color: '#E2E8F0',
          },
        }, stripEmoji(typeName)),
      ),

      // Commentary section
      ...(displayCommentary ? [
        // WHAT AI WANTS TO TELL YOU label
        h('div', {
          style: { ...sectionLabelStyle, marginTop: '28px' },
        }, t('vibeCard.commentaryTitle', lang)),

        // Commentary block
        h('div', {
          style: {
            display: 'flex',
            marginTop: '16px',
            padding: '24px 28px',
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            borderLeft: `3px solid ${color1}`,
            fontSize: '15px',
            lineHeight: '28px',
            color: '#CBD5E1',
            whiteSpace: 'pre-wrap' as const,
          },
        }, displayCommentary),
      ] : []),

      // Closing quote
      ...(closingQuote ? [
        h('div', {
          style: {
            display: 'flex',
            justifyContent: 'center',
            marginTop: '20px',
            fontSize: '15px',
            fontStyle: 'italic',
            color: '#94A3B8',
          },
        }, `"${closingQuote}"`),
      ] : []),
    ),

    // Footer
    h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        marginTop: '28px',
      },
    },
      // Footer gradient line
      h('div', {
        style: {
          display: 'flex',
          width: '100%',
          height: '2px',
          backgroundImage: `linear-gradient(90deg, ${color1}00, ${color1}80, ${color2}80, ${color2}00)`,
        },
      }),
      // Footer content
      h('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 56px 20px',
        },
      },
        h('div', {
          style: {
            display: 'flex',
            fontSize: '14px',
            fontWeight: 700,
            color: '#64748B',
            letterSpacing: '4px',
          },
        }, 'AI REPORT TO ME'),
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          },
        },
          h('div', {
            style: {
              display: 'flex',
              fontSize: '13px',
              color: '#64748B',
            },
          }, t('vibeCard.generateMine', lang)),
          h('img', {
            src: GITHUB_ICON_URI,
            width: 18,
            height: 18,
            style: { display: 'flex' },
          }),
          h('div', {
            style: {
              display: 'flex',
              fontSize: '13px',
              color: '#94A3B8',
            },
          }, 'FakeHank/ai-report-to-me'),
        ),
      ),
    ),
  )
}

let fontCache: { name: string; data: Buffer; weight: number; style: string }[] | null = null

function loadFonts(): { name: string; data: Buffer; weight: number; style: string }[] {
  if (fontCache) return fontCache

  const fonts: { name: string; data: Buffer; weight: number; style: string }[] = []

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

/**
 * Estimate height needed to render the formatted commentary text.
 */
function estimateTextHeight(text: string, fontSize: number, lineHeight: number, contentWidth: number): number {
  const isCjk = hasCjkChars(text)
  const avgCharWidth = isCjk ? (fontSize * 1.0) : (fontSize * 0.52)
  const charsPerLine = Math.floor(contentWidth / avgCharWidth)

  const totalLines = Math.max(1, Math.ceil(text.length / charsPerLine))
  return Math.ceil(totalLines * lineHeight)
}

export async function generateVibeCardPng(options: VibeCardOptions): Promise<Buffer> {
  const fonts = loadFonts()

  const formattedCommentary = options.commentary ? options.commentary : null
  const textContentWidth = 1200 - 56 * 2 - 28 * 2

  // Build height from components
  let height = 6  // top bar
  height += 36    // top padding
  height += 26    // title
  height += 8 + 18  // gap + period label
  height += 36    // gap to hero
  height += 80    // hero token number
  height += 12 + 18 // gap + token label
  height += 32    // gap to divider
  height += 1     // divider
  height += 24    // gap to stats
  height += 50    // stats row
  height += 28    // gap to divider
  height += 1     // divider
  height += 24    // gap to YOUR VIBE TYPE label
  height += 14    // label
  height += 16    // gap to emoji/type row
  height += 40    // emoji/type row

  if (formattedCommentary) {
    height += 28   // gap to commentary title
    height += 14 + 16 // section title + gap
    height += 24 * 2  // commentary top/bottom padding
    height += estimateTextHeight(formattedCommentary, 15, 28, textContentWidth)
  }

  if (options.closingQuote) {
    height += 20
    const quoteWidth = 1200 - 56 * 2
    height += estimateTextHeight(options.closingQuote, 15, 24, quoteWidth)
  }

  height += 28   // gap to footer
  height += 2    // footer gradient line
  height += 18 + 14 + 20 // footer padding + text + bottom padding

  height = Math.max(height, 400)

  // Pre-fetch emoji SVG for satori's loadAdditionalAsset
  const emojiSvgCache = new Map<string, string>()
  if (options.emoji) {
    const svg = await fetchEmojiSvg(options.emoji)
    if (svg) emojiSvgCache.set(options.emoji, svg)
  }

  const element = buildCard(options)

  const svg = await satori(element as any, {
    width: 1200,
    height,
    fonts: fonts as any,
    loadAdditionalAsset: async (code: string, segment: string) => {
      if (code === 'emoji') {
        // Check cache first
        if (emojiSvgCache.has(segment)) return emojiSvgCache.get(segment)!
        // Try fetching on the fly
        const svg = await fetchEmojiSvg(segment)
        if (svg) {
          emojiSvgCache.set(segment, svg)
          return svg
        }
      }
      return ''
    },
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 2400 },
  })

  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}
