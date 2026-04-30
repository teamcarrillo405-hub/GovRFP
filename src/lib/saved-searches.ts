import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { SavedSearch, SavedSearchInput } from '@/lib/saved-searches-types'

export {
  paramsToFilters,
  summarizeFilters,
  type SavedSearch,
  type SavedSearchInput,
} from '@/lib/saved-searches-types'

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as SavedSearch[]
}

export async function getSavedSearch(id: string): Promise<SavedSearch | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('id', id)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data as SavedSearch
}

export async function createSavedSearch(input: SavedSearchInput): Promise<SavedSearch> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      filters: input.filters,
      alerts_enabled: input.alerts_enabled ?? true,
    })
    .select()
    .single()

  if (error) throw error
  return data as SavedSearch
}

export async function updateSavedSearch(
  id: string,
  patch: Partial<SavedSearchInput>,
): Promise<SavedSearch> {
  const supabase = await createClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.filters !== undefined) update.filters = patch.filters
  if (patch.alerts_enabled !== undefined) update.alerts_enabled = patch.alerts_enabled

  const { data, error } = await supabase
    .from('saved_searches')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as SavedSearch
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('saved_searches').delete().eq('id', id)
  if (error) throw error
}
