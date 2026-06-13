import type { ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'

export default function SettingsScreen(): ReactElement {
  const { user, logout } = useAppStore()

  return (
    <div className="page">
      <div>
        <h1>Settings</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', marginTop: '0.25rem' }}>App preferences and account</p>
      </div>

      {/* Account */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <h2 style={{ fontSize: '0.875rem', marginBottom: 0 }}>Account</h2>
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
        <h2 style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>About</h2>
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
