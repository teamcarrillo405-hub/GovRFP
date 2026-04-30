'use client'

import dynamic from 'next/dynamic'

const AddinShell = dynamic(
  () => import('@/components/addin/AddinShell').then(m => m.AddinShell),
  { ssr: false },
)

export default function TaskpanePage() {
  return <AddinShell />
}
