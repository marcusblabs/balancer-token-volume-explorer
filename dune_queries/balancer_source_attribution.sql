-- Balancer-only source attribution with router/MEV-bot classification.
--
-- Base set: Balancer-pool trades that touch the address list. Each row is
-- enriched in priority order:
--
--   1. cow_protocol_<chain>.batches join (by tx_hash)
--        -> source_category = 'cow_solver', source_name = solver.name
--   2. dex_aggregator.trades exact match (by tx_hash + evt_index)
--        -> source_category = 'aggregator', source_name = a.project
--   3. known_routers lookup by tx_to
--        -> source_category = 'aggregator' | 'mev_bot' | 'cex' | 'direct'
--           (depending on the entry), source_name = kr.name
--   4. otherwise
--        -> source_category = 'unknown', source_name = '0x<tx_to>'
--           so the residual volume is visible per-router rather than
--           merged into one giant 'direct' bucket.
--
-- The known_routers list catches everything `dex_aggregator.trades` hasn't
-- spelled (newer 0x AllowanceHolder, Velora v6, Binance/Bitget DEXes,
-- jaredfromsubway-style MEV bots, …) plus surfaces real Balancer-router
-- direct trades vs. unspelled traffic.
--
-- Parameters: {{chain}}, {{token_addresses}}, {{date}}

WITH addr_list AS (
  SELECT from_hex(REPLACE(LOWER(TRIM(x)), '0x', '')) AS addr
  FROM UNNEST(SPLIT('{{token_addresses}}', ',')) AS t(x)
  WHERE TRIM(x) <> ''
),

