import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { authClient } from './auth'

export type SignedInUser = {
  id: string
  email: string
  name: string
}

type AuthGateProps = {
  children: (user: SignedInUser, signOut: () => Promise<void>) => ReactNode
}

type AuthMode = 'sign-in' | 'sign-up' | 'recover'

function messageFrom(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function authErrorMessage(error: unknown, fallback: string): string {
  const message = messageFrom(error, fallback)
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid') && (normalized.includes('password') || normalized.includes('credential'))) {
    return 'That email or password did not match. Check both fields or reset your password.'
  }
  if (normalized.includes('already') && (normalized.includes('user') || normalized.includes('email'))) {
    return 'An account already uses this email. Sign in instead.'
  }
  if (normalized.includes('fetch') || normalized.includes('network')) {
    return 'The auth service could not be reached. Check your connection and try again.'
  }
  return message
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'checking' | 'idle' | 'submitting'>('checking')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false

    authClient.getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return
        if (sessionError) setError(sessionError.message ?? 'We could not check your session.')
        if (data?.user) {
          setUser({ id: data.user.id, email: data.user.email, name: data.user.name })
        }
      })
      .catch((sessionError: unknown) => {
        if (!cancelled) setError(messageFrom(sessionError, 'We could not check your session.'))
      })
      .finally(() => {
        if (!cancelled) setStatus('idle')
      })

    return () => { cancelled = true }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setStatus('submitting')

    try {
      if (mode === 'recover') {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: window.location.origin,
        })
        if (result.error) {
          setError(authErrorMessage(result.error, 'We could not send the reset email. Try again.'))
          return
        }
        setNotice('If an account uses that email, a password-reset message is on its way.')
        return
      }

      const result = mode === 'sign-up'
        ? await authClient.signUp.email({
            email: email.trim(),
            password,
            name: name.trim() || email.split('@')[0] || 'Learner',
          })
        : await authClient.signIn.email({ email: email.trim(), password })

      if (result.error) {
        setError(authErrorMessage(
          result.error,
          `We could not ${mode === 'sign-up' ? 'create your account' : 'sign you in'}.`,
        ))
        return
      }

      const session = await authClient.getSession()
      if (session.error || !session.data?.user) {
        setError(session.error?.message ?? 'Your account is ready, but the session could not be opened.')
        return
      }

      setUser({
        id: session.data.user.id,
        email: session.data.user.email,
        name: session.data.user.name,
      })
      setPassword('')
    } catch (submitError) {
      setError(authErrorMessage(submitError, 'The auth service could not be reached. Try again.'))
    } finally {
      setStatus('idle')
    }
  }

  const signOut = async () => {
    const result = await authClient.signOut()
    if (result.error) throw new Error(result.error.message ?? 'Sign out failed.')
    setUser(null)
    setPassword('')
    setError('')
    setNotice('')
    setMode('sign-in')
  }

  if (status === 'checking') {
    return (
      <main className="auth-shell" aria-busy="true">
        <div className="auth-ledger auth-ledger-loading" role="status">
          <span className="auth-status-mark" aria-hidden="true" />
          <p>Checking your study record…</p>
        </div>
      </main>
    )
  }

  if (user) return <>{children(user, signOut)}</>

  const isSignUp = mode === 'sign-up'
  const isRecovering = mode === 'recover'
  const isSubmitting = status === 'submitting'

  return (
    <main className="auth-shell">
      <section className="auth-ledger" aria-labelledby="auth-title">
        <header className="auth-heading">
          <div>
            <h1 id="auth-title">Inference Engineering</h1>
            <p>Inference + Java backend</p>
          </div>
          <span className="auth-record-code">Private study record</span>
        </header>

        <div className="auth-body">
          <div className="auth-intro">
            <h2>{isSignUp ? 'Start your record.' : isRecovering ? 'Recover access.' : 'Return to your record.'}</h2>
            <p>
              Your stages, practice checks, hours, and notes stay attached to your Neon account across sessions.
            </p>
            <dl className="auth-measures">
              <div><dt>Tracks</dt><dd>02</dd></div>
              <div><dt>Sprints</dt><dd>28</dd></div>
              <div><dt>Scope</dt><dd>1 hour</dd></div>
            </dl>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-mode" role="group" aria-label="Account access">
              <button
                type="button"
                aria-pressed={mode === 'sign-in'}
                className={mode === 'sign-in' ? 'is-selected' : ''}
                disabled={isSubmitting}
                onClick={() => { setMode('sign-in'); setError(''); setNotice('') }}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={isSignUp}
                className={isSignUp ? 'is-selected' : ''}
                disabled={isSubmitting}
                onClick={() => { setMode('sign-up'); setError(''); setNotice('') }}
              >
                Create account
              </button>
            </div>

            {isSignUp && (
              <label className="auth-field">
                <span>Name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  maxLength={80}
                  disabled={isSubmitting}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="How should we address you?"
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                disabled={isSubmitting}
                required
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            {!isRecovering && (
              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  minLength={8}
                  disabled={isSubmitting}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                />
              </label>
            )}

            {mode === 'sign-in' && (
              <button
                className="auth-text-button"
                type="button"
                disabled={isSubmitting}
                onClick={() => { setMode('recover'); setError(''); setNotice('') }}
              >
                Forgot password?
              </button>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? (isSignUp ? 'Creating account…' : isRecovering ? 'Sending reset email…' : 'Signing in…')
                : (isSignUp ? 'Create account' : isRecovering ? 'Send reset email' : 'Open my roadmap')}
            </button>
            {isRecovering && (
              <button
                className="auth-text-button auth-back-button"
                type="button"
                disabled={isSubmitting}
                onClick={() => { setMode('sign-in'); setError(''); setNotice('') }}
              >
                Back to sign in
              </button>
            )}
            <p className="auth-fine-print">
              Managed by Neon Auth. Your identity and study record live in the same branch.
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
