# Token Volume Explorer — Balancer Wrapper Expansion

A React app that lets you select a chain and token, expands the input to its
Balancer wrapper set (every Balancer-registered ERC-4626 wrapper that shares
an underlying), and runs two saved Dune queries against the expanded address
set: one for per-pool volume and one for source attribution (aggregators,
CoW solvers, direct). Built on top of `zekraken-bot/dex_volume`.

## Project Structure

```
dune-query-runner/
├── src/
│   ├── data/
│   │   └── tokens.js          ← Token addresses by chain (names fetched via RPC)
│   ├── hooks/
│   │   ├── useDuneQuery.js    ← Dune API: execute, poll, results
│   │   └── useTokenRegistry.js ← RPC token name/symbol resolver
│   ├── components/
│   │   ├── ResultsTable.jsx   ← Paginated results table
│   │   ├── TokenSelect.jsx    ← Type-ahead token selector with address lookup
│   │   └── ProjectVersionChart.jsx ← Volume chart by project/version
│   ├── App.jsx                ← Main app / controls
│   └── main.jsx
├── .env.example               ← Copy to .env and fill in
├── index.html
├── package.json
└── vite.config.js
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
VITE_DUNE_API_KEY=your_api_key_here
VITE_DUNE_QUERY_ID=6743629
VITE_DUNE_VOLUME_QUERY_ID=7582218
VITE_DUNE_SOURCE_QUERY_ID=7582229
```

- **API key**: Get from [dune.com/settings/api](https://dune.com/settings/api)
- `VITE_DUNE_QUERY_ID` — original single-token saved query. Kept for rollback;
  the app does not use it on the main pipeline.
- `VITE_DUNE_VOLUME_QUERY_ID` — multi-address volume-by-pool query
  (`dune_queries/volume_by_pool.sql`).
- `VITE_DUNE_SOURCE_QUERY_ID` — source-attribution query
  (`dune_queries/source_attribution.sql`).

### 3. Dune saved queries

Two queries drive the new pipeline. They share three parameters:

| Parameter | Type | Example |
|---|---|---|
| `chain` | text | `ethereum` |
| `token_addresses` | text | `0xa0b...eb48,0xd4f...d23e,0xbee...64cb` |
| `date` | text | `2026-05-19` |

The SQL for both is committed in `dune_queries/`. Re-deploy them as your own
saved queries (or fork the existing ones at IDs 7582218 / 7582229) and put
the numeric IDs in `.env`.

### 4. Data flow

1. User picks `(chain, token, date)`.
2. `useBalancerAddressExpansion` calls Balancer v3 GraphQL
   (`https://api-v3.balancer.fi/graphql`) to learn whether the input is an
   ERC-4626 wrapper and to enumerate every sibling wrapper that shares the
   same underlying. Result: the **expansion set** (usually 1 token for
   tokens with no Balancer wrappers, up to ~15 for USDC on mainnet).
3. **Run Query** fires the two Dune saved queries with the expansion
   addresses joined by commas.
4. `useBalancerWrapperResolver` resolves every paired-side address that
   came back to its underlying, so paired-token columns can render as the
   underlying symbol (toggleable).
5. Each row is enriched with `paired_display` and `is_buffer_op`. Buffer-op
   rows (queried + paired resolve to the same underlying) are excluded from
   headline aggregates by default and surfaced in the BufferActivityPanel.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding Tokens

Token names and symbols are fetched automatically from the chain's RPC — you only ever need to store addresses.

### Ad-hoc lookup (no config needed)

Paste any contract address directly into the Token search field. A **Lookup `0x...`** row appears in the dropdown — click it or press Enter and the app resolves the token's name and symbol from the RPC on the fly, adds it to the selector, and selects it automatically. The resolved token stays available for the rest of the session.

Use this for one-off queries or tokens you don't need again after the session.

### Persisting tokens in the registry

If you query a token regularly, add its address to `src/data/tokens.js` so it always appears in the dropdown without a lookup step:

```js
// src/data/tokens.js
export const TOKEN_ADDRESSES = {
  ethereum: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // add more addresses here...
  ],
  // other chains...
}
```

## Adding Chains

1. Add the chain's token addresses to `TOKEN_ADDRESSES` in `src/data/tokens.js`
2. Add a display label to `CHAIN_LABELS` in the same file
3. Add an RPC endpoint to `DEFAULT_RPCS` in the same file

The chain name must match what Dune uses in the `blockchain` column (lowercase: `ethereum`, `base`, `arbitrum`, etc.).

## Notes

- Dune's free tier has limited execution credits — results are cached by Dune if you run the same parameters again within a short window
- The Dune API does support browser requests (CORS is allowed) with the `x-dune-api-key` header
- Your API key is loaded from `.env` at build time via Vite — never commit `.env` to git (it's in `.gitignore`)
- Token metadata is fetched from public RPC nodes (publicnode.com) and cached in memory for the session

## Scope of "wrapper expansion"

Only **Balancer-registered ERC-4626 wrappers** count. Aave / Compound /
Yearn / Pendle wrappers that are not in Balancer's token index are
ignored. This matches the actual problem the expansion solves: undercounted
Balancer boosted-pool volume that comes through wrappers. See `DISCOVERY.md`
for the data-layer nuances (`dex.trades` already substitutes the underlying
for the Aave family, so the incremental volume comes mostly from non-Aave
wrappers like `syrupUSDC`, `steakUSDC`, `gtusdcp`, …).
