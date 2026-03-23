import { extractText } from 'unpdf'

export interface PdfResult {
  text: string
  pageCount: number
  charPerPage: number[]
}

export async function extractPdfText(buffer: Uint8Array): Promise<PdfResult> {
  const result = await extractText(buffer, { mergePages: false })
  // result.text is string[] (one per page when mergePages: false)
  const pages: string[] = Array.isArray(result.text) ? result.text : []
  const charPerPage = pages.map((p: string) => p.trim().length)
  const text = pages.join('\n\n')
  return {
    text,
    pageCount: result.totalPages,
    charPerPage,
  }
}

const SCANNED_THRESHOLD = 100 // chars per page

export function isScannedPdf(charPerPage: number[], threshold = SCANNED_THRESHOLD): boolean {
  if (charPerPage.length === 0) return true
  return charPerPage.every(count => count < threshold)
}
