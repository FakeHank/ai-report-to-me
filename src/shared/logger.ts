const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const

export const logger = {
  info(msg: string) {
    console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`)
  },

  success(msg: string) {
    console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`)
  },

  warn(msg: string) {
    console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`)
  },

  error(msg: string) {
    console.error(`${COLORS.red}✗${COLORS.reset} ${msg}`)
  },

  debug(msg: string) {
    if (process.env.DEBUG) {
      console.log(`${COLORS.gray}[debug] ${msg}${COLORS.reset}`)
    }
  },

  dim(msg: string) {
    console.log(`${COLORS.gray}${msg}${COLORS.reset}`)
  },

  bold(msg: string) {
    console.log(`${COLORS.bold}${msg}${COLORS.reset}`)
  },
}
