-- Source-attribution query: per-aggregator and per-CoW-solver volume for an
-- expanded address set. Reads directly from the source-of-truth tables for
-- each routing surface, rather than left-joining dex.trades.
--
--   * dex_aggregator.trades — one row per aggregator route. project ∈
--     {1inch, 0x API, kyberswap, cow_protocol, velora (Paraswap), bebop,
--      odos, bitget_dex_aggregator, sushiswap, tokenlon, DODO X, lifi, …}.
--   * cow_protocol_<chain>.trades — one row per CoW order fill. Joined to
--     batches → solvers for the human-readable solver name. CoW rows are
--     ALSO present in dex_aggregator.trades with project='cow_protocol';
--     we exclude that branch below to avoid double-counting and keep the
--     fine-grained per-solver attribution.
--
-- Output is grouped by (blockchain, source_category, source_name, version,
-- block_date, queried_token_address). Pool address is omitted from the
-- group key because aggregator volume isn't pool-scoped on the aggregator
-- side; the per-DEX pool breakdown comes from the Phase 2 query.
--
-- Parameters:
--   {{chain}}           varchar  - lowercase chain (e.g. 'ethereum')
--   {{token_addresses}} varchar  - comma-separated 0x-hex addresses
--   {{date}}            varchar  - YYYY-MM-DD lower bound (inclusive)

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),
aggregator_rows AS (
  SELECT
    a.blockchain,
    'aggregator' AS source_category,
    a.project    AS source_name,
    a.version,
    a.block_date,
    CASE
      WHEN a.token_bought_address IN (SELECT addr FROM addr_list) THEN a.token_bought_address
      ELSE a.token_sold_address
    END AS queried_token_address,
    a.amount_usd
  FROM dex_aggregator.trades a
  WHERE a.blockchain = '{{chain}}'
    AND a.block_date >= DATE '{{date}}'
    -- exclude cow_protocol so the per-solver branch owns CoW attribution.
    AND a.project <> 'cow_protocol'
    AND (
      a.token_bought_address IN (SELECT addr FROM addr_list)
      OR a.token_sold_address IN (SELECT addr FROM addr_list)
    )
),
cow_rows AS (
  SELECT 'ethereum' AS blockchain, 'cow_solver' AS source_category,
         COALESCE(s.name, 'Unknown solver') AS source_name,
         CAST(NULL AS varchar) AS version,
         t.block_date,
         CASE WHEN t.buy_token_address  IN (SELECT addr FROM addr_list) THEN t.buy_token_address
              ELSE t.sell_token_address END AS queried_token_address,
         t.usd_value AS amount_usd
  FROM cow_protocol_ethereum.trades t
  LEFT JOIN cow_protocol_ethereum.batches  b ON b.tx_hash  = t.tx_hash
  LEFT JOIN cow_protocol_ethereum.solvers  s ON s.address = b.solver_address
  WHERE '{{chain}}' = 'ethereum'
    AND t.block_date >= DATE '{{date}}'
    AND (t.buy_token_address IN (SELECT addr FROM addr_list)
         OR t.sell_token_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT 'arbitrum', 'cow_solver', COALESCE(s.name, 'Unknown solver'),
         CAST(NULL AS varchar), t.block_date,
         CASE WHEN t.buy_token_address IN (SELECT addr FROM addr_list) THEN t.buy_token_address ELSE t.sell_token_address END,
         t.usd_value
  FROM cow_protocol_arbitrum.trades t
  LEFT JOIN cow_protocol_arbitrum.batches b ON b.tx_hash = t.tx_hash
  LEFT JOIN cow_protocol_arbitrum.solvers s ON s.address = b.solver_address
  WHERE '{{chain}}' = 'arbitrum'
    AND t.block_date >= DATE '{{date}}'
    AND (t.buy_token_address IN (SELECT addr FROM addr_list)
         OR t.sell_token_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT 'base', 'cow_solver', COALESCE(s.name, 'Unknown solver'),
         CAST(NULL AS varchar), t.block_date,
         CASE WHEN t.buy_token_address IN (SELECT addr FROM addr_list) THEN t.buy_token_address ELSE t.sell_token_address END,
         t.usd_value
  FROM cow_protocol_base.trades t
  LEFT JOIN cow_protocol_base.batches b ON b.tx_hash = t.tx_hash
  LEFT JOIN cow_protocol_base.solvers s ON s.address = b.solver_address
  WHERE '{{chain}}' = 'base'
    AND t.block_date >= DATE '{{date}}'
    AND (t.buy_token_address IN (SELECT addr FROM addr_list)
         OR t.sell_token_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT 'gnosis', 'cow_solver', COALESCE(s.name, 'Unknown solver'),
         CAST(NULL AS varchar), t.block_date,
         CASE WHEN t.buy_token_address IN (SELECT addr FROM addr_list) THEN t.buy_token_address ELSE t.sell_token_address END,
         t.usd_value
  FROM cow_protocol_gnosis.trades t
  LEFT JOIN cow_protocol_gnosis.batches b ON b.tx_hash = t.tx_hash
  LEFT JOIN cow_protocol_gnosis.solvers s ON s.address = b.solver_address
  WHERE '{{chain}}' = 'gnosis'
    AND t.block_date >= DATE '{{date}}'
    AND (t.buy_token_address IN (SELECT addr FROM addr_list)
         OR t.sell_token_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT 'polygon', 'cow_solver', COALESCE(s.name, 'Unknown solver'),
         CAST(NULL AS varchar), t.block_date,
         CASE WHEN t.buy_token_address IN (SELECT addr FROM addr_list) THEN t.buy_token_address ELSE t.sell_token_address END,
         t.usd_value
  FROM cow_protocol_polygon.trades t
  LEFT JOIN cow_protocol_polygon.batches b ON b.tx_hash = t.tx_hash
  LEFT JOIN cow_protocol_polygon.solvers s ON s.address = b.solver_address
  WHERE '{{chain}}' = 'polygon'
    AND t.block_date >= DATE '{{date}}'
    AND (t.buy_token_address IN (SELECT addr FROM addr_list)
         OR t.sell_token_address IN (SELECT addr FROM addr_list))
),
combined AS (
  SELECT * FROM aggregator_rows
  UNION ALL
  SELECT * FROM cow_rows
)
SELECT
  blockchain,
  source_category,
  source_name,
  version,
  block_date,
  '0x' || LOWER(to_hex(queried_token_address)) AS queried_token_address,
  SUM(amount_usd) AS total_amount_usd,
  COUNT(*)        AS trade_count
FROM combined
GROUP BY 1,2,3,4,5,6
ORDER BY total_amount_usd DESC NULLS LAST, block_date DESC
