import { create } from 'zustand'
import type { AuthUser } from '@shared/types'

export type Screen =
  | 'Login'
  | 'Dashboard'
  | 'ProductMaster'
  | 'BulkInventory'
  | 'Packing'
  | 'RetailPacketInventory'
  | 'PriceMenu'
  | 'LabelPrinting'
  | 'RetailBilling'
  | 'WholesaleBilling'
  | 'Customers'
  | 'PurchaseEntry'
  | 'Expenses'
  | 'Reports'
  | 'InvoiceHistory'
  | 'Settings'
  | 'Factory'
  | 'OutsideProducts'

interface AppState {
  currentScreen: Screen
  user: AuthUser | null // no raw PIN ever stored here
  navigate: (screen: Screen) => void
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentScreen: 'Login',
  user: null,
  navigate: (screen) => set({ currentScreen: screen }),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, currentScreen: 'Login' })
}))
