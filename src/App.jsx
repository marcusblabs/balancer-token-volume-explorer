import { useState, useEffect, useMemo } from 'react'
import { TOKEN_ADDRESSES, CHAIN_LABELS, CHAINS, DEFAULT_RPCS } from './data/tokens'
import { useDuneQuery, STATUS } from './hooks/useDuneQuery'
import { useTokenRegistry, fetchTokenMeta, metaCache, addressFallback } from './hooks/useTokenRegistry'
import ResultsTable from './components/ResultsTable'
import TokenSelect from './components/TokenSelect'

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
  const [chain, setChain] = useState('ethereum')
  const [tokenAIdx, setTokenAIdx] = useState(0)
  const [date, setDate] = useState(() => getLocalDateInputValue(-1))

  // Extra addresses entered manually by the user (per-chain)
  const [customAddresses, setCustomAddresses] = useState({}) // { [chain]: [address, ...] }
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  const chainAddresses = useMemo(() => [
    ...TOKEN_ADDRESSES[chain],
    ...(customAddresses[chain] ?? []),
  ], [chain, customAddresses])

  // Resolved tokens (symbol + name) for the currently selected chain
  const { tokens, loading } = useTokenRegistry(chain, chainAddresses)

  // Accumulate resolved tokens by chain for chart lookups
  const [resolvedRegistry, setResolvedRegistry] = useState({})
  useEffect(() => {
    if (tokens.length > 0 && !loading) {
      setResolvedRegistry((prev) => ({ ...prev, [chain]: tokens }))
    }
  }, [chain, tokens, loading])

  const { status, rows, columns, error, executionId, meta, run, cancel } = useDuneQuery()

  // Collect unique paired token addresses from query results and resolve via RPC
  const pairedAddresses = useMemo(() => {
    if (!rows?.length) return []
    const seen = new Set()
    const result = []
    for (const row of rows) {
      const addr = row.paired_token_address
      if (addr?.startsWith('0x') && !seen.has(addr.toLowerCase())) {
        seen.add(addr.toLowerCase())
        result.push(addr)
      }
    }
    return result
  }, [rows])

  const { tokens: pairedTokens, loading: pairedLoading } = useTokenRegistry(chain, pairedAddresses)

  // Merge resolved paired tokens into the registry for chart lookups
  useEffect(() => {
    if (!pairedTokens.length) return
    setResolvedRegistry((prev) => {
      const existing = new Map((prev[chain] ?? []).map((t) => [t.address.toLowerCase(), t]))
      let changed = false
      for (const t of pairedTokens) {
        if (!existing.has(t.address.toLowerCase())) {
          existing.set(t.address.toLowerCase(), t)
          changed = true
        }
      }
      return changed ? { ...prev, [chain]: [...existing.values()] } : prev
    })
  }, [chain, pairedTokens])

  const safeA = Math.min(tokenAIdx, tokens.length - 1)
  const tokenA = tokens[safeA]
  const invalid = !tokenA || loading

  const isRunning = status === STATUS.EXECUTING || status === STATUS.POLLING

  const handleLookupAddress = async (address) => {
    const lower = address.toLowerCase()
    // Already in the list — just select it
    const existing = tokens.findIndex((t) => t.address.toLowerCase() === lower)
    if (existing !== -1) {
      setTokenAIdx(existing)
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    try {
      const rpcUrl = DEFAULT_RPCS[chain]
      if (!metaCache.has(lower)) {
        const meta = await fetchTokenMeta(address, rpcUrl)
        if (meta) metaCache.set(lower, meta)
        else metaCache.set(lower, addressFallback(address))
      }
      setCustomAddresses((prev) => {
        const list = prev[chain] ?? []
        if (list.some((a) => a.toLowerCase() === lower)) return prev
        return { ...prev, [chain]: [...list, address] }
      })
      // The new address will appear at the end; select it after tokens update
      // We store the target so the effect below can pick it up
      setPendingSelect(lower)
    } catch (err) {
      setLookupError(`Could not resolve ${address}: ${err.message}`)
    } finally {
      setLookupLoading(false)
    }
  }

  const [pendingSelect, setPendingSelect] = useState(null)
  useEffect(() => {
    if (!pendingSelect || loading) return
    const idx = tokens.findIndex((t) => t.address.toLowerCase() === pendingSelect)
    if (idx !== -1) {
      setTokenAIdx(idx)
      setPendingSelect(null)
    }
  }, [pendingSelect, tokens, loading])

  const handleRun = () => {
    if (invalid || isRunning) return
    run({ chain, tokenA, date })
  }

  const handleChainChange = (c) => {
    setChain(c)
    setTokenAIdx(0)
    setLookupError(null)
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
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes toastIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        select option { background: #f7f9fd; }
        select:focus, input:focus { border-color: #365fd9 !important; box-shadow: 0 0 0 2px rgba(54,95,217,0.2); outline: none; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#e3eaf5; }
        ::-webkit-scrollbar-thumb { background:#b4c0d5; border-radius:3px; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: none; }
        .query-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(150px, 170px); }
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
            Select chain + token, run query against Dune API, view top pairs by volume inline
          </p>
        </div>

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

              <Field label="Token">
                <TokenSelect
                  tokens={tokens}
                  value={safeA}
                  onChange={setTokenAIdx}
                  onLookupAddress={handleLookupAddress}
                  inputStyle={sel}
                  loading={loading}
                  lookupLoading={lookupLoading}
                />
                {lookupError && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#c0392b' }}>{lookupError}</div>
                )}
              </Field>

              <Field label="Start Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...sel, colorScheme: 'light' }} />
              </Field>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {!invalid && (
                <div style={{ display: 'flex', gap: 10, flex: '1 1 560px', minWidth: 0 }}>
                  <div
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
                    <span style={{ color: '#365fd9', marginRight: 8 }}>{tokenA.symbol}</span>
                    <span style={{ color: '#5c6b7d', wordBreak: 'break-all' }}>{tokenA.address}</span>
                  </div>
                </div>
              )}

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
            registry={resolvedRegistry}
          />
        </div>
      </div>

      {(loading || pairedLoading) && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#1f314a',
            color: '#c8d8f0',
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            animation: 'toastIn .2s ease',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid #4a7fd4',
              borderTopColor: 'transparent',
              animation: 'spin .7s linear infinite',
              flexShrink: 0,
            }}
          />
          Fetching token names…
        </div>
      )}
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
