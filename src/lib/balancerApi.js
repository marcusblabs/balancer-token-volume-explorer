/**
 * Balancer v3 GraphQL client + in-session caches.
 *
 * Single source of truth for `chain -> GqlChain` mapping and shared caches,
 * used by both `useBalancerAddressExpansion` and `useBalancerWrapperResolver`
 * to avoid duplicate network calls.
 */

const BALANCER_API_URL = 'https://api-v3.balancer.fi/graphql'

// Repo chain string -> Balancer GqlChain enum value.
// Chains absent from this map are treated as "Balancer not deployed".
export const REPO_CHAIN_TO_GQL = {
  ethereum: 'MAINNET',
  base: 'BASE',
  arbitrum: 'ARBITRUM',
  optimism: 'OPTIMISM',
  polygon: 'POLYGON',
  hyperevm: 'HYPEREVM',
  monad: 'MONAD',
  gnosis: 'GNOSIS',
  avalanche: 'AVALANCHE',
  sonic: 'SONIC',
}

export function repoChainToGql(chain) {
  return REPO_CHAIN_TO_GQL[chain?.toLowerCase()] ?? null
}

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

async function gqlRequest(query, variables, { signal } = {}) {
  const res = await fetch(BALANCER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  })
  if (!res.ok) throw new Error(`Balancer API HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Balancer API: ${json.errors.map((e) => e.message).join('; ')}`)
  }
  return json.data
}

// ── Caches (module-level, lifetime = browser session) ────────────────────────
// One per chain. Maps lowercase address -> token object (or null sentinel).
const tokenByAddressCache = new Map() // key: `${gqlChain}:${lowerAddr}` -> token or null
const erc4626IndexCache = new Map()   // key: gqlChain -> Array<token>
const erc4626IndexInflight = new Map() // key: gqlChain -> Promise

const TOKEN_FIELDS = `
  address
  chain
  symbol
  name
  decimals
  isErc4626
  isBufferAllowed
  underlyingTokenAddress
`

/**
 * Look up one or more tokens by address on a chain.
 * Caches per-address results. Returns Map<lowerAddr, token|null>.
 */
export async function fetchTokens(gqlChain, addresses, { signal } = {}) {
  const lowers = [...new Set(addresses.map(lower))]
  const out = new Map()
  const missing = []
  for (const a of lowers) {
    const key = `${gqlChain}:${a}`
    if (tokenByAddressCache.has(key)) {
      out.set(a, tokenByAddressCache.get(key))
    } else {
      missing.push(a)
    }
  }
  if (missing.length === 0) return out

  const data = await gqlRequest(
    `query Tokens($chain: GqlChain!, $addrs: [String!]!) {
       tokenGetTokens(chains: [$chain], where: { tokensIn: $addrs }) { ${TOKEN_FIELDS} }
     }`,
    { chain: gqlChain, addrs: missing },
    { signal },
  )
  const found = new Map((data.tokenGetTokens ?? []).map((t) => [lower(t.address), t]))
  for (const a of missing) {
    const tok = found.get(a) ?? null
    tokenByAddressCache.set(`${gqlChain}:${a}`, tok)
    out.set(a, tok)
  }
  return out
}

/**
 * Fetch every ERC-4626 token on a chain. Cached per-chain.
 */
export async function fetchErc4626Index(gqlChain, { signal } = {}) {
  if (erc4626IndexCache.has(gqlChain)) return erc4626IndexCache.get(gqlChain)
  if (erc4626IndexInflight.has(gqlChain)) return erc4626IndexInflight.get(gqlChain)

  const promise = (async () => {
    try {
      const data = await gqlRequest(
        `query Erc4626($chain: GqlChain!) {
           tokenGetTokens(chains: [$chain], where: { typeIn: [ERC4626] }) { ${TOKEN_FIELDS} }
         }`,
        { chain: gqlChain },
        { signal },
      )
      const list = data.tokenGetTokens ?? []
      erc4626IndexCache.set(gqlChain, list)
      // Side-effect: warm the per-token cache too.
      for (const t of list) tokenByAddressCache.set(`${gqlChain}:${lower(t.address)}`, t)
      return list
    } finally {
      // Always clear the inflight entry, success or failure — otherwise a
      // single transient error would poison the whole session.
      erc4626IndexInflight.delete(gqlChain)
    }
  })()
  erc4626IndexInflight.set(gqlChain, promise)
  return promise
}

/**
 * Pool count per token address on a chain. Returns Map<lowerAddr, count>.
 */
