-- Balancer-only source attribution.
--
-- Base set: dex.trades rows where project='balancer' that touch the address
-- list. Each row is enriched with whichever aggregator / CoW solver triggered
-- it (left joined). Where neither matches, the row is 'direct' (a user trade
-- via the Balancer router with no aggregator on top).
--
-- Why this is correct here even though the cross-DEX Phase-4 query reads from
-- dex_aggregator.trades directly: this query is scoped to a single
-- destination DEX (Balancer), so the LEFT JOIN approach doesn't risk
-- mislabeling rows on other venues. The semantics are "for the Balancer-
-- pool volume we're already seeing in dex.trades, how was each trade
-- triggered?"
--
-- Parameters: {{chain}}, {{token_addresses}}, {{date}}

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),
bal_trades AS (
  SELECT
    t.blockchain,
    t.version,
    t.block_date,
    t.tx_hash,
    t.evt_index,
    t.project_contract_address AS pool_address,
    CASE
      WHEN t.token_bought_address IN (SELECT addr FROM addr_list) THEN t.token_bought_address
      ELSE t.token_sold_address
    END AS queried_token_address,
    t.amount_usd
  FROM dex.trades t
  WHERE t.blockchain = '{{chain}}'
    AND t.block_date >= DATE '{{date}}'
    AND t.project = 'balancer'
    AND (
      t.token_bought_address IN (SELECT addr FROM addr_list)
      OR t.token_sold_address IN (SELECT addr FROM addr_list)
    )
),
agg_lookup AS (
  SELECT blockchain, tx_hash, evt_index, project AS aggr_name
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
    t.version,
    t.block_date,
    t.queried_token_address,
    t.amount_usd,
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
  FROM bal_trades t
  LEFT JOIN agg_lookup a
    ON a.blockchain = t.blockchain
   AND a.tx_hash    = t.tx_hash
   AND a.evt_index  = t.evt_index
  LEFT JOIN cow_solver_map cs
    ON cs.blockchain = t.blockchain
   AND cs.tx_hash    = t.tx_hash
)
SELECT
  blockchain,
  source_category,
  source_name,
  version AS balancer_version,
  block_date,
  '0x' || LOWER(to_hex(queried_token_address)) AS queried_token_address,
  SUM(amount_usd) AS total_amount_usd,
  COUNT(*)        AS trade_count
FROM attributed
GROUP BY 1,2,3,4,5,6
ORDER BY total_amount_usd DESC NULLS LAST, block_date DESC
