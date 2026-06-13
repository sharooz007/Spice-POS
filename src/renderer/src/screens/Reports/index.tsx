import { Fragment, useState, useEffect, useRef, type ReactElement, type CSSProperties } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency, gramsToKg, formatQuantity } from '@shared/money'
import { MoneyAreaChart, PaymentMethodChart } from '../../components/Charts'
import InvoiceDetailPanel from '../../components/InvoiceDetailPanel'
import ExpenseDetailModal from '../../components/ExpenseDetailModal'
import type {
  DateRange, DailySalesRow, SalesByProductRow, SalesByVariantRow,
  PackingReportRun, ProfitReportRow,
  PaymentBreakdownRow, ExpenseRow, InvoiceRow, BulkArrivalRow, RepaymentReportRow
} from '@shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = 'invoices' | 'daily' | 'byProduct' | 'byVariant' | 'packing' | 'profit' | 'expenses' | 'factory' | 'repayments'
type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string { return new Date().toISOString().slice(0, 10) }
function monthStartStr(): string { return new Date().toISOString().slice(0, 7) + '-01' }
function yesterdayStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
function weekStartStr(): string {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}
function fmtDate(s: string): string {
  if (!s) return ''
  const [y, m, dd] = s.split('-')
  return `${dd}-${m}-${y}`
}

// ─── Design tokens (inline) ───────────────────────────────────────────────────

const T = {
  bg:       '#0f1117',
  surface:  'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  glass:    'rgba(255,255,255,0.06)',
  border:   'rgba(255,255,255,0.10)',
  borderHover: 'rgba(255,255,255,0.18)',
  ink1:     '#f1f5f9',
  ink2:     '#94a3b8',
  ink3:     '#64748b',
  accent:   '#6366f1',
  accentSoft: 'rgba(99,102,241,0.15)',
  green:    '#22c55e',
  greenSoft: 'rgba(34,197,94,0.12)',
  red:      '#f87171',
  redSoft:  'rgba(248,113,113,0.12)',
  amber:    '#f59e0b',
  amberSoft: 'rgba(245,158,11,0.12)',
  purple:   '#a78bfa',
  purpleSoft: 'rgba(167,139,250,0.12)',
  sky:      '#38bdf8',
  skySoft:  'rgba(56,189,248,0.12)',
  shadow:   '0 4px 24px rgba(0,0,0,0.35)',
  shadowSm: '0 2px 8px rgba(0,0,0,0.2)',
  r:        '16px',
  rSm:      '10px',
  rFull:    '9999px',
  font:     '-apple-system, "Inter", "Segoe UI", sans-serif',
  mono:     '"JetBrains Mono", "Fira Code", monospace',
}

// ─── Base components ──────────────────────────────────────────────────────────

