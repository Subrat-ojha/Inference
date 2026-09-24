import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined

if (!authUrl) {
  throw new Error('VITE_NEON_AUTH_URL is required.')
}

const configuredAuthUrl = authUrl

export const authClient = createAuthClient(configuredAuthUrl, {
  adapter: BetterAuthVanillaAdapter({
    fetchOptions: { credentials: 'include' },
  }),
})

export class AuthSessionError extends Error {
  name = 'AuthSessionError'
}

export async function getAccessToken(): Promise<string> {
  const response = await fetch(`${configuredAuthUrl.replace(/\/$/, '')}/token`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null) as { token?: unknown } | null
  if (!response.ok || typeof payload?.token !== 'string') {
    throw new AuthSessionError('Your session has expired. Sign in again.')
  }
  return payload.token
}
