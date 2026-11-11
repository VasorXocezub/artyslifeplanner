// Small dependency-free SVG charts that follow the theme through CSS variables.
export function Donut({ slices, size = 150, centerTop, centerBottom }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 12, c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Spending by category" className="bd-donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="16" />
      {total > 0 && slices.map((s, i) => {
        const len = (s.value / total) * c
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="16"
          strokeDasharray={`${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`} strokeDashoffset={-acc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{`${s.label}: ${Math.round((s.value / total) * 100)}%`}</title></circle>
        acc += len
        return el
      })}
      <text x="50%" y="47%" textAnchor="middle" className="bd-donut-top">{centerTop}</text>
      <text x="50%" y="60%" textAnchor="middle" className="bd-donut-bottom">{centerBottom}</text>
    </svg>
  )
}

export function TrendBars({ data, money }) {
  // data: [{ label, budget, spent }] oldest → newest
  const max = Math.max(1, ...data.flatMap(d => [d.budget, d.spent]))
  const w = 100 / Math.max(1, data.length)
  return (
    <div className="bd-trend" role="img" aria-label="Budget versus spent by period">
      <svg viewBox="0 0 100 52" preserveAspectRatio="none" className="bd-trend-svg">
        {data.map((d, i) => {
          const bh = (d.budget / max) * 46, sh = (d.spent / max) * 46
          const over = d.budget > 0 && d.spent > d.budget
          return (
            <g key={i}>
              <rect x={i * w + w * 0.12} y={50 - bh} width={w * 0.34} height={Math.max(0.4, bh)} rx="0.8" fill="var(--border-strong)"><title>{`${d.label} budget ${money(d.budget)}`}</title></rect>
              <rect x={i * w + w * 0.5} y={50 - sh} width={w * 0.34} height={Math.max(0.4, sh)} rx="0.8" fill={over ? 'var(--danger)' : 'var(--accent-deep)'}><title>{`${d.label} spent ${money(d.spent)}`}</title></rect>
            </g>
          )
        })}
      </svg>
      <div className="bd-trend-labels">{data.map((d, i) => <span key={i}>{d.short}</span>)}</div>
      <div className="bd-legend"><span><i style={{ background: 'var(--border-strong)' }} /> Budget</span><span><i style={{ background: 'var(--accent-deep)' }} /> Spent</span></div>
    </div>
  )
}
