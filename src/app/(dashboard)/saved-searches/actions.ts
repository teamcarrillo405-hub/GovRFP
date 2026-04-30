'use server'

import { revalidatePath } from 'next/cache'
import {
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  type SavedSearchInput,
} from '@/lib/saved-searches'

export async function saveSearchAction(input: SavedSearchInput) {
  const result = await createSavedSearch(input)
  revalidatePath('/saved-searches')
  revalidatePath('/opportunities')
  return result
}

export async function updateSearchAction(id: string, patch: Partial<SavedSearchInput>) {
  const result = await updateSavedSearch(id, patch)
  revalidatePath('/saved-searches')
  return result
}

export async function deleteSearchAction(id: string) {
  await deleteSavedSearch(id)
  revalidatePath('/saved-searches')
}

export async function toggleAlertsAction(id: string, enabled: boolean) {
  const result = await updateSavedSearch(id, { alerts_enabled: enabled })
  revalidatePath('/saved-searches')
  return result
}
