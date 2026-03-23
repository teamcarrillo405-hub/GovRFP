import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { extractPdfText, isScannedPdf } from '@/lib/documents/parse-pdf'

const samplePdf = readFileSync(resolve(__dirname, '../fixtures/sample.pdf'))
const scannedPdf = readFileSync(resolve(__dirname, '../fixtures/sample-scanned.pdf'))

describe('parse-pdf', () => {
  it('extractPdfText() returns text content from a valid PDF', async () => {
    const result = await extractPdfText(new Uint8Array(samplePdf))
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
    expect(result.charPerPage).toHaveLength(result.pageCount)
    expect(typeof result.text).toBe('string')
  })

  it('extractPdfText() returns page count', async () => {
    const result = await extractPdfText(new Uint8Array(samplePdf))
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  })

  it('isScannedPdf() returns false for text-based PDF (explicit array)', () => {
    expect(isScannedPdf([500, 300, 450])).toBe(false)
  })

  it('isScannedPdf() returns true for image-only PDF (explicit array)', () => {
    expect(isScannedPdf([0, 5, 10])).toBe(true)
  })

  it('isScannedPdf() returns true for scanned fixture', async () => {
    const result = await extractPdfText(new Uint8Array(scannedPdf))
    // Scanned PDF has no extractable text — all pages should be below threshold
    expect(isScannedPdf(result.charPerPage)).toBe(true)
  })

  it('isScannedPdf() returns true for empty charPerPage', () => {
    expect(isScannedPdf([])).toBe(true)
  })

  it('isScannedPdf() returns false when all pages above threshold', () => {
    expect(isScannedPdf([200, 150, 300])).toBe(false)
  })
})
