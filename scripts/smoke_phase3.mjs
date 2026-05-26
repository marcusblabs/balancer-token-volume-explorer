// Phase 3 smoke: exercise the wrapper resolver logic against the real
// Balancer API.

import { repoChainToGql, fetchTokens } from '../src/lib/balancerApi.js'

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

async function resolve(chain, addresses) {
  const gqlChain = repoChainToGql(chain)
  const uniq = [...new Set(addresses.map(lower))]
  const tokenMap = await fetchTokens(gqlChain, uniq)
  const underlyings = new Set()
  const wrappers = []
  for (const a of uniq) {
    const t = tokenMap.get(a)
    if (t?.isErc4626 && t?.underlyingTokenAddress) {
      wrappers.push(t)
      underlyings.add(lower(t.underlyingTokenAddress))
    }
  }
  const um = underlyings.size ? await fetchTokens(gqlChain, [...underlyings]) : new Map()
  const out = new Map()
  for (const w of wrappers) {
    const ua = lower(w.underlyingTokenAddress)
    const ut = um.get(ua)
    out.set(lower(w.address), {
      underlyingAddress: ua,
      underlyingSymbol: ut?.symbol ?? 'UNKNOWN',
      underlyingName: ut?.name ?? ua,
      wrapperSymbol: w.symbol,
      wrapperName: w.name,
    })
  }
  return out
}

// stataEthUSDT does not exist on current Balancer; substitute a verified
// non-Aave USDT wrapper instead — `csUSDT` should map to USDT.
// First confirm by lookup; if absent, use waEthUSDT.
const cases = [
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC (not a wrapper)
  '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e', // waEthUSDC (wrapper)
  '0x6982508145454ce325ddbe47a25d4ec3d2311933', // PEPE (not a wrapper)
  '0x7bc3485026ac48b6cf9baf0a377477fff5703af8', // waEthUSDT (wrapper) — substitutes for stataEthUSDT
]

const map = await resolve('ethereum', cases)
console.log('Resolver result (only wrappers present in output map):')
for (const [k, v] of map.entries()) console.log(' ', k, '=>', JSON.stringify(v))
console.log('Inputs NOT in map (treated as display-as-is):')
for (const a of cases) {
  if (!map.has(a)) console.log(' ', a)
}
