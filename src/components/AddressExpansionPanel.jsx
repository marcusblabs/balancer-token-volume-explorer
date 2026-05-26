import { useState } from 'react'

const cellStyle = {
  fontSize: 12,
  padding: '8px 10px',
  borderBottom: '1px solid #e2e8f0',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const explorerUrl = (chain, addr) => {
  const base = {
    ethereum: 'https://etherscan.io/address/',
    base: 'https://basescan.org/address/',
    arbitrum: 'https://arbiscan.io/address/',
    optimism: 'https://optimistic.etherscan.io/address/',
    polygon: 'https://polygonscan.com/address/',
    gnosis: 'https://gnosisscan.io/address/',
    avalanche: 'https://snowtrace.io/address/',
  }[chain] ?? 'https://blockscan.com/address/'
  return base + addr
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {/* noop */}
      }}
      style={{
        background: 'transparent',
        border: '1px solid #c4cfde',
        color: '#365fd9',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 10,
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function AddressExpansionPanel({ chain, expansion, loading, error }) {
  if (loading) {
    return (
      <Card>
        <Header subtitle="Resolving Balancer wrapper set…" />
      </Card>
    )
  }
  const data = expansion ?? {
    inputIsWrapper: false,
    inputUnderlying: null,
    expandedAddresses: [],
    source: 'none',
  }
  const { inputIsWrapper, expandedAddresses, source } = data
  const isUnsupported = source === 'none' && expandedAddresses.length <= 1

  return (
    <Card>
      <Header
        subtitle={
          isUnsupported
            ? 'Balancer does not have wrappers for this token on this chain.'
            : `Expanded to ${expandedAddresses.length} address${expandedAddresses.length === 1 ? '' : 'es'} via ${source}`
        }
      />
      {inputIsWrapper && (
        <div
          style={{
            background: '#fff7e6',
            border: '1px solid #f0c987',
            borderRadius: 8,
            padding: '8px 12px',
            margin: '0 0 12px',
            fontSize: 12,
            color: '#8a6200',
          }}
        >
          You pasted a Balancer-registered wrapper. The expansion includes the
          underlying token and every sibling wrapper.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 8 }}>
          Address expansion error: {String(error.message ?? error)}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#edf2fa' }}>
              <th style={cellStyle}>Symbol</th>
              <th style={cellStyle}>Role</th>
              <th style={cellStyle}>Address</th>
              <th style={cellStyle}>4626</th>
              <th style={cellStyle}>Buffer init.</th>
              <th style={cellStyle}>Pools</th>
              <th style={cellStyle}></th>
            </tr>
          </thead>
          <tbody>
            {expandedAddresses.map((e) => (
              <tr key={e.address}>
                <td style={cellStyle}><strong>{e.symbol}</strong> <span style={{ color: '#5c6b7d' }}>{e.name}</span></td>
                <td style={cellStyle}>
                  <span
                    style={{
                      background: e.role === 'underlying' ? '#e8f3ff' : '#f0e8ff',
                      color: e.role === 'underlying' ? '#234ba8' : '#5a2a8a',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    {e.role}
                  </span>
                </td>
                <td style={{ ...cellStyle, fontFamily: "'JetBrains Mono', monospace", color: '#5c6b7d' }}>
                  <a
                    href={explorerUrl(chain, e.address)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#365fd9' }}
                  >
                    {e.address.slice(0, 6)}…{e.address.slice(-4)}
                  </a>
                </td>
                <td style={cellStyle}>{e.isErc4626 ? '✓' : '—'}</td>
                <td style={cellStyle}>{e.isBufferInitialized ? '✓' : '—'}</td>
                <td style={cellStyle}>{e.boostedPoolsCount ?? 0}</td>
                <td style={cellStyle}><CopyButton value={e.address} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: '#f4f7fc',
      border: '1px solid #c4cfde',
      borderRadius: 12,
      padding: 16,
    }}>
      {children}
    </div>
  )
}

function Header({ subtitle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: '#1f314a' }}>
        Address expansion
      </div>
      <div style={{ fontSize: 11, color: '#5c6b7d' }}>{subtitle}</div>
    </div>
  )
}
