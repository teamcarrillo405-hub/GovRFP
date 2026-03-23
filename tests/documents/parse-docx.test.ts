import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { extractDocxText } from '@/lib/documents/parse-docx'

describe('parse-docx', () => {
  it('extractDocxText() returns text content from a valid DOCX', async () => {
    const buffer = readFileSync(resolve(__dirname, '../fixtures/sample.docx'))
    const text = await extractDocxText(buffer)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('extractDocxText() handles empty buffer gracefully', async () => {
    const emptyBuffer = Buffer.alloc(0)
    await expect(extractDocxText(emptyBuffer)).rejects.toThrow()
  })
})
