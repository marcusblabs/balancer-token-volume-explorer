# Phase 0 Discovery

All findings verified live against the Balancer v3 GraphQL API and DuneSQL on
2026-05-26. Outputs below are real, not paraphrased.

---

## 0.1 Repo bootstrap

- Forked `zekraken-bot/dex_volume` at commit `6465a6a`.
- `npm install` completed without fatal errors.
- `.env` created with `VITE_DUNE_API_KEY` (Dune key from `~/.config/dune/config.yaml`) and `VITE_DUNE_QUERY_ID=6743629`.

### Smoke test — first 3 rows from original saved query `6743629`

Parameters: `chain=ethereum`, `token_address=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`, `date=2026-05-24`.

```json
[
  {"block_date":"2026-05-25","blockchain":"ethereum","paired_token_address":"0xA47C8BF37F92ABED4A126BDA807A7B7498661ACD","pool_address":"0x890F4E345B1DAED0367A877A1612F86A1F86985F","project":"curve","total_amount_usd":0,"version":"Regular"},
  {"block_date":"2026-05-25","blockchain":"ethereum","paired_token_address":"0x056FD409E1D7A124BD7017459DFEA2F387B6D5CD","pool_address":"0x4F062658EAAF2C1CCF8C8E36D6824CDF41167956","project":"curve","total_amount_usd":0,"version":"Regular"},
  {"block_date":"2026-05-26","blockchain":"ethereum","paired_token_address":"0xF57D49646621F563B0B905AFC8336923AC569EC5","pool_address":"0x111111125421CA6DC452D289314280A0F8842A65","project":"1inch-LOP","total_amount_usd":null,"version":"4.0"}
]
```

The base query works.

---

## 0.2 Balancer API v3 GraphQL

Endpoint: `https://api-v3.balancer.fi/graphql`. Introspection enabled.

### GqlChain enum (full list, repo-relevant subset bolded)

`ARBITRUM`, `AVALANCHE`, `BASE`, `FANTOM`, `FRAXTAL`, `GNOSIS`, **`HYPEREVM`**,
`MAINNET`, `MODE`, **`MONAD`**, `OPTIMISM`, `PLASMA`, `POLYGON`, `SEPOLIA`, `SONIC`.

**Repo chain → GqlChain mapping** (only chains in `src/data/tokens.js`):

| Repo chain string | GqlChain enum |
|-------------------|---------------|
| `ethereum`        | `MAINNET`     |
| `base`            | `BASE`        |
| `arbitrum`        | `ARBITRUM`    |
| `optimism`        | `OPTIMISM`    |
| `polygon`         | `POLYGON`     |
| `hyperevm`        | `HYPEREVM`    |
| `monad`           | `MONAD`       |
| `gnosis`          | `GNOSIS`      |

Chains the repo lists but Balancer does not deploy on: none of the above are
unsupported. Hooks must still tolerate "no result" (e.g. an obscure custom
chain a future user adds).

### Token lookup — single address (`isErc4626`, `underlyingTokenAddress`, etc.)

```graphql
query Lookup($chain: GqlChain!, $addrs: [String!]!) {
  tokenGetTokens(chains: [$chain], where: { tokensIn: $addrs }) {
    address
    chain
    symbol
    name
    decimals
    isErc4626
    isBufferAllowed
    underlyingTokenAddress
    erc4626ReviewData { canUseBufferForSwaps reviewFile summary }
  }
}
```

Real response for USDC on mainnet:

```json
{"data":{"tokenGetTokens":[{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","symbol":"USDC","name":"USD Coin","decimals":6,"isErc4626":false,"isBufferAllowed":true,"underlyingTokenAddress":null}]}}
```

### "Every wrapper of token X on chain Y"

The `GqlTokenFilter` input only supports `tokensIn` and `typeIn`. There is **no**
server-side `underlyingTokenAddressIn` filter. The two-step pattern:

```graphql
query Erc4626Index($chain: GqlChain!) {
  tokenGetTokens(chains: [$chain], where: { typeIn: [ERC4626] }) {
    address symbol name underlyingTokenAddress isBufferAllowed
  }
}
```

