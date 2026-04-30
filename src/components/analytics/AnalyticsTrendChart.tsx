'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface MonthDatum {
  label: string
  winRate: number | null
  total: number
}

interface Props {
  months: MonthDatum[]
}

interface TooltipEntry {
  dataKey?: string
  value?: number
}

interface TooltipPayload {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const winRate = payload.find(p => p.dataKey === 'winRate')?.value
  const total = payload.find(p => p.dataKey === 'total')?.value
  return (
    <div style={{
      background: 'rgba(26,29,33,0.96)',
      border: '1px solid rgba(212,175,55,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11,
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontWeight: 700, color: '#F5F5F7', marginBottom: 6, letterSpacing: '0.06em' }}>{label}</div>
      {winRate != null && (
        <div style={{ color: '#D4AF37' }}>Win rate: <strong>{winRate}%</strong></div>
      )}
      <div style={{ color: '#C0C2C6', marginTop: 2 }}>Volume: {total} proposal{total !== 1 ? 's' : ''}</div>
    </div>
  )
}

export function AnalyticsTrendChart({ months }: Props) {
  const data = months.map(m => ({
    label: m.label,
    winRate: m.winRate,
    total: m.total,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="rgba(192,194,198,0.08)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tick={{ fill: '#C0C2C6', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="rate"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: '#C0C2C6', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}
          axisLine={false}
          tickLine={false}
          width={34}
        />
        <YAxis
          yAxisId="vol"
          orientation="right"
          tick={{ fill: 'rgba(192,194,198,0.45)', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(192,194,198,0.04)' }} />
        <Bar
          yAxisId="vol"
          dataKey="total"
          fill="rgba(192,194,198,0.15)"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="winRate"
          stroke="#D4AF37"
          strokeWidth={2}
          dot={{ fill: '#D4AF37', r: 4, strokeWidth: 2, stroke: 'rgba(11,11,13,0.8)' }}
          activeDot={{ r: 6, fill: '#D4AF37', stroke: 'rgba(11,11,13,0.8)', strokeWidth: 2 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
