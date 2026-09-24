import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters'

// Neon Auth's client URL is public (like the API URL), so keeping a deployed
// fallback makes static hosts work even when they do not receive local .env files.
const DEFAULT_NEON_AUTH_URL =
  'https://ep-raspy-bonus-b5fun27l.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth'
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
