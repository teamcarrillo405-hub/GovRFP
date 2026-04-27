import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/app/(dashboard)/profile/actions'
import OnboardingWizard from './OnboardingWizard'

export const metadata = {
  title: 'Profile Setup | Avero GovTool',
}

export default async function OnboardingPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.onboarding_completed === true) redirect('/dashboard')

  return <OnboardingWizard />
}
