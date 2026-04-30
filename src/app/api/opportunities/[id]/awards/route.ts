import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFpdsAwardsByAgency } from '@/lib/fpds/fetch'
import type { FpdsAward } from '@/lib/fpds/types'

interface AwardsResponse {
  awards: FpdsAward[]
  incumbent: FpdsAward | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Load opportunity details
  const { data: opp } = await supabase
    .from('opportunities' as never)
    .select('agency, naics_code, title')
    .eq('id', id)
    .single()

  if (!opp) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const { agency, naics_code } = opp as { agency: string | null; naics_code: string | null; title: string | null }

  if (!agency) {
    const empty: AwardsResponse = { awards: [], incumbent: null }
    return Response.json(empty)
  }

  // Fetch FPDS data
  const fpdsResult = await fetchFpdsAwardsByAgency(agency, naics_code ?? null)

  const incumbent = fpdsResult.awards.find((a) => a.isIncumbent) ?? null

  const response: AwardsResponse = {
    awards: fpdsResult.awards,
    incumbent,
  }

  return Response.json(response)
}
