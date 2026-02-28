import { join } from 'node:path'
import type { OutputTarget, OutputMetadata } from './output.interface.js'
import { writeMarkdown, ensureDir } from '../shared/storage.js'
import { REPORTS_DIR, WRAPPED_DIR } from '../shared/constants.js'

export class LocalFileOutput implements OutputTarget {
  readonly name = 'local-file'

  async send(content: string | Buffer, metadata: OutputMetadata): Promise<void> {
    const dir = metadata.type === 'daily' ? REPORTS_DIR : WRAPPED_DIR
    ensureDir(dir)
    const filePath = join(dir, metadata.fileName)
    if (typeof content === 'string') {
      writeMarkdown(filePath, content)
    } else {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(filePath, content)
    }
  }
}
