'use server'

import { getUser, createClient } from '@/lib/supabase/server'

export interface SectionComment {
  id: string
  proposal_id: string
  section_name: string
  user_id: string
  author_email: string
  body: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export async function addCommentAction(
  proposalId: string,
  sectionName: string,
  body: string,
): Promise<{ comment: SectionComment }> {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 2000) throw new Error('Invalid comment body')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('section_comments')
    .insert({
      proposal_id: proposalId,
      section_name: sectionName,
      user_id: user.id,
      author_email: user.email ?? 'Unknown',
      body: trimmed,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to add comment')
  return { comment: data as SectionComment }
}

export async function resolveCommentAction(commentId: string): Promise<void> {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { error } = await supabase
    .from('section_comments')
    .update({
      resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', commentId)

  if (error) throw new Error(error.message)
}

export async function deleteCommentAction(commentId: string): Promise<void> {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createClient()
  const { error } = await supabase
    .from('section_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}
