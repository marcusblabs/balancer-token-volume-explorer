import { useState, useEffect, useMemo, useRef } from 'react'
import { TOKEN_ADDRESSES, CHAIN_LABELS, CHAINS, DEFAULT_RPCS } from './data/tokens'
import { useDuneQuery, STATUS } from './hooks/useDuneQuery'
import { useTokenRegistry, fetchTokenMeta, metaCache, addressFallback } from './hooks/useTokenRegistry'
import { useBalancerAddressExpansion } from './hooks/useBalancerAddressExpansion'
import { useBalancerWrapperResolver } from './hooks/useBalancerWrapperResolver'
import ResultsTable from './components/ResultsTable'
import TokenSelect from './components/TokenSelect'
import AddressExpansionPanel from './components/AddressExpansionPanel'
import PerAddressVolumeChart from './components/PerAddressVolumeChart'
import BufferActivityPanel from './components/BufferActivityPanel'
import SourceBreakdownChart from './components/SourceBreakdownChart'
import SourceBreakdownTable from './components/SourceBreakdownTable'

const VOLUME_QUERY_ID = (import.meta.env.VITE_DUNE_VOLUME_QUERY_ID ?? '').trim()
const SOURCE_QUERY_ID = (import.meta.env.VITE_DUNE_SOURCE_QUERY_ID ?? '').trim()

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

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

function readBool(key, fallback) {
  try {
    const v = sessionStorage.getItem(key)
    if (v === null) return fallback
    return v === 'true'
  } catch {
    return fallback
  }
}
function writeBool(key, value) {
  try { sessionStorage.setItem(key, String(value)) } catch { /* noop */ }
}

