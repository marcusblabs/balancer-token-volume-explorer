import { useEffect, useState } from 'react'
import { getDuneApiKey, setDuneApiKey, subscribeDuneApiKey, looksLikeDuneKey } from '../lib/duneApiKey'

export default function ApiKeyPanel() {
  const [key, setKey] = useState(() => getDuneApiKey())
  const [editing, setEditing] = useState(() => !getDuneApiKey())
  const [draft, setDraft] = useState('')

  useEffect(() => subscribeDuneApiKey((v) => setKey(v)), [])

  const mask = (k) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '')

  const save = () => {
    const t = draft.trim()
    if (!looksLikeDuneKey(t)) return
    setDuneApiKey(t)
    setDraft('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div style={panelStyle}>
        <div>
          <span style={{ fontSize: 11, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em' }}>Dune API key</span>
          <div style={{ fontSize: 12, color: '#243447', fontFamily: "'JetBrains Mono', monospace" }}>{mask(key)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setDraft(''); setEditing(true) }} style={btnSecondary}>Change</button>
          <button onClick={() => setDuneApiKey('')} style={btnSecondary}>Forget</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...panelStyle, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: '#5c6b7d', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Add your Dune API key
        </div>
        <div style={{ fontSize: 11, color: '#5c6b7d', marginTop: 4 }}>
          Free key at <a href="https://dune.com/settings/api" target="_blank" rel="noreferrer" style={{ color: '#365fd9' }}>dune.com/settings/api</a>.
          Stored only in your browser's localStorage — never sent anywhere except dune.com.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste your Dune API key…"
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          style={{
            flex: 1,
            background: '#f7f9fd',
            border: '1px solid #b9c6da',
            color: '#243447',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
          }}
        />
        <button
          onClick={save}
          disabled={!looksLikeDuneKey(draft.trim())}
          style={{
            ...btnPrimary,
            opacity: looksLikeDuneKey(draft.trim()) ? 1 : 0.5,
            cursor: looksLikeDuneKey(draft.trim()) ? 'pointer' : 'default',
          }}
        >
          Save
        </button>
        {key && (
          <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
        )}
      </div>
    </div>
  )
}

const panelStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  background: '#fff7e6',
  border: '1px solid #f0c987',
  borderRadius: 12,
  padding: '10px 16px',
  flexWrap: 'wrap',
}

const btnPrimary = {
  background: '#dfe9ff',
  border: '1px solid #8ca8f0',
  color: '#234ba8',
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer',
}
const btnSecondary = {
  background: 'transparent',
  border: '1px solid #c4cfde',
  color: '#5c6b7d',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer',
}
