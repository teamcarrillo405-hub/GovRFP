interface ArcGaugeProps {
  value: number        // 0–100
  size?: number        // px, default 110
  strokeWidth?: number // default 7
  color?: string       // arc fill color
  label?: string       // center sub-label
  unit?: string        // appended to value (default '%')
  glow?: boolean
}

export function ArcGauge({
  value,
  size = 110,
  strokeWidth = 7,
  color = '#FF1A1A',
  label,
  unit = '%',
  glow = true,
}: ArcGaugeProps) {
  const cx = size / 2
  const cy = size / 2
  const R  = (size / 2) - strokeWidth - 4

  // 270° arc: starts at 225°, sweeps clockwise
  const C          = 2 * Math.PI * R
  const trackDash  = C * 0.75
  const valueDash  = Math.max(0, Math.min(1, value / 100)) * trackDash
  const rotate     = 135  // degrees — aligns 0° start to bottom-left

  const filter = glow ? `drop-shadow(0 0 5px ${color})` : undefined

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: 'visible' }}
    >
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="none"
        stroke="rgba(192,194,198,0.12)"
        strokeWidth={strokeWidth}
        strokeDasharray={`${trackDash} ${C}`}
        strokeLinecap="round"
        transform={`rotate(${rotate}, ${cx}, ${cy})`}
      />

      {/* Value arc */}
      {valueDash > 0 && (
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${valueDash} ${C}`}
          strokeLinecap="round"
          transform={`rotate(${rotate}, ${cx}, ${cy})`}
          style={{ filter }}
        />
      )}

      {/* Center value */}
      <text
        x={cx}
        y={label ? cy : cy + (size * 0.08)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.22}
        fontWeight={600}
        fill="#F5F5F7"
        fontFamily="'IBM Plex Mono', monospace"
      >
        {value}{unit}
      </text>

      {/* Optional sub-label */}
      {label && (
        <text
          x={cx}
          y={cy + size * 0.20}
          textAnchor="middle"
          fontSize={size * 0.09}
          fill="rgba(192,194,198,0.7)"
          fontFamily="'IBM Plex Mono', monospace"
          letterSpacing="0.08em"
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}