function Card({ children, style, onClick }: { children: React.ReactNode; style?: CSSProperties; onClick?: () => void }): ReactElement {
  const [hov, setHov] = useState(false)
  const interactive = Boolean(onClick)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.surface,
        border: `1px solid ${interactive && hov ? T.borderHover : T.border}`,
        borderRadius: T.r,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: T.shadow,
        transition: 'border-color 180ms ease, background 180ms ease',
        transform: 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Pill({
  children, active, onClick, color,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void; color?: string }): ReactElement {
  const [hov, setHov] = useState(false)
  const c = color ?? T.accent
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 16px',
        borderRadius: T.rFull,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: T.font,
        cursor: 'pointer',
        border: active ? 'none' : `1px solid ${T.border}`,
        background: active ? c : hov ? T.surfaceHover : 'transparent',
        color: active ? '#fff' : hov ? T.ink1 : T.ink2,
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Badge({ children, color = T.accent }: { children: React.ReactNode; color?: string }): ReactElement {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: T.rFull,
      fontSize: 11, fontWeight: 600, fontFamily: T.font,
      background: color + '22', color,
      border: `1px solid ${color}44`,
    }}>{children}</span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string; value: string; sub?: string
  icon?: ReactElement; color?: string; accent?: boolean
}
function KpiCard({ label, value, sub, icon, color, accent }: KpiProps): ReactElement {
  const c = color ?? T.accent
  return (
    <div
      style={{
        background: accent ? `linear-gradient(135deg, ${c}cc, ${c}88)` : T.surface,
        border: `1px solid ${accent ? `${c}44` : T.border}`,
        borderRadius: T.r,
        padding: '20px 22px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: T.shadow,
        display: 'flex', flexDirection: 'column', gap: 6,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* background glow */}
      {accent && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: accent ? 'rgba(255,255,255,0.72)' : T.ink3, fontFamily: T.font, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: T.rSm,
            background: accent ? 'rgba(255,255,255,0.15)' : c + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent ? '#fff' : c, flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 26, fontWeight: 700, fontFamily: T.mono,
        color: accent ? '#fff' : T.ink1,
        letterSpacing: '-0.03em', lineHeight: 1,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.55)' : T.ink3, fontFamily: T.font }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ─── Mini SVG icons ───────────────────────────────────────────────────────────

const Icons = {
  revenue: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 0 1-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582ZM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 0 1-.567.267Z"/><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v.56a3.98 3.98 0 0 0-1.046.386c-.598.327-1.204.952-1.204 1.804 0 .852.606 1.477 1.204 1.804.328.179.69.32 1.046.386v1.73a2.51 2.51 0 0 1-.832-.392.75.75 0 1 0-.952 1.158A4.01 4.01 0 0 0 9.25 13.44v.56a.75.75 0 0 0 1.5 0v-.56c.357-.066.718-.207 1.047-.386.598-.327 1.203-.952 1.203-1.804 0-.852-.605-1.477-1.203-1.804a3.98 3.98 0 0 0-1.047-.386v-1.73c.286.073.543.21.832.392a.75.75 0 0 0 .952-1.158 4.012 4.012 0 0 0-1.784-.667V6.75Z" clipRule="evenodd"/></svg>,
  sales: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7 10a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1Zm3 1a1 1 0 0 1 2 0v4a1 1 0 0 1-2 0v-4Zm5-1a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0v-4a1 1 0 0 0-1-1ZM6.293 4.293a1 1 0 0 1 1.414 0L10 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414Z" clipRule="evenodd"/></svg>,
  invoice: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd"/></svg>,
  profit: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/></svg>,
  expense: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z"/></svg>,
  dues: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd"/></svg>,
  retail: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M3 1a1 1 0 0 0 0 2h1.22l.305 1.222a.997.997 0 0 0 .01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 0 0 0-2H6.414l1-1H14a1 1 0 0 0 .894-.553l3-6A1 1 0 0 0 17 3H6.28l-.31-1.243A1 1 0 0 0 5 1H3Z"/></svg>,
  wholesale: <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}><path d="M3.196 12.87l-.825.483a.75.75 0 0 0 0 1.294l7.25 4.25a.75.75 0 0 0 .758 0l7.25-4.25a.75.75 0 0 0 0-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 0 1-2.276 0L3.196 12.87Z"/><path d="m3.196 8.87-.825.483a.75.75 0 0 0 0 1.294l7.25 4.25a.75.75 0 0 0 .758 0l7.25-4.25a.75.75 0 0 0 0-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 0 1-2.276 0L3.196 8.87Z"/><path d="m10.38 1.103-7.25 4.25a.75.75 0 0 0 0 1.294l7.25 4.25a.75.75 0 0 0 .758 0l7.25-4.25a.75.75 0 0 0 0-1.294l-7.25-4.25a.75.75 0 0 0-.758 0Z"/></svg>,
}

// ─── Table helpers ────────────────────────────────────────────────────────────

const thStyle: CSSProperties = {
  padding: '10px 16px',
  fontSize: 11,
  fontWeight: 600,
  color: T.ink3,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: T.font,
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${T.border}`,
  background: 'rgba(255,255,255,0.02)',
}
const tdStyle: CSSProperties = {
  padding: '11px 16px',
  fontSize: 13,
  color: T.ink2,
  fontFamily: T.font,
  borderBottom: `1px solid ${T.border}`,
}
const tdMono: CSSProperties = { ...tdStyle, fontFamily: T.mono, fontWeight: 600, color: T.ink1 }

function TRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }): ReactElement {
  const [hov, setHov] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{ background: hov ? T.surfaceHover : 'transparent', transition: 'background 120ms', cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </tr>
  )
}

// ─── ByVariant grouped component ─────────────────────────────────────────────

function ByVariantGrouped({ groups }: { groups: Array<{ productName: string; rows: SalesByVariantRow[] }> }): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(name: string): void {
    setExpanded((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }
  if (groups.length === 0) return <EmptyState text="No sales in this period." />
  return (
    <div style={{ borderRadius: T.r, overflow: 'hidden', border: `1px solid ${T.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>Product / Variant</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty (pcs)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const totalQty = g.rows.reduce((s, r) => s + r.qtyPcs, 0)
            const totalRev = g.rows.reduce((s, r) => s + r.revenuePaise, 0)
            const open = expanded.has(g.productName)
            return (
              <Fragment key={g.productName}>
                <TRow>
                  <td style={{ ...tdStyle, fontWeight: 600, color: T.ink1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggle(g.productName)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        border: 0,
                        background: 'transparent',
                        color: T.ink1,
                        font: 'inherit',
                        fontWeight: 600,
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <span aria-hidden="true" style={{ color: T.ink3, fontSize: 10 }}>{open ? '▼' : '▶'}</span>
                      {g.productName}
                    </button>
                    <Badge color={T.accent}>{g.rows.length} var</Badge>
                  </td>
                  <td style={{ ...tdMono, textAlign: 'right' }}>{totalQty}</td>
                  <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>{paiseToCurrency(totalRev)}</td>
                </TRow>
                {open && g.rows.map((r) => (
                  <TRow key={r.variantId}>
                    <td style={{ ...tdStyle, paddingLeft: 40, color: T.ink3 }}>{r.label}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.qtyPcs}</td>
                    <td style={{ ...tdMono, textAlign: 'right' }}>{paiseToCurrency(r.revenuePaise)}</td>
                  </TRow>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ text }: { text: string }): ReactElement {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: T.ink3, fontSize: 14, fontFamily: T.font }}>
      {text}
    </div>
  )
}

// ─── Date range input ─────────────────────────────────────────────────────────

function DateInputRow({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }): ReactElement {
  const inputStyle: CSSProperties = {
    padding: '7px 12px', borderRadius: T.rSm, fontSize: 13,
    background: T.surface, border: `1px solid ${T.border}`,
    color: T.ink1, fontFamily: T.font, cursor: 'pointer',
    outline: 'none',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: T.ink3, fontFamily: T.font }}>From</span>
      <input type="date" value={range.dateFrom} onChange={(e) => onChange({ ...range, dateFrom: e.target.value })} style={inputStyle} />
      <span style={{ fontSize: 12, color: T.ink3, fontFamily: T.font }}>To</span>
      <input type="date" value={range.dateTo} onChange={(e) => onChange({ ...range, dateTo: e.target.value })} style={inputStyle} />
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SecHead({ title, action }: { title: string; action?: ReactElement }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.ink1, fontFamily: T.font, letterSpacing: '-0.01em' }}>{title}</h2>
      {action}
    </div>
  )
}

// ─── Action button ───────────────────────────────────────────────────────────

function ActionBtn({ children, icon, onClick }: { children: string; icon?: ReactElement; onClick: () => void }): ReactElement {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        borderRadius: T.rSm, fontSize: 13, fontWeight: 500, fontFamily: T.font,
        background: hov ? T.surfaceHover : T.surface,
        border: `1px solid ${hov ? T.borderHover : T.border}`,
        color: T.ink2, cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportsScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [tab, setTab] = useState<ReportTab>('invoices')
  const [preset, setPreset] = useState<DatePreset>('today')
  const [range, setRange] = useState<DateRange>({ dateFrom: todayStr(), dateTo: todayStr() })
  const [chartMode, setChartMode] = useState<'revenue' | 'expenses'>('revenue')

  // data state
  const [dailyRows, setDailyRows] = useState<DailySalesRow[]>([])
  const [byProduct, setByProduct] = useState<SalesByProductRow[]>([])
  const [byVariant, setByVariant] = useState<SalesByVariantRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [repayments, setRepayments] = useState<RepaymentReportRow[]>([])
  const [packingRuns, setPackingRuns] = useState<PackingReportRun[]>([])
  const [profitRows, setProfitRows] = useState<ProfitReportRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [factoryArrivals, setFactoryArrivals] = useState<Array<BulkArrivalRow & { productName: string }>>([])
  const [collections, setCollections] = useState<PaymentBreakdownRow | null>(null)
  const [kpiDaily, setKpiDaily] = useState<DailySalesRow[]>([])
  const [error, setError] = useState('')

  // modal states
  const [modalInvoiceId, setModalInvoiceId] = useState<number | null>(null)
  const [modalExpense, setModalExpense] = useState<ExpenseRow | null>(null)

  // ── Handle preset changes ──────────────────────────────────────────────────

  function applyPreset(p: DatePreset): void {
    setPreset(p)
    const t = todayStr(), y = yesterdayStr(), ws = weekStartStr(), ms = monthStartStr()
    const map: Record<DatePreset, DateRange> = {
      today:     { dateFrom: t, dateTo: t },
      yesterday: { dateFrom: y, dateTo: y },
      week:      { dateFrom: ws, dateTo: t },
      month:     { dateFrom: ms, dateTo: t },
      custom:    range,
    }
    if (p !== 'custom') setRange(map[p])
  }

  function handleCustomRange(r: DateRange): void {
    setRange(r); setPreset('custom')
  }

  // ── Load report data ───────────────────────────────────────────────────────

  const loadRef = useRef(0)
  async function load(): Promise<void> {
    const id = ++loadRef.current
    setError('')
    // Always load summary data used above the tabbed report tables.
    const [kpiRes, colRes, expRes, profitRes] = await Promise.all([
      window.api.reports.dailySales(range),
      window.api.reports.paymentBreakdown(range),
      window.api.expenses.list(range),
      isAdmin ? window.api.reports.profit(range) : Promise.resolve(null),
    ])
    if (id !== loadRef.current) return
    if (kpiRes.ok) {
      setKpiDaily(kpiRes.data)
      setDailyRows(kpiRes.data)
    }
    if (colRes.ok) setCollections(colRes.data)
    if (expRes.ok) setExpenses(expRes.data)
    if (profitRes && profitRes.ok) setProfitRows(profitRes.data)

    if (tab === 'invoices') {
      const r = await window.api.invoiceHistory.search({ dateFrom: range.dateFrom, dateTo: range.dateTo })
      if (id !== loadRef.current) return
      if (r.ok) setInvoices(r.data); else setError(r.error)
    } else if (tab === 'repayments') {
      const r = await window.api.reports.repayments(range)
      if (id !== loadRef.current) return
      if (r.ok) setRepayments(r.data); else setError(r.error)
    } else if (tab === 'byProduct') {
      const r = await window.api.reports.salesByProduct(range)
      if (id !== loadRef.current) return
      if (r.ok) setByProduct(r.data); else setError(r.error)
    } else if (tab === 'byVariant') {
      const r = await window.api.reports.salesByVariant(range)
      if (id !== loadRef.current) return
      if (r.ok) setByVariant(r.data); else setError(r.error)
    } else if (tab === 'packing') {
      const r = await window.api.reports.packing(range)
      if (id !== loadRef.current) return
      if (r.ok) setPackingRuns(r.data); else setError(r.error)
    } else if (tab === 'factory') {
      // Fetch all products, then collect all arrivals across all products
      const prodRes = await window.api.products.listProducts()
      if (id !== loadRef.current) return
      if (!prodRes.ok) { setError(prodRes.error); return }
      const allArrivals: Array<BulkArrivalRow & { productName: string }> = []
      await Promise.all(
        prodRes.data.map(async (p) => {
          const aRes = await window.api.bulkInventory.listArrivals({ productId: p.id })
          if (aRes.ok) {
            for (const a of aRes.data) {
              // client-side date filter — arrivals have a `date` field (YYYY-MM-DD)
              if (a.date >= range.dateFrom && a.date <= range.dateTo) {
                allArrivals.push({ ...a, productName: p.name })
              }
            }
          }
        })
      )
      if (id !== loadRef.current) return
      // Sort newest first
      allArrivals.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      setFactoryArrivals(allArrivals)
    }
  }

  useEffect(() => { load() }, [tab, range])

  // ── Computed KPIs ──────────────────────────────────────────────────────────

  const totalRetail    = kpiDaily.reduce((s, r) => s + r.retailTotalPaise, 0)
  const totalWholesale = kpiDaily.reduce((s, r) => s + r.wholesaleTotalPaise, 0)
  const totalSales     = kpiDaily.reduce((s, r) => s + r.combinedTotalPaise, 0)
  const totalInvoices  = kpiDaily.reduce((s, r) => s + r.invoiceCount, 0)
  const totalExpenses  = expenses.reduce((s, e) => s + e.amountPaise, 0)
  const totalProfit    = profitRows.reduce((s, r) => s + r.totalProfitPaise, 0)

  // Payment breakdown
  const col = collections
  const colMethods = col ? [
    { label: 'Cash',   value: col.cash,   count: col.cashCount,   color: T.green },
    { label: 'UPI',    value: col.upi,    count: col.upiCount,    color: T.accent },
    { label: 'Card',   value: col.card,   count: col.cardCount,   color: T.purple },
    ...(col.credit > 0 || col.creditCount > 0 ? [{ label: 'Credit', value: col.credit, count: col.creditCount, color: T.red }] : []),
    ...(col.creditRepaid > 0 ? [{ label: 'Repaid', value: col.creditRepaid, count: 0, color: T.amber }] : []),
  ] : []

  const repaymentMethods = col && col.creditRepaid > 0 ? [
    ...(col.repaidCash > 0 ? [{ label: 'Cash', value: col.repaidCash, count: 0, color: T.green }] : []),
    ...(col.repaidUpi > 0 ? [{ label: 'UPI', value: col.repaidUpi, count: 0, color: T.accent }] : []),
    ...(col.repaidCard > 0 ? [{ label: 'Card', value: col.repaidCard, count: 0, color: T.purple }] : []),
  ] : []

  // Tabs config
  const allTabs: Array<{ key: ReportTab; label: string; adminOnly?: boolean }> = [
    { key: 'invoices',   label: 'Invoices' },
    { key: 'repayments', label: 'Repayments' },
    { key: 'expenses',   label: 'Expenses' },
    { key: 'daily',      label: 'Daily Sales' },
    { key: 'byProduct',  label: 'By Product' },
    { key: 'byVariant',  label: 'By Variant' },
    { key: 'packing',    label: 'Packing' },
    { key: 'profit',     label: 'Profit', adminOnly: true },
    { key: 'factory',    label: 'Factory' },
  ]
  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin)

  const needsRange = ['invoices', 'repayments', 'daily', 'byProduct', 'byVariant', 'packing', 'profit', 'expenses', 'factory'].includes(tab)

  // label for range subtitle
  const rangeLabel = `${fmtDate(range.dateFrom)} – ${fmtDate(range.dateTo)}`
  const presetLabels: Record<DatePreset, string> = {
    today: 'Today', yesterday: 'Yesterday',
    week: 'This Week', month: 'This Month', custom: 'Custom',
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const page: CSSProperties = {
    minHeight: '100vh',
    background: T.bg,
    fontFamily: T.font,
    padding: '0 0 132px',
  }
  const inner: CSSProperties = { maxWidth: 1280, margin: '0 auto', padding: '0 28px' }
  const chartPalette = {
    ink1: T.ink1,
    ink2: T.ink2,
    ink3: T.ink3,
    border: T.border,
    tooltipBg: '#151923',
    tooltipShadow: T.shadowSm,
  }

  return (
    <div style={page}>
      <div style={inner}>

        {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '28px 0 22px',
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 28,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Title + actions row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: T.ink1, letterSpacing: '-0.03em' }}>
                Business Reports
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: T.ink3 }}>
                {presetLabels[preset]}
                <span style={{ color: T.ink3, margin: '0 6px' }}>·</span>
                <span style={{ color: T.accent }}>{rangeLabel}</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <ActionBtn
                onClick={() => { void load() }}
                icon={<svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M4.93 4.93a7.5 7.5 0 0 1 10.607.075.75.75 0 1 1-1.074 1.047 6 6 0 1 0 1.293 6.487.75.75 0 0 1 1.365.62A7.5 7.5 0 1 1 3.87 3.872L2.75 2.75A.75.75 0 0 1 3.28 1.47h3.44a.75.75 0 0 1 .75.75v3.44a.75.75 0 0 1-1.28.53L4.93 4.93Z" clipRule="evenodd"/></svg>}
              >
                Refresh
              </ActionBtn>
            </div>
          </div>

          {/* Date preset pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {(['today', 'yesterday', 'week', 'month', 'custom'] as DatePreset[]).map((p) => (
              <Pill key={p} active={preset === p} onClick={() => applyPreset(p)}>
                {presetLabels[p]}
              </Pill>
            ))}
            {preset === 'custom' && (
              <DateInputRow range={range} onChange={handleCustomRange} />
            )}
          </div>
        </div>

        {/* ── KPI GRID ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          <KpiCard label="Total Sales" value={paiseToCurrency(totalSales)} sub={`${totalInvoices} invoices`} icon={Icons.sales} color={T.accent} accent />
          <KpiCard label="Retail Revenue" value={paiseToCurrency(totalRetail)} icon={Icons.retail} color={T.accent} />
          <KpiCard label="Wholesale Revenue" value={paiseToCurrency(totalWholesale)} icon={Icons.wholesale} color={T.amber} />
          <KpiCard label="Invoice Count" value={String(totalInvoices)} sub="total bills" icon={Icons.invoice} color={T.sky} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <KpiCard label="Net Revenue" value={paiseToCurrency(totalSales - totalExpenses)} sub="sales - expenses" icon={Icons.revenue} color={T.green} accent />
          {isAdmin && <KpiCard label="Profit" value={paiseToCurrency(totalProfit)} sub="known-cost lines only" icon={Icons.profit} color={T.green} />}
          <KpiCard label="Expenses" value={paiseToCurrency(totalExpenses)} icon={Icons.expense} color={T.red} />
          <KpiCard label="Collected" value={paiseToCurrency(collections?.total ?? 0)} sub="paid amount" icon={Icons.dues} color={T.sky} />
        </div>

        {/* ── ANALYTICS BLOCK ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 28 }}>
          {col && (
            <>
              <Card style={{ padding: '22px 24px' }}>
                <SecHead title="Payment Breakdown" action={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 13, color: T.ink3, fontFamily: T.mono }}>
                      Collected: <span style={{ color: T.green, fontWeight: 600 }}>{paiseToCurrency(col.total)}</span>
                    </span>
                    {col.creditRepaid > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: T.font }}>
                        (Includes {paiseToCurrency(col.creditRepaid)} from past dues)
                      </span>
                    )}
                  </div>
                } />
                <PaymentMethodChart
                  data={colMethods}
                  palette={{
                    label: T.ink1,
                    value: T.ink2,
                    muted: T.ink3,
                    track: 'rgba(255,255,255,0.045)',
                    bar: 'rgba(203,213,225,0.92)'
                  }}
                />
              </Card>
              
              {col.creditRepaid > 0 && (
                <Card style={{ padding: '22px 24px' }}>
                  <SecHead title="Repayment Breakdown" action={
                    <span style={{ fontSize: 13, color: T.ink3, fontFamily: T.mono }}>
                      Total Repaid: <span style={{ color: T.amber, fontWeight: 600 }}>{paiseToCurrency(col.creditRepaid)}</span>
                    </span>
                  } />
                  <PaymentMethodChart
                    data={repaymentMethods}
                    palette={{
                      label: T.ink1,
                      value: T.ink2,
                      muted: T.ink3,
                      track: 'rgba(255,255,255,0.045)',
                      bar: 'rgba(203,213,225,0.92)'
                    }}
                  />
                </Card>
              )}
            </>
          )}

          {/* Revenue Chart */}
          <Card style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <SecHead title="Revenue Overview" />
              <div style={{ display: 'flex', gap: 6 }}>
                <Pill active={chartMode === 'revenue'} onClick={() => setChartMode('revenue')}>Revenue</Pill>
                <Pill active={chartMode === 'expenses'} onClick={() => setChartMode('expenses')} color={T.red}>Expenses</Pill>
              </div>
            </div>
            <MoneyAreaChart
              data={chartMode === 'revenue'
                ? kpiDaily.slice().map((r) => ({ label: r.businessDate, value: r.combinedTotalPaise }))
                : expenses.slice().reduce<Array<{ label: string; value: number }>>((acc, e) => {
                    const ex = acc.find((x) => x.label === e.date)
                    if (ex) ex.value += e.amountPaise; else acc.push({ label: e.date, value: e.amountPaise })
                    return acc
                  }, []).sort((a, b) => a.label.localeCompare(b.label))
              }
              color={chartMode === 'revenue' ? T.accent : T.red}
              height={128}
              palette={chartPalette}
              gradientId="reports-money-area-fill"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: T.ink3 }}>
              <span>{fmtDate(range.dateFrom)}</span>
              <span>{fmtDate(range.dateTo)}</span>
            </div>
          </Card>
        </div>

        {/* ── TABS ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          {/* Segmented tabs */}
          <div style={{
            display: 'inline-flex', gap: 2, padding: '4px',
            background: T.surface, borderRadius: T.r,
            border: `1px solid ${T.border}`,
            flexWrap: 'wrap',
          }}>
            {tabs.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: '7px 16px', borderRadius: '12px',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    fontFamily: T.font, cursor: 'pointer',
                    border: 'none',
                    background: active ? T.accent : 'transparent',
                    color: active ? '#fff' : T.ink2,
                    transition: 'background 180ms ease, color 180ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── FILTER BAR ────────────────────────────────────────────────────── */}
        {needsRange && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 18px',
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: T.r, marginBottom: 20, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.ink3, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Filter</span>
            {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
              <Pill key={p} active={preset === p} onClick={() => applyPreset(p)}>
                {presetLabels[p]}
              </Pill>
            ))}
            <div style={{ flex: 1 }} />
            <DateInputRow range={range} onChange={handleCustomRange} />
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: T.rSm, background: T.redSoft, border: `1px solid ${T.red}44`, color: T.red, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── REPORT TABLES ──────────────────────────────────────────────── */}

        {/* Daily Sales */}
        {tab === 'daily' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Daily Sales Report" />
            </div>
            {dailyRows.length === 0 ? <EmptyState text="No sales in selected period." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Business Date</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Retail</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Wholesale</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Combined</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((r) => (
                      <TRow key={r.businessDate}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: T.ink1 }}>{r.businessDate}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.accent }}>{paiseToCurrency(r.retailTotalPaise)}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.amber }}>{paiseToCurrency(r.wholesaleTotalPaise)}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>{paiseToCurrency(r.combinedTotalPaise)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <Badge color={T.sky}>{r.invoiceCount}</Badge>
                        </td>
                      </TRow>
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ background: T.surface }}>
                      <td style={{ ...thStyle, textAlign: 'left', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }}>Total</td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.accent }}>{paiseToCurrency(totalRetail)}</td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.amber }}>{paiseToCurrency(totalWholesale)}</td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.green }}>{paiseToCurrency(totalSales)}</td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }}>{totalInvoices}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* By Product */}
        {tab === 'byProduct' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Sales by Product" />
            </div>
            {byProduct.length === 0 ? <EmptyState text="No sales in selected period." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Packets (pcs)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Loose (kg)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                  </tr></thead>
                  <tbody>
                    {byProduct.map((r) => (
                      <TRow key={r.productId}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: T.ink1 }}>{r.productName}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{r.qtyPcs > 0 ? r.qtyPcs : <span style={{ color: T.ink3 }}>—</span>}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{r.qtyGrams > 0 ? gramsToKg(r.qtyGrams).toFixed(3) : <span style={{ color: T.ink3 }}>—</span>}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>{paiseToCurrency(r.revenuePaise)}</td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* By Variant */}
        {tab === 'byVariant' && (() => {
          const grouped: Array<{ productName: string; rows: SalesByVariantRow[] }> = []
          for (const r of byVariant) {
            const ex = grouped.find((g) => g.productName === r.productName)
            if (ex) ex.rows.push(r); else grouped.push({ productName: r.productName, rows: [r] })
          }
          return <ByVariantGrouped groups={grouped} />
        })()}

        {/* Inventory — removed */}

        {/* Low Stock — removed */}

        {/* Packing */}
        {tab === 'packing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {packingRuns.length === 0 ? <EmptyState text="No packing runs in selected period." /> : packingRuns.map((r) => (
              <Card key={r.id} style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: T.ink1, fontSize: 15 }}>{r.productName}</span>
                    <span style={{ color: T.ink3, fontSize: 13, marginLeft: 10 }}>{r.date}</span>
                  </div>
                  <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.amber }}>
                    {formatQuantity(r.bulkUsedGrams, r.unitType)} used
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.lines.map((l, i) => (
                    <span key={i} style={{
                      padding: '3px 12px', borderRadius: T.rFull, fontSize: 12, fontWeight: 500,
                      background: T.accentSoft, color: T.accent, border: `1px solid ${T.accent}33`,
                    }}>
                      {l.packetsCount} × {l.label}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Profit (Admin) */}
        {tab === 'profit' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profitRows.length === 0 ? <EmptyState text="No sales in selected period." /> : profitRows.map((r) => (
              <Card key={r.businessDate} style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: T.ink3 }}>{r.businessDate}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: T.mono, letterSpacing: '-0.03em', marginTop: 4 }}>
                      {paiseToCurrency(r.totalProfitPaise)}
                    </div>
                  </div>
                  {r.nullCostLineCount > 0 && (
                    <div style={{
                      padding: '8px 12px', borderRadius: T.rSm,
                      background: T.amberSoft, border: `1px solid ${T.amber}44`,
                      color: T.amber, fontSize: 12, maxWidth: 280, textAlign: 'right',
                    }}>
                      Covers only known-cost items. <strong>{r.nullCostLineCount} line{r.nullCostLineCount !== 1 ? 's' : ''}</strong> with unknown cost excluded.
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Expenses */}
        {tab === 'expenses' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Expenses" action={
                <span style={{ fontSize: 13, color: T.ink3 }}>
                  Total: <span style={{ color: T.red, fontWeight: 600, fontFamily: T.mono }}>{paiseToCurrency(totalExpenses)}</span>
                </span>
              } />
            </div>
            {expenses.length === 0 ? <EmptyState text="No expenses in selected period." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Category</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {expenses.map((e) => (
                      <TRow key={e.id} onClick={() => setModalExpense(e)}>
                        <td style={{ ...tdStyle, color: T.ink3, fontSize: 12, fontFamily: T.mono }}>{e.date}</td>
                        <td style={tdStyle}>
                          <Badge color={T.amber}>{e.category}</Badge>
                        </td>
                        <td style={{ ...tdStyle, color: T.ink3 }}>{e.notes ?? '—'}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.red }}>{paiseToCurrency(e.amountPaise)}</td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Invoices ───────────────────────────────────────────────────── */}
        {tab === 'invoices' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Invoice History" action={
                <Badge color={T.sky}>{invoices.length} invoices</Badge>
              } />
            </div>
            {invoices.length === 0 ? <EmptyState text="No invoices in selected period." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Invoice #</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Type</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Customer</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Payment</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Paid</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <TRow key={inv.id} onClick={() => setModalInvoiceId(inv.id)}>
                        <td style={{ ...tdStyle, fontFamily: T.mono, fontSize: 12, color: T.accent, fontWeight: 600 }}>
                          {inv.invoiceNo}
                          {inv.status === 'void' && (
                            <span style={{
                              marginLeft: 8, padding: '2px 6px', borderRadius: T.rFull,
                              fontSize: 10, fontWeight: 700, background: T.redSoft, color: T.red,
                              letterSpacing: '0.05em'
                            }}>VOID</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <Badge color={inv.type === 'retail' ? T.accent : T.amber}>{inv.type}</Badge>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: T.ink3 }}>{inv.businessDate}</td>
                        <td style={{ ...tdStyle, color: T.ink2 }}>
                          {inv.customerName ?? <span style={{ color: T.ink3 }}>Walk-in</span>}
                        </td>
                        <td style={tdStyle}>
                          <Badge color={inv.paymentMode === 'credit' ? T.red : T.green}>{inv.paymentMode}</Badge>
                        </td>
                        <td style={{ ...tdMono, textAlign: 'right', textDecoration: inv.status === 'void' ? 'line-through' : 'none', color: inv.status === 'void' ? T.red : T.ink1 }}>{paiseToCurrency(inv.totalPaise)}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>{paiseToCurrency(inv.amountPaidPaise)}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: inv.balanceDuePaise > 0 ? T.red : T.ink3 }}>
                          {inv.balanceDuePaise > 0 ? paiseToCurrency(inv.balanceDuePaise) : '—'}
                        </td>
                      </TRow>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: T.surface }}>
                      <td colSpan={5} style={{ ...thStyle, textAlign: 'left', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }}>
                        Total ({invoices.length} invoices)
                      </td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.ink1 }}>
                        {paiseToCurrency(invoices.reduce((s, i) => s + i.totalPaise, 0))}
                      </td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.green }}>
                        {paiseToCurrency(invoices.reduce((s, i) => s + i.amountPaidPaise, 0))}
                      </td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.red }}>
                        {paiseToCurrency(invoices.reduce((s, i) => s + i.balanceDuePaise, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Repayments ─────────────────────────────────────────────────── */}
        {tab === 'repayments' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Credit Repayments" action={
                <Badge color={T.amber}>{repayments.length} payments</Badge>
              } />
            </div>
            {repayments.length === 0 ? <EmptyState text="No repayments in selected period." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Party</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Mode</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repayments.map((rep) => (
                      <TRow key={rep.id}>
                        <td style={{ ...tdStyle, fontSize: 12, color: T.ink3 }}>{rep.date}</td>
                        <td style={{ ...tdStyle, color: T.ink1, fontWeight: 500 }}>{rep.customerName}</td>
                        <td style={tdStyle}>
                          <Badge color={T.sky}>{rep.mode}</Badge>
                        </td>
                        <td style={{ ...tdStyle, color: T.ink3 }}>{rep.notes ?? '—'}</td>
                        <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>{paiseToCurrency(rep.amountPaise)}</td>
                      </TRow>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: T.surface }}>
                      <td colSpan={4} style={{ ...thStyle, textAlign: 'left', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }}>
                        Total Collected
                      </td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.green }}>
                        {paiseToCurrency(repayments.reduce((s, r) => s + r.amountPaise, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Factory (Bulk Arrivals) ────────────────────────────────────── */}
        {tab === 'factory' && (
          <Card>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
              <SecHead title="Factory — Bulk Arrivals" action={
                <Badge color={T.amber}>{factoryArrivals.length} entries</Badge>
              } />
            </div>
            {factoryArrivals.length === 0 ? (
              <EmptyState text="No bulk arrivals recorded yet." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
                      {isAdmin && <th style={{ ...thStyle, textAlign: 'right' }}>Cost / kg</th>}
                      {isAdmin && <th style={{ ...thStyle, textAlign: 'right' }}>Total Amount</th>}
                      <th style={{ ...thStyle, textAlign: 'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factoryArrivals.map((a) => {
                      const totalAmountPaise = a.costPerKgPaise != null
                        ? Math.round((a.costPerKgPaise * a.qtyGrams) / 1000)
                        : null
                      return (
                        <TRow key={a.id}>
                          <td style={{ ...tdStyle, fontSize: 12, color: T.ink3, fontFamily: T.mono }}>{a.date}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: T.ink1 }}>{a.productName}</td>
                          <td style={{ ...tdMono, textAlign: 'right', color: T.amber }}>
                            {gramsToKg(a.qtyGrams).toFixed(3)} kg
                          </td>
                          {isAdmin && (
                            <td style={{ ...tdMono, textAlign: 'right' }}>
                              {a.costPerKgPaise != null
                                ? paiseToCurrency(a.costPerKgPaise) + '/kg'
                                : <span style={{ color: T.ink3 }}>—</span>}
                            </td>
                          )}
                          {isAdmin && (
                            <td style={{ ...tdMono, textAlign: 'right', color: T.green }}>
                              {totalAmountPaise != null
                                ? paiseToCurrency(totalAmountPaise)
                                : <span style={{ color: T.ink3 }}>—</span>}
                            </td>
                          )}
                          <td style={{ ...tdStyle, color: T.ink3, fontSize: 12 }}>{a.notes ?? '—'}</td>
                        </TRow>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: T.surface }}>
                      <td colSpan={2} style={{ ...thStyle, textAlign: 'left', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }}>
                        Total received
                      </td>
                      <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.amber }}>
                        {gramsToKg(factoryArrivals.reduce((s, a) => s + a.qtyGrams, 0)).toFixed(3)} kg
                      </td>
                      {isAdmin && (
                        <td style={{ ...thStyle, borderTop: `1px solid ${T.border}`, borderBottom: 'none' }} />
                      )}
                      {isAdmin && (
                        <td style={{ ...thStyle, textAlign: 'right', borderTop: `1px solid ${T.border}`, borderBottom: 'none', color: T.green }}>
                          {paiseToCurrency(factoryArrivals.reduce((s, a) => (
                            s + (a.costPerKgPaise != null ? Math.round((a.costPerKgPaise * a.qtyGrams) / 1000) : 0)
                          ), 0))}
                        </td>
                      )}
                      <td style={{ ...thStyle, borderTop: `1px solid ${T.border}`, borderBottom: 'none' }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Invoice Detail Modal */}
        {modalInvoiceId && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
            onClick={() => setModalInvoiceId(null)}
          >
            <div
              style={{ background: T.bg, borderRadius: T.r, boxShadow: T.shadow, width: 440, maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', border: `1px solid ${T.border}`, zIndex: 101 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem', color: T.ink1 }}>Invoice Detail</span>
                <button
                  onClick={() => setModalInvoiceId(null)}
                  style={{ width: 28, height: 28, borderRadius: T.rFull, background: T.surface, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.ink2 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <InvoiceDetailPanel invoiceId={modalInvoiceId} onUpdated={(deleted) => {
                if (deleted) setModalInvoiceId(null)
                load()
              }} />
            </div>
          </div>
        )}

        {/* Expense Detail Modal */}
        {modalExpense && (
          <ExpenseDetailModal
            expense={modalExpense}
            onClose={() => setModalExpense(null)}
            onDeleted={() => {
              setModalExpense(null)
              load()
            }}
          />
        )}

      </div>
    </div>
  )
}
