import { useMemo, useState } from 'react'

const CATEGORY_COLOR = {
  aggregator: '#3b82f6',
  cow_solver: '#8b5cf6',
  direct:     '#16a34a',
}

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

/**
 * Balancer-only source attribution. Renders both a bar chart and a table,
 * showing the share of Balancer-pool volume that came via each
 * aggregator, CoW solver, or direct user-router trade.
 *
 * Expects rows in the Phase-4b shape:
 *   { source_category, source_name, balancer_version, total_amount_usd, trade_count, ... }
 */
export default function BalancerSourceBreakdown({ rows, queriedToken }) {
  const [filter, setFilter] = useState('all')

  const { bars, total } = useMemo(() => {
    const agg = new Map()
    for (const r of rows ?? []) {
      if (filter !== 'all' && r.source_category !== filter) continue
      const usd = Number(r.total_amount_usd ?? 0)
      if (!usd) continue
      const key = `${r.source_category}::${r.source_name}`
      const prev = agg.get(key) ?? { category: r.source_category, source: r.source_name, usd: 0, trades: 0 }
      prev.usd += usd
      prev.trades += Number(r.trade_count ?? 0)
      agg.set(key, prev)
    }
    const bars = [...agg.values()].sort((a, b) => b.usd - a.usd)
    const total = bars.reduce((a, b) => a + b.usd, 0)
    return { bars, total }
  }, [rows, filter])

  if (!rows?.length) return null

  const maxBar = bars[0]?.usd || 1

  return (
    <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: '#1f314a' }}>
            Balancer-only source breakdown{queriedToken?.symbol ? ` — ${queriedToken.symbol}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#5c6b7d' }}>
            Of Balancer-pool volume on the expanded address set: how each trade arrived.
            {' · '}Total {fmtUsd(total)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all',        label: 'All' },
            { id: 'aggregator', label: 'Aggregators' },
            { id: 'cow_solver', label: 'CoW solvers' },
            { id: 'direct',     label: 'Direct' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                fontSize: 11, padding: '4px 8px', borderRadius: 4,
                border: '1px solid #c4cfde',
                background: filter === f.id ? '#dfe9ff' : '#f7f9fd',
                color: filter === f.id ? '#234ba8' : '#5c6b7d',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bars.map((p) => (
          <div key={`${p.category}-${p.source}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px', gap: 8, alignItems: 'center' }}>
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
                title={`${p.category} · ${p.source}: ${fmtUsd(p.usd)} (${p.trades.toLocaleString()} trades)`}
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
            <div style={{ fontSize: 11, color: '#5c6b7d', textAlign: 'right' }}>
              {total > 0 ? `${((p.usd / total) * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
        <Legend color={CATEGORY_COLOR.aggregator} label="aggregator" />
        <Legend color={CATEGORY_COLOR.cow_solver} label="cow_solver" />
        <Legend color={CATEGORY_COLOR.direct}     label="direct (user trade via router)" />
      </div>
    </div>
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
