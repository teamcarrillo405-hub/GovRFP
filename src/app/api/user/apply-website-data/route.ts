import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.company_name?.trim())           update.company_name = body.company_name.trim()
  if (body.capability_statement?.trim())   update.capability_statement = body.capability_statement.trim().slice(0, 2000)
  if (body.differentiators?.trim())        update.differentiators = body.differentiators.trim()
  if (Array.isArray(body.construction_types) && body.construction_types.length)
                                           update.construction_types = body.construction_types
  if (Array.isArray(body.certifications) && body.certifications.length)
                                           update.certifications = body.certifications
  if (Array.isArray(body.geographic_states) && body.geographic_states.length)
                                           update.geographic_states = body.geographic_states
  if (body.years_in_business != null)      update.years_in_business = body.years_in_business
  if (body.employee_count != null)         update.employee_count = body.employee_count

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
