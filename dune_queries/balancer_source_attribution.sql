-- Balancer-only source attribution.
--
-- Auto-classifies tx_to by joining to <chain>.contracts (Dune's named-
-- contract registry — 1.3M+ named contracts on ethereum alone). Falls
-- back to a small manual MEV-bot list because MEV bots are mostly EOAs
-- and don't get spelled into the contracts table.
--
-- Priority of attribution:
--   1. cow_protocol_<chain>.batches (by tx_hash) -> 'cow_solver' + solver
--   2. dex_aggregator.trades exact match (tx_hash + evt_index) -> 'aggregator' + project
--   3. mev_overrides (manual EOA list) -> 'mev_bot'
--   4. <chain>.contracts namespace whitelist -> 'aggregator' / 'direct' / 'protocol'
--   5. else -> 'unknown' with the raw 0x<tx_to> as source_name
--
-- Parameters: {{chain}}, {{token_addresses}}, {{date}}
--
-- Adding a new chain: add a contracts-namespace branch (search for
-- chain_contracts CTE) and add CoW + balancer_v3 trade UNION branches.

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),

-- MEV bots / EOAs that don't show up in <chain>.contracts. Curated.
mev_overrides AS (
  SELECT * FROM (VALUES
    ('ethereum', from_hex('1f2f10d1c40777ae1da742455c65828ff36df387'), 'mev_bot', 'jaredfromsubway #2'),
    ('ethereum', from_hex('000000000035b5e5ad9019092c665357240f594e'), 'mev_bot', 'MEV bot 0x000…594E'),
    ('ethereum', from_hex('01fdc48ba0903bb1ae7c517c9287d88ea236f8e1'), 'mev_bot', 'MEV bot 0x01FD…F8E1'),
    ('ethereum', from_hex('e00456d3af6e9b8715a9c29c88c1932983e064c1'), 'mev_bot', 'MEV-funded EOA 0xE004…64C1'),
    ('ethereum', from_hex('a0f1c3ad83e07d97b5e7030e177718be175275ea'), 'mev_bot', 'MEV-funded EOA 0xA0F1…75EA'),
    ('ethereum', from_hex('00c21ca82d94dade0d5d1ed420a4728f58427d21'), 'mev_bot', 'MEV bot 0x00C2…7D21'),
    ('ethereum', from_hex('d8349e874934593c85eafa8e534b495d80848e41'), 'mev_bot', 'MEV-interacting EOA 0xD834…8E41'),

    -- Override for binance_dex (contract is correctly classified but its name 'binance_dex'
    -- isn't user-friendly; force a label)
    ('ethereum', from_hex('b300000b72deaeb607a12d5f54773d1c19c7028d'), 'aggregator', 'Binance DEX Aggregator')
  ) AS t(chain, address, category, name)
),

-- All named contracts on the chain, classified by namespace.
-- Namespace whitelists are the source of truth — adding a new aggregator
-- means adding its namespace once here, no per-address bookkeeping.
-- Dune's <chain>.contracts has multiple rows per address (one per
-- deployed proxy / version), which would fan-out the LEFT JOIN below.
-- Collapse to one row per address. Picking arbitrary `name` for the
-- duplicates is fine since the namespace classification is identical.
chain_contracts_raw AS (
  SELECT
    address,
    CASE
      -- Balancer's own routers — only these count as 'direct'
      WHEN namespace IN ('balancer', 'balancer_v2', 'balancer_v3') THEN 'direct'

      -- Aggregators / meta-aggregators / consumer wallets that route to DEXes
      WHEN namespace IN (
        'oneinch','zeroex','paraswap','velora','kyberswap','odos_v2',
        'lifi','okx_dex_v4','okx','metamask','bebop','enso','tokenlon',
        'aori','rainbow_swap_aggregator','rainbow','cowswap',
        'dodo','dodo_v2','dodo_v3',
        'debridge','socket','rabby','squid_router','bungee','jumper',
        'matcha','sushi_aggregator','dexible','swing','rango','symbiosis'
      ) THEN 'aggregator'

      -- Uniswap routers (UniversalRouter, SwapRouter02) — when these route
      -- to Balancer pools they're effectively aggregator-style routing.
      WHEN namespace IN ('uniswap','uniswap_v2','uniswap_v3','uniswap_v4')
           AND (
             LOWER(name) LIKE '%universal%router%'
             OR LOWER(name) LIKE '%swaprouter%'
             OR LOWER(name) LIKE '%aggregator%'
           ) THEN 'aggregator'

      -- Other named DeFi protocols touching Balancer pools
      WHEN namespace IN (
        'fluid','aave','aave_v2','aave_v3','compound','compound_v2','compound_v3',
        'morpho_blue','morpho','pendle','yearn','yearn_v3','curvefi','convex',
        'sushi','sushiswap','beethovenx','euler','spark','sky_protocol','maker',
        'lido','rocketpool','swell','etherfi','renzo','origin_ether','frax'
      ) THEN 'protocol'

      ELSE 'unknown'
    END AS category,
    namespace || ': ' || name AS pretty_name
  FROM ethereum.contracts
  WHERE '{{chain}}' = 'ethereum'
  -- For other chains, UNION ALL branches below. See note at top of CTE.
),
chain_contracts AS (
  SELECT address,
         ARBITRARY(category)    AS category,
         ARBITRARY(pretty_name) AS pretty_name
  FROM chain_contracts_raw
  GROUP BY address
),

