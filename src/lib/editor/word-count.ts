import { SECTION_NAMES } from './types'

export function countWords(plainText: string): number {
  if (!plainText || plainText.trim().length === 0) return 0
  return plainText.trim().split(/\s+/).filter((token) => token.length > 0).length
}

export function countPages(plainText: string, wordsPerPage = 250): number {
  const words = countWords(plainText)
  if (words === 0) return 0
  return Math.ceil(words / wordsPerPage)
}

export function estimateReadingMinutes(plainText: string): number {
  const words = countWords(plainText)
  return words / 238
}

export interface SectionWordCount {
  sectionName: string
  words: number
  pages: number
  limitWords: number | null
  limitPages: number | null
  status: 'ok' | 'warning' | 'over'
}

export function computeSectionWordCount(
  sectionName: string,
  plainText: string,
  limitWords: number | null,
  limitPages: number | null,
  wordsPerPage = 250,
): SectionWordCount {
  const words = countWords(plainText)
  const pages = countPages(plainText, wordsPerPage)

  let status: SectionWordCount['status'] = 'ok'

  if (limitWords !== null && words > limitWords) {
    status = 'over'
  } else if (limitPages !== null && pages > limitPages) {
    status = 'over'
  } else if (limitWords !== null && words > limitWords * 0.8) {
    status = 'warning'
  } else if (limitPages !== null && pages > limitPages * 0.8) {
    status = 'warning'
  }

  return { sectionName, words, pages, limitWords, limitPages, status }
}

export { SECTION_NAMES }
