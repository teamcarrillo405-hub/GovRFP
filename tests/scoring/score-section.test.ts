import { describe, it, expect } from 'vitest'
import { parseScoreResponse } from '@/lib/scoring/score-section'

const VALID_RESPONSE = JSON.stringify({
  criteria: [
    { ref: 'M.3.1', label: 'Technical Approach', score: 92, weight: 0.4, weighted: 36.8, rationale: 'Thorough', gaps: [] },
    { ref: 'M.3.2', label: 'Past Performance', score: 88, weight: 0.3, weighted: 26.4, rationale: 'Good examples', gaps: ['Missing contract values'] },
    { ref: 'M.3.3', label: 'Management Plan', score: 95, weight: 0.3, weighted: 28.5, rationale: 'Clear org chart', gaps: [] },
  ],
  total_score: 92,
  passed: true,
  critique: 'Strong overall. Add contract values to PP section.',
  strengths: ['Detailed methodology', 'Clear org structure'],
  gaps: ['Missing contract values in Past Performance'],
})

describe('parseScoreResponse', () => {
  it('parses a valid response correctly', () => {
    const result = parseScoreResponse(VALID_RESPONSE, 'Technical Approach', 1)
    expect(result.total_score).toBe(92)
    expect(result.passed).toBe(true)
    expect(result.criteria).toHaveLength(3)
    expect(result.criteria[0].ref).toBe('M.3.1')
    expect(result.gaps).toHaveLength(1)
  })

  it('handles markdown-wrapped JSON', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```'
    const result = parseScoreResponse(wrapped, 'Technical Approach', 1)
    expect(result.total_score).toBe(92)
  })

  it('returns failing fallback on invalid JSON', () => {
    const result = parseScoreResponse('not valid json', 'Technical Approach', 1)
    expect(result.passed).toBe(false)
    expect(result.total_score).toBe(0)
    expect(result.critique).toContain('Scoring failed')
  })

  it('clamps scores to 0-100', () => {
    const bad = JSON.stringify({
      criteria: [{ ref: 'X', label: 'X', score: 150, weight: 1, weighted: 150, rationale: 'x', gaps: [] }],
      total_score: 150,
      passed: true,
      critique: '',
      strengths: [],
      gaps: [],
    })
    const result = parseScoreResponse(bad, 'Technical Approach', 1)
    expect(result.total_score).toBe(100)
    expect(result.criteria[0].score).toBe(100)
  })

  it('returns correct section name and attempt', () => {
    const result = parseScoreResponse(VALID_RESPONSE, 'Management Plan', 2)
    expect(result.section).toBe('Management Plan')
    expect(result.attempt).toBe(2)
  })
})
