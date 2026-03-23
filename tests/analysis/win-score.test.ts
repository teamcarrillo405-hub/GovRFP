import { describe, it } from 'vitest'

describe('win-score', () => {
  it.todo('computeWinScore returns weighted average of all 5 factors')
  it.todo('computeWinScore rounds to integer')
  it.todo('computeWinScore clamps to 0-100')
  it.todo('computeCertificationsScore returns 50 when no RFP set-asides')
  it.todo('computeCertificationsScore returns 90 when contractor cert matches')
  it.todo('computeCertificationsScore returns 20 when no match')
  it.todo('computeSetAsideScore returns 100 when primary matches')
  it.todo('computeSetAsideScore returns 0 when no match')
  it.todo('computeSetAsideScore returns 50 for full-and-open')
})
