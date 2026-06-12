import { useState, useRef, type FormEvent, type ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'

export default function LoginScreen(): ReactElement {
  const { navigate, setUser } = useAppStore()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!username.trim() || !pin) return
    setLoading(true)
    setError('')
    const result = await window.api.auth.login({ username: username.trim(), pin })
    setLoading(false)
    if (result.ok) {
      setUser(result.user)
      navigate('Dashboard')
    } else {
      setError('Incorrect username or PIN')
      setPin('')
      pinRef.current?.focus()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: '2.5rem 2rem',
        }}
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--r-lg)',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 14px oklch(0.58 0.2 260 / 0.35)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--ink-1)',
              letterSpacing: '-0.02em',
            }}
          >
            Spice Shop POS
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="username"
              style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-2)' }}
            >
              Username
            </label>
            <input
              id="username"
              className="input"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          {/* PIN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="pin"
              style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-2)' }}
            >
              PIN
            </label>
            <input
              id="pin"
              ref={pinRef}
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <p
              role="alert"
              style={{
                fontSize: '0.8125rem',
                color: 'var(--red)',
                textAlign: 'center',
                background: 'oklch(0.97 0.012 25)',
                border: '1px solid oklch(0.9 0.04 25)',
                borderRadius: 'var(--r-sm)',
                padding: '0.5rem 0.75rem',
              }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !username.trim() || !pin}
            style={{ marginTop: '0.5rem', height: '40px', fontSize: '0.9375rem', fontWeight: 600 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
