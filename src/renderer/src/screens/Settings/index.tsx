import { useState, useEffect, type ReactElement, type FormEvent } from 'react'
import { useAppStore } from '../../store/appStore'

type Tab = 'general' | 'hardware' | 'backup' | 'users' | 'advanced'

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-1)', fontSize: '0.875rem' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

export default function SettingsScreen(): ReactElement {
  const { user, logout, navigate } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [printers, setPrinters] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  
  // Users modal
  const [showAddUser, setShowAddUser] = useState(false)
  const [showChangePin, setShowChangePin] = useState<{id: number, name: string} | null>(null)
  
  const loadData = async () => {
    const sRes = await window.api.settings.getAll()
    if (sRes.ok) setSettings(sRes.data)
    
    const bRes = await window.api.backup.list()
    if (bRes.ok) setBackups(bRes.data)
    
    const uRes = await window.api.users.list()
    if (uRes.ok) setUsersList(uRes.data)
  }

  useEffect(() => { loadData() }, [])

  const setSetting = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.api.settings.set({ key, value })
  }

  const handleDetectPrinters = async () => {
    const res = await window.api.print.listPrinters()
    if (res.ok) setPrinters(res.data)
  }

  const handleBackupNow = async () => {
    const res = await window.api.backup.create('manual')
    if (res.ok) {
      const bRes = await window.api.backup.list()
      if (bRes.ok) setBackups(bRes.data)
    }
  }

  const handleSelectFolder = async (key: string) => {
    const res = await window.api.backup.selectFolder()
    if (res.ok && res.data) {
      setSetting(key, res.data)
    }
  }

  const handleRestore = async (filePath: string) => {
    if (confirm('Are you sure you want to restore this backup? Current data will be replaced.')) {
      const res = await window.api.backup.restore(filePath)
      if (res.ok) {
        alert('Restore successful! The app will now reload.')
        window.location.reload()
      } else {
        alert('Restore failed: ' + res.error)
      }
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (id === user?.id) {
      alert("You cannot delete your own account.")
      return
    }
    if (confirm('Are you sure you want to delete this user?')) {
      await window.api.users.delete({ id, userId: user!.id })
      loadData()
    }
  }

  const handleResetDemoData = async () => {
    if (confirm('DANGER: This will delete ALL current data and replace it with demo data. Proceed?')) {
      const res = await window.api.settings.resetDemo(user!.id)
      if (res.ok) {
        alert('Demo data seeded. App will restart.')
        window.location.reload()
      } else {
        alert('Failed to reset demo data: ' + res.error)
      }
    }
  }

  const handleClearAllData = async () => {
    if (confirm('DANGER: This will delete ALL data (except users and settings) to start fresh. An emergency backup will be taken first. Proceed?')) {
      if (confirm('Are you ABSOLUTELY sure? This action cannot be undone.')) {
        const res = await window.api.settings.clearAllData(user!.id)
        if (res.ok) {
          alert('Data cleared successfully. App will restart.')
          window.location.reload()
        } else {
          alert('Failed to clear data: ' + res.error)
        }
      }
    }
  }

  const AddUserModal = () => {
    const [name, setName] = useState('')
    const [role, setRole] = useState('staff')
    const [pin, setPin] = useState('')
    
    const submit = async (e: FormEvent) => {
      e.preventDefault()
      await window.api.users.create({ name, role, pin })
      setShowAddUser(false)
      loadData()
    }
    
    return (
      <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add User</h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={selectStyle} value={role} onChange={e => setRole(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>PIN</label>
              <input style={inputStyle} type="password" value={pin} onChange={e => setPin(e.target.value)} required minLength={4} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const ChangePinModal = () => {
    const [pin, setPin] = useState('')
    
    const submit = async (e: FormEvent) => {
      e.preventDefault()
      await window.api.users.updatePin({ id: showChangePin!.id, pin })
      setShowChangePin(null)
    }
    
    return (
      <div className="modal-overlay" onClick={() => setShowChangePin(null)}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Change PIN for {showChangePin!.name}</h3>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>New PIN</label>
              <input style={inputStyle} type="password" value={pin} onChange={e => setPin(e.target.value)} required minLength={4} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowChangePin(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Update</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab, label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'backup', label: 'Backup' },
    { id: 'users', label: 'Users' },
    { id: 'advanced', label: 'Advanced' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 96px)', background: 'var(--bg-base)', padding: '1.25rem', gap: '1rem' }}>
      {showAddUser && <AddUserModal />}
      {showChangePin && <ChangePinModal />}
      
      <div style={{ flexShrink: 0, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>App preferences, hardware, and account management</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                textAlign: 'left', padding: '0.625rem 1rem', borderRadius: 'var(--r-md)',
                background: activeTab === t.id ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--ink-2)',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontSize: '0.875rem', border: 'none', cursor: 'pointer',
                transition: 'background 120ms ease'
              }}
              onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.background = 'var(--bg-fill)' }}
              onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.background = 'transparent' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
          
          {activeTab === 'general' && (
            <>
              {/* Shop Info */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, marginBottom: '1rem', color: 'var(--ink-1)' }}>Shop Info</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Shop Name</label>
                    <input style={inputStyle} value={settings['shop_name'] || ''} onChange={e => setSetting('shop_name', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={settings['shop_address'] || ''} onChange={e => setSetting('shop_address', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input style={inputStyle} value={settings['shop_phone'] || ''} onChange={e => setSetting('shop_phone', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Additional Modules (from old file) */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, marginBottom: '1rem', color: 'var(--ink-1)' }}>Additional Modules</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <button onClick={() => navigate('Customers')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '1.25rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)', color: 'var(--ink-1)', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em', transition: 'opacity 120ms ease, transform 120ms ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: 'var(--blue)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    Customers
                  </button>
                  <button onClick={() => navigate('PurchaseEntry')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '1.25rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)', color: 'var(--ink-1)', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em', transition: 'opacity 120ms ease, transform 120ms ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: 'var(--purple)' }}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                    Purchase Entry
                  </button>
                </div>
              </div>

              {/* Account (from old file) */}
              <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, margin: 0, color: 'var(--ink-1)' }}>Account</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink-1)', fontSize: '0.9375rem' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', textTransform: 'capitalize' }}>{user?.role}</div>
                  </div>
                </div>
                <hr className="divider" />
                <div><button className="btn btn-danger" onClick={logout} style={{ width: '100%', maxWidth: 200 }}>Sign out</button></div>
              </div>

              {/* About (from old file) */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, marginBottom: '0.75rem', color: 'var(--ink-1)' }}>About</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[['Application', 'Spice Shop POS'], ['Version', '1.0'], ['Database', 'SQLite (local)']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                      <span style={{ color: 'var(--ink-1)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'hardware' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink-1)', margin: 0 }}>Printers</h2>
                <button className="btn btn-secondary" onClick={handleDetectPrinters}>Detect Printers</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Receipt Printer</label>
                    <select style={selectStyle} value={settings['receipt_printer'] || ''} onChange={e => setSetting('receipt_printer', e.target.value)}>
                      <option value="">Select a printer...</option>
                      {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Receipt Size</label>
                    <select style={selectStyle} value={settings['receipt_size'] || '80mm'} onChange={e => setSetting('receipt_size', e.target.value)}>
                      <option value="58mm">58mm</option>
                      <option value="80mm">80mm</option>
                    </select>
                  </div>
                </div>
                
                <hr className="divider" style={{ margin: 0 }} />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Label Printer</label>
                    <select style={selectStyle} value={settings['label_printer'] || ''} onChange={e => setSetting('label_printer', e.target.value)}>
                      <option value="">Select a printer...</option>
                      {printers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Label Size</label>
                    <select style={selectStyle} value={settings['label_size'] || '50x25'} onChange={e => setSetting('label_size', e.target.value)}>
                      <option value="50x25">50mm x 25mm</option>
                      <option value="40x20">40mm x 20mm</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink-1)', margin: 0 }}>Backup Configuration</h2>
                  <button className="btn btn-primary" onClick={handleBackupNow}>Back up now</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Primary Folder</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input style={{ ...inputStyle, flex: 1 }} readOnly value={settings['backup_primary_folder'] || ''} placeholder="Not configured" />
                      <button className="btn btn-secondary" onClick={() => handleSelectFolder('backup_primary_folder')}>Browse</button>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Secondary Folder</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input style={{ ...inputStyle, flex: 1 }} readOnly value={settings['backup_secondary_folder'] || ''} placeholder="Not configured" />
                      <button className="btn btn-secondary" onClick={() => handleSelectFolder('backup_secondary_folder')}>Browse</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input type="checkbox" id="autoBackup" checked={settings['auto_backup_enabled'] === 'true'} onChange={e => setSetting('auto_backup_enabled', e.target.checked ? 'true' : 'false')} />
                    <label htmlFor="autoBackup" style={{ fontSize: '0.875rem', color: 'var(--ink-1)', cursor: 'pointer' }}>Enable auto-backup on exit</label>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink-1)', marginBottom: '1rem' }}>Backup History</h2>
                {backups.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>No backups found.</p>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>Date</th>
                        <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>File</th>
                        <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>Size</th>
                        <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map(b => (
                        <tr key={b.filePath}>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-1)' }}>{new Date(b.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{b.fileName}</td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                          <td style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleRestore(b.filePath)}>Restore</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink-1)', margin: 0 }}>System Users</h2>
                <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>+ Add User</button>
              </div>
              
              <table style={{ width: '100%', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>Username</th>
                    <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)' }}>Role</th>
                    <th style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--ink-1)' }}>{u.name} {u.id === user?.id && '(You)'}</td>
                      <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)', textTransform: 'capitalize' }}>{u.role}</td>
                      <td style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }} onClick={() => setShowChangePin({ id: u.id, name: u.name })}>Change PIN</button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} disabled={u.id === user?.id} onClick={() => handleDeleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--red)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--red)', marginBottom: '1rem' }}>Danger Zone</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-1)' }}>Reset to Demo Data</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Wipes all current transactions and seeds demo data.</div>
                  {settings['demo_seeded'] === 'true' && <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.125rem', fontWeight: 500 }}>Demo data is currently seeded.</div>}
                </div>
                <button className="btn btn-danger" onClick={handleResetDemoData}>Reset Data</button>
              </div>
              <hr className="divider" style={{ margin: '1rem 0', borderColor: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-1)' }}>Clear All Data</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '0.125rem' }}>Completely wipes the database to start fresh (an emergency backup is created first).</div>
                </div>
                <button className="btn btn-danger" onClick={handleClearAllData}>Clear Data</button>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  )
}
