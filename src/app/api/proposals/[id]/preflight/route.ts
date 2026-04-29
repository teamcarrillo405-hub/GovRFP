import { createClient } from '@/lib/supabase/server'
import type { SectionName } from '@/lib/editor/types'

type GapType = 'past_projects' | 'key_personnel' | 'capability_statement'

const SECTION_NEEDS: Partial<Record<SectionName, { pastProjects: boolean; keyPersonnel: boolean; capabilityStatement: boolean }>> = {
  'Executive Summary':  { pastProjects: true,  keyPersonnel: true,  capabilityStatement: false },
  'Technical Approach': { pastProjects: true,  keyPersonnel: true,  capabilityStatement: false },
  'Management Plan':    { pastProjects: false, keyPersonnel: true,  capabilityStatement: false },
  'Staffing Plan':      { pastProjects: false, keyPersonnel: true,  capabilityStatement: false },
  'Cover Letter':       { pastProjects: false, keyPersonnel: false, capabilityStatement: true  },
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const url = new URL(req.url)
  const section = url.searchParams.get('section') as SectionName | null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!section) return Response.json({ gaps: [] })

  const needs = SECTION_NEEDS[section]
  if (!needs) return Response.json({ gaps: [] })

  const gaps: GapType[] = []

  if (needs.pastProjects) {
    const { count } = await supabase
      .from('past_projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!count || count === 0) gaps.push('past_projects')
  }

  if (needs.keyPersonnel) {
    const { count } = await supabase
      .from('key_personnel')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!count || count === 0) gaps.push('key_personnel')
  }

  if (needs.capabilityStatement) {
    const { data } = await supabase
      .from('profiles')
      .select('capability_statement')
      .eq('id', user.id)
      .single()
    if (!data?.capability_statement?.trim()) gaps.push('capability_statement')
  }

  return Response.json({ gaps })
}
