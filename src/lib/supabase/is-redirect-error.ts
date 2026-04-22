/**
 * Detect Next.js's redirect() control-flow "error".
 *
 * `redirect()` in a server action throws an Error with
 * digest = "NEXT_REDIRECT;replace;/target/path;..." to signal the
 * navigation to the framework. If a client component swallows this via
 * try/catch, the redirect never fires and the user sees the digest as
 * a regular error. Always re-throw these.
 *
 * Matching helper also catches `notFound()` (digest = "NEXT_NOT_FOUND")
 * for completeness.
 */
export function isRedirectError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const digest = (e as { digest?: unknown }).digest
  if (typeof digest !== 'string') return false
  return digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND'
}
