'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient, getUser } from '@/lib/supabase/server'

export async function createSnippet(formData: FormData): Promise<void> {
  const user = await getUser()
  if (!user) redirect('/login')

  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const category = (formData.get('category') as string) ?? 'general'
  const tagsRaw = (formData.get('tags') as string) ?? ''
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
  const naicsRaw = (formData.get('naics_codes') as string) ?? ''
  const naics_codes = naicsRaw.split(',').map(t => t.trim()).filter(Boolean)

  if (!title || !body) return

  const supabase = await createClient()
  await (supabase as any)
    .from('content_snippets')
    .insert({ user_id: user.id, title, body, category, tags, naics_codes })

  revalidatePath('/library')
}

export async function deleteSnippet(id: string) {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  await (supabase as any)
    .from('content_snippets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath('/library')
}

export async function incrementUseCount(id: string) {
  const supabase = await createClient()
  await (supabase as any).rpc('increment_snippet_use_count', { snippet_id: id })
}

export async function saveEditorSelectionAsSnippet(
  title: string,
  body: string,
  category: string,
  proposalId?: string,
  sectionName?: string,
) {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('content_snippets')
    .insert({
      user_id: user.id,
      title,
      body,
      category,
      tags: [],
      naics_codes: [],
      source_proposal_id: proposalId ?? null,
      source_section_name: sectionName ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/library')
  return { success: true, id: data.id }
}
