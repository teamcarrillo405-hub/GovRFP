export function extractBearer(req: Request): string | null {
  const header = req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice(7)
}
