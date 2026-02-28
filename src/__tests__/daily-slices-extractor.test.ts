import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { extractExperienceSlicesFromReports } from '../core/daily-slices-extractor.js'

describe('extractExperienceSlicesFromReports', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `aireport-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('should extract experience slices from markdown reports', () => {
    writeFileSync(join(testDir, '2026-02-25.md'), `# 日报 · 2026-02-25

## 概览

Did some work today.

## 经验切片

### TypeScript path alias 在 vitest 中不生效

- **背景**：项目使用 tsconfig 的 paths 配置
- **问题**：vitest 运行时报 module not found
- **解决方案**：在 vitest.config.ts 中添加 resolve.alias

## AI 复盘

Some review here.
`)

    const slices = extractExperienceSlicesFromReports(testDir, '2026-02-20', '2026-02-28')
    expect(slices).toHaveLength(1)
    expect(slices[0].date).toBe('2026-02-25')
    expect(slices[0].content).toContain('TypeScript path alias')
    expect(slices[0].content).toContain('vitest.config.ts')
  })

  it('should filter by date range', () => {
    writeFileSync(join(testDir, '2026-02-20.md'), `# 日报

## 经验切片

### Slice from Feb 20

Content here.

## AI 复盘
`)
    writeFileSync(join(testDir, '2026-02-25.md'), `# 日报

## 经验切片

### Slice from Feb 25

Content here.

## AI 复盘
`)

    const slices = extractExperienceSlicesFromReports(testDir, '2026-02-22', '2026-02-28')
    expect(slices).toHaveLength(1)
    expect(slices[0].date).toBe('2026-02-25')
  })

  it('should return empty array when no reports exist', () => {
    const slices = extractExperienceSlicesFromReports(testDir, '2026-02-20', '2026-02-28')
    expect(slices).toHaveLength(0)
  })

  it('should return empty array for non-existent directory', () => {
    const slices = extractExperienceSlicesFromReports('/nonexistent/path', '2026-02-20', '2026-02-28')
    expect(slices).toHaveLength(0)
  })

  it('should skip reports without experience slice section', () => {
    writeFileSync(join(testDir, '2026-02-25.md'), `# 日报 · 2026-02-25

## 概览

Did some work today.

## AI 复盘

Some review.
`)

    const slices = extractExperienceSlicesFromReports(testDir, '2026-02-20', '2026-02-28')
    expect(slices).toHaveLength(0)
  })

  it('should handle experience slice as last section', () => {
    writeFileSync(join(testDir, '2026-02-25.md'), `# 日报

## 概览

Overview.

## 经验切片

### Last section slice

This is at the very end of the file with no trailing section.
`)

    const slices = extractExperienceSlicesFromReports(testDir, '2026-02-20', '2026-02-28')
    expect(slices).toHaveLength(1)
    expect(slices[0].content).toContain('Last section slice')
  })
})
