import { useMemo } from 'react'

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

export default function BufferActivityPanel({ rows, wrapperMap }) {
  const grouped = useMemo(() => {
    const out = new Map() // wrapperSymbol -> Map<dexLabel, { usd, count }>
    for (const r of rows ?? []) {
      if (!r.is_buffer_op) continue
      const wrapAddr = (r.queried_token_address ?? '').toLowerCase()
      const wrap = wrapperMap?.get(wrapAddr)
      const symbol = wrap?.wrapperSymbol ?? wrapAddr
      const dex = `${r.project ?? 'unknown'} v${r.version ?? '-'}`
      if (!out.has(symbol)) out.set(symbol, new Map())
      const inner = out.get(symbol)
      const cur = inner.get(dex) ?? { usd: 0, count: 0 }
      inner.set(dex, { usd: cur.usd + Number(r.total_amount_usd ?? 0), count: cur.count + Number(r.trade_count ?? 1) })
    }
    return out
  }, [rows, wrapperMap])

  if (grouped.size === 0) return null

  return (
    <div style={{ background: '#fff7e6', border: '1px solid #f0c987', borderRadius: 12, padding: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: '#8a6200' }}>
          Buffer wrap / unwrap activity
        </div>
        <div style={{ fontSize: 11, color: '#a47330' }}>
          Rows where the queried wrapper and the (un-wrapped) paired token resolve to the same underlying.
          Excluded from headline totals by default.
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Wrapper</th>
            <th style={th}>DEX</th>
            <th style={{ ...th, textAlign: 'right' }}>USD</th>
            <th style={{ ...th, textAlign: 'right' }}>Trades</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([symbol, inner]) =>
            [...inner.entries()].map(([dex, v]) => (
              <tr key={`${symbol}-${dex}`}>
                <td style={td}>{symbol}</td>
                <td style={td}>{dex}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(v.usd)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{v.count}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

const th = { fontSize: 11, padding: '6px 8px', borderBottom: '1px solid #f0c987', textAlign: 'left', color: '#8a6200' }
const td = { fontSize: 12, padding: '6px 8px', borderBottom: '1px solid #f5e4c4', color: '#5c6b7d' }
