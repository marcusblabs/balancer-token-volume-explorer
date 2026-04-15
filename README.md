# Dune Query Runner

A React app that lets you select a chain and token from dropdowns, then execute a saved Dune query via the Dune API and display results inline — no copy-pasting SQL required.

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
│   │   ├── TokenRegistry.jsx  ← Registry management UI
│   │   ├── TokenSelect.jsx    ← Type-ahead token selector
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
VITE_DUNE_QUERY_ID=your_query_id_here
```

- **API key**: Get from [dune.com/settings/api](https://dune.com/settings/api)
- **Query ID**: Your saved Dune query ID (numeric)

### 3. Use an existing saved query on Dune

Use a saved Dune query that accepts these exact parameter names:

| Parameter | Type | Example |
|---|---|---|
| `chain` | text | `ethereum` |
| `token_address` | text | `0xC02aaA39...` |
| `date` | date | `2024-01-01` |

Copy the numeric ID from the URL (`https://dune.com/queries/1234567`) and add it to `.env` as `VITE_DUNE_QUERY_ID`.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding Tokens

Token names and symbols are fetched automatically from the chain's RPC — only addresses need to be stored. Edit `src/data/tokens.js` to add addresses to the dropdown permanently, or use the **Token Registry** tab in the UI to add them at runtime (note: runtime additions reset on page refresh — edit the file to persist them).

```js
// src/data/tokens.js
export const TOKEN_ADDRESSES = {
  ethereum: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // add more...
  ],
  // add more chains...
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
