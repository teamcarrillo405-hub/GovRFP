import Link from 'next/link'
import { getProfile } from './actions'
import { ProfileForm } from '@/components/profile/profile-form'
import type { ProfileFormData } from '@/lib/validators/profile'

export default async function ProfilePage() {
  const profile = await getProfile() as Partial<ProfileFormData> | null

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contractor Profile</h1>
      </div>

      {/* Sub-section navigation */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/profile/past-projects"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Past Projects
        </Link>
        <Link
          href="/profile/key-personnel"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Key Personnel
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Company Information</h2>
        <ProfileForm initialData={profile} />
      </div>
    </main>
  )
}
