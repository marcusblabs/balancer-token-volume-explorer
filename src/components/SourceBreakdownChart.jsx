import { useMemo } from 'react'

const CATEGORY_COLOR = {
  aggregator: '#3b82f6',
  cow_solver: '#8b5cf6',
}

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

/**
 * Per-aggregator + per-CoW-solver volume bar chart.
 *
 * Expects rows in the Phase-4-v2 shape:
 *   { source_category, source_name, total_amount_usd, trade_count, ... }
 *
 * One row per (category, source_name), sorted by USD descending.
 */
export default function SourceBreakdownChart({ rows }) {
  const data = useMemo(() => {
    const agg = new Map() // `${category}::${source}` -> { category, source, usd, trades }
    for (const r of rows ?? []) {
      const usd = Number(r.total_amount_usd ?? 0)
      if (!usd) continue
      const key = `${r.source_category}::${r.source_name}`
      const prev = agg.get(key) ?? { category: r.source_category, source: r.source_name, usd: 0, trades: 0 }
      prev.usd += usd
      prev.trades += Number(r.trade_count ?? 0)
      agg.set(key, prev)
    }
    return [...agg.values()].sort((a, b) => b.usd - a.usd).slice(0, 25)
  }, [rows])

  if (!data.length) {
    return (
      <Card title="Volume by aggregator / CoW solver" subtitle="No aggregator-tagged or CoW-tagged trades in the result set.">
        <div style={{ fontSize: 11, color: '#5c6b7d' }}>—</div>
      </Card>
    )
  }
  const maxBar = data[0].usd || 1
  const totalUsd = data.reduce((a, b) => a + b.usd, 0)

  return (
    <Card
      title="Volume by aggregator / CoW solver"
      subtitle={`${data.length} sources · total ${fmtUsd(totalUsd)} routed`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((p) => (
          <div key={`${p.category}-${p.source}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#243447', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                title={p.category}
                style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                  background: CATEGORY_COLOR[p.category] ?? '#94a3b8',
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.source}
              </span>
            </div>
            <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: '#e3eaf5' }}>
              <div
                title={`${p.category} · ${p.source}: ${fmtUsd(p.usd)} across ${p.trades.toLocaleString()} trades`}
                style={{
                  width: `${(p.usd / maxBar) * 100}%`,
                  background: CATEGORY_COLOR[p.category] ?? '#94a3b8',
                  minWidth: 1,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#5c6b7d', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtUsd(p.usd)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11 }}>
        <Legend color={CATEGORY_COLOR.aggregator} label="aggregator (dex_aggregator.trades)" />
        <Legend color={CATEGORY_COLOR.cow_solver} label="cow_solver (cow_protocol.*.trades + solvers)" />
      </div>
    </Card>
  )
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#5c6b7d' }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
      {label}
    </span>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: '#1f314a' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5c6b7d' }}>{subtitle}</div>
      </div>
      {children}
    </div>
  )
}
