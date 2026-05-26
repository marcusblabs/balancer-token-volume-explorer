// Phase 1 smoke test: exercise the lib/balancerApi expansion logic the same
// way useBalancerAddressExpansion exercises it, end-to-end with the real
// Balancer API. Run with: node scripts/smoke_phase1.mjs
//
// Output is intentionally plain JSON so the result can be pasted into chat
// as Phase-1 evidence per the prompt.

import {
  repoChainToGql,
  fetchTokens,
  fetchErc4626Index,
  fetchPoolCountByToken,
} from '../src/lib/balancerApi.js'

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

function buildExpansion({ inputTok, underlyingTok, erc4626Index, poolCounts, inputAddress }) {
  const inputIsWrapper = !!(inputTok?.isErc4626 && inputTok?.underlyingTokenAddress)
  const inputUnderlying = inputIsWrapper ? lower(inputTok.underlyingTokenAddress) : null
  const underlyingAddr = inputUnderlying ?? lower(inputAddress)

  const wrappers = (erc4626Index ?? []).filter(
    (t) => lower(t.underlyingTokenAddress) === underlyingAddr,
  )

  const expanded = []
  const seen = new Set()
  const push = (addr, role, t, isErc4626) => {
    const la = lower(addr)
    if (seen.has(la)) return
    seen.add(la)
    expanded.push({
      address: addr,
      symbol: t?.symbol ?? 'UNKNOWN',
      name: t?.name ?? addr,
      role,
      isErc4626: !!isErc4626,
      isBufferInitialized: !!t?.isBufferAllowed,
      boostedPoolsCount: poolCounts?.get(la) ?? 0,
    })
  }
  if (inputIsWrapper) {
    push(inputTok.address, 'wrapper', inputTok, true)
    push(underlyingAddr, 'underlying', underlyingTok, false)
    for (const w of wrappers) {
      if (lower(w.address) !== lower(inputTok.address)) push(w.address, 'wrapper', w, true)
    }
  } else {
    push(inputAddress, 'underlying', inputTok ?? null, false)
    for (const w of wrappers) push(w.address, 'wrapper', w, true)
  }
  return {
    inputIsWrapper,
    inputUnderlying,
    expandedAddresses: expanded,
    source: 'balancer-api',
  }
}

async function expand(chain, tokenAddress) {
  const gqlChain = repoChainToGql(chain)
  const [tokenMap, erc4626Index] = await Promise.all([
    fetchTokens(gqlChain, [tokenAddress]),
    fetchErc4626Index(gqlChain),
  ])
  const inputTok = tokenMap.get(lower(tokenAddress))
  let underlyingTok = null
  if (inputTok?.isErc4626 && inputTok?.underlyingTokenAddress) {
    const um = await fetchTokens(gqlChain, [inputTok.underlyingTokenAddress])
    underlyingTok = um.get(lower(inputTok.underlyingTokenAddress))
  }
  const provisional = buildExpansion({ inputTok, underlyingTok, erc4626Index, poolCounts: null, inputAddress: tokenAddress })
  const poolCounts = await fetchPoolCountByToken(
    gqlChain,
    provisional.expandedAddresses.map((e) => e.address),
  ).catch(() => new Map())
  return buildExpansion({ inputTok, underlyingTok, erc4626Index, poolCounts, inputAddress: tokenAddress })
}

const cases = [
  { label: 'USDC (underlying)',      chain: 'ethereum', addr: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { label: 'waEthUSDC (wrapper)',    chain: 'ethereum', addr: '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e' },
  { label: 'PEPE (no wrapper)',      chain: 'ethereum', addr: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
]

for (const c of cases) {
  console.log(`\n=== ${c.label} ===`)
  try {
    const data = await expand(c.chain, c.addr)
    console.log(JSON.stringify({
      inputIsWrapper: data.inputIsWrapper,
      inputUnderlying: data.inputUnderlying,
      source: data.source,
      expandedCount: data.expandedAddresses.length,
      addresses: data.expandedAddresses.map((e) => ({
        address: e.address,
        symbol: e.symbol,
        role: e.role,
        isErc4626: e.isErc4626,
        isBufferInitialized: e.isBufferInitialized,
        boostedPoolsCount: e.boostedPoolsCount,
      })),
    }, null, 2))
  } catch (err) {
    console.error('FAILED:', err)
  }
}
