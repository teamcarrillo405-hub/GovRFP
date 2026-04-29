import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PAGES_TO_TRY = ['', '/about', '/about-us', '/services', '/our-work', '/projects', '/who-we-are']

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{3,}/g, '  ')
    .trim()
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProposalBot/1.0)' },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return ''
  const html = await res.text()
  return stripHtml(html).slice(0, 3000)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json() as { url: string }
  if (!url) return Response.json({ error: 'URL required' }, { status: 400 })

  // Normalize URL
  let base: string
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    base = `${parsed.protocol}//${parsed.host}`
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Fetch homepage + sub-pages concurrently, ignore failures
  const texts = await Promise.allSettled(
    PAGES_TO_TRY.map((path) => fetchPage(`${base}${path}`))
  )

  const combined = texts
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value.length > 50)
    .map((r) => r.value)
    .join('\n\n---\n\n')
    .slice(0, 12000)

  if (combined.length < 100) {
    return Response.json({ error: 'Could not read website content. Make sure the URL is correct and publicly accessible.' }, { status: 422 })
  }

  // Claude extraction
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are extracting structured business information from a government contractor's website to pre-fill their proposal profile.

WEBSITE CONTENT:
${combined}

Extract what you can find. Return ONLY valid JSON with these exact fields (use null for fields you cannot confidently determine):

{
  "company_name": string | null,
  "capability_statement": string | null,  // 1-3 sentence summary of what they do, max 300 chars
  "differentiators": string | null,       // what makes them stand out, max 300 chars
  "construction_types": string[],         // only values from: ["building","heavy_civil","highway","residential","specialty_trade","electrical","mechanical","environmental"]
  "certifications": string[],             // only values from: ["8(a)","HUBZone","SDVOSB","WOSB","SDB"]
  "geographic_states": string[],          // 2-letter US state codes they serve
  "years_in_business": number | null,
  "employee_count": number | null
}

Rules:
- Only include certifications explicitly mentioned on the website
- Only include construction_types that match actual services described
- For capability_statement: write it in first person ("We provide...") based on their actual services
- Do not invent information not present on the website`
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  let extracted: Record<string, unknown>
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    return Response.json({ error: 'Failed to parse website data' }, { status: 500 })
  }

  return Response.json({ extracted, pages_read: texts.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<string>).value.length > 50).length })
}
