'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Legend,
} from 'recharts'

interface MonthPoint {
  label: string
  winRate: number | null
  total: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(26,29,33,0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(192,194,198,0.15)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{ fontSize: 10, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(192,194,198,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <span style={{ color: 'rgba(192,194,198,0.6)' }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: p.color }}>{p.name === 'Win Rate' ? `${p.value}%` : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function AnalyticsTrendChart({ months }: { months: MonthPoint[] }) {
  const data = months.map(m => ({
    label: m.label,
    winRate: m.winRate,
    total: m.total,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="winRateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(192,194,198,0.06)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fill: 'rgba(192,194,198,0.4)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          tick={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fill: 'rgba(192,194,198,0.4)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", fill: 'rgba(192,194,198,0.25)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(192,194,198,0.1)', strokeWidth: 1 }} />
        <Bar yAxisId="right" dataKey="total" name="Proposals" fill="rgba(192,194,198,0.12)" radius={[2, 2, 0, 0]} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="winRate"
          name="Win Rate"
          stroke="#D4AF37"
          strokeWidth={2}
          fill="url(#winRateGrad)"
          dot={{ fill: '#D4AF37', r: 3, strokeWidth: 0 }}
          activeDot={{ fill: '#D4AF37', r: 5, strokeWidth: 0 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
