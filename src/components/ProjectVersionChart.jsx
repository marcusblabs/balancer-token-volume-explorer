import { useMemo } from 'react'

const VERSION_COLORS = [
  '#3b82f6',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#d946ef',
  '#f97316',
  '#14b8a6',
]

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
  const projectMap = new Map()
  const versionTotals = new Map()

  for (const row of rows) {
    const project = normalizeLabel(row.project, 'unknown')
    const version = normalizeLabel(row.version, 'unknown')
    const amount = toAmount(row.total_amount_usd ?? row.amount_usd ?? 0)
    if (amount <= 0) continue

    if (!projectMap.has(project)) {
      projectMap.set(project, new Map())
    }

    const projectVersions = projectMap.get(project)
    projectVersions.set(version, (projectVersions.get(version) ?? 0) + amount)
    versionTotals.set(version, (versionTotals.get(version) ?? 0) + amount)
  }

  const versions = [...versionTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([version]) => version)

  const colorByVersion = Object.fromEntries(
    versions.map((version, idx) => [version, VERSION_COLORS[idx % VERSION_COLORS.length]]),
  )

  const projects = [...projectMap.entries()]
    .map(([project, versionMap]) => {
      const segments = versions
        .filter((version) => versionMap.has(version))
        .map((version) => ({ version, value: versionMap.get(version) }))

      const total = segments.reduce((sum, seg) => sum + seg.value, 0)
      return { project, total, segments }
    })
    .sort((a, b) => b.total - a.total)

  const maxTotal = projects[0]?.total ?? 0

  return { projects, versions, colorByVersion, maxTotal }
}

export default function ProjectVersionChart({ rows }) {
  const { projects, versions, colorByVersion, maxTotal } = useMemo(() => buildSeries(rows), [rows])

  if (projects.length === 0 || maxTotal <= 0) {
    return null
  }

  return (
    <div style={{ border: '1px solid #c4cfde', borderRadius: 10, background: '#f7f9fd', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Project Volume by Version
        </span>
        <span style={{ fontSize: 11, color: '#5c6b7d' }}>{projects.length} projects</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {versions.map((version) => (
          <div
            key={version}
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
                background: colorByVersion[version],
                display: 'inline-block',
              }}
            />
            {version}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 8, boxSizing: 'border-box' }}>
        {projects.map((projectRow, idx) => (
          <div key={projectRow.project}>
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
                  }}
                  title={projectRow.project}
                >
                  {projectRow.project}
                </span>
              </div>
              <span style={{ color: '#4f6077', fontSize: 11 }}>{formatCompactUsd(projectRow.total)}</span>
            </div>

            <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden', background: '#e6edf9' }}>
              {projectRow.segments.map((segment) => (
                <div
                  key={`${projectRow.project}-${segment.version}`}
                  title={`${projectRow.project} | v${segment.version}: ${formatCompactUsd(segment.value)}`}
                  style={{
                    width: `${(segment.value / maxTotal) * 100}%`,
                    minWidth: 2,
                    background: colorByVersion[segment.version],
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
