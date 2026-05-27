import { useMemo, useState } from 'react'

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'aggregator', label: 'Aggregators' },
  { id: 'cow_solver', label: 'CoW solvers' },
]

/**
 * Per-aggregator / per-CoW-solver table. Reads rows in the Phase-4-v2
 * shape (no `project`/`pool_address` columns).
 */
export default function SourceBreakdownTable({ rows }) {
  const [filter, setFilter] = useState('all')

  const aggregated = useMemo(() => {
    const map = new Map()
    for (const r of rows ?? []) {
      if (filter !== 'all' && r.source_category !== filter) continue
      const key = `${r.source_category}::${r.source_name}`
      const cur = map.get(key) ?? {
        source_category: r.source_category,
        source_name: r.source_name,
        usd: 0,
        count: 0,
      }
      cur.usd += Number(r.total_amount_usd ?? 0)
      cur.count += Number(r.trade_count ?? 0)
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.usd - a.usd)
  }, [rows, filter])

  const total = aggregated.reduce((a, b) => a + b.usd, 0)

  return (
    <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: '#1f314a' }}>
            Source breakdown (table)
          </div>
          <div style={{ fontSize: 11, color: '#5c6b7d' }}>
            {aggregated.length} source{aggregated.length === 1 ? '' : 's'} · total {fmtUsd(total)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 4,
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
      <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#edf2fa' }}>
            <tr>
              <th style={th}>Category</th>
              <th style={th}>Source</th>
              <th style={{ ...th, textAlign: 'right' }}>USD</th>
              <th style={{ ...th, textAlign: 'right' }}>Trades</th>
              <th style={{ ...th, textAlign: 'right' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.source_category}</td>
                <td style={td}><strong>{r.source_name}</strong></td>
                <td style={{ ...td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(r.usd)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.count.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right', color: '#5c6b7d' }}>
                  {total > 0 ? `${((r.usd / total) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { fontSize: 11, padding: '8px 10px', borderBottom: '1px solid #c4cfde', textAlign: 'left', color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '0.06em' }
const td = { fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', color: '#243447' }