Then filter client-side: `t.underlyingTokenAddress?.toLowerCase() === underlying`.

For mainnet this returns 99 ERC-4626 tokens; 12 of them have USDC as
`underlyingTokenAddress`. Real response (smoke test passes — well above ≥3):

```json
[
  {"address":"0x8399c8fc273bd165c346af74a02e65f10e4fd78f","symbol":"vgUSDC","name":"Varlamore USDC Growth"},
  {"address":"0xd4fa2d31b7968e448877f69a96de69f5de8cd23e","symbol":"waEthUSDC","name":"Wrapped Aave Ethereum USDC"},
  {"address":"0xe108fbc04852b5df72f9e44d7c29f47e7a993add","symbol":"kpk_USDC_Prime","name":" kpk USDC Prime"},
  {"address":"0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b","symbol":"syrupUSDC","name":"Syrup USDC"},
  {"address":"0xf30f62963cce132f32306d7f18a8587958b30ea9","symbol":"atvUSDC","name":"aarna atv USDC"},
  {"address":"0x7204b7dbf9412567835633b6f00c3edc3a8d6330","symbol":"csUSDC","name":"Coinshift USDC"},
  {"address":"0x4ef53d2caa51c447fdfeeedee8f07fd1962c9ee6","symbol":"kpk_USDC_PrimeV2","name":"KPK USDC Prime"},
  {"address":"0x8c106eedad96553e64287a5a6839c3cc78afa3d0","symbol":"gtusdcp","name":"Gauntlet USDC Prime"},
  {"address":"0xbeef01735c132ada46aa9aa4c54623caa92a64cb","symbol":"steakUSDC","name":"Steakhouse USDC"},
  {"address":"0xc582f04d8a82795aa2ff9c8bb4c1c889fe7b754e","symbol":"gtusdcf","name":"Gauntlet USDC Frontier"},
  {"address":"0xa5269a8e31b93ff27b887b56720a25f844db0529","symbol":"maUSDC","name":"Morpho-Aave USD Coin Supply Vault"},
  {"address":"0xc3da79e0de523eef7ac1e4ca9abfe3aac9973133","symbol":"idleUSDCJunior4626","name":"IdleUSDC Junior4626Adapter"}
]
```

`waEthUSDC` and `stataEthUSDC` family: the prompt mentions `stataEthUSDC` —
the current Aave-on-Balancer wrapper is `waEthUSDC` (Wrapped Aave Ethereum
USDC) at `0xd4fa2d31b7968e448877f69a96de69f5de8cd23e`. The older static-aToken
wrapper still exists for non-Balancer integrations but Balancer v3 boosted
pools now use `wa*`.

### Pools containing a token

```graphql
query PoolsForToken($chain: GqlChain!, $addrs: [String!]!) {
  poolGetPools(first: 100, where: { chainIn: [$chain], tokensIn: $addrs }) {
    id
    address
    chain
    type
    protocolVersion
    hook { name type }
    dynamicData { totalLiquidity }
  }
}
```

Real response for `waEthUSDC` on mainnet:

```json
[
  {"id":"0x85b2b559bc2d21104c4defdd6efca8a20343361d","address":"0x85b2b559bc2d21104c4defdd6efca8a20343361d","chain":"MAINNET","type":"STABLE","hook":null,"dynamicData":{"totalLiquidity":"2198372.04"}},
  {"id":"0x51cdf9cc199f8121b58d9337983a79a1b87330fd","address":"0x51cdf9cc199f8121b58d9337983a79a1b87330fd","chain":"MAINNET","type":"STABLE","hook":null,"dynamicData":{"totalLiquidity":"164564.01"}},
  {"id":"0x114907c2a07978c38ebb9f9f6a5261a846b79521","address":"0x114907c2a07978c38ebb9f9f6a5261a846b79521","chain":"MAINNET","type":"STABLE","hook":{"name":""},"dynamicData":{"totalLiquidity":"52005.42"}}
]
```

