import { useState } from 'react'
import { TOKEN_REGISTRY, CHAIN_LABELS, CHAINS } from './data/tokens'
import { useDuneQuery, STATUS } from './hooks/useDuneQuery'
import ResultsTable from './components/ResultsTable'
import TokenRegistry from './components/TokenRegistry'

const sel = {
  background: '#f7f9fd',
  border: '1px solid #b9c6da',
  color: '#243447',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'JetBrains Mono', monospace",
}

function getLocalDateInputValue(offsetDays = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function App() {
  const [tab, setTab] = useState('query')
  const [chain, setChain] = useState('ethereum')
  const [tokenAIdx, setTokenAIdx] = useState(0)
  const [tokenBIdx, setTokenBIdx] = useState(1)
  const [date, setDate] = useState(() => getLocalDateInputValue(-1))
  const [registry, setRegistry] = useState(TOKEN_REGISTRY)

  const { status, rows, columns, error, executionId, meta, run, cancel } = useDuneQuery()

  const tokens = registry[chain] ?? []
  const safeA = Math.min(tokenAIdx, tokens.length - 1)
  const safeB = Math.min(tokenBIdx, tokens.length - 1)
  const tokenA = tokens[safeA]
  const tokenB = tokens[safeB]
  const invalid = !tokenA || !tokenB || safeA === safeB

  const isRunning = status === STATUS.EXECUTING || status === STATUS.POLLING

  const handleRun = () => {
    if (invalid || isRunning) return
    run({ chain, tokenA, tokenB, date })
  }

  const handleChainChange = (c) => {
    setChain(c)
    setTokenAIdx(0)
    setTokenBIdx(Math.min(1, (registry[c] ?? []).length - 1))
  }

  const addToken = ({ chain: ch, symbol, name, address }) => {
    setRegistry((prev) => ({
      ...prev,
      [ch]: [...(prev[ch] ?? []), { symbol, name, address }],
    }))
  }

  const removeToken = (ch, idx) => {
    setRegistry((prev) => ({
      ...prev,
      [ch]: prev[ch].filter((_, i) => i !== idx),
    }))
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #eef2f8 0%, #dde5f2 55%, #cfd9ea 100%)',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#243447',
      }}
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        select option { background: #f7f9fd; }
        select:focus, input:focus { border-color: #365fd9 !important; box-shadow: 0 0 0 2px rgba(54,95,217,0.2); outline: none; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#e3eaf5; }
        ::-webkit-scrollbar-thumb { background:#b4c0d5; border-radius:3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: none; }
        .query-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(150px, 170px); }
        @media (max-width: 980px) {
          .query-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        }
        @media (max-width: 680px) {
          .query-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '36px 24px' }}>
        <div style={{ marginBottom: 28, animation: 'fadeUp .4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#365fd9" strokeWidth="1.5" />
              <path d="M5 9h8M9 5v8" stroke="#365fd9" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: '#1f314a',
                letterSpacing: '-0.02em',
              }}
            >
              Dune Query Runner
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#5c6b7d', margin: 0, paddingLeft: 30 }}>
            Select chain + pair, run query against Dune API, view results inline
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[
            ['query', 'Query'],
            ['registry', 'Token Registry'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTab(val)}
              style={{
                background: tab === val ? '#e6edf9' : 'transparent',
                border: `1px solid ${tab === val ? '#b8c5db' : 'transparent'}`,
                color: tab === val ? '#223349' : '#6a788a',
                padding: '6px 18px',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'all .12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'query' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .3s ease' }}>
            <div
              style={{
                background: '#f4f7fc',
                border: '1px solid #c4cfde',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="query-grid" style={{ display: 'grid', gap: 12 }}>
                <Field label="Chain">
                  <select style={sel} value={chain} onChange={(e) => handleChainChange(e.target.value)}>
                    {CHAINS.map((c) => (
                      <option key={c} value={c}>
                        {CHAIN_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Token A">
                  <select style={sel} value={safeA} onChange={(e) => setTokenAIdx(Number(e.target.value))}>
                    {tokens.map((t, i) => (
                      <option key={i} value={i}>
                        {t.symbol} - {t.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Token B">
                  <select style={sel} value={safeB} onChange={(e) => setTokenBIdx(Number(e.target.value))}>
                    {tokens.map((t, i) => (
                      <option key={i} value={i}>
                        {t.symbol} - {t.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start Date">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...sel, colorScheme: 'light' }} />
                </Field>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!invalid && (
                  <div style={{ display: 'flex', gap: 10, flex: '1 1 560px', minWidth: 0 }}>
                    {[tokenA, tokenB].map((t, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#edf2fa',
                          border: '1px solid #c6d2e4',
                          borderRadius: 7,
                          padding: '6px 12px',
                          fontSize: 11,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span style={{ color: '#365fd9', marginRight: 8 }}>{t.symbol}</span>
                        <span style={{ color: '#5c6b7d', wordBreak: 'break-all' }}>{t.address}</span>
                      </div>
                    ))}
                  </div>
                )}

                {invalid && safeA === safeB && <span style={{ fontSize: 12, color: '#9a6a08' }}>Token A and B must be different</span>}

                <button
                  onClick={isRunning ? cancel : handleRun}
                  disabled={invalid && !isRunning}
                  style={{
                    background: isRunning ? '#f4ead8' : invalid ? '#e4e8ef' : '#dfe9ff',
                    border: `1px solid ${isRunning ? '#d8b680' : invalid ? '#c6cedd' : '#8ca8f0'}`,
                    color: isRunning ? '#8a6200' : invalid ? '#7f8a9a' : '#234ba8',
                    padding: '8px 24px',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: invalid && !isRunning ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all .15s',
                    flexShrink: 0,
                    marginLeft: 'auto',
                  }}
                >
                  {isRunning ? 'Cancel' : 'Run Query'}
                </button>
              </div>
            </div>

            <ResultsTable
              status={status}
              rows={rows}
              columns={columns}
              error={error}
              meta={meta}
              executionId={executionId}
              onCancel={cancel}
            />
          </div>
        )}

        {tab === 'registry' && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <TokenRegistry registry={registry} onAdd={addToken} onRemove={removeToken} />
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
