const SECTION_L_PATTERNS: RegExp[] = [
  /SECTION\s+L[\s.:–—]/i,
  /SEC(?:TION)?\.?\s+L[\s.:–—]/i,
  /PART\s+(?:IV|4).*SECTION\s+L/is,
  /L\.\s+(?:INSTRUCTIONS?|CONDITIONS?|NOTICES?)\s+TO\s+OFFERORS?/i,
  /INSTRUCTIONS?,?\s+CONDITIONS?\s+AND\s+NOTICES?\s+TO\s+OFFERORS?/i,
  /PROPOSAL\s+PREPARATION\s+INSTRUCTIONS?/i,
]

const SECTION_M_PATTERNS: RegExp[] = [
  /SECTION\s+M[\s.:–—]/i,
  /SEC(?:TION)?\.?\s+M[\s.:–—]/i,
  /M\.\s+EVALUATION\s+(?:FACTORS?|CRITERIA)/i,
  /EVALUATION\s+FACTORS?\s+FOR\s+AWARD/i,
  /BASIS\s+FOR\s+AWARD/i,
  /EVALUATION\s+CRITERIA/i,
]

export function detectSectionLM(rfpText: string): { hasL: boolean; hasM: boolean } {
  const hasL = SECTION_L_PATTERNS.some(p => p.test(rfpText))
  const hasM = SECTION_M_PATTERNS.some(p => p.test(rfpText))
  return { hasL, hasM }
}
