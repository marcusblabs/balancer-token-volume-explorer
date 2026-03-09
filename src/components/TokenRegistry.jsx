import { useState } from 'react'
import { CHAINS, CHAIN_LABELS } from '../data/tokens'

const inputStyle = {
  background: '#f7f9fd',
  border: '1px solid #b9c6da',
  color: '#243447',
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'JetBrains Mono', monospace",
}

export default function TokenRegistry({ registry, onAdd, onRemove }) {
  const [newChain, setNewChain] = useState('ethereum')
  const [newSymbol, setNewSymbol] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [expanded, setExpanded] = useState(new Set(['ethereum']))

  const toggle = (ch) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(ch) ? next.delete(ch) : next.add(ch)
      return next
    })
  }

  const handleAdd = () => {
    const addr = newAddress.trim()
    if (!newSymbol.trim() || !addr) return
    if (!addr.match(/^0x[0-9a-fA-F]{40}$/)) {
      alert('Invalid address: must be 0x followed by 40 hex characters.')
      return
    }
    onAdd({
      chain: newChain,
      symbol: newSymbol.trim().toUpperCase(),
      name: newName.trim() || newSymbol.trim(),
      address: addr,
    })
    setNewSymbol('')
    setNewName('')
    setNewAddress('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#5c6b7d', marginBottom: 14 }}>
          Add Token
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 2fr', gap: 10, alignItems: 'end' }}>
          <div>
            <Label>Chain</Label>
            <select style={inputStyle} value={newChain} onChange={(e) => setNewChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {CHAIN_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Symbol</Label>
            <input
              placeholder="USDC"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div>
            <Label>Name</Label>
            <input
              placeholder="USD Coin"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div>
            <Label>Address</Label>
            <input
              placeholder="0x..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!newSymbol.trim() || !newAddress.trim()}
          style={{
            marginTop: 12,
            background: newSymbol && newAddress ? '#e7f5ed' : '#e4e8ef',
            border: `1px solid ${newSymbol && newAddress ? '#9fccb0' : '#c6cedd'}`,
            color: newSymbol && newAddress ? '#2f8f5b' : '#7f8a9a',
            padding: '7px 20px',
            borderRadius: 8,
            fontSize: 12,
            cursor: newSymbol && newAddress ? 'pointer' : 'default',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'all .15s',
          }}
        >
          + Add Token
        </button>
      </div>

      {CHAINS.map((ch) => {
        const tokens = registry[ch] ?? []
        const isOpen = expanded.has(ch)
        return (
          <div key={ch} style={{ background: '#f4f7fc', border: '1px solid #c4cfde', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(ch)}
              style={{
                width: '100%',
  boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 16px',
                background: '#ecf2fa',
                border: 'none',
                borderBottom: isOpen ? '1px solid #c4cfde' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#5c6b7d', fontSize: 10 }}>{isOpen ? 'v' : '>'}</span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#1f314a' }}>{CHAIN_LABELS[ch]}</span>
              <span
                style={{
                  background: '#e6edf9',
                  color: '#365fd9',
                  fontSize: 10,
                  padding: '1px 8px',
                  borderRadius: 4,
                }}
              >
                {tokens.length}
              </span>
            </button>

            {isOpen && (
              <table style={{ width: '100%',
  boxSizing: 'border-box', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #c4cfde' }}>
                    {['Symbol', 'Name', 'Address', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '7px 16px',
                          textAlign: 'left',
                          color: '#5c6b7d',
                          fontWeight: 400,
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t, i) => (
                    <tr key={i} style={{ borderBottom: i < tokens.length - 1 ? '1px solid #d7dfec' : 'none' }}>
                      <td style={{ padding: '8px 16px', color: '#365fd9', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {t.symbol}
                      </td>
                      <td style={{ padding: '8px 16px', color: '#5f6f84', fontSize: 12 }}>{t.name}</td>
                      <td style={{ padding: '8px 16px', color: '#5c6b7d', fontFamily: 'monospace', fontSize: 11 }}>{t.address}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => onRemove(ch, i)}
                          title="Remove token"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#5c6b7d',
                            cursor: 'pointer',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: '0 4px',
                            transition: 'color .1s',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.color = '#c45858'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.color = '#5c6b7d'
                          }}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tokens.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '14px 16px', color: '#5c6b7d', fontStyle: 'italic', fontSize: 12 }}>
                        No tokens - add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace" }}>
      {children}
    </div>
  )
}
