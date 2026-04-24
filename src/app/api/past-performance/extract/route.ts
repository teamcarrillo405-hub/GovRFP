import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const bodySchema = z.object({
  text: z.string().min(20).max(20_000),
})

const client = new Anthropic()

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json()
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { text } = parsed.data

  const systemPrompt = `You extract structured past performance records from proposal text.
Return a JSON array of records. Each record must have these fields (all optional except contract_title, customer_name, scope_narrative):
- contract_title: string (short descriptive title if not explicit, derive from scope)
- contract_number: string | null (PIID/contract number if mentioned)
- customer_name: string (government agency or prime contractor)
- customer_agency_code: string | null (e.g. USACE, DOD, VA)
- period_start: string | null (ISO date YYYY-MM-DD)
- period_end: string | null (ISO date YYYY-MM-DD)
- contract_value_usd: number | null (numeric USD, no symbols)
- naics_codes: string[] (6-digit NAICS codes only, e.g. ["236220"])
- set_asides_claimed: string[] (use codes: SBA, 8A, 8AN, HZC, HZS, SDVOSBC, SDVOSBS, WOSB, EDWOSB, VSA)
- scope_narrative: string (200-500 word evergreen scope description)
- outcomes: string | null (measurable results, awards, delivery metrics)
- cpars_rating: "exceptional" | "very_good" | "satisfactory" | "marginal" | "unsatisfactory" | null
- tags: string[] (free-form taxonomy tags like "design-build", "renovation", "federal")

Extract 1-5 records. Return ONLY the JSON array, no explanation.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract past performance records from this text:\n\n${text}`,
      },
    ],
    system: systemPrompt,
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }

  let records: unknown[]
  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    records = JSON.parse(jsonMatch[0])
    if (!Array.isArray(records) || records.length === 0) throw new Error('Empty result')
  } catch {
    return NextResponse.json({ error: 'Could not parse extracted records' }, { status: 500 })
  }

  return NextResponse.json({ records: records.slice(0, 5) })
}