export default function App() {
  const [chain, setChain] = useState('ethereum')
  const [tokenAIdx, setTokenAIdx] = useState(0)
  const [date, setDate] = useState(() => getLocalDateInputValue(-7))

  const [customAddresses, setCustomAddresses] = useState({})
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)

  // Header toggles, both persisted in sessionStorage.
  const [unwrapPaired, setUnwrapPaired] = useState(() => readBool('flag.unwrapPaired', true))
  const [includeBuffer, setIncludeBuffer] = useState(() => readBool('flag.includeBuffer', false))
  useEffect(() => writeBool('flag.unwrapPaired', unwrapPaired), [unwrapPaired])
  useEffect(() => writeBool('flag.includeBuffer', includeBuffer), [includeBuffer])

  const chainAddresses = useMemo(() => [
    ...TOKEN_ADDRESSES[chain],
    ...(customAddresses[chain] ?? []),
  ], [chain, customAddresses])

  const { tokens, loading } = useTokenRegistry(chain, chainAddresses)
  const [resolvedRegistry, setResolvedRegistry] = useState({})
  useEffect(() => {
    if (tokens.length > 0 && !loading) {
      setResolvedRegistry((prev) => ({ ...prev, [chain]: tokens }))
    }
  }, [chain, tokens, loading])

  // Pick selected token from registry.
  const safeA = Math.min(tokenAIdx, tokens.length - 1)
  const tokenA = tokens[safeA]
  const invalid = !tokenA || loading

  // ── Balancer wrapper expansion (Phase 1 hook) ─────────────────────────────
  const { data: expansion, loading: expansionLoading, error: expansionError } =
    useBalancerAddressExpansion(chain, tokenA?.address ?? null)

  const expandedCount = expansion?.expandedAddresses?.length ?? 0

  // ── Volume + source queries (Phase 2 + 4) ─────────────────────────────────
  const volumeQuery = useDuneQuery(VOLUME_QUERY_ID || undefined)
  const sourceQuery = useDuneQuery(SOURCE_QUERY_ID || undefined)

  const [queriedToken, setQueriedToken] = useState(null)
  const [runStamp, setRunStamp] = useState(0)

  const isRunning = useMemo(() => {
    const r = (s) => s === STATUS.EXECUTING || s === STATUS.POLLING
    return r(volumeQuery.status) || r(sourceQuery.status)
  }, [volumeQuery.status, sourceQuery.status])

  // Wrapper resolver: input is the union of expanded addresses AND every
  // paired address that came back in volume rows.
  const pairedAddresses = useMemo(() => {
    const set = new Set()
    for (const r of volumeQuery.rows ?? []) {
      const a = r.paired_token_address
      if (typeof a === 'string' && a.startsWith('0x')) set.add(a.toLowerCase())
    }
    return [...set]
  }, [volumeQuery.rows])

  const resolverInput = useMemo(() => {
    const set = new Set(pairedAddresses)
    for (const e of expansion?.expandedAddresses ?? []) set.add(lower(e.address))
    return [...set]
  }, [pairedAddresses, expansion])

  const wrapperResolver = useBalancerWrapperResolver(chain, resolverInput)

  // Resolve paired tokens to readable symbols for the existing registry display.
  const { tokens: pairedTokens } = useTokenRegistry(chain, pairedAddresses)
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

  // ── Post-process rows: paired_display + is_buffer_op + filter ─────────────
  const wrapperMap = wrapperResolver.data

  const enrichRow = (r) => {
    const queriedAddr = lower(r.queried_token_address ?? '')
    const pairedAddr = lower(r.paired_token_address ?? '')
    const pairedWrap = wrapperMap?.get(pairedAddr)
    const queriedWrap = wrapperMap?.get(queriedAddr)
    const pairedUnderlying = pairedWrap?.underlyingAddress ?? pairedAddr
    const queriedUnderlying = queriedWrap?.underlyingAddress ?? queriedAddr
    const isBufferOp = !!(pairedUnderlying && queriedUnderlying && pairedUnderlying === queriedUnderlying)
    let pairedDisplay
    if (pairedWrap && unwrapPaired) {
      pairedDisplay = `${pairedWrap.underlyingSymbol} (was ${pairedWrap.wrapperSymbol})`
    } else if (pairedAddr) {
      // Fall back to TokenSelect registry lookup for a readable symbol.
      const fromRegistry = (resolvedRegistry[chain] ?? []).find((t) => t.address.toLowerCase() === pairedAddr)
      pairedDisplay = fromRegistry?.symbol ?? pairedAddr
    } else {
      pairedDisplay = '—'
    }
    return { ...r, paired_display: pairedDisplay, is_buffer_op: isBufferOp }
  }

  const enrichedVolumeRows = useMemo(
    () => (volumeQuery.rows ?? []).map(enrichRow),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [volumeQuery.rows, wrapperMap, unwrapPaired, resolvedRegistry, chain],
  )

  const headlineRows = useMemo(
    () => (includeBuffer ? enrichedVolumeRows : enrichedVolumeRows.filter((r) => !r.is_buffer_op)),
    [enrichedVolumeRows, includeBuffer],
  )

  const bufferRows = useMemo(
    () => enrichedVolumeRows.filter((r) => r.is_buffer_op),
    [enrichedVolumeRows],
  )

  const headlineColumns = useMemo(
    () => [
      ...(volumeQuery.columns ?? []),
      ...((volumeQuery.columns ?? []).includes('paired_display') ? [] : ['paired_display']),
      ...((volumeQuery.columns ?? []).includes('is_buffer_op') ? [] : ['is_buffer_op']),
    ],
    [volumeQuery.columns],
  )

  // ── Lookup-address handler (unchanged from base repo) ─────────────────────
  const handleLookupAddress = async (address) => {
    const lowerAddr = address.toLowerCase()
    const existing = tokens.findIndex((t) => t.address.toLowerCase() === lowerAddr)
    if (existing !== -1) {
      setTokenAIdx(existing)
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    try {
      const rpcUrl = DEFAULT_RPCS[chain]
      if (!metaCache.has(lowerAddr)) {
        const meta = await fetchTokenMeta(address, rpcUrl)
        if (meta) metaCache.set(lowerAddr, meta)
        else metaCache.set(lowerAddr, addressFallback(address))
      }
      setCustomAddresses((prev) => {
        const list = prev[chain] ?? []
        if (list.some((a) => a.toLowerCase() === lowerAddr)) return prev
        return { ...prev, [chain]: [...list, address] }
      })
      setPendingSelect(lowerAddr)
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

  // ── Run handler — fires both Dune queries with the expanded address set ──
  const handleRun = () => {
    if (invalid || isRunning) return
    setQueriedToken(tokenA)
    setRunStamp((s) => s + 1)
    const expandedAddresses = expansion?.expandedAddresses?.length
      ? expansion.expandedAddresses.map((e) => e.address.toLowerCase())
      : [tokenA.address.toLowerCase()]
    const params = {
      chain,
      token_addresses: expandedAddresses.join(','),
      date,
    }
    if (VOLUME_QUERY_ID) volumeQuery.run({ queryId: VOLUME_QUERY_ID, params })
    if (SOURCE_QUERY_ID) sourceQuery.run({ queryId: SOURCE_QUERY_ID, params })
  }

  const handleCancel = () => {
    volumeQuery.cancel()
    sourceQuery.cancel()
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        <div style={{ marginBottom: 24, animation: 'fadeUp .4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#365fd9" strokeWidth="1.5" />
              <path d="M5 9h8M9 5v8" stroke="#365fd9" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#1f314a', letterSpacing: '-0.02em' }}>
              Token Volume Explorer — Balancer Wrapper Expansion
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#5c6b7d', margin: 0, paddingLeft: 30 }}>
            Pick chain + token. The app expands to all Balancer-registered wrappers, queries DEX volume across the set, and attributes by source.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp .3s ease' }}>
          <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 20 }}>
            <div className="query-grid" style={{ display: 'grid', gap: 12 }}>
              <Field label="Chain">
                <select style={sel} value={chain} onChange={(e) => handleChainChange(e.target.value)}>
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>{CHAIN_LABELS[c]}</option>
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
                  <div style={{ background: '#edf2fa', border: '1px solid #c6d2e4', borderRadius: 7, padding: '6px 12px', fontSize: 11, flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#365fd9', marginRight: 8 }}>{tokenA.symbol}</span>
                    <span style={{ color: '#5c6b7d', wordBreak: 'break-all' }}>{tokenA.address}</span>
                  </div>
                </div>
              )}
              <button
                onClick={isRunning ? handleCancel : handleRun}
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

          {/* Header controls — toggles persisted in sessionStorage */}
          <div style={{
            display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap',
            background: '#edf2fa', border: '1px solid #c4cfde', borderRadius: 12, padding: '10px 16px',
          }}>
            <Toggle
              checked={unwrapPaired}
              onChange={setUnwrapPaired}
              label="Un-wrap paired tokens"
              hint="When a paired token is a Balancer wrapper, show its underlying."
            />
            <Toggle
              checked={includeBuffer}
              onChange={setIncludeBuffer}
              label="Include buffer wraps in totals"
              hint="When off, rows whose two sides resolve to the same underlying are excluded from headline aggregates."
            />
          </div>

          <AddressExpansionPanel chain={chain} expansion={expansion} loading={expansionLoading} error={expansionError} />

          <PerAddressVolumeChart rows={headlineRows} expansion={expansion} />

          <BufferActivityPanel rows={bufferRows} wrapperMap={wrapperMap} />

          <ResultsTable
            status={volumeQuery.status}
            rows={headlineRows}
            columns={headlineColumns}
            error={volumeQuery.error}
            meta={volumeQuery.meta}
            executionId={volumeQuery.executionId}
            onCancel={handleCancel}
            registry={resolvedRegistry}
            queriedToken={queriedToken}
            expandedCount={expandedCount}
          />

          {sourceQuery.rows?.length > 0 && (
            <>
              <SourceBreakdownChart rows={sourceQuery.rows} />
              <SourceBreakdownTable rows={sourceQuery.rows} />
            </>
          )}

          {!VOLUME_QUERY_ID && (
            <div style={{ fontSize: 11, color: '#c0392b' }}>
              VITE_DUNE_VOLUME_QUERY_ID is not set in .env — the new pipeline cannot run.
            </div>
          )}
        </div>
      </div>

      {(loading || expansionLoading) && (
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
          {expansionLoading ? 'Resolving Balancer wrappers…' : 'Fetching token names…'}
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

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#365fd9' }}
      />
      <span style={{ fontSize: 12, color: '#243447' }}>{label}</span>
      {hint && <span style={{ fontSize: 10, color: '#8a9ab0' }} title={hint}>ⓘ</span>}
    </label>
  )
}
