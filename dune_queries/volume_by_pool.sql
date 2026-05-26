-- Multi-address DEX volume per pool, day, paired token, and queried-side
-- address. Aggregates across all chains in dex.trades.
--
-- Parameters:
--   {{chain}}           varchar - lowercase chain name (e.g. 'ethereum')
--   {{token_addresses}} varchar - comma-separated 0x-hex addresses
--   {{date}}            varchar - YYYY-MM-DD (lower bound, inclusive)
--
-- The address list is decoded to varbinary (matching dex.trades) via
-- SPLIT + UNNEST + from_hex.

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),
base AS (
  SELECT
    t.blockchain,
    t.project,
    t.version,
    t.block_date,
    t.project_contract_address AS pool_address,
    CASE
      WHEN t.token_bought_address IN (SELECT addr FROM addr_list) THEN t.token_bought_address
      ELSE t.token_sold_address
    END AS queried_token_address,
    CASE
      WHEN t.token_bought_address IN (SELECT addr FROM addr_list) THEN t.token_sold_address
      ELSE t.token_bought_address
    END AS paired_token_address,
    t.amount_usd
  FROM dex.trades t
  WHERE t.blockchain = '{{chain}}'
    AND t.block_date >= DATE '{{date}}'
    AND (
      t.token_bought_address IN (SELECT addr FROM addr_list)
      OR t.token_sold_address IN (SELECT addr FROM addr_list)
    )
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
