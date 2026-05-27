-- Multi-address DEX volume per pool, day, paired token, and queried-side
-- address. Aggregates across all chains in dex.trades.
--
-- Parameters:
--   {{chain}}           varchar - lowercase chain name (e.g. 'ethereum')
--   {{token_addresses}} varchar - comma-separated 0x-hex addresses
--   {{date}}            varchar - YYYY-MM-DD (lower bound, inclusive)
--
-- Why this is a UNION rather than just dex.trades:
-- ----------------------------------------------------------------------
-- On chains where the Balancer v3 spellbook hasn't been wired into the
-- dex.trades pricing pipeline yet (Monad is the live example), wrapper
-- ↔ wrapper swaps land in dex.trades with `amount_usd = NULL`. So a
-- pool that did $5M last week shows up as $7. The per-chain
-- `balancer_v3_<chain>.trades` spellbook prices the same trades using
-- the underlying token, and that one is correct.
--
-- The query therefore pulls non-Balancer-v3 rows from dex.trades, then
-- UNION ALLs in balancer_v3 rows from the per-chain table, with a
-- chain-literal predicate so the optimizer drops the 6 irrelevant
-- branches.

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),
non_bal_v3 AS (
  SELECT
    t.blockchain, t.project, t.version, t.block_date,
    t.project_contract_address,
    t.token_bought_address, t.token_sold_address,
    t.amount_usd
  FROM dex.trades t
  WHERE t.blockchain = '{{chain}}'
    AND t.block_date >= DATE '{{date}}'
    AND NOT (t.project = 'balancer' AND t.version = '3')
    AND (
      t.token_bought_address IN (SELECT addr FROM addr_list)
      OR t.token_sold_address IN (SELECT addr FROM addr_list)
    )
),
bal_v3 AS (
  SELECT blockchain, 'balancer' AS project, '3' AS version, block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_ethereum.trades
  WHERE '{{chain}}' = 'ethereum' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_arbitrum.trades
  WHERE '{{chain}}' = 'arbitrum' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_base.trades
  WHERE '{{chain}}' = 'base' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_gnosis.trades
  WHERE '{{chain}}' = 'gnosis' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_avalanche_c.trades
  WHERE '{{chain}}' = 'avalanche_c' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_hyperevm.trades
  WHERE '{{chain}}' = 'hyperevm' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, 'balancer', '3', block_date,
         project_contract_address, token_bought_address, token_sold_address, amount_usd
  FROM balancer_v3_monad.trades
  WHERE '{{chain}}' = 'monad' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list)
         OR token_sold_address IN (SELECT addr FROM addr_list))
),
all_trades AS (
  SELECT * FROM non_bal_v3
  UNION ALL
  SELECT * FROM bal_v3
),
base AS (
  SELECT
    blockchain, project, version, block_date,
    project_contract_address AS pool_address,
    CASE
      WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address
      ELSE token_sold_address
    END AS queried_token_address,
    CASE
      WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_sold_address
      ELSE token_bought_address
    END AS paired_token_address,
    amount_usd
  FROM all_trades
)
SELECT
  blockchain,
  project,
  version,
  block_date,
  '0x' || LOWER(to_hex(pool_address))             AS pool_address,
  '0x' || LOWER(to_hex(paired_token_address))     AS paired_token_address,
  '0x' || LOWER(to_hex(queried_token_address))    AS queried_token_address,
  SUM(amount_usd)                                 AS total_amount_usd,
  COUNT(*)                                        AS trade_count
FROM base
GROUP BY
  blockchain, project, version, block_date,
  pool_address, paired_token_address, queried_token_address
ORDER BY
  total_amount_usd DESC NULLS LAST,
  block_date DESC
