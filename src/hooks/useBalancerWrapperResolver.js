import { useEffect, useState } from 'react'
import { repoChainToGql, fetchTokens, fetchErc4626Index } from '../lib/balancerApi'

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : s)

const EMPTY_DATA = new Map()

/**
 * Map a batch of addresses on a chain to wrapper metadata.
 *
 * Output map only contains entries where `isErc4626 == true` and
 * `underlyingTokenAddress` is populated. Non-wrapper / unknown addresses
 * are omitted (consumer treats those as "display as is").
 */
export function useBalancerWrapperResolver(chain, addresses) {
  // Stabilize the dependency key so the effect doesn't re-run on every
  // identical-but-newly-allocated array.
  const dependencyKey = JSON.stringify(
    Array.isArray(addresses) ? [...new Set(addresses.map(lower))].sort() : null,
  )

  const [state, setState] = useState({ loading: false, error: null, data: EMPTY_DATA })

  useEffect(() => {
    if (!chain || !addresses?.length) {
      setState({ loading: false, error: null, data: EMPTY_DATA })
      return
    }
    const gqlChain = repoChainToGql(chain)
    if (!gqlChain) {
      setState({ loading: false, error: null, data: EMPTY_DATA })
      return
    }
    const uniq = [...new Set(addresses.map(lower))]
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    ;(async () => {
      try {
        // Lookup the raw addresses (warms the per-token cache).
        const tokenMap = await fetchTokens(gqlChain, uniq, { signal: controller.signal })

        // Collect underlyings we still need symbol/name for.
        const wrappers = []
        const underlyingsNeeded = new Set()
        for (const addr of uniq) {
          const tok = tokenMap.get(addr)
          if (tok?.isErc4626 && tok?.underlyingTokenAddress) {
            wrappers.push(tok)
            underlyingsNeeded.add(lower(tok.underlyingTokenAddress))
          }
        }

        let underlyingMap = new Map()
        if (underlyingsNeeded.size > 0) {
          underlyingMap = await fetchTokens(
            gqlChain,
            [...underlyingsNeeded],
            { signal: controller.signal },
          )
        }

        // Warm the index cache opportunistically (background prefetch). Not awaited.
        fetchErc4626Index(gqlChain).catch(() => {})

        const out = new Map()
        for (const w of wrappers) {
          const ua = lower(w.underlyingTokenAddress)
          const ut = underlyingMap.get(ua)
          out.set(lower(w.address), {
            underlyingAddress: ua,
            underlyingSymbol: ut?.symbol ?? 'UNKNOWN',
            underlyingName: ut?.name ?? ua,
            wrapperSymbol: w.symbol,
            wrapperName: w.name,
          })
        }

        if (controller.signal.aborted) return
        setState({ loading: false, error: null, data: out })
      } catch (err) {
        if (controller.signal.aborted) return
        setState({ loading: false, error: err, data: EMPTY_DATA })
      }
    })()

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, dependencyKey])

  return state
}
