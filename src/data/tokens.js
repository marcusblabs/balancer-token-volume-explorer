/**
 * TOKEN REGISTRY
 * Add or remove tokens here. These populate the dropdowns in the UI.
 *
 * Structure: { [chainName]: [{ symbol, name, address }] }
 *
 * The chainName must match what Dune expects in the `blockchain` column,
 * e.g. 'ethereum', 'base', 'arbitrum', 'optimism', 'polygon'.
 */
export const TOKEN_REGISTRY = {
  ethereum: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    },
    {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    },
    {
      symbol: "LINK",
      name: "Chainlink Token",
      address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    },
    { symbol: "UNI", name: "Uniswap Token", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
    { symbol: "AAVE", name: "Aave Token", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
  ],
  base: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
    },
    {
      symbol: "USDC",
      name: "USD Coin (native)",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    {
      symbol: "cbETH",
      name: "Coinbase Wrapped ETH",
      address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    },
    {
      symbol: "AERO",
      name: "Aerodrome Finance",
      address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    },
    {
      symbol: "VIRTUAL",
      name: "Virtual Protocol",
      address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    },
    {
      symbol: "BNKR",
      name: "BNKR",
      address: "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b",
    },
    {
      symbol: "VVV",
      name: "Venice Token",
      address: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
    },
  ],
  arbitrum: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
    {
      symbol: "USDC",
      name: "USD Coin (native)",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    { symbol: "USDT", name: "Tether USD", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    {
      symbol: "ARB",
      name: "Arbitrum Token",
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    },
    {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    },
    { symbol: "GMX", name: "GMX Token", address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a" },
  ],
  optimism: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
    },
    {
      symbol: "USDC",
      name: "USD Coin (native)",
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
    { symbol: "USDT", name: "Tether USD", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" },
    { symbol: "OP", name: "Optimism Token", address: "0x4200000000000000000000000000000000000042" },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    },
  ],
  polygon: [
    {
      symbol: "WPOL",
      name: "Wrapped POL",
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    },
    { symbol: "USDC", name: "USD Coin", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
    { symbol: "USDT", name: "Tether USD", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    },
  ],
  hyperevm: [
    {
      symbol: "WHYPE",
      name: "Wrapped HYPE",
      address: "0x5555555555555555555555555555555555555555",
    },
    { symbol: "USDC", name: "USD Coin", address: "0xb88339CB7199b77E23DB6E890353E22632Ba630f" },
    { symbol: "USDT", name: "Tether USD", address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb" },
    {
      symbol: "UETH",
      name: "Unit Ether",
      address: "0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
    },
    {
      symbol: "USDXL",
      name: "Last USD",
      address: "0xca79db4B49f608eF54a5CB813FbEd3a6387bC645",
    },
  ],
  monad: [
    {
      symbol: "WMON",
      name: "Wrapped MON",
      address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    },
    { symbol: "USDC", name: "USD Coin", address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242",
    },
  ],
};

export const CHAIN_LABELS = {
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  polygon: "Polygon",
  hyperevm: "Hyperevm",
  monad: "Monad",
};

export const CHAINS = Object.keys(TOKEN_REGISTRY);
