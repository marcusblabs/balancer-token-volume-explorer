-- Source-attribution query.
--
-- Returns per-pool, per-day, per-queried-address volume, broken down by
-- attribution source: aggregator (1inch / Velora / 0x / KyberSwap / Odos /
-- Bebop / cow_protocol / tokenlon / DODO X / bitget / sushi-as-aggregator /
-- etc.), CoW solver (when settled via the CoW batch auction), or direct
-- (no router / no settlement match).
--
-- Parameters:
--   {{chain}}           varchar  - lowercase chain (e.g. 'ethereum')
--   {{token_addresses}} varchar  - comma-separated 0x-hex addresses
--   {{date}}            varchar  - YYYY-MM-DD lower bound (inclusive)
--
-- The `UNION ALL` over per-chain CoW schemas pre-prunes to the requested
-- chain via the constant-literal `blockchain` projection — the optimizer
-- drops 4 of 5 branches when the predicate `cs.blockchain = '{{chain}}'`
-- is enforced.

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),
trades AS (
  SELECT
    t.blockchain,
    t.project,
    t.version,
    t.block_date,
    t.project_contract_address AS pool_address,
    t.tx_hash,
    t.evt_index,
    CASE
      WHEN t.token_bought_address IN (SELECT addr FROM addr_list) THEN t.token_bought_address
      ELSE t.token_sold_address
    END AS queried_token_address,
    t.amount_usd
  FROM dex.trades t
  WHERE t.blockchain = '{{chain}}'
    AND t.block_date >= DATE '{{date}}'
    AND (
      t.token_bought_address IN (SELECT addr FROM addr_list)
      OR t.token_sold_address IN (SELECT addr FROM addr_list)
    )
),
aggr AS (
  SELECT
    blockchain,
    tx_hash,
    evt_index,
    project AS aggr_name
  FROM dex_aggregator.trades
  WHERE blockchain = '{{chain}}'
    AND block_date >= DATE '{{date}}'
),
cow_solver_map AS (
  SELECT 'ethereum' AS blockchain, b.tx_hash,
         COALESCE(s.name, 'Unknown solver') AS solver_name
  FROM cow_protocol_ethereum.batches b
  LEFT JOIN cow_protocol_ethereum.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'ethereum'
  UNION ALL
  SELECT 'arbitrum', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_arbitrum.batches b
  LEFT JOIN cow_protocol_arbitrum.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'arbitrum'
  UNION ALL
  SELECT 'base', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_base.batches b
  LEFT JOIN cow_protocol_base.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'base'
  UNION ALL
  SELECT 'gnosis', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_gnosis.batches b
  LEFT JOIN cow_protocol_gnosis.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'gnosis'
  UNION ALL
  SELECT 'polygon', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_polygon.batches b
  LEFT JOIN cow_protocol_polygon.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'polygon'
),
attributed AS (
  SELECT
    t.blockchain,
    t.project,
    t.version,
    t.block_date,
    t.pool_address,
    t.queried_token_address,
    t.amount_usd,
    -- Prefer CoW solver over generic aggregator label.
    CASE
      WHEN cs.solver_name IS NOT NULL THEN 'cow_solver'
      WHEN a.aggr_name    IS NOT NULL THEN 'aggregator'
      ELSE 'direct'
    END AS source_category,
    CASE
      WHEN cs.solver_name IS NOT NULL THEN cs.solver_name
      WHEN a.aggr_name    IS NOT NULL THEN a.aggr_name
      ELSE 'direct'
    END AS source_name
  FROM trades t
  LEFT JOIN aggr a
    ON a.blockchain = t.blockchain
   AND a.tx_hash    = t.tx_hash
   AND a.evt_index  = t.evt_index
  LEFT JOIN cow_solver_map cs
    ON cs.blockchain = t.blockchain
   AND cs.tx_hash    = t.tx_hash
)
SELECT
  blockchain,
  project,
  version,
  block_date,
  '0x' || LOWER(to_hex(pool_address))          AS pool_address,
  '0x' || LOWER(to_hex(queried_token_address)) AS queried_token_address,
  source_category,
  source_name,
  SUM(amount_usd) AS total_amount_usd,
  COUNT(*)        AS trade_count
FROM attributed
GROUP BY
  blockchain, project, version, block_date,
  pool_address, queried_token_address,
  source_category, source_name
ORDER BY total_amount_usd DESC NULLS LAST, block_date DESC
