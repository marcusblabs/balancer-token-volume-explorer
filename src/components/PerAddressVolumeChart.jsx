import { useMemo } from 'react'

const COLORS = [
  '#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#d946ef', '#f97316', '#14b8a6',
  '#475569', '#a855f7', '#22c55e', '#eab308', '#ec4899',
]

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

export default function PerAddressVolumeChart({ rows, expansion }) {
  const { series, totals, dexKeys, dexColor } = useMemo(() => {
    const sym = new Map((expansion?.expandedAddresses ?? []).map((e) => [e.address.toLowerCase(), e.symbol]))
    const byAddrDex = new Map() // queriedAddr -> Map<projectVersion, sum>
    const dexSet = new Set()
    for (const r of rows ?? []) {
      const usd = Number(r.total_amount_usd ?? 0)
      if (!usd) continue
      const addr = (r.queried_token_address ?? '').toLowerCase()
      const dex = `${r.project ?? 'unknown'} v${r.version ?? '-'}`
      dexSet.add(dex)
      if (!byAddrDex.has(addr)) byAddrDex.set(addr, new Map())
      const inner = byAddrDex.get(addr)
      inner.set(dex, (inner.get(dex) ?? 0) + usd)
    }
    const series = [...byAddrDex.entries()]
      .map(([addr, inner]) => {
        const total = [...inner.values()].reduce((a, b) => a + b, 0)
        return {
          addr,
          symbol: sym.get(addr) ?? addr.slice(0, 6) + '…' + addr.slice(-4),
          total,
          parts: [...inner.entries()].sort((a, b) => b[1] - a[1]),
        }
      })
      .sort((a, b) => b.total - a.total)
    const dexKeys = [...dexSet].sort()
    const dexColor = new Map(dexKeys.map((k, i) => [k, COLORS[i % COLORS.length]]))
    const totals = series.reduce((a, s) => a + s.total, 0)
    return { series, totals, dexKeys, dexColor }
  }, [rows, expansion])

  if (!series.length) {
    return (
      <Card title="Per-address volume" subtitle="No volume in the result set.">
        <div style={{ fontSize: 11, color: '#5c6b7d' }}>—</div>
      </Card>
    )
  }
  const maxBar = Math.max(...series.map((s) => s.total)) || 1

  return (
    <Card
      title="Per-address volume"
      subtitle={`Stacked by DEX (project/version) — total ${fmtUsd(totals)} across ${series.length} address${series.length === 1 ? '' : 'es'}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {series.map((s) => (
          <div key={s.addr} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#243447', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.symbol}
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', background: '#e3eaf5' }}>
              {s.parts.map(([dex, v]) => {
                const w = (v / maxBar) * 100
                return (
                  <div
                    key={dex}
                    title={`${dex}: ${fmtUsd(v)}`}
                    style={{ width: `${w}%`, background: dexColor.get(dex), minWidth: v > 0 ? 1 : 0 }}
                  />
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#5c6b7d', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
              {fmtUsd(s.total)}
            </div>
          </div>
        ))}
      </div>
      <Legend keys={dexKeys.slice(0, 20)} colorOf={(k) => dexColor.get(k)} />
    </Card>
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

function Legend({ keys, colorOf }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {keys.map((k) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#243447' }}>
          <span style={{ width: 8, height: 8, background: colorOf(k), borderRadius: 2, display: 'inline-block' }} />
          {k}
        </span>
      ))}
    </div>
  )
}
