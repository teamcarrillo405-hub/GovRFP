import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { sendWebhookNotification } from '@/lib/notifications/webhook'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// GET — load notification settings for current user + proposal
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: proposalId } = await params

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('notifications GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }

  return NextResponse.json({ settings: data ?? null })
}

// ---------------------------------------------------------------------------
// POST — upsert notification settings + send test notification
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: proposalId } = await params

  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    slack_webhook_url?: string | null
    teams_webhook_url?: string | null
    notify_task_assign?: boolean
    notify_deadline?: boolean
    notify_status?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch proposal title for the test notification
  const { data: proposal } = await supabase
    .from('proposals')
    .select('title')
    .eq('id', proposalId)
    .single()

  const upsertPayload = {
    proposal_id: proposalId,
    user_id: user.id,
    slack_webhook_url: body.slack_webhook_url ?? null,
    teams_webhook_url: body.teams_webhook_url ?? null,
    notify_task_assign: body.notify_task_assign ?? true,
    notify_deadline: body.notify_deadline ?? true,
    notify_status: body.notify_status ?? true,
    updated_at: new Date().toISOString(),
  }

  const { data: saved, error } = await supabase
    .from('notification_settings')
    .upsert(upsertPayload, { onConflict: 'proposal_id,user_id' })
    .select()
    .single()

  if (error) {
    console.error('notifications POST error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  // Send test notification to both webhooks (fire-and-forget)
  const proposalTitle = proposal?.title ?? 'your proposal'
  await sendWebhookNotification({
    slackWebhookUrl: body.slack_webhook_url ?? null,
    teamsWebhookUrl: body.teams_webhook_url ?? null,
    title: 'Avero GovTool — Notifications Configured',
    message: `Avero GovTool notifications configured for: *${proposalTitle}*`,
  })

  return NextResponse.json({ settings: saved })
}
