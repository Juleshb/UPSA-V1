import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compactMoney, money, statusLabel } from './format'
import { useTheme } from './ThemeContext'

function usePalette() {
  const { theme } = useTheme()
  const reversed = theme === 'reversed'
  return {
    axis: reversed ? '#9bb2bc' : '#57717d',
    grid: reversed ? 'rgba(199, 247, 237, .1)' : '#e4eeeb',
    billed: reversed ? '#7eb8c9' : '#092b3c',
    collected: reversed ? '#18d6b4' : '#0d6b5c',
    outstanding: reversed ? '#f0b429' : '#c47d0e',
    waveBilled: reversed ? '#f0b429' : '#d4a017',
    waveCollected: reversed ? '#18d6b4' : '#0d6b5c',
    waveOutstanding: reversed ? '#ff8a80' : '#d96b6b',
    credit: reversed ? '#8ec5ff' : '#1d4e89',
    cover: reversed ? '#c7f7ed' : '#18d6b4',
    available: reversed ? '#57717d' : '#9bb2bc',
    tooltipBg: reversed ? '#092b3c' : '#ffffff',
    tooltipText: reversed ? '#f7faf9' : '#092b3c',
    status: {
      ISSUED: reversed ? '#7eb8c9' : '#1d4e89',
      PARTIALLY_PAID: reversed ? '#f0b429' : '#c47d0e',
      PAID: reversed ? '#18d6b4' : '#0d6b5c',
      OVERDUE: '#c23b3b',
      CANCELLED: reversed ? '#6d858f' : '#9bb2bc',
      WRITTEN_OFF: '#8a4b08',
    } as Record<string, string>,
  }
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  const palette = usePalette()
  if (!active || !payload?.length) return null
  return (
    <div className="app-chart-tip" style={{ background: palette.tooltipBg, color: palette.tooltipText }}>
      {label && <strong>{label}</strong>}
      {payload.map((item) => (
        <p key={item.name}>
          <i style={{ background: item.color }} />
          {item.name} <b>{money(item.value)}</b>
        </p>
      ))}
    </div>
  )
}

function TrendTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  const palette = usePalette()
  if (!active || !payload?.length) return null
  return (
    <div className="app-chart-tip wave" style={{ background: palette.tooltipBg, color: palette.tooltipText }}>
      {label && <strong>{label}</strong>}
      {payload.map((item) => (
        <p key={item.name}>
          <span style={{ color: item.color }}>{item.name}:</span>
          <b>{money(item.value)}</b>
        </p>
      ))}
    </div>
  )
}

export function CollectionsTrend({
  series,
}: {
  series: { month: string; billed: number; collected: number }[]
}) {
  const palette = usePalette()
  if (!series.length) return <p className="app-empty">No collection history yet.</p>
  const data = series.map((item) => ({
    ...item,
    outstanding: Math.max(item.billed - item.collected, 0),
  }))
  return (
    <div className="app-chart tall wave">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={palette.grid} vertical={false} strokeDasharray="3 8" />
          <XAxis dataKey="month" tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} padding={{ left: 8, right: 8 }} />
          <YAxis tickFormatter={compactMoney} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={72} domain={[0, 'auto']} />
          <Tooltip content={<TrendTip />} cursor={{ stroke: palette.axis, strokeDasharray: '3 4' }} />
          <Line type="monotone" dataKey="collected" name="Collected" stroke={palette.waveCollected} strokeWidth={2.6} dot={false} activeDot={{ r: 5, fill: palette.waveCollected, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke={palette.waveOutstanding} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, fill: palette.waveOutstanding, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="billed" name="Billed" stroke={palette.waveBilled} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, fill: palette.waveBilled, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CollectionSplit({ collected, outstanding }: { collected: number; outstanding: number }) {
  const palette = usePalette()
  const data = [
    { name: 'Collected', value: collected, color: palette.collected },
    { name: 'Outstanding', value: outstanding, color: palette.outstanding },
  ].filter((item) => item.value > 0)
  if (!data.length) return <p className="app-empty">No fee movement yet.</p>
  const total = collected + outstanding
  return (
    <div className="app-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none" isAnimationActive={false}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Tooltip content={<ChartTip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: palette.axis }} />
        </PieChart>
      </ResponsiveContainer>
      <p className="app-chart-center">{compactMoney(total)}<small>fee book</small></p>
    </div>
  )
}

export function StatusBars({
  items,
}: {
  items: { status: string; count: number; amount: number }[]
}) {
  const palette = usePalette()
  if (!items.length) return <p className="app-empty">No invoice positions.</p>
  const data = items.map((item) => ({ ...item, label: statusLabel(item.status) }))
  return (
    <div className="app-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid stroke={palette.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={compactMoney} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="amount" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive={false}>
            {data.map((item) => <Cell key={item.status} fill={palette.status[item.status] ?? palette.collected} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ChannelBars({
  items,
}: {
  items: { channel: string; amount: number }[]
}) {
  const palette = usePalette()
  if (!items.length) return <p className="app-empty">No settled payments yet.</p>
  const data = items.map((item) => ({ ...item, label: statusLabel(item.channel) }))
  return (
    <div className="app-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="32%">
          <CartesianGrid stroke={palette.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compactMoney} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="amount" name="Settled" fill={palette.collected} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ExposureBars({
  credit,
  outstandingFees,
  cover,
}: {
  credit: number
  outstandingFees: number
  cover: number
}) {
  const palette = usePalette()
  const data = [
    { name: 'Fees due', value: outstandingFees, color: palette.outstanding },
    { name: 'Loan book', value: credit, color: palette.credit },
    { name: 'Guarantee cover', value: cover, color: palette.cover },
  ]
  return (
    <div className="app-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid stroke={palette.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={compactMoney} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: palette.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} />
          <Bar dataKey="value" name="Exposure" radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FacilitySplit({
  outstanding,
  available,
}: {
  outstanding: number
  available: number
}) {
  const palette = usePalette()
  const data = [
    { name: 'Outstanding cover', value: outstanding, color: palette.cover },
    { name: 'Available capacity', value: available, color: palette.available },
  ].filter((item) => item.value > 0)
  if (!data.length) return <p className="app-empty">No guarantee facility loaded.</p>
  return (
    <div className="app-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} stroke="none" isAnimationActive={false}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Tooltip content={<ChartTip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: palette.axis }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
