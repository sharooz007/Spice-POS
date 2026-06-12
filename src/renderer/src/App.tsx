import type { ReactElement } from 'react'
import { useAppStore } from './store/appStore'
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

export default function App(): ReactElement {
  const { currentScreen, user, navigate, logout } = useAppStore()

  // Auth gate: always show Login if no active session
  if (!user && currentScreen !== 'Login') {
    navigate('Login')
    return <LoginScreen />
  }

  const Screen = screens[currentScreen]

  if (currentScreen === 'Login') {
    return <Screen />
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Minimal dev nav — will be replaced with proper sidebar in later phases */}
      <nav className="flex flex-wrap items-center gap-1 p-2 bg-gray-800 text-xs text-white">
        <span className="font-semibold mr-2">
          {user?.name} ({user?.role})
        </span>
        {(Object.keys(screens).filter((s) => s !== 'Login') as Array<keyof typeof screens>).map(
          (s) => (
            <button
              key={s}
              onClick={() => navigate(s)}
              className={`px-2 py-1 rounded cursor-pointer transition-colors duration-150 ${
                currentScreen === s ? 'bg-blue-600' : 'hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          )
        )}
        <button
          onClick={logout}
          className="ml-auto px-2 py-1 bg-red-700 hover:bg-red-600 rounded cursor-pointer transition-colors duration-150"
        >
          Logout
        </button>
      </nav>
      <main>
        <Screen />
      </main>
    </div>
  )
}
