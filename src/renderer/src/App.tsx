import { useState, useRef, useEffect, type ReactElement } from 'react'
import { useAppStore, type Screen } from './store/appStore'
import LoginScreen from './screens/Login'
import DashboardScreen from './screens/Dashboard'
import ProductMasterScreen from './screens/ProductMaster'
import BulkInventoryScreen from './screens/BulkInventory'
import PackingScreen from './screens/Packing'
import RetailPacketInventoryScreen from './screens/RetailPacketInventory'
import PriceMenuScreen from './screens/PriceMenu'
import LabelPrintingScreen from './screens/LabelPrinting'
import RetailBillingScreen from './screens/RetailBilling'
import WholesaleBillingScreen from './screens/WholesaleBilling'
import CustomersScreen from './screens/Customers'
import PurchaseEntryScreen from './screens/PurchaseEntry'
import ExpensesScreen from './screens/Expenses'
import ReportsScreen from './screens/Reports'
import InvoiceHistoryScreen from './screens/InvoiceHistory'
import SettingsScreen from './screens/Settings'

const screens = {
  Login: LoginScreen,
  Dashboard: DashboardScreen,
  ProductMaster: ProductMasterScreen,
  BulkInventory: BulkInventoryScreen,
  Packing: PackingScreen,
  RetailPacketInventory: RetailPacketInventoryScreen,
  PriceMenu: PriceMenuScreen,
  LabelPrinting: LabelPrintingScreen,
  RetailBilling: RetailBillingScreen,
  WholesaleBilling: WholesaleBillingScreen,
  Customers: CustomersScreen,
  PurchaseEntry: PurchaseEntryScreen,
  Expenses: ExpensesScreen,
  Reports: ReportsScreen,
  InvoiceHistory: InvoiceHistoryScreen,
  Settings: SettingsScreen
} as const

// ── Navigation structure ──────────────────────────────────────────────────────

type TabId = 'dashboard' | 'retail' | 'wholesale' | 'inventory' | 'reports' | 'settings'

interface TabDef {
  id: TabId
  label: string
  icon: ReactElement
  screen?: Screen          // single-screen tab
  children?: { label: string; screen: Screen }[]  // multi-screen tab
}

const tabs: TabDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    screen: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    id: 'retail',
    label: 'Retail',
    screen: 'RetailBilling',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    )
  },
  {
    id: 'wholesale',
    label: 'Wholesale',
    screen: 'WholesaleBilling',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    )
  },
  {
    id: 'inventory',
    label: 'Inventory',
    children: [
      { label: 'Bulk Inventory', screen: 'BulkInventory' },
      { label: 'Packing', screen: 'Packing' },
      { label: 'Retail Packets', screen: 'RetailPacketInventory' },
      { label: 'Product Master', screen: 'ProductMaster' },
      { label: 'Price Menu', screen: 'PriceMenu' },
      { label: 'Label Printing', screen: 'LabelPrinting' }
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    )
  },
  {
    id: 'reports',
    label: 'Reports',
    screen: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    screen: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  }
]

// ── Which tab is active for a given screen ────────────────────────────────────
function activeTabFor(screen: Screen): TabId {
  for (const tab of tabs) {
    if (tab.screen === screen) return tab.id
    if (tab.children?.some((c) => c.screen === screen)) return tab.id
  }
  return 'dashboard'
}

// ── Bottom tab bar component ──────────────────────────────────────────────────
function BottomNav({ currentScreen, navigate, user, logout }: {
  currentScreen: Screen
  navigate: (s: Screen) => void
  user: { name: string; role: string } | null
  logout: () => void
}): ReactElement {
  const [openMenu, setOpenMenu] = useState<TabId | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeTab = activeTabFor(currentScreen)

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  function handleTabClick(tab: TabDef): void {
    if (tab.children) {
      setOpenMenu(openMenu === tab.id ? null : tab.id)
    } else if (tab.screen) {
      setOpenMenu(null)
      navigate(tab.screen)
    }
  }

  function handleSubNav(screen: Screen): void {
    setOpenMenu(null)
    navigate(screen)
  }

  return (
    <div ref={menuRef}>
      {/* Sub-menu popover */}
      {openMenu && (() => {
        const tab = tabs.find((t) => t.id === openMenu)
        if (!tab?.children) return null
        const tabIdx = tabs.indexOf(tab)
        const totalTabs = tabs.length
        const isRightHalf = tabIdx >= totalTabs / 2
        return (
          <div
            style={{
              position: 'fixed',
              bottom: 72,
              left: isRightHalf ? 'auto' : `calc(${(tabIdx / totalTabs) * 100}% + 4px)`,
              right: isRightHalf ? `calc(${((totalTabs - 1 - tabIdx) / totalTabs) * 100}% + 4px)` : 'auto',
              minWidth: 200,
              zIndex: 50,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: '0.25rem',
              backdropFilter: 'blur(20px)',
            }}
          >
            {tab.children.map((item) => (
              <button
                key={item.screen}
                onClick={() => handleSubNav(item.screen)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.875rem',
                  fontWeight: currentScreen === item.screen ? 600 : 400,
                  color: currentScreen === item.screen ? 'var(--accent)' : 'var(--ink-1)',
                  background: currentScreen === item.screen ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  display: 'block',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => {
                  if (currentScreen !== item.screen)
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-fill)'
                }}
                onMouseLeave={(e) => {
                  if (currentScreen !== item.screen)
                    (e.currentTarget as HTMLButtonElement).style.background = currentScreen === item.screen ? 'var(--accent-soft)' : 'transparent'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Bottom bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 40,
          display: 'flex',
          alignItems: 'stretch',
          background: 'oklch(0.2 0.014 260 / 0.92)',
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* User pill */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 12, gap: 10, borderRight: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-1)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const isOpen = openMenu === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '0 8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  color: isActive || isOpen ? 'var(--accent)' : 'var(--ink-4)',
                  transition: 'color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isOpen) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isOpen) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-4)'
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 32, height: 2, borderRadius: '0 0 2px 2px', background: 'var(--accent)' }} />
                )}
                {tab.icon}
                <span style={{ fontSize: '0.625rem', fontWeight: isActive ? 600 : 400, lineHeight: 1, letterSpacing: '0.01em' }}>
                  {tab.label}{tab.children ? ' ›' : ''}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sign out */}
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 16, paddingLeft: 12, borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={logout}
            title="Sign out"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.375rem 0.75rem', borderRadius: 'var(--r-sm)', background: 'transparent', border: 'none', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-3)', cursor: 'pointer', transition: 'background 120ms ease, color 120ms ease' }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'oklch(0.24 0.065 25)'; el.style.color = 'var(--red)' }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.color = 'var(--ink-3)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App(): ReactElement {
  const { currentScreen, user, navigate, logout } = useAppStore()

  if (!user && currentScreen !== 'Login') {
    navigate('Login')
    return <LoginScreen />
  }

  const Screen = screens[currentScreen]

  if (currentScreen === 'Login') {
    return <Screen />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink-1)', paddingBottom: 96 }}>
      <main>
        <Screen />
      </main>
      <BottomNav currentScreen={currentScreen} navigate={navigate} user={user} logout={logout} />
    </div>
  )
}
