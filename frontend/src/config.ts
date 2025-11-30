// src/config.ts
// AidChain Configuration - V11

export const AIDCHAIN_PACKAGE_ID =
  '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da';

export const AIDCHAIN_REGISTRY_ID =
  '0xae9fedfa3419cd46ae6e0b86a27ce96a80ba9428e4adaa83ede998e9674de992';

export const REGISTRY_INITIAL_SHARED_VERSION = 670251451;

// Impact NFT Configuration
export const IMPACT_COUNTER_ID =
  '0x67ee24048776782d84bf18acbe5e9f7bb820bc9db51668c0802720861e0899a7';

export const IMPACT_COUNTER_INITIAL_SHARED_VERSION = 670251442;

// Walrus Testnet URLs
export const WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';

// DAO Config Defaults
export const DEFAULT_VOTING_PERIOD = 10;
export const DEFAULT_QUORUM_PERCENT = 50;
export const DEFAULT_APPROVAL_PERCENT = 60;

// Enoki Sponsored Transactions
export const SPONSOR_BACKEND_URL = import.meta.env.VITE_SPONSOR_BACKEND_URL || 'http://localhost:3001';
export const ENOKI_NETWORK = 'testnet' as const;
export const SPONSORED_TX_ENABLED = import.meta.env.VITE_SPONSORED_TX_ENABLED === 'true';
