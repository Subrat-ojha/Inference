import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters'

// Production traffic goes through the app origin. Some ISP resolvers reject
// Neon's service subdomains even though public DNS resolves them; the Netlify
// proxy keeps authentication reachable without changing the user's DNS.
const DEFAULT_NEON_AUTH_URL = import.meta.env.PROD
  ? `${window.location.origin}/api/neon-auth`
  : 'https://ep-raspy-bonus-b5fun27l.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth'
const configuredAuthUrl = (
  (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)
  || DEFAULT_NEON_AUTH_URL
).replace(/\/$/, '')

export const authClient = createAuthClient(configuredAuthUrl, {
  adapter: BetterAuthVanillaAdapter({
    fetchOptions: { credentials: 'include' },
  }),
})

export class AuthSessionError extends Error {
  name = 'AuthSessionError'
}

export async function getAccessToken(): Promise<string> {
  const response = await fetch(`${configuredAuthUrl}/token`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null) as { token?: unknown } | null
  if (!response.ok || typeof payload?.token !== 'string') {
    throw new AuthSessionError('Your session has expired. Sign in again.')
  }
  return payload.token
}
