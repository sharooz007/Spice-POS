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
      setError(result.error)
      setPin('')
      pinRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm flex flex-col gap-5"
      >
        <h1 className="text-2xl font-bold text-gray-800 text-center">Spice Shop POS</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pin" className="text-sm font-medium text-gray-700">
            PIN
          </label>
          <input
            id="pin"
            ref={pinRef}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 text-center">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !pin}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg py-2 cursor-pointer transition-colors duration-150"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
