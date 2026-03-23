import Link from 'next/link'
import { getPastProjects, deletePastProject } from './actions'
import { PastProjectsClient } from '@/components/profile/past-projects-client'

export default async function PastProjectsPage() {
  const projects = await getPastProjects()

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/profile" className="text-sm text-blue-600 hover:text-blue-700">
          &larr; Back to Profile
        </Link>
      </div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Past Projects</h1>
      </div>

      <PastProjectsClient
        projects={projects}
        deletePastProject={deletePastProject}
      />
    </main>
  )
}