-- Per-chain known routers. Add new rows here as you find them.
known_routers AS (
  SELECT * FROM (VALUES
    -- Balancer-owned routers (real direct user trades)
    ('ethereum', from_hex('ae563e3f8219521950555f5962419c8919758ea2'), 'direct',     'Balancer v3 Router'),
    ('ethereum', from_hex('5c6fb490bdfd3246eb0bb062c168decaf4bd9fdd'), 'direct',     'Balancer v3 Router (legacy)'),
    ('ethereum', from_hex('136f1efcc3f8f88516b9e94110d56fdbfb1778d1'), 'direct',     'Balancer BatchRouter'),
    ('ethereum', from_hex('1cd776897ef4f647bf8241ec69d585bac7640f1f'), 'direct',     'Balancer CompositeLiquidityRouter'),
    ('ethereum', from_hex('309abcaefb19c84e3e73cf59611a1f4f0286948f'), 'direct',     'Balancer AggregatorRouter'),
    ('ethereum', from_hex('ba12222222228d8ba445958a75a0704d566bf2c8'), 'direct',     'Balancer v2 Vault'),

    -- Aggregator routers Dune hasn't fully spelled into dex_aggregator.trades
    ('ethereum', from_hex('0000000000001ff3684f28c67538d4d072c22734'), 'aggregator', '0x AllowanceHolder'),
    ('ethereum', from_hex('def1c0ded9bec7f1a1670819833240f027b25eff'), 'aggregator', '0x Exchange Proxy'),
    ('ethereum', from_hex('6a000f20005980200259b80c5102003040001068'), 'aggregator', 'Velora (Paraswap Augustus v6)'),
    ('ethereum', from_hex('def171fe48cf0115b1d80b88dc8eab59176fee57'), 'aggregator', 'Paraswap Augustus v5'),
    ('ethereum', from_hex('1111111254eeb25477b68fb85ed929f73a960582'), 'aggregator', '1inch v5'),
    ('ethereum', from_hex('111111125421ca6dc452d289314280a0f8842a65'), 'aggregator', '1inch v6'),
    ('ethereum', from_hex('6131b5fae19ea4f9d964eac0408e4408b66337b5'), 'aggregator', 'KyberSwap MetaAggregator'),
    ('ethereum', from_hex('df1a1b60f2d438842916c0adc43748768353ec25'), 'aggregator', 'KyberSwap Router'),
    ('ethereum', from_hex('cf5540fffcdc3d510b18bfca6d2b9987b0772559'), 'aggregator', 'Odos Router V2'),
    ('ethereum', from_hex('b300000b72deaeb607a12d5f54773d1c19c7028d'), 'aggregator', 'Binance DEX Aggregator'),
    ('ethereum', from_hex('1231deb6f5749ef6ce6943a275a1d3e7486f4eae'), 'aggregator', 'LiFi Diamond'),
    ('ethereum', from_hex('beef096c8d2fbfa7c08af07f6bdb5e3d0a3a8b3c'), 'aggregator', 'Bebop Settlement'),
    ('ethereum', from_hex('9008d19f58aabd9ed0d60971565aa8510560ab41'), 'aggregator', 'CoW Settlement'),
    ('ethereum', from_hex('28b1dc1a5e3699a428bc51d234dfab7c9cb2a183'), 'aggregator', 'OKX Dex Router v6'),
    ('ethereum', from_hex('881d40237659c251811cec9c364ef91dc08d300c'), 'aggregator', 'MetaMask Swap Router'),
    ('ethereum', from_hex('663dc15d3c1ac63ff12e45ab68fea3f0a883c251'), 'aggregator', 'deBridge Crosschain Forwarder'),
    ('ethereum', from_hex('a69babef1ca67a37ffaf7a485dfff3382056e78c'), 'aggregator', 'LiFi Diamond (legacy)'),
    ('ethereum', from_hex('e592427a0aece92de3edee1f18e0157c05861564'), 'aggregator', 'Uniswap SwapRouter02'),
    ('ethereum', from_hex('66a9893cc07d91d95644aedd05d03f95e1dba8af'), 'aggregator', 'Uniswap Universal Router'),

    -- MEV / sandwich / arbitrage bots — biggest culprits dragging 'direct' up
    ('ethereum', from_hex('1f2f10d1c40777ae1da742455c65828ff36df387'), 'mev_bot',    'jaredfromsubway #2'),
    ('ethereum', from_hex('000000000035b5e5ad9019092c665357240f594e'), 'mev_bot',    'MEV bot 0x000…594E'),
    ('ethereum', from_hex('01fdc48ba0903bb1ae7c517c9287d88ea236f8e1'), 'mev_bot',    'MEV bot 0x01FD…F8E1'),
    ('ethereum', from_hex('e00456d3af6e9b8715a9c29c88c1932983e064c1'), 'mev_bot',    'MEV bot 0xE004…64C1'),
    ('ethereum', from_hex('a0f1c3ad83e07d97b5e7030e177718be175275ea'), 'mev_bot',    'MEV bot 0xA0F1…75EA'),
    ('ethereum', from_hex('00c21ca82d94dade0d5d1ed420a4728f58427d21'), 'mev_bot',    'MEV bot 0x00C2…7D21'),
    ('ethereum', from_hex('d8349e874934593c85eafa8e534b495d80848e41'), 'mev_bot',    'MEV-interacting EOA 0xD834…8E41'),

    -- 0x newer settler routes
    ('ethereum', from_hex('7f54f05635d15cde17a49502fedb9d1803a3be8a'), 'aggregator', '0x MainnetSettler'),

    -- Protocol integrators (DeFi protocols calling Balancer pools directly)
    ('ethereum', from_hex('324c5dc1fc42c7a4d43d92df1eba58a54d13bf2d'), 'protocol',   'Fluid Vault Factory'),
    ('ethereum', from_hex('78aba0729345219b8ec4d5c9c19d23186e0803fb'), 'protocol',   'ClearFactory'),

    -- CEX hot wallets (rare but they do interact directly)
    ('ethereum', from_hex('bc1d9760bd6ca468ca9fb5ff2cfbeac35d86c973'), 'cex',        'Bitget hot wallet')
  ) AS t(chain, address, category, name)
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
    t.blockchain, t.version, t.block_date, t.queried_token_address, t.amount_usd,
    CASE
      WHEN cs.solver_name IS NOT NULL                 THEN 'cow_solver'
      WHEN a.aggr_name    IS NOT NULL                 THEN 'aggregator'
      WHEN kr.category    IS NOT NULL                 THEN kr.category
      ELSE                                                 'unknown'
    END AS source_category,
    CASE
      WHEN cs.solver_name IS NOT NULL                 THEN cs.solver_name
      WHEN a.aggr_name    IS NOT NULL                 THEN a.aggr_name
      WHEN kr.name        IS NOT NULL                 THEN kr.name
      ELSE                                                 'unknown ' || '0x' || LOWER(to_hex(t.tx_to))
    END AS source_name
  FROM bal_trades t
  LEFT JOIN agg_lookup a
    ON a.blockchain = t.blockchain AND a.tx_hash = t.tx_hash AND a.evt_index = t.evt_index
  LEFT JOIN cow_solver_map cs
    ON cs.blockchain = t.blockchain AND cs.tx_hash = t.tx_hash
  LEFT JOIN known_routers kr
    ON kr.chain = t.blockchain AND kr.address = t.tx_to
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
