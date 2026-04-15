import { useState, useRef, useEffect } from 'react'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export default function TokenSelect({ tokens, value, onChange, onLookupAddress, inputStyle, loading, lookupLoading }) {
  const selected = tokens[value] ?? null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const isAddress = ADDRESS_RE.test(query.trim())

  const filtered = tokens.reduce((acc, t, i) => {
    const q = query.toLowerCase()
    if (!q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)) {
      acc.push({ ...t, index: i })
    }
    return acc
  }, [])

  // When query is a raw address, prepend a "lookup" sentinel row
  const showLookup = isAddress && onLookupAddress
  const listItems = showLookup
    ? [{ _lookup: true, address: query.trim() }, ...filtered]
    : filtered

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted]
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const select = (index) => {
    onChange(index)
    setOpen(false)
    setQuery('')
  }

  const triggerLookup = (address) => {
    setOpen(false)
    setQuery('')
    onLookupAddress(address)
  }

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        setHighlighted(0)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      setHighlighted((h) => Math.min(h + 1, listItems.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setHighlighted((h) => Math.max(h - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      const item = listItems[highlighted]
      if (item?._lookup) triggerLookup(item.address)
      else if (item) select(item.index)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const isLookupLoading = loading || lookupLoading
  const displayValue = isLookupLoading ? '' : open ? query : (selected ? `${selected.symbol} — ${selected.name}` : '')
  const placeholder = lookupLoading ? 'Resolving address…' : loading ? 'Loading tokens…' : 'Search tokens or paste address…'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={displayValue}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlighted(0) }}
        onFocus={() => { setOpen(true); setHighlighted(0) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLookupLoading}
        style={{ ...inputStyle, cursor: isLookupLoading ? 'default' : 'text', color: isLookupLoading ? '#8a9ab0' : inputStyle?.color }}
        autoComplete="off"
        spellCheck={false}
      />
      {open && listItems.length > 0 && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#f7f9fd',
            border: '1px solid #b9c6da',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(36,52,71,0.12)',
            zIndex: 100,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {listItems.map((t, i) => {
            if (t._lookup) {
              return (
                <div
                  key="__lookup__"
                  onMouseDown={() => triggerLookup(t.address)}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: i === highlighted ? '#dfe9ff' : '#eef4ff',
                    borderBottom: '1px solid #d4dfef',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="5.5" cy="5.5" r="4.5" stroke="#365fd9" strokeWidth="1.4" />
                    <path d="M9 9l2.5 2.5" stroke="#365fd9" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 12, color: '#234ba8', fontWeight: 600, whiteSpace: 'nowrap' }}>Lookup</span>
                  <span style={{ fontSize: 11, color: '#5c6b7d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 6 }}>{t.address}</span>
                </div>
              )
            }
            return (
              <div
                key={t.index}
                onMouseDown={() => select(t.index)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: i === highlighted ? '#dfe9ff' : 'transparent',
                  borderBottom: i < listItems.length - 1 ? '1px solid #e8eef7' : 'none',
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span style={{ fontWeight: 600, color: '#243447', fontSize: 13 }}>{t.symbol}</span>
                <span style={{ color: '#5c6b7d', fontSize: 11, marginLeft: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
