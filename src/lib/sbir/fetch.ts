import type { SbirAward } from './types'

interface SbirApiAward {
  award_uid?: string
  program?: string
  phase?: string
  title?: string
  agency?: string
  award_amount?: number | string | null
  award_year?: number | string | null
  firm?: string
  abstract?: string
  keywords?: string | null
}

interface SbirApiResponse {
  awards?: SbirApiAward[]
}

function normalizePhase(raw: string | undefined): SbirAward['phase'] {
  const p = (raw ?? '').toLowerCase()
  if (p.includes('iib') || p.includes('2b')) return 'Phase IIB'
  if (p.includes('ii') || p.includes('2')) return 'Phase II'
  return 'Phase I'
}

function normalizeProgram(raw: string | undefined): SbirAward['program'] {
  return (raw ?? '').toUpperCase().includes('STTR') ? 'STTR' : 'SBIR'
}

export async function fetchSbirOpportunities(
  keywords: string[],
  agency?: string,
): Promise<SbirAward[]> {
  if (!keywords.length) return []

  const keyword = keywords.slice(0, 3).join(' ')

  const params = new URLSearchParams({ keyword, rows: '10', start: '0' })
  if (agency) params.set('agency', agency)

  try {
    const url = `https://api.sbir.gov/public/award?${params.toString()}`
    const res = await fetch(url, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const json = (await res.json()) as SbirApiResponse | SbirApiAward[]
    const rawAwards: SbirApiAward[] = Array.isArray(json)
      ? (json as SbirApiAward[])
      : ((json as SbirApiResponse).awards ?? [])

    return rawAwards.map((r, i): SbirAward => ({
      awardId: r.award_uid ?? `sbir-${i}`,
      program: normalizeProgram(r.program),
      phase: normalizePhase(r.phase),
      title: r.title ?? 'Untitled',
      agency: r.agency ?? agency ?? '',
      awardAmount: Number(r.award_amount ?? 0),
      awardYear: Number(r.award_year ?? 0),
      companyName: r.firm ?? 'Unknown',
      abstract: r.abstract ?? '',
      keywords: r.keywords ? r.keywords.split(/[,;]+/).map((k) => k.trim()).filter(Boolean) : [],
    }))
  } catch {
    return []
  }
}
