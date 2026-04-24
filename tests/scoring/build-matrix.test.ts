import { describe, it, expect } from 'vitest'
import {
  parseWeight,
  normalizeWeights,
  buildScoringMatrix,
  buildDefaultCriteria,
  PASS_THRESHOLD,
} from '@/lib/scoring/types'
import type { SectionLMEntry, AnalysisRequirement } from '@/lib/analysis/types'

describe('parseWeight', () => {
  it('parses percentage strings', () => {
    expect(parseWeight('40%')).toBeCloseTo(0.4)
    expect(parseWeight('15.5%')).toBeCloseTo(0.155)
  })

  it('parses point strings', () => {
    expect(parseWeight('300 points')).toBe(300)
    expect(parseWeight('100 pts')).toBe(100)
  })

  it('parses bare numbers as percent', () => {
    expect(parseWeight('40')).toBeCloseTo(0.4)
  })

  it('returns 0 for unparseable strings', () => {
    expect(parseWeight('N/A')).toBe(0)
  })
})

describe('normalizeWeights', () => {
  it('normalizes to sum to 1.0', () => {
    const result = normalizeWeights([300, 200, 100])
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0)
    expect(result[0]).toBeCloseTo(0.5)
    expect(result[1]).toBeCloseTo(1 / 3)
  })

  it('handles all-zero input with equal distribution', () => {
    const result = normalizeWeights([0, 0, 0])
    expect(result).toEqual([1/3, 1/3, 1/3])
  })
})

describe('buildScoringMatrix', () => {
  const crosswalk: SectionLMEntry[] = [
    { section_l_ref: 'L.5.1', section_l_instruction: 'Provide technical approach', section_m_ref: 'M.3.1', section_m_criterion: 'Technical Approach', weight: '40%' },
    { section_l_ref: 'L.5.2', section_l_instruction: 'Provide past performance', section_m_ref: 'M.3.2', section_m_criterion: 'Past Performance', weight: '30%' },
    { section_l_ref: 'L.5.3', section_l_instruction: 'Provide management plan', section_m_ref: 'M.3.3', section_m_criterion: 'Management Plan', weight: '30%' },
  ]

  const requirements: AnalysisRequirement[] = [
    { id: 'REQ-001', text: 'Shall provide technical approach', classification: 'mandatory', keyword: 'shall', section_ref: 'L.5.1', proposal_topic: 'Technical' },
    { id: 'REQ-002', text: 'Must document past performance', classification: 'mandatory', keyword: 'must', section_ref: 'L.5.2', proposal_topic: 'Past Performance' },
  ]

  it('uses section_lm source when crosswalk is provided', () => {
    const matrix = buildScoringMatrix('prop-1', crosswalk, requirements)
    expect(matrix.source).toBe('section_lm')
    expect(matrix.criteria).toHaveLength(3)
    expect(matrix.criteria[0].weight).toBeCloseTo(0.4)
    expect(matrix.criteria[1].weight).toBeCloseTo(0.3)
  })

  it('falls back to default criteria when crosswalk is empty', () => {
    const matrix = buildScoringMatrix('prop-1', [], requirements)
    expect(matrix.source).toBe('default')
    expect(matrix.criteria.length).toBeGreaterThan(0)
  })

  it('groups requirements by section correctly', () => {
    const matrix = buildScoringMatrix('prop-1', crosswalk, requirements)
    expect(matrix.requirements_by_section['Technical Approach']).toHaveLength(1)
    // Past Performance topic is now remapped to Executive Summary
    expect(matrix.requirements_by_section['Executive Summary']).toHaveLength(1)
  })
})

describe('buildDefaultCriteria', () => {
  it('returns criteria with refs and weights summing to 1.0', () => {
    const criteria = buildDefaultCriteria()
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
    expect(totalWeight).toBeCloseTo(1.0)
    criteria.forEach((c) => {
      expect(c.ref).toMatch(/^DEFAULT-\d+$/)
      expect(c.weight).toBeGreaterThan(0)
    })
  })
})

describe('PASS_THRESHOLD', () => {
  it('is 90', () => {
    expect(PASS_THRESHOLD).toBe(90)
  })
})
