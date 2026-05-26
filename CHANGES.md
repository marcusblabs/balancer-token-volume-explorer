# CHANGES

Token Volume Explorer with Balancer Wrapper Expansion. Built on top of
`zekraken-bot/dex_volume` (React + Vite + Dune Analytics).

## New files

### Hooks + Balancer client
- `src/lib/balancerApi.js` — module-level Balancer v3 GraphQL client. Owns the
  `chain → GqlChain` enum mapping, the per-chain ERC-4626 index cache, the
  per-token cache, and the GitHub-canonical-token-list fallback. Shared by
  both new hooks.
- `src/hooks/useBalancerAddressExpansion.js` — given `(chain, tokenAddress)`,
  returns the input expanded to its Balancer wrapper set: the underlying plus
  every Balancer-registered ERC-4626 wrapper that shares an underlying.
  Falls back to the GitHub token list if the API is unreachable.
- `src/hooks/useBalancerWrapperResolver.js` — batch-resolves a list of
  addresses on a chain to wrapper metadata (`underlyingAddress`,
  `underlyingSymbol`, `wrapperSymbol`, …) so paired-token UNDERLYINGs can be
  rendered consistently.

### Components
- `src/components/AddressExpansionPanel.jsx` — table of the expanded address
  set with role / 4626 / buffer / pool-count columns + a "you pasted a
  wrapper" banner.
- `src/components/PerAddressVolumeChart.jsx` — stacked bar chart, x-axis =
  queried address symbol, stacked by DEX project/version.
- `src/components/BufferActivityPanel.jsx` — wrap/unwrap rows grouped by
  wrapper + DEX. Hidden when empty.
- `src/components/SourceBreakdownChart.jsx` — stacked bar by DEX, segments
  coloured by category (aggregator / CoW solver / direct) with per-source
  shading.
- `src/components/SourceBreakdownTable.jsx` — tabular view with a category
  filter (All / Aggregators / CoW solvers / Direct).

### Dune queries
- `dune_queries/volume_by_pool.sql` (saved as query 7582218): per-pool,
  per-day, per-paired, per-queried-address volume across `dex.trades` for
  the comma-separated address list. Trino `IN` against `varbinary` via
  `SPLIT + from_hex + UNNEST`.
- `dune_queries/source_attribution.sql` (saved as query 7582229): same
  parameters, breaks volume down by attribution source. LEFT JOINs
  `dex_aggregator.trades` on `(blockchain, tx_hash, evt_index)` for the
  generic aggregator label and a `UNION ALL` over the five
  `cow_protocol_<chain>` schemas (ethereum / arbitrum / base / gnosis /
  polygon) on `tx_hash → batches → solvers.name` for CoW solver detail.
  CoW solver wins over the generic `cow_protocol` aggregator label.

### Docs / scripts
- `DISCOVERY.md` — Phase 0 discovery notes: every GraphQL query, every Dune
  schema fact, and the load-bearing decisions (per-chain CoW handling,
  buffer-op detection rule, underlying-substitution nuance in `dex.trades`
  for Aave-style wrappers).
- `scripts/smoke_phase1.mjs` — exercises `useBalancerAddressExpansion`'s pure
  logic against the live API for USDC / waEthUSDC / PEPE.
- `scripts/smoke_phase3.mjs` — same for `useBalancerWrapperResolver` on
  USDC / waEthUSDC / PEPE / waEthUSDT.
- `.env.example` — adds `VITE_DUNE_VOLUME_QUERY_ID` + `VITE_DUNE_SOURCE_QUERY_ID`.
- `.claude/launch.json` — preview-server config (gstack Claude Preview).

## Modified files

- `src/hooks/useDuneQuery.js` — generalised. `run({ chain, tokenA, date })`
  still works (backwards-compatible). New shape `run({ queryId, params })`
  drives the new volume + source queries from the same hook.
- `src/components/ProjectVersionChart.jsx` — adds `· Aggregated across N
  addresses` subtitle when the expansion contains more than one address.
- `src/components/ResultsTable.jsx` — promotes `queried_token_address`,
  `paired_display`, `is_buffer_op` into the priority-column ordering and
  renders `is_buffer_op` as a `⚠ buffer` tag.
- `src/App.jsx` — full rewrite around the new pipeline. Adds the two header
  toggles (`Un-wrap paired tokens`, `Include buffer wraps in totals`), both
  persisted in `sessionStorage`. Re-orders the page top-to-bottom per the
  Phase 5 spec. Frontend post-processing computes `paired_display` and
  `is_buffer_op` per row using the wrapper resolver.

## Scope notes (out of scope)

- No backend, no serverless. Browser-only HTTP.
- No on-chain `eth_call` from the hooks. `isBufferInitialized` is sourced
  from `Token.isBufferAllowed` (the eligibility flag) as a proxy. The on-
  chain truth lives on Balancer v3 Vault `0xbA1333333333a1BA1108E8412f11850A5C319bA9`
  `.getBufferAsset(wrapper)` and could be wired in later without changing
  the hook output shape.
- Expansion is Balancer-only: Aave/Compound/Yearn/Pendle wrappers outside
  of Balancer's ERC-4626 registry are not picked up.
- Single-chain per query run; multi-chain runs are out of scope.

## Known nuances (see `DISCOVERY.md` for full detail)

- `dex.trades` substitutes the underlying for Aave-style wrappers (e.g.
  `waEthUSDC → USDC`), so the wrapper address returns zero rows for those
  trades. The expansion still adds material extra volume for the many
  non-Aave wrappers (`syrupUSDC`, `steakUSDC`, `gtusdcp`, `csUSDC`,
  `kpk_*`, …) which are not substituted and would otherwise be missed by a
  single-address query.
- The Phase 5 `BufferActivityPanel` is therefore often sparse for USDC-on-
  ethereum: Aave-side buffer operations don't surface in `dex.trades` and
  only non-Aave-wrapper-vs-underlying trades land in the panel.
