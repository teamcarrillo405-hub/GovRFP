export interface WebhookPayload {
  slackWebhookUrl: string | null
  teamsWebhookUrl: string | null
  message: string
  title: string
  color?: string
  fields?: Array<{ label: string; value: string }>
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export async function sendWebhookNotification(payload: WebhookPayload): Promise<void> {
  const { slackWebhookUrl, teamsWebhookUrl, message, title, fields } = payload

  const sends: Promise<void>[] = []

  if (slackWebhookUrl) {
    sends.push(sendSlack(slackWebhookUrl, title, message, fields))
  }

  if (teamsWebhookUrl) {
    sends.push(sendTeams(teamsWebhookUrl, title, message, fields))
  }

  await Promise.all(sends)
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

async function sendSlack(
  url: string,
  title: string,
  message: string,
  fields?: Array<{ label: string; value: string }>,
): Promise<void> {
  try {
    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: title },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: message },
      },
    ]

    if (fields && fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.map((f) => ({
          type: 'mrkdwn',
          text: `*${f.label}*\n${f.value}`,
        })),
      })
    }

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: title, blocks }),
    })
  } catch {
    // fire-and-forget — never break proposal workflows
  }
}

// ---------------------------------------------------------------------------
// Microsoft Teams
// ---------------------------------------------------------------------------

async function sendTeams(
  url: string,
  title: string,
  message: string,
  fields?: Array<{ label: string; value: string }>,
): Promise<void> {
  try {
    const body: unknown[] = [
      {
        type: 'TextBlock',
        size: 'Medium',
        weight: 'Bolder',
        text: title,
      },
      {
        type: 'TextBlock',
        text: message,
        wrap: true,
      },
    ]

    if (fields && fields.length > 0) {
      body.push({
        type: 'FactSet',
        facts: fields.map((f) => ({ title: f.label, value: f.value })),
      })
    }

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard',
              version: '1.2',
              body,
            },
          },
        ],
      }),
    })
  } catch {
    // fire-and-forget — never break proposal workflows
  }
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

export function buildTaskAssignedMessage(params: {
  proposalTitle: string
  requirementId: string
  requirementText: string
  assigneeName: string
}): { title: string; message: string } {
  const { proposalTitle, requirementId, requirementText, assigneeName } = params
  return {
    title: `Task Assigned — ${proposalTitle}`,
    message: `*${assigneeName}* has been assigned requirement *${requirementId}*.\n\n>${requirementText}`,
  }
}

export function buildDeadlineAlertMessage(params: {
  proposalTitle: string
  dueDate: string
  daysLeft: number
}): { title: string; message: string } {
  const { proposalTitle, dueDate, daysLeft } = params
  return {
    title: `Deadline Alert — ${proposalTitle}`,
    message: `This proposal is due on *${dueDate}* — *${daysLeft} day${daysLeft === 1 ? '' : 's'}* remaining. Review and finalize your draft before the deadline.`,
  }
}

export function buildStatusChangeMessage(params: {
  proposalTitle: string
  newStatus: string
}): { title: string; message: string } {
  const { proposalTitle, newStatus } = params
  return {
    title: `Status Updated — ${proposalTitle}`,
    message: `The proposal status has changed to *${newStatus}*.`,
  }
}
