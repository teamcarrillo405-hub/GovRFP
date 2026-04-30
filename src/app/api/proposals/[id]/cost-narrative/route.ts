import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const maxDuration = 60

interface CostItem {
  labor_category: string
  cost_type: string
  rate_per_hour: number
  hours: number
}

interface CostSettings {
  fee_pct: number
  overhead_rate: number
  g_and_a_rate: number
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params
  const supabase = await createClient()

  // Load cost items
  const { data: items, error: itemsError } = await supabase
    .from('proposal_cost_items' as any)
    .select('labor_category, cost_type, rate_per_hour, hours')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to load cost items' }, { status: 500 })
  }

  // Load cost settings
  const { data: settingsRow } = await supabase
    .from('proposal_cost_settings' as any)
    .select('fee_pct, overhead_rate, g_and_a_rate')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  const settings: CostSettings = {
    fee_pct: (settingsRow as CostSettings | null)?.fee_pct ?? 10,
    overhead_rate: (settingsRow as CostSettings | null)?.overhead_rate ?? 0,
    g_and_a_rate: (settingsRow as CostSettings | null)?.g_and_a_rate ?? 0,
  }

  const costItems = (items ?? []) as CostItem[]

  // Compute totals
  const directItems = costItems.filter((i) => i.cost_type === 'direct')
  const totalDirect = directItems.reduce((sum, i) => sum + i.rate_per_hour * i.hours, 0)
  const overhead = totalDirect * (settings.overhead_rate / 100)
  const gAndA = (totalDirect + overhead) * (settings.g_and_a_rate / 100)
  const fee = (totalDirect + overhead + gAndA) * (settings.fee_pct / 100)
  const grandTotal = totalDirect + overhead + gAndA + fee

  // Build labor lines for the prompt
  const laborLines = directItems
    .map((i) => {
      const lineTotal = i.rate_per_hour * i.hours
      return `- ${i.labor_category}: ${i.hours} hours × $${i.rate_per_hour.toFixed(2)}/hr = $${lineTotal.toFixed(2)}`
    })
    .join('\n')

  const userMessage = `Write a cost narrative for the following cost breakdown:

Direct Labor:
${laborLines || '- No direct labor items entered'}

Subtotals:
- Direct Labor Total: $${totalDirect.toFixed(2)}
- Indirect/Overhead (${settings.overhead_rate}%): $${overhead.toFixed(2)}
- G&A (${settings.g_and_a_rate}%): $${gAndA.toFixed(2)}
- Fee/Profit (${settings.fee_pct}%): $${fee.toFixed(2)}
- TOTAL PROPOSED COST: $${grandTotal.toFixed(2)}

Write 2-3 professional paragraphs explaining this cost breakdown, justifying the labor rates, and summarizing the total proposed cost. Reference FAR compliance.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system:
      'You are a government proposal pricing expert. Write a clear, compliant cost proposal narrative. Follow FAR 15.408 Table 15-2 format. Be professional and specific.',
    messages: [{ role: 'user', content: userMessage }],
  })

  const narrative =
    response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ narrative })
}
