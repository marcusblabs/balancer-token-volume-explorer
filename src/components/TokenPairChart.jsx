import { useMemo, useState } from 'react'

const PROJECT_COLORS = [
  '#3b82f6',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#d946ef',
]

const TOP_PROJECTS = 8
const OTHER_KEY = '__other__'
const OTHER_COLOR = '#94a3b8'

function normalizeLabel(value, fallback) {
  const text = String(value ?? '').trim()
  return text || fallback
}

function toAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatCompactUsd(value) {
  const n = toAmount(value)
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function buildSeries(rows) {
  const projectTotals = new Map()
  const pairMap = new Map()

  for (const row of rows) {
    const project = normalizeLabel(row.project, 'unknown')
    const paired = normalizeLabel(row.paired_token_address, 'unknown')
    const amount = toAmount(row.total_amount_usd ?? row.amount_usd ?? 0)
    if (amount <= 0) continue

    projectTotals.set(project, (projectTotals.get(project) ?? 0) + amount)
    if (!pairMap.has(paired)) pairMap.set(paired, new Map())
    const pm = pairMap.get(paired)
    pm.set(project, (pm.get(project) ?? 0) + amount)
  }

  const rankedProjects = [...projectTotals.entries()].sort((a, b) => b[1] - a[1])
  const topProjects = rankedProjects.slice(0, TOP_PROJECTS).map(([p]) => p)
  const topSet = new Set(topProjects)

  const legendKeys = [...topProjects]
  const colorByProject = Object.fromEntries(
    topProjects.map((p, i) => [p, PROJECT_COLORS[i % PROJECT_COLORS.length]]),
  )
  if (rankedProjects.length > TOP_PROJECTS) {
    legendKeys.push(OTHER_KEY)
    colorByProject[OTHER_KEY] = OTHER_COLOR
  }

  const pairs = [...pairMap.entries()]
    .map(([address, projMap]) => {
      const buckets = new Map()
      for (const [project, value] of projMap.entries()) {
        const key = topSet.has(project) ? project : OTHER_KEY
        buckets.set(key, (buckets.get(key) ?? 0) + value)
      }
      const segments = legendKeys
        .filter((k) => buckets.has(k))
        .map((k) => ({ key: k, value: buckets.get(k) }))
      const total = segments.reduce((s, seg) => s + seg.value, 0)
      return { address, total, segments }
    })
    .sort((a, b) => b.total - a.total)

  const maxTotal = pairs[0]?.total ?? 0
  return { pairs, legendKeys, colorByProject, maxTotal }
}

export default function TokenPairChart({ rows, registry, queriedToken }) {
  const { pairs, legendKeys, colorByProject, maxTotal } = useMemo(() => buildSeries(rows), [rows])

  const tokenByAddress = useMemo(() => {
    const map = new Map()
    for (const tokens of Object.values(registry ?? {})) {
      for (const t of tokens) {
        map.set(t.address.toLowerCase(), t)
      }
    }
    return map
  }, [registry])

  if (pairs.length === 0 || maxTotal <= 0) return null

  return (
    <div style={{ border: '1px solid #c4cfde', borderRadius: 10, background: '#f7f9fd', padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Volume by Token Pair{queriedToken?.symbol ? ` — ${queriedToken.symbol}` : ''}
        </span>
        <span style={{ fontSize: 11, color: '#5c6b7d' }}>{pairs.length} pairs</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {legendKeys.map((key) => (
          <div
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              border: '1px solid #d2daea',
              borderRadius: 999,
              fontSize: 10,
              color: '#5c6b7d',
              background: '#eef3fb',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: colorByProject[key],
                display: 'inline-block',
              }}
            />
            {key === OTHER_KEY ? 'other' : key}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto', paddingRight: 8, boxSizing: 'border-box' }}>
        {pairs.map((pair, idx) => {
          const token = tokenByAddress.get(pair.address?.toLowerCase())
          return (
            <div key={pair.address}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      minWidth: 24,
                      padding: '1px 6px',
                      borderRadius: 999,
                      border: '1px solid #d2daea',
                      background: '#eef3fb',
                      color: '#5c6b7d',
                      fontSize: 10,
                      textAlign: 'center',
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    style={{
                      color: '#243447',
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: token ? 'inherit' : "'JetBrains Mono', monospace",
                    }}
                    title={pair.address}
                  >
                    {token ? (
                      <>
                        {token.symbol}
                        <span style={{ color: '#8a9ab0', marginLeft: 6, fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                          {pair.address}
                        </span>
                      </>
                    ) : (
                      pair.address
                    )}
                  </span>
                </div>
                <span style={{ color: '#4f6077', fontSize: 11 }}>{formatCompactUsd(pair.total)}</span>
              </div>

              <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden', background: '#e6edf9' }}>
                {pair.segments.map((segment) => (
                  <div
                    key={`${pair.address}-${segment.key}`}
                    title={`${segment.key === OTHER_KEY ? 'other' : segment.key}: ${formatCompactUsd(segment.value)}`}
                    style={{
                      width: `${(segment.value / maxTotal) * 100}%`,
                      minWidth: 2,
                      background: colorByProject[segment.key],
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