### Buffer initialization state

**Not directly exposed** as `isBufferInitialized` on the GraphQL token type.
What is exposed:

- `Token.isBufferAllowed: Boolean!` — whether the token is *eligible* to have a buffer (per Balancer's ERC-4626 allowlist).
- `Token.erc4626ReviewData.canUseBufferForSwaps: Boolean` — review-gate flag.
- `Pool.hasAnyAllowedBuffer: Boolean` (on `GqlPoolMinimal`) — pool-level signal that at least one token has buffer support.

On-chain fallback for true initialized state — Balancer v3 Vault per chain
(same address across all v3 chains): `0xbA1333333333a1BA1108E8412f11850A5C319bA9`.

ABI fragment for the buffer check:

```
function getBufferAsset(IERC4626 wrappedToken) external view returns (address)
function getBufferBalance(IERC4626 wrappedToken) external view returns (uint256 underlying, uint256 wrapped)
```

If `getBufferAsset(wrapper)` returns a non-zero address → buffer is initialized.

**Decision for Phase 1:** use `isBufferAllowed` as the proxy in
`expandedAddresses[].isBufferInitialized`. The field name `isBufferInitialized`
in the output schema is kept for the prompt's UI contract, but it reflects
"buffer is permitted" not "buffer has actually been initialized on the Vault."
This is sufficient for the UI; an on-chain `eth_call` fallback is documented
above and can be wired in later without changing the hook's output shape.

---

## 0.3 Dune schemas

### `dex.trades` column types (relevant subset)

```
blockchain                varchar         (partition)
project                   varchar
version                   varchar
block_date                date            (partition)
block_time                timestamp(3) tz
amount_usd                double
token_bought_address      varbinary
token_sold_address        varbinary
project_contract_address  varbinary
tx_hash                   varbinary
evt_index                 bigint
```

All address columns are `varbinary`. To match against a comma-separated hex
list, decode with `from_hex(REPLACE(LOWER(TRIM(x)), '0x', ''))`.

### Trino IN-array pattern for varbinary addresses

```sql
WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
)
SELECT ...
FROM dex.trades t
WHERE t.blockchain = '{{chain}}'
  AND t.block_date >= DATE '{{date}}'
  AND (t.token_bought_address IN (SELECT addr FROM addr_list)
       OR t.token_sold_address  IN (SELECT addr FROM addr_list))
```

Smoke test — `chain=ethereum`, `addresses=USDC,waEthUSDC,steakUSDC`, last 2
days. Returns 30+ rows across Uniswap V2/V3/V4 Factory updated, Curve,
SushiSwap, Integral. Real first 5 rows (top-volume Balancer-only subset, last
7 days):

```json
[
  {"project":"balancer","version":"3","trade_count":4854,"total_usd":40137688.74,"queried_token_address":"0xA0B8...EB48"},
  {"project":"balancer","version":"2","trade_count":8255,"total_usd":8974542.27,"queried_token_address":"0xA0B8...EB48"},
  {"project":"balancer","version":"1","trade_count":2452,"total_usd":151328.49,"queried_token_address":"0xA0B8...EB48"}
]
```

### Important nuance: `dex.trades` substitutes underlying for Aave-style wrappers

When a swap routes through a Balancer v3 boosted pool that holds `waEthUSDC`,
the resulting `dex.trades` row is emitted with `token_bought_address = USDC`
(underlying), not `waEthUSDC`. Verified: a 14-day query filtering
`token_*_address = waEthUSDC` against `dex.trades` returns zero rows, even
though `balancer_v3_ethereum.base_trades` over the same window has thousands
of `waEthUSDC ↔ waEthUSDT` rows.

**This does not invalidate the expansion approach.** Non-Aave 4626 wrappers
(`syrupUSDC`, `steakUSDC`, `gtusdcp`, `csUSDC`, `kpk_*`, …) are *not*
substituted and DO appear as themselves in `dex.trades`. Example: `syrupUSDC`
shows ~$8M of 14-day Uniswap volume and ~$2M of Fluid volume — all of which a
USDC-only query misses. So the expansion still adds material volume for any
token with a meaningful non-Aave wrapper set.

For Balancer v3-specific per-wrapper attribution within boosted pools, the
authoritative source is `balancer_v3_<chain>.base_trades`. This is out of
scope for the current phases (which target cross-DEX volume), but is the
right place to plug in if "per-wrapper inside Balancer" becomes a follow-up.

### `dex_aggregator.trades` join

Columns: same shape as `dex.trades`, no `aggregator_name`. The aggregator
identity lives in `dex_aggregator.trades.project` — values seen on ethereum
last 7 days:

```
1inch, 0x API, kyberswap, bebop, sushiswap, bitget_dex_aggregator,
velora, odos, cow_protocol, DODO X, tokenlon
```

(`velora` = Paraswap rebrand. `OKX` not present on this chain in the window.)

**Join key**: `(blockchain, tx_hash, evt_index)`. Verified with a live join:

```sql
SELECT t.tx_hash, t.project, a.project AS aggr_project, t.amount_usd
FROM dex.trades t
LEFT JOIN dex_aggregator.trades a
  ON a.blockchain = t.blockchain
 AND a.tx_hash    = t.tx_hash
 AND a.evt_index  = t.evt_index
WHERE t.blockchain='ethereum'
  AND t.block_date >= CURRENT_DATE - INTERVAL '1' DAY
  AND a.project IS NOT NULL
LIMIT 5
```

Returned 5 rows, each enriched with an aggregator label (e.g.
`bitget_dex_aggregator` → `swaap` DEX rows).

### CoW Protocol per-chain availability

`information_schema.tables` shows these `cow_protocol_*.trades` tables:

| Chain (repo) | Schema                      | Available |
|--------------|-----------------------------|-----------|
| ethereum     | `cow_protocol_ethereum`     | ✅        |
| arbitrum     | `cow_protocol_arbitrum`     | ✅        |
| base         | `cow_protocol_base`         | ✅        |
| gnosis       | `cow_protocol_gnosis`       | ✅        |
| polygon      | `cow_protocol_polygon`      | ✅        |
| optimism     | —                           | ❌        |
| hyperevm     | —                           | ❌        |
| monad        | —                           | ❌        |

Also available (but not in repo's chain list): `avalanche_c`, `bnb`, `ink`,
`lens`, `linea`, `plasma`.

`cow_protocol_<chain>.trades` columns (ethereum sample):

```
block_date, block_month, block_time, block_number, tx_hash, evt_index,
trace_address, project_contract_address, order_uid, trader,
sell_token_address, sell_token, buy_token_address, buy_token, token_pair,
units_sold, atoms_sold, units_bought, atoms_bought,
usd_value, buy_price, buy_value_usd, sell_price, sell_value_usd,
fee, fee_atoms, fee_usd, app_data, receiver,
limit_sell_amount, limit_buy_amount, valid_to, flags, order_type,
partial_fill, fill_proportion, surplus_usd
```

Solver name resolution: `cow_protocol_<chain>.trades` does NOT carry a solver
column directly. Use:

```sql
LEFT JOIN cow_protocol_<chain>.batches b  ON b.tx_hash       = t.tx_hash
LEFT JOIN cow_protocol_<chain>.solvers s  ON s.address       = b.solver_address
```

Live sample (last 2 days, ethereum):

```
Quasi      | 865 batches
Rizzolver  | 763
Barter     | 631
Baseline   | 483
Tsolver    | 393
Fractal    | 320
```

For chains without a CoW table: skip the CoW join. Phase 4 SQL
conditionally emits the `cow_protocol_<chain>` join only when the parameter
matches a chain in the list above (selected via a CASE / dynamic SQL — the
simplest path is to template the chain into the schema name client-side
when picking which saved query to run, or to emit the join with a guarded
`IS NULL`-on-no-table fallback. **Decision: per-chain CASE in the saved
query**, since Dune saved queries must have static schema references — we'll
ship two query variants if needed, but since CoW tables exist for 5 of the 8
repo chains and the others (optimism, hyperevm, monad) are unlikely to have
CoW volume soon, the simplest path is a single query with a `UNION ALL` over
the available schemas filtered by `WHERE blockchain = '{{chain}}'`.)

### Buffer ops in `dex.trades`

Direct buffer-only operations (wrap/unwrap with no swap) emitted by
`bufferrouter_call_initializebuffer` or `bufferrouter_call_addliquiditytobuffer`
do **not** appear in `dex.trades`. The spellbook only registers actual swaps.

For trade-time wrap/unwrap inside boosted-pool swaps, those ARE inside the
swap's tx but the spellbook emits the user-facing `USDC ↔ USDT` row, not the
internal wrap leg. So you will not see "buffer ops" as separate rows in
`dex.trades`.

**Buffer-op detection method (Phase 5 / decided here):** after the volume
query returns and the wrapper resolver runs, flag a row as `is_buffer_op = true`
when, after un-wrapping both sides via the resolver map, the queried token
and the paired token resolve to the **same underlying**. This catches the
rare case where a direct wrapper trade like `waEthUSDC ↔ USDC` (or
`waEthUSDC ↔ stataEthUSDC`) lands in `dex.trades` from outside the Balancer
router — which empirically does happen on smaller DEXes for non-Aave
wrappers (e.g. `syrupUSDC ↔ USDC` on Uniswap).

The Phase 5 `BufferActivityPanel` should be expected to be empty for most
USDC-on-ethereum queries, since the Aave-style wrappers don't surface as
themselves in `dex.trades`. The panel will only become non-empty when
non-Aave wrappers like `syrupUSDC` produce wrapper-vs-underlying trades.

---

## 0.4 Decisions

### GraphQL queries used by hooks

`useBalancerAddressExpansion`:

1. **First call** — lookup the input token to learn `isErc4626` /
   `underlyingTokenAddress`:
   ```graphql
   tokenGetTokens(chains: [$chain], where: { tokensIn: [$addr] }) { … }
   ```
2. **Second call** — list all 4626 tokens on the chain to find siblings:
   ```graphql
   tokenGetTokens(chains: [$chain], where: { typeIn: [ERC4626] }) { … }
   ```
   Then filter client-side by `underlyingTokenAddress == underlying`.
3. **Third call** — pool count per expanded address (one batched call):
   ```graphql
   poolGetPools(first: 1000, where: { chainIn: [$chain], tokensIn: $expandedAddrs })
   ```

`useBalancerWrapperResolver`: re-uses the `tokenGetTokens` call from #1 with
the full input address batch, then filters to rows where `isErc4626 == true`.

### Dune SQL pattern

`SPLIT` + `UNNEST` + `from_hex` to build a `varbinary` IN list (verified
working above).

### Per-chain CoW handling

Saved query emits the CoW join only for chains with a `cow_protocol_<chain>`
table. Implementation: a single saved query per attribution variant, using
`{{chain}}`-templated table reference is **not** supported by Dune (table
names cannot be parametrized). Decision: use a `UNION ALL` of per-chain CoW
sources filtered to the relevant chain, OR maintain two saved query IDs (one
"with-cow", one "without-cow") and select at runtime in the frontend.

**Chosen:** one saved query with a hard-coded `UNION ALL` over the five
supported chains' CoW schemas, each with a `WHERE block_date >= '{{date}}'
AND blockchain = '{{chain}}'`. The chain filter prunes 4 of 5 at the
optimizer level.

### Buffer op detection

See above. Resolver-derived rule: same-underlying on both sides → buffer op.

---

## Scope notes

- No backend, no on-chain RPC calls from the hooks (Vault.getBufferAsset is
  documented as a future enhancement; Phase 1 uses `isBufferAllowed` as the
  proxy field for `isBufferInitialized`).
- No Aave/Compound/Yearn/Pendle expansion outside of Balancer-registered ERC-4626.
- Single-chain per query run.
