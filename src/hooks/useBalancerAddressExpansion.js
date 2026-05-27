import { useEffect, useState } from 'react'
import {
  repoChainToGql,
  fetchTokens,
  fetchErc4626Index,
  fetchPoolCountByToken,
  fetchGithubTokenList,
  expandFromGithubList,
} from '../lib/balancerApi'

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

const EMPTY = {
  inputIsWrapper: false,
  inputUnderlying: null,
  expandedAddresses: [],
  source: 'none',
}

function buildExpansion({ inputTok, underlyingTok, erc4626Index, poolCounts, inputAddress }) {
  // Decide underlying for the expansion set.
  const inputIsWrapper = !!(inputTok?.isErc4626 && inputTok?.underlyingTokenAddress)
  const inputUnderlying = inputIsWrapper ? lower(inputTok.underlyingTokenAddress) : null
  const underlyingAddr = inputUnderlying ?? lower(inputAddress)

  // Find all 4626 tokens whose underlying == underlyingAddr.
  const wrappers = (erc4626Index ?? []).filter(
    (t) => lower(t.underlyingTokenAddress) === underlyingAddr,
  )

  // Build the expansion list.
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
    // input itself first
    push(inputTok.address, 'wrapper', inputTok, true)
    // underlying (look it up from cache if available — may not be 4626 indexed)
    push(underlyingAddr, 'underlying', underlyingTok, false)
    // siblings
    for (const w of wrappers) {
      if (lower(w.address) !== lower(inputTok.address)) push(w.address, 'wrapper', w, true)
    }
  } else {
    // input is underlying
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

export function useBalancerAddressExpansion(chain, tokenAddress) {
  const [state, setState] = useState({ loading: false, error: null, data: EMPTY })

  useEffect(() => {
    if (!chain || !tokenAddress) {
      setState({ loading: false, error: null, data: EMPTY })
      return
    }
    const gqlChain = repoChainToGql(chain)
    if (!gqlChain) {
      // Balancer not deployed on this chain.
      setState({
        loading: false,
        error: null,
        data: {
          inputIsWrapper: false,
          inputUnderlying: null,
          expandedAddresses: [
            {
              address: tokenAddress,
              symbol: 'UNKNOWN',
              name: tokenAddress,
              role: 'underlying',
              isErc4626: false,
              isBufferInitialized: false,
              boostedPoolsCount: 0,
            },
          ],
          source: 'none',
        },
      })
      return
    }

    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    ;(async () => {
      try {
        // Settle independently — a flake on the (potentially heavy) ERC4626
        // index shouldn't throw away a perfectly good single-token lookup.
        const [tokenSettled, indexSettled] = await Promise.allSettled([
          fetchTokens(gqlChain, [tokenAddress], { signal: controller.signal }),
          fetchErc4626Index(gqlChain, { signal: controller.signal }),
        ])
        if (tokenSettled.status === 'rejected') throw tokenSettled.reason
        const tokenMap = tokenSettled.value
        const erc4626Index = indexSettled.status === 'fulfilled' ? indexSettled.value : []
        const indexError = indexSettled.status === 'rejected' ? indexSettled.reason : null
        if (indexError && indexError.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.warn('Balancer ERC4626 index lookup failed, no wrappers will be listed:', indexError)
        }
        const inputTok = tokenMap.get(lower(tokenAddress))

        // If input is a wrapper, fetch the underlying token's meta too.
        let underlyingTok = null
        if (inputTok?.isErc4626 && inputTok?.underlyingTokenAddress) {
          const underMap = await fetchTokens(
            gqlChain,
            [inputTok.underlyingTokenAddress],
            { signal: controller.signal },
          )
          underlyingTok = underMap.get(lower(inputTok.underlyingTokenAddress))
        }

        // Compute the to-be-expanded set so we can fetch pool counts in one call.
        const provisional = buildExpansion({
          inputTok,
          underlyingTok,
          erc4626Index,
          poolCounts: null,
          inputAddress: tokenAddress,
        })
        let data = provisional
        try {
          const poolCounts = await fetchPoolCountByToken(
            gqlChain,
            provisional.expandedAddresses.map((e) => e.address),
            { signal: controller.signal },
          )
          data = buildExpansion({
            inputTok,
            underlyingTok,
            erc4626Index,
            poolCounts,
            inputAddress: tokenAddress,
          })
        } catch (poolErr) {
          // Non-fatal: keep expansion without pool counts.
          if (poolErr.name !== 'AbortError') {
            // eslint-disable-next-line no-console
            console.warn('poolGetPools failed, continuing without counts:', poolErr)
          }
        }

        if (controller.signal.aborted) return
        setState({ loading: false, error: null, data })
      } catch (err) {
        if (controller.signal.aborted) return
        // Try GitHub fallback.
        try {
          const list = await fetchGithubTokenList({ signal: controller.signal })
          const data = expandFromGithubList(list, chain, tokenAddress)
          if (data.expandedAddresses.length === 0) {
            data.expandedAddresses = [
              {
                address: tokenAddress,
                symbol: 'UNKNOWN',
                name: tokenAddress,
                role: 'underlying',
                isErc4626: false,
                isBufferInitialized: false,
                boostedPoolsCount: 0,
              },
            ]
            data.source = 'none'
          }
          setState({ loading: false, error: null, data })
        } catch (fallbackErr) {
          // Both failed — input only, with error attached.
          setState({
            loading: false,
            error: err,
            data: {
              inputIsWrapper: false,
              inputUnderlying: null,
              expandedAddresses: [
                {
                  address: tokenAddress,
                  symbol: 'UNKNOWN',
                  name: tokenAddress,
                  role: 'underlying',
                  isErc4626: false,
                  isBufferInitialized: false,
                  boostedPoolsCount: 0,
                },
              ],
              source: 'none',
            },
          })
        }
      }
    })()

    return () => controller.abort()
  }, [chain, tokenAddress])

  return state
}
