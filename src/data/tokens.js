/**
 * TOKEN ADDRESSES
 * Add token contract addresses here. Name and symbol are fetched automatically
 * from the chain's RPC when the app loads.
 *
 * Structure: { [chainName]: [address, ...] }
 *
 * The chainName must match what Dune expects in the `blockchain` column,
 * e.g. 'ethereum', 'base', 'arbitrum', 'optimism', 'polygon'.
 */
export const TOKEN_ADDRESSES = {
  ethereum: [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
  ],
  base: [
    "0x4200000000000000000000000000000000000006",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b",
    "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
  ],
  arbitrum: [
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "0x912CE59144191C1204E64559FE8253a0e49E6548",
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
  ],
  optimism: [
    "0x4200000000000000000000000000000000000006",
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    "0x4200000000000000000000000000000000000042",
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  ],
  polygon: [
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  ],
  hyperevm: [
    "0x5555555555555555555555555555555555555555",
    "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
    "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    "0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
    "0xca79db4B49f608eF54a5CB813FbEd3a6387bC645",
  ],
  monad: [
    "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242",
    "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
    "0xe9c082921dc3564e10196c5cc15db1250ac7d5c6",
  ],
  gnosis: [
    "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1",
    "0x8e5bbbb09ed1ebde8674cda39a0c169401db4252",
    "0x2a22f9c3b484c3629090feed35f17ff8f88f76f0",
  ],
  avalanche_c: [
    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab",
    "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
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
  gnosis: "Gnosis",
  avalanche_c: "Avalanche",
};

export const CHAINS = Object.keys(TOKEN_ADDRESSES);

export const DEFAULT_RPCS = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one-rpc.publicnode.com",
  optimism: "https://optimism-rpc.publicnode.com",
  polygon: "https://polygon.drpc.org",
  hyperevm: "https://rpc.hypurrscan.io",
  monad: "https://rpc.monad.xyz",
  gnosis: "https://gnosis-rpc.publicnode.com",
  avalanche_c: "https://avalanche-c-chain-rpc.publicnode.com",
};