export async function fetchPoolCountByToken(gqlChain, addresses, { signal } = {}) {
  const lowers = [...new Set(addresses.map(lower))]
  if (lowers.length === 0) return new Map()
  const data = await gqlRequest(
    `query Pools($chain: GqlChain!, $addrs: [String!]!) {
       poolGetPools(first: 1000, where: { chainIn: [$chain], tokensIn: $addrs }) {
         id
         address
         poolTokens { address }
       }
     }`,
    { chain: gqlChain, addrs: lowers },
    { signal },
  )
  const counts = new Map(lowers.map((a) => [a, 0]))
  for (const p of data.poolGetPools ?? []) {
    for (const t of p.poolTokens ?? []) {
      const a = lower(t.address)
      if (counts.has(a)) counts.set(a, counts.get(a) + 1)
    }
  }
  return counts
}

// ── GitHub fallback: Balancer canonical token list ───────────────────────────
// If the GraphQL API is unreachable, fall back to the published token list.
// This list does not carry `underlyingTokenAddress` on every entry, so the
// fallback can only return the input as-is plus any wrappers whose
// `extensions.underlyingTokenAddress` field is populated.

const GITHUB_TOKENLIST_URL =
  'https://raw.githubusercontent.com/balancer/tokenlists/main/generated/balancer.tokenlist.json'

const githubTokenListCache = { list: null, inflight: null }

export async function fetchGithubTokenList({ signal } = {}) {
  if (githubTokenListCache.list) return githubTokenListCache.list
  if (githubTokenListCache.inflight) return githubTokenListCache.inflight
  githubTokenListCache.inflight = (async () => {
    const res = await fetch(GITHUB_TOKENLIST_URL, { signal })
    if (!res.ok) throw new Error(`GitHub token list HTTP ${res.status}`)
    const json = await res.json()
    githubTokenListCache.list = json.tokens ?? []
    githubTokenListCache.inflight = null
    return githubTokenListCache.list
  })()
  return githubTokenListCache.inflight
}

// Chain id -> repo chain string (only the ones we care about).
const CHAIN_ID_TO_REPO = {
  1: 'ethereum',
  10: 'optimism',
  100: 'gnosis',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
  43114: 'avalanche',
  146: 'sonic',
}

/**
 * Fallback expansion using the GitHub token list. Returns the same shape as
 * the GraphQL path, but with `source = 'github'`.
 */
export function expandFromGithubList(list, chain, tokenAddress) {
  const inputAddr = lower(tokenAddress)
  // Filter to the chain.
  const onChain = list.filter((t) => CHAIN_ID_TO_REPO[t.chainId] === chain)
  const inputTok = onChain.find((t) => lower(t.address) === inputAddr)
  // Best-effort underlying detection from extensions.
  const ext = (t) =>
    t.extensions?.underlyingTokenAddress ?? t.extensions?.underlying ?? null
  const inputUnderlying = inputTok ? lower(ext(inputTok)) : null
  const inputIsWrapper = !!inputUnderlying

  let underlying = inputIsWrapper ? inputUnderlying : inputAddr
  const siblings = onChain.filter((t) => {
    const u = lower(ext(t))
    return u && u === underlying && lower(t.address) !== inputAddr
  })

  const out = []
  if (inputTok) {
    out.push({
      address: inputTok.address,
      symbol: inputTok.symbol,
      name: inputTok.name,
      role: inputIsWrapper ? 'wrapper' : 'underlying',
      isErc4626: inputIsWrapper,
      isBufferInitialized: false,
      boostedPoolsCount: 0,
    })
  } else {
    out.push({
      address: tokenAddress,
      symbol: 'UNKNOWN',
      name: tokenAddress,
      role: 'underlying',
      isErc4626: false,
      isBufferInitialized: false,
      boostedPoolsCount: 0,
    })
  }
  if (inputIsWrapper) {
    const u = onChain.find((t) => lower(t.address) === inputUnderlying)
    if (u) {
      out.push({
        address: u.address,
        symbol: u.symbol,
        name: u.name,
        role: 'underlying',
        isErc4626: false,
        isBufferInitialized: false,
        boostedPoolsCount: 0,
      })
    }
  }
  for (const s of siblings) {
    out.push({
      address: s.address,
      symbol: s.symbol,
      name: s.name,
      role: 'wrapper',
      isErc4626: true,
      isBufferInitialized: false,
      boostedPoolsCount: 0,
    })
  }
  return {
    inputIsWrapper,
    inputUnderlying: inputIsWrapper ? inputUnderlying : null,
    expandedAddresses: out,
    source: 'github',
  }
}
