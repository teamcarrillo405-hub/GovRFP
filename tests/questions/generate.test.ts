import { describe, it, expect } from 'vitest'
import { parseQuestionList } from '@/lib/questions/generate'

describe('parseQuestionList (Claude output sanitizer)', () => {
  it('parses a clean JSON array', () => {
    const raw = JSON.stringify([
      { category: 'scope', question: 'What is the scope?', context: 'tip', required: true },
      { category: 'cost', question: 'What is the budget?', context: '', required: false },
    ])
    const out = parseQuestionList(raw)
    expect(out).toHaveLength(2)
    expect(out[0].category).toBe('scope')
    expect(out[0].required).toBe(true)
  })

  it('strips ```json fences', () => {
    const raw = '```json\n[{"category":"risk","question":"q","context":"c","required":false}]\n```'
    expect(parseQuestionList(raw)).toHaveLength(1)
  })

  it('strips ``` (no language) fences', () => {
    const raw = '```\n[{"category":"risk","question":"q","context":"","required":false}]\n```'
    expect(parseQuestionList(raw)).toHaveLength(1)
  })

  it('extracts the JSON array from prose-wrapped output', () => {
    const raw = `Here are the questions:

[{"category":"scope","question":"q","context":"","required":false}]

Hope this helps!`
    expect(parseQuestionList(raw)).toHaveLength(1)
  })

  it('drops items with missing or empty question', () => {
    const raw = JSON.stringify([
      { category: 'scope', question: '', context: '', required: false },
      { category: 'scope', context: '', required: false },
      { category: 'scope', question: 'good', context: '', required: false },
    ])
    expect(parseQuestionList(raw)).toHaveLength(1)
  })

  it('drops items with invalid category', () => {
    const raw = JSON.stringify([
      { category: 'made_up', question: 'q', context: '', required: false },
      { category: 'cost', question: 'q', context: '', required: false },
    ])
    expect(parseQuestionList(raw)).toHaveLength(1)
  })

  it('returns empty array on malformed JSON', () => {
    expect(parseQuestionList('not json at all')).toEqual([])
    expect(parseQuestionList('{not: even: valid}')).toEqual([])
  })

  it('returns empty array when response is not an array', () => {
    expect(parseQuestionList(JSON.stringify({ a: 1 }))).toEqual([])
  })

  it('truncates absurdly long questions to 1000 chars', () => {
    const long = 'a'.repeat(5000)
    const raw = JSON.stringify([{ category: 'scope', question: long, context: '', required: false }])
    expect(parseQuestionList(raw)[0].question).toHaveLength(1000)
  })
})