bal_v2_etc AS (
  SELECT
    t.blockchain, t.version, t.block_date, t.tx_hash, t.evt_index, t.tx_to,
    t.project_contract_address AS pool_address,
    CASE WHEN t.token_bought_address IN (SELECT addr FROM addr_list) THEN t.token_bought_address ELSE t.token_sold_address END AS queried_token_address,
    t.amount_usd
  FROM dex.trades t
  WHERE t.blockchain = '{{chain}}'
    AND t.block_date >= DATE '{{date}}'
    AND t.project   = 'balancer'
    AND t.version  <> '3'
    AND (t.token_bought_address IN (SELECT addr FROM addr_list)
         OR t.token_sold_address IN (SELECT addr FROM addr_list))
),

bal_v3 AS (
  SELECT blockchain, '3' AS version, block_date, tx_hash, evt_index, tx_to,
         project_contract_address AS pool_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END AS queried_token_address,
         amount_usd
  FROM balancer_v3_ethereum.trades
  WHERE '{{chain}}' = 'ethereum' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_arbitrum.trades
  WHERE '{{chain}}' = 'arbitrum' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_base.trades
  WHERE '{{chain}}' = 'base' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_gnosis.trades
  WHERE '{{chain}}' = 'gnosis' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_avalanche_c.trades
  WHERE '{{chain}}' = 'avalanche_c' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_hyperevm.trades
  WHERE '{{chain}}' = 'hyperevm' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
  UNION ALL
  SELECT blockchain, '3', block_date, tx_hash, evt_index, tx_to, project_contract_address,
         CASE WHEN token_bought_address IN (SELECT addr FROM addr_list) THEN token_bought_address ELSE token_sold_address END,
         amount_usd
  FROM balancer_v3_monad.trades
  WHERE '{{chain}}' = 'monad' AND block_date >= DATE '{{date}}'
    AND (token_bought_address IN (SELECT addr FROM addr_list) OR token_sold_address IN (SELECT addr FROM addr_list))
),

bal_trades AS (
  SELECT * FROM bal_v2_etc UNION ALL SELECT * FROM bal_v3
),

agg_lookup AS (
  SELECT blockchain, tx_hash, evt_index, project AS aggr_name
  FROM dex_aggregator.trades
  WHERE blockchain = '{{chain}}'
    AND block_date >= DATE '{{date}}'
),

cow_solver_map AS (
  SELECT 'ethereum' AS blockchain, b.tx_hash, COALESCE(s.name, 'Unknown solver') AS solver_name
  FROM cow_protocol_ethereum.batches b
  LEFT JOIN cow_protocol_ethereum.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'ethereum'
  UNION ALL
  SELECT 'arbitrum', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_arbitrum.batches b LEFT JOIN cow_protocol_arbitrum.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'arbitrum'
  UNION ALL
  SELECT 'base', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_base.batches b LEFT JOIN cow_protocol_base.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'base'
  UNION ALL
  SELECT 'gnosis', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_gnosis.batches b LEFT JOIN cow_protocol_gnosis.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'gnosis'
  UNION ALL
  SELECT 'polygon', b.tx_hash, COALESCE(s.name, 'Unknown solver')
  FROM cow_protocol_polygon.batches b LEFT JOIN cow_protocol_polygon.solvers s ON s.address = b.solver_address
  WHERE b.block_date >= DATE '{{date}}' AND '{{chain}}' = 'polygon'
),

attributed AS (
  SELECT
    t.blockchain, t.version, t.block_date, t.queried_token_address, t.amount_usd,
    CASE
      WHEN cs.solver_name IS NOT NULL                                THEN 'cow_solver'
      WHEN a.aggr_name    IS NOT NULL                                THEN 'aggregator'
      WHEN mev.category   IS NOT NULL                                THEN mev.category
      WHEN cc.category    IS NOT NULL AND cc.category <> 'unknown'   THEN cc.category
      ELSE                                                                'unknown'
    END AS source_category,
    CASE
      WHEN cs.solver_name IS NOT NULL                                THEN cs.solver_name
      WHEN a.aggr_name    IS NOT NULL                                THEN a.aggr_name
      WHEN mev.name       IS NOT NULL                                THEN mev.name
      WHEN cc.pretty_name IS NOT NULL AND cc.category <> 'unknown'   THEN cc.pretty_name
      ELSE                                                                'unknown ' || '0x' || LOWER(to_hex(t.tx_to))
    END AS source_name
  FROM bal_trades t
  LEFT JOIN agg_lookup a
    ON a.blockchain = t.blockchain AND a.tx_hash = t.tx_hash AND a.evt_index = t.evt_index
  LEFT JOIN cow_solver_map cs
    ON cs.blockchain = t.blockchain AND cs.tx_hash = t.tx_hash
  LEFT JOIN mev_overrides mev
    ON mev.chain = t.blockchain AND mev.address = t.tx_to
  LEFT JOIN chain_contracts cc
    ON cc.address = t.tx_to
)

SELECT
  blockchain, source_category, source_name,
  version AS balancer_version, block_date,
  '0x' || LOWER(to_hex(queried_token_address)) AS queried_token_address,
  SUM(amount_usd) AS total_amount_usd,
  COUNT(*)        AS trade_count
FROM attributed
GROUP BY 1,2,3,4,5,6
ORDER BY total_amount_usd DESC NULLS LAST, block_date DESC
