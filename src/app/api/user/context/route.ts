import { createClient } from '@/lib/supabase/server'

interface PastProjectInput {
  agency: string
  scope_narrative: string
  contract_value?: string
  period_start?: string
  period_end?: string
  outcome?: string
}

interface KeyPersonnelInput {
  name: string
  title?: string
  experience?: string
}

interface Body {
  past_projects?: PastProjectInput[]
  key_personnel?: KeyPersonnelInput[]
  capability_statement?: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Body = await req.json()

  if (body.past_projects?.length) {
    const rows = body.past_projects
      .filter((p) => p.agency?.trim() && p.scope_narrative?.trim())
      .map((p) => ({
        user_id: user.id,
        agency: p.agency.trim(),
        scope_narrative: p.scope_narrative.trim(),
        contract_value: p.contract_value ? Math.round(parseFloat(p.contract_value) * 100) : null,
        period_start: p.period_start || null,
        period_end: p.period_end || null,
        outcome: p.outcome?.trim() || null,
      }))
    if (rows.length) await supabase.from('past_projects').insert(rows)
  }

  if (body.key_personnel?.length) {
    const rows = body.key_personnel
      .filter((p) => p.name?.trim())
      .map((p) => ({
        user_id: user.id,
        name: p.name.trim(),
        title: p.title?.trim() || null,
        experience: p.experience?.trim() || null,
      }))
    if (rows.length) await supabase.from('key_personnel').insert(rows)
  }

  if (body.capability_statement?.trim()) {
    await supabase
      .from('profiles')
      .update({ capability_statement: body.capability_statement.trim() })
      .eq('id', user.id)
  }

  return Response.json({ ok: true })
}
