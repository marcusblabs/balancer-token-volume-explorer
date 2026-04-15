import { useState, useEffect } from 'react'
import { DEFAULT_RPCS } from '../data/tokens'

// Module-level cache — persists across renders and chain switches for the session
const metaCache = new Map() // address.toLowerCase() → { symbol, name }

let reqId = 1

async function ethCall(rpcUrl, to, data) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: reqId++,
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result ?? ''
}

function hexToUtf8(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [])
  return new TextDecoder().decode(bytes).replace(/\0/g, '')
}

function decodeString(hex) {
  const data = hex.startsWith('0x') ? hex.slice(2) : hex
  if (data.length < 128) return null
  const len = parseInt(data.slice(64, 128), 16)
  if (!len) return null
  return hexToUtf8(data.slice(128, 128 + len * 2)) || null
}

function decodeBytes32(hex) {
  const data = hex.startsWith('0x') ? hex.slice(2) : hex
  if (!data || data === '0'.repeat(64)) return null
  return hexToUtf8(data.slice(0, 64)) || null
}

async function fetchTokenMeta(address, rpcUrl) {
  const [nameHex, symbolHex] = await Promise.all([
    ethCall(rpcUrl, address, '0x06fdde03'), // name()
    ethCall(rpcUrl, address, '0x95d89b41'), // symbol()
  ])
  const name   = decodeString(nameHex)   ?? decodeBytes32(nameHex)
  const symbol = decodeString(symbolHex) ?? decodeBytes32(symbolHex)
  return name && symbol ? { name, symbol } : null
}

function addressFallback(address) {
  return { symbol: `${address.slice(0, 6)}…`, name: address }
}

function buildTokenList(addresses) {
  return addresses.map((address) => {
    const meta = metaCache.get(address.toLowerCase())
    return { address, ...(meta ?? addressFallback(address)) }
  })
}

export { fetchTokenMeta, metaCache, addressFallback }

export function useTokenRegistry(chain, addresses) {
  const rpcUrl = DEFAULT_RPCS[chain]
  const addrKey = addresses?.join(',') ?? ''
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!addresses?.length || !rpcUrl) {
      setTokens([])
      return
    }

    const missing = addresses.filter((a) => !metaCache.has(a.toLowerCase()))

    if (missing.length === 0) {
      setTokens(buildTokenList(addresses))
      setLoading(false)
      return
    }

    setLoading(true)
    setTokens([])

    Promise.all(
      missing.map(async (address) => {
        try {
          const meta = await fetchTokenMeta(address, rpcUrl)
          if (meta) {
            metaCache.set(address.toLowerCase(), meta)
          } else {
            console.warn(`[TokenRegistry] no name/symbol decoded for ${address}`)
          }
        } catch (err) {
          console.warn(`[TokenRegistry] fetch failed for ${address}:`, err.message)
        }
      }),
    ).then(() => {
      setTokens(buildTokenList(addresses))
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, addrKey, rpcUrl])

  return { tokens, loading }
}
