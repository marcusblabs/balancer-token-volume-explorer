import { useMemo } from 'react'

const CATEGORY_COLOR = {
  aggregator: '#3b82f6',
  cow_solver: '#8b5cf6',
  direct: '#16a34a',
}

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

// Mix the category color with a per-source hue so different sources inside
// the same category are visually distinct without exploding the legend.
function shadeFor(category, sourceIdx) {
  const base = CATEGORY_COLOR[category] ?? '#94a3b8'
  // Blend with white by varying amounts to produce a few shades.
  const ratios = [0, 0.18, 0.36, 0.54, 0.72]
  const r = ratios[sourceIdx % ratios.length]
  const [, hex] = base.match(/#([0-9a-f]{6})/i)
  const rr = parseInt(hex.slice(0, 2), 16)
  const gg = parseInt(hex.slice(2, 4), 16)
  const bb = parseInt(hex.slice(4, 6), 16)
  const mix = (c) => Math.round(c + (255 - c) * r)
  return `rgb(${mix(rr)},${mix(gg)},${mix(bb)})`
}

export default function SourceBreakdownChart({ rows }) {
  const data = useMemo(() => {
    const byDex = new Map() // dexLabel -> Map<{category,source}, usd>
    const sourceIdx = new Map() // source_name -> index for shading
    let nextIdx = 0
    for (const r of rows ?? []) {
      const usd = Number(r.total_amount_usd ?? 0)
      if (!usd) continue
      const dex = `${r.project ?? 'unknown'} v${r.version ?? '-'}`
      const key = `${r.source_category}::${r.source_name}`
      if (!sourceIdx.has(r.source_name)) sourceIdx.set(r.source_name, nextIdx++)
      if (!byDex.has(dex)) byDex.set(dex, new Map())
      const inner = byDex.get(dex)
      inner.set(key, (inner.get(key) ?? 0) + usd)
    }
    const series = [...byDex.entries()]
      .map(([dex, inner]) => ({
        dex,
        total: [...inner.values()].reduce((a, b) => a + b, 0),
        parts: [...inner.entries()]
          .map(([k, v]) => {
            const [category, source] = k.split('::')
            return { category, source, usd: v }
          })
          .sort((a, b) => b.usd - a.usd),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
    const legend = new Map()
    for (const s of series) {
      for (const p of s.parts) {
        const lk = `${p.category}::${p.source}`
        if (!legend.has(lk)) legend.set(lk, { category: p.category, source: p.source })
      }
    }
    return { series, sourceIdx, legend: [...legend.values()] }
  }, [rows])

  if (!data.series.length) {
    return (
      <Card title="Source breakdown" subtitle="No source-attributed rows in the result set.">
        <div style={{ fontSize: 11, color: '#5c6b7d' }}>—</div>
      </Card>
    )
  }
  const maxBar = Math.max(...data.series.map((s) => s.total)) || 1

  return (
    <Card title="Source breakdown by DEX" subtitle="Stacked by aggregator / CoW solver / direct.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.series.map((s) => (
          <div key={s.dex} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#243447', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.dex}
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', background: '#e3eaf5' }}>
              {s.parts.map((p) => {
                const w = (p.usd / maxBar) * 100
                return (
                  <div
                    key={`${p.category}-${p.source}`}
                    title={`${p.category} · ${p.source}: ${fmtUsd(p.usd)}`}
                    style={{
                      width: `${w}%`,
                      background: shadeFor(p.category, data.sourceIdx.get(p.source) ?? 0),
                      minWidth: p.usd > 0 ? 1 : 0,
                    }}
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
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.legend.slice(0, 40).map((l) => (
          <span key={`${l.category}-${l.source}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#243447' }}>
            <span style={{
              width: 8, height: 8,
              background: shadeFor(l.category, data.sourceIdx.get(l.source) ?? 0),
              borderRadius: 2, display: 'inline-block',
            }} />
            <span style={{ color: '#5c6b7d' }}>{l.category}/</span>{l.source}
          </span>
        ))}
      </div>
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
