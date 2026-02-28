export interface OutputMetadata {
  type: 'daily' | 'wrapped'
  date: string
  fileName: string
}

export interface OutputTarget {
  readonly name: string
  send(content: string | Buffer, metadata: OutputMetadata): Promise<void>
}
