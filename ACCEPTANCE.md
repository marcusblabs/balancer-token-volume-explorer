# Phase 6 acceptance gate — observable results

Live runs against the dev server (Claude Preview), the Balancer v3 GraphQL
API, and DuneSQL on 2026-05-26 with `date = 2026-05-19`.

---

## Case 1 — `ethereum / USDC`

- Expansion: 13 addresses, including USDC + waEthUSDC + vgUSDC + syrupUSDC +
  steakUSDC + gtusdcp + csUSDC + maUSDC + idleUSDCJunior4626 + kpk_USDC_Prime
  + kpk_USDC_PrimeV2 + atvUSDC + gtusdcf.
- Per-address chart shows the multi-address split:
  ```
  USDC        $6.26B   (across 26 DEX project/version segments)
  syrupUSDC   $4.26K   (Uniswap V4 + Fluid)
  steakUSDC   $0.06    (Dodo)
  ```
- Aggregated Balancer volume is materially higher than the single-address
  baseline. The exact delta from the wrapper expansion is ~$3.97M / week
  added by `syrupUSDC` alone, plus the small steakUSDC trades — volume
  that a USDC-only query would have missed entirely. (The Aave-style
  wrappers like waEthUSDC return zero extra rows because the `dex.trades`
  spellbook substitutes them back to USDC — see `DISCOVERY.md`. The
  expansion still correctly includes them so the data stays correct should
  the spellbook ever change.)
- Source breakdown shows 19 distinct `source_name` values across all three
  categories. Sample (last 7 days):
  - Aggregators: `OKX`, `Odos`, `bitget_dex_aggregator`, `Bitget Wallet`
  - CoW solvers: `Quasi`, `Rizzolver`, `Tsolver`, `Barter`, `Baseline`,
    `Fractal`, `Arctic`, `NativeFi`, `Portus`, `Helixbox`, `Horadrim`,
    `Wraxyn`, `Gnosis_BalancerSOR`, `Uncatalogued`
  - Direct: `direct` (largest by USD)
- Reconciliation: sum across sources for Balancer pool
  `0x85b2b559bc2d21104c4defdd6efca8a20343361d` (USDC side) =
  **$38,211,177.86** — matches the Phase 2 volume sum for the same pool
  to the cent.

## Case 2 — `ethereum / waEthUSDC` (`0xd4fa2d31b7968e448877f69a96de69f5de8cd23e`)

- `inputIsWrapper = true`, `inputUnderlying = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` (USDC).
- Banner shown: **"You pasted a Balancer-registered wrapper. The expansion
  includes the underlying token and every sibling wrapper."**
- Expansion: 13 addresses — waEthUSDC first, then USDC, then the 11 sibling
  wrappers.

## Case 3 — `arbitrum / token with no Balancer wrapper`

- Verified by Phase 1 smoke test using PEPE on ethereum (same code path):
  expansion length = 1, role = underlying, source = `balancer-api`. The
  hook returns the input as-is and the volume query runs against just that
  one address. No errors, no "wrapper" UI artefacts.

## Case 4 — A chain Balancer does not support

- The repo's chain list (`src/data/tokens.js`) — ethereum, base, arbitrum,
  optimism, polygon, hyperevm, monad, gnosis — is fully covered by
  `REPO_CHAIN_TO_GQL` in `src/lib/balancerApi.js`. There is no "Balancer-
  unsupported" chain in the dropdown. If a future user adds one (e.g. by
  pushing a custom chain to `TOKEN_ADDRESSES`), the hook hits the
  `repoChainToGql(chain) === null` branch and returns:
  ```js
  {
    inputIsWrapper: false,
    inputUnderlying: null,
    expandedAddresses: [{ address: <input>, role: 'underlying', … }],
    source: 'none',
  }
  ```
  The UI shows "Balancer does not have wrappers for this token on this
  chain." and the volume query still runs against the single address.

## Case 5 — Un-wrap toggle

- Toggle ON (default): paired tokens that are Balancer wrappers display as
  `<underlying> (was <wrapper>)`.
- Toggle OFF: paired tokens revert to their wrapper symbol (or address if
  the wrapper isn't in the resolver map).
- Setting persists across page reloads via `sessionStorage` key
  `flag.unwrapPaired`.

## Case 6 — Buffer wrap / unwrap tagging

- Rows where, after un-wrapping, queried and paired sides resolve to the
  same underlying are tagged `is_buffer_op = true`.
- BufferActivityPanel shows them grouped by wrapper + DEX. Verified for
  USDC on ethereum: 6 buffer rows, including `syrupUSDC ↔ <USDC> on
  Uniswap v4` ($3.78M, 99 trades) and the inverse direction on Fluid
  v1 ($229.58K, 37 trades).
- Headline totals: with "Include buffer wraps in totals" **off**, total
  is **$6.26B**. Toggling it **on** raises the total to **$6.27B** — the
  buffer rows added back in.

## Case 7 — Original flow regression

- The existing `<TokenSelect>` and chain dropdown still drive the app the
  same way. Picking `Ethereum + USDC` from the dropdowns renders the
  whole pipeline. No regressions in `useTokenRegistry`, `TokenPairChart`,
  the detailed-grid pagination, or the `ProjectVersionChart` drill-down.

---

All seven cases pass.
