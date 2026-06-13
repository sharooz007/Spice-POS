import type { ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'

export default function SettingsScreen(): ReactElement {
  const { user, logout, navigate } = useAppStore()

  return (
    <div className="page">
      <div>
        <h1>Settings</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>App preferences and account</p>
      </div>

      {/* Modules */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--ink-2)' }}>Additional Modules</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('Customers')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '0.625rem', padding: '1.25rem 1rem', background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xs)', color: 'var(--ink-1)',
              cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em',
              transition: 'opacity 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: 'var(--blue)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Customers
          </button>
          
          <button
            onClick={() => navigate('PurchaseEntry')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '0.625rem', padding: '1.25rem 1rem', background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-xs)', color: 'var(--ink-1)',
              cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em',
              transition: 'opacity 120ms ease, transform 120ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: 'var(--purple)' }}>
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            Purchase Entry
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.875rem', marginBottom: 0, color: 'var(--ink-2)' }}>Account</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: '0.9375rem' }}>{user?.name}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>
        <hr className="divider" />
        <div>
          <button className="btn btn-danger" onClick={logout} style={{ width: '100%', maxWidth: 200 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--ink-2)' }}>About</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            ['Application', 'Spice Shop POS'],
            ['Version', '1.0'],
            ['Database', 'SQLite (local)'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--ink-3)' }}>{k}</span>
              <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
