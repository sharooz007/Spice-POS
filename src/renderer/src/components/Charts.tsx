import type { ReactElement } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps
} from 'recharts'
import { paiseToCurrency } from '@shared/money'

export interface MoneyPoint {
  label: string
  value: number
}

export interface PaymentChartItem {
  label: string
  value: number
  color: string
  count?: number
}

const ink1 = 'var(--ink-1)'
const ink2 = 'var(--ink-2)'
const ink3 = 'var(--ink-3)'
const border = 'var(--border)'

function EmptyChart({ height = 140 }: { height?: number }): ReactElement {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink3, fontSize: 13 }}>
      No data
    </div>
  )
}

function MoneyTooltip({ active, payload, label }: TooltipContentProps): ReactElement | null {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${border}`,
      borderRadius: 'var(--r-sm)',
      padding: '0.5rem 0.625rem',
      boxShadow: 'var(--shadow-sm)',
      color: ink1,
      fontSize: 12,
    }}>
      <div style={{ color: ink3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {paiseToCurrency(Number(point.value ?? 0))}
      </div>
    </div>
  )
}

export function MoneyAreaChart({
  data,
  color,
  height = 150
}: {
  data: MoneyPoint[]
  color: string
  height?: number
}): ReactElement {
  if (data.length === 0) return <EmptyChart height={height} />

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="money-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip content={(props) => <MoneyTooltip {...props} />} cursor={{ stroke: border }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#money-area-fill)"
            dot={{ r: 2, strokeWidth: 0, fill: color }}
            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SalesSplitChart({
  retail,
  wholesale,
  colors,
  height = 150
}: {
  retail: number
  wholesale: number
  colors: { retail: string; wholesale: string }
  height?: number
}): ReactElement {
  const total = retail + wholesale
  if (total === 0) return <EmptyChart height={height} />

  const data = [
    { label: 'Retail', value: retail, color: colors.retail },
    { label: 'Wholesale', value: wholesale, color: colors.wholesale }
  ].filter((row) => row.value > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '138px 1fr', alignItems: 'center', gap: 14, minHeight: height }}>
      <div style={{ height: 138 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={42}
              outerRadius={58}
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive={false}
            >
              {data.map((row) => <Cell key={row.label} fill={row.color} />)}
            </Pie>
            <Tooltip content={(props) => <MoneyTooltip {...props} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: row.color, flexShrink: 0 }} />
            <span style={{ color: ink2 }}>{row.label}</span>
            <span style={{ color: ink1, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
              {paiseToCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaymentMethodChart({
  data,
  height = 150,
  palette
}: {
  data: PaymentChartItem[]
  palette?: {
    label: string
    value: string
    muted: string
    track: string
    bar: string
  }
  height?: number
}): ReactElement {
  if (data.length === 0) return <EmptyChart height={height} />
  const total = data.reduce((sum, row) => sum + row.value, 0)
  const colors = palette ?? {
    label: ink1,
    value: ink2,
    muted: ink3,
    track: 'var(--bg-fill)',
    bar: 'color-mix(in oklch, var(--ink-2) 62%, transparent)'
  }

  return (
    <div style={{ minHeight: height, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
      {data.map((row) => {
        const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
        const billLabel = `${row.count ?? 0} ${(row.count ?? 0) === 1 ? 'bill' : 'bills'}`
        return (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: colors.label, fontSize: 13, fontWeight: 600 }}>{row.label}</span>
              <span style={{ color: colors.value, fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {paiseToCurrency(row.value)} <span style={{ color: colors.muted }}>·</span> {billLabel} <span style={{ color: colors.muted }}>·</span> {pct}%
              </span>
            </div>
            <div style={{
              height: 8,
              borderRadius: 'var(--r-full)',
              background: colors.track,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 'var(--r-full)',
                background: colors.bar,
                transition: 'width 180ms ease-out'
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
