import { useEffect, useMemo, useState } from 'react'
import { STATUS } from '../hooks/useDuneQuery'
import ProjectVersionChart from './ProjectVersionChart'
import TokenPairChart from './TokenPairChart'

const PRIORITY_COLS = ['project', 'version', 'block_date', 'total_amount_usd', 'pool_address', 'blockchain']

function formatNumber(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return val
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatCell(col, val) {
  if (val === null || val === undefined) return '-'
  if (col === 'total_amount_usd' || col === 'amount_usd') return formatNumber(val)
  if (col === 'block_time') return val?.replace('T', ' ')?.slice(0, 19) ?? val
  return String(val)
}

const S = {
  cell: {
    padding: '8px 14px',
    fontSize: 12,
    color: '#5f6f84',
    borderBottom: '1px solid #d7dfec',
    whiteSpace: 'nowrap',
    fontFamily: "'JetBrains Mono', monospace",
  },
}

export default function ResultsTable({ status, rows, columns, error, meta, executionId, onCancel, registry, queriedToken }) {
  const [page, setPage] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const PAGE_SIZE = 50

  useEffect(() => {
    setPage(0)
    setShowGrid(false)
    setSortCol(null)
  }, [rows])

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const an = Number(av), bn = Number(bv)
      const cmp = Number.isFinite(an) && Number.isFinite(bn)
        ? an - bn
        : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE)
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sortedCols = useMemo(() => {
    if (!columns?.length) return columns
    return [
      ...PRIORITY_COLS.filter((c) => columns.includes(c)),
      ...columns.filter((c) => !PRIORITY_COLS.includes(c)),
    ]
  }, [columns])

  if (status === STATUS.EXECUTING || status === STATUS.POLLING) {
    const label = status === STATUS.EXECUTING ? 'Submitting query...' : 'Waiting for results...'
    return (
      <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <Spinner />
          <span style={{ fontSize: 13, color: '#5f6f84' }}>{label}</span>
        </div>
        {executionId && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#5c6b7d' }}>
            execution id: {executionId}
          </div>
        )}
        <button
          onClick={onCancel}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'transparent',
            border: '1px solid #b9c6da',
            color: '#5c6b7d',
            padding: '5px 14px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === STATUS.ERROR) {
    return (
      <div
        style={{
          background: '#fcebec',
          border: '1px solid #e3b4b7',
          borderRadius: 12,
          padding: '16px 20px',
          fontSize: 13,
          color: '#b23943',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <span>!</span>
        <span>{error}</span>
      </div>
    )
  }

  if (status === STATUS.IDLE || rows.length === 0) {
    if (status === STATUS.COMPLETE && rows.length === 0) {
      return (
        <div
          style={{
            background: '#f4f7fc',
            border: '1px solid #c4cfde',
            borderRadius: 12,
            padding: 28,
            textAlign: 'center',
            fontSize: 13,
            color: '#5c6b7d',
          }}
        >
          No trades found for this pair in the selected date range.
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid #c4cfde',
          background: '#ecf2fa',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em' }}>Results</span>
          <span
            style={{
              background: '#e7f5ed',
              color: '#2f8f5b',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {meta?.total_row_count?.toLocaleString() ?? rows.length} rows
          </span>
        </div>
        {meta?.execution_ended_at && (
          <span style={{ fontSize: 10, color: '#5c6b7d' }}>
            ran at {meta.execution_ended_at.slice(0, 19).replace('T', ' ')} UTC
          </span>
        )}
      </div>

      <div style={{ padding: 12 }}>
        <ProjectVersionChart rows={rows} registry={registry} queriedToken={queriedToken} />
        <TokenPairChart rows={rows} registry={registry} queriedToken={queriedToken} />

        <div style={{ marginTop: 12, border: '1px solid #c4cfde', borderRadius: 10, overflow: 'hidden', background: '#f7f9fd' }}>
          <button
            onClick={() => setShowGrid((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: 'none',
              borderBottom: showGrid ? '1px solid #c4cfde' : 'none',
              padding: '10px 12px',
              cursor: 'pointer',
              background: '#edf2fa',
              color: '#334a63',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
            }}
          >
            <span>Detailed Grid{queriedToken?.symbol ? ` — ${queriedToken.symbol}` : ''}</span>
            <span>{showGrid ? 'Hide' : 'Show'}</span>
          </button>

          {showGrid && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #c4cfde' }}>
                      {sortedCols.map((col) => (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          style={{
                            ...S.cell,
                            color: sortCol === col ? '#365fd9' : '#5c6b7d',
                            fontWeight: 400,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '.06em',
                            background: '#ecf2fa',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          {col}{sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#f0f4fb' }}>
                        {sortedCols.map((col) => (
                          <td
                            key={col}
                            style={{
                              ...S.cell,
                              color:
                                col === 'project'
                                  ? '#365fd9'
                                  : col === 'version'
                                    ? '#2f8f5b'
                                    : col === 'total_amount_usd'
                                      ? '#223349'
                                      : col === 'pool_address'
                                        ? '#7a5af8'
                                        : '#5f6f84',
                            }}
                          >
                            {formatCell(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderTop: '1px solid #c4cfde',
                    background: '#ecf2fa',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#5c6b7d' }}>
                    Page {page + 1} of {totalPages} ({rows.length} rows total)
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <PagBtn onClick={() => setPage(0)} disabled={page === 0} label="<<" />
                    <PagBtn onClick={() => setPage((p) => p - 1)} disabled={page === 0} label="<" />
                    <PagBtn onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1} label=">" />
                    <PagBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} label=">>" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PagBtn({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'transparent' : '#e6edf9',
        border: '1px solid #b9c6da',
        color: disabled ? '#9aa7bb' : '#4f6077',
        width: 28,
        height: 28,
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        border: '2px solid #c4cfde',
        borderTopColor: '#365fd9',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
