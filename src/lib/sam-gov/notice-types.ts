export interface NoticeType {
  code: string
  label: string
  isActiveSolicitation: boolean
}

export const NOTICE_TYPES: readonly NoticeType[] = [
  { code: 'Solicitation', label: 'Solicitation', isActiveSolicitation: true },
  { code: 'Combined Synopsis/Solicitation', label: 'Combined Synopsis/Solicitation', isActiveSolicitation: true },
  { code: 'Presolicitation', label: 'Presolicitation', isActiveSolicitation: true },
  { code: 'Sources Sought', label: 'Sources Sought', isActiveSolicitation: false },
  { code: 'Special Notice', label: 'Special Notice', isActiveSolicitation: false },
  { code: 'Award Notice', label: 'Award Notice', isActiveSolicitation: false },
  { code: 'Justification', label: 'Justification', isActiveSolicitation: false },
  { code: 'Intent to Bundle', label: 'Intent to Bundle', isActiveSolicitation: false },
  { code: 'Sale of Surplus Property', label: 'Sale of Surplus Property', isActiveSolicitation: true },
  { code: 'Foreign Government', label: 'Foreign Government', isActiveSolicitation: false },
] as const

const BY_CODE = new Map(NOTICE_TYPES.map((t) => [t.code, t]))

export function lookupNoticeType(code: string | null | undefined): NoticeType | null {
  if (!code) return null
  return BY_CODE.get(code.trim()) ?? null
}

export function noticeLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return BY_CODE.get(code.trim())?.label ?? code
}

export function isBiddable(code: string | null | undefined): boolean {
  if (!code) return false
  return BY_CODE.get(code.trim())?.isActiveSolicitation ?? false
}
