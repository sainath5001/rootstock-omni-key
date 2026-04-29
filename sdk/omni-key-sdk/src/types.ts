/**
 * Global Unisat wallet interface (injected in window).
 * @see https://unisat.io/
 */
export interface UnisatProvider {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  /** Public key (hex) for the current account – used to derive SmartAccount owner address. */
  getPublicKey?: () => Promise<string>;
  signMessage(message: string): Promise<string>;
  switchNetwork?(network: string): Promise<void>;
  /** Clears the in-extension session when supported (Unisat). */
  disconnect?: () => Promise<void> | void;
}

declare global {
  interface Window {
    unisat?: UnisatProvider;
  }
}

/**
 * Config for OmniKeyClient.
 */
export interface OmniKeyClientConfig {
  /** Base URL of the relayer (e.g. http://localhost:3001). */
  relayerUrl: string;
  /** SmartAccount contract address (optional if passed per call). */
  smartAccountAddress?: string;
  /** Optional API key sent as X-Relayer-API-Key when RELAYER_API_KEY is set on the server. */
  relayerApiKey?: string;
}

/**
 * Params for signAndRelay.
 */
export interface SignAndRelayParams {
  /** Message bytes (hex 0x... or base64). Treated as hex if starts with 0x. */
  message: string;
  /** EVM chainId of the target chain (e.g. Rootstock testnet = 31, mainnet = 30). */
  chainId: number | string | bigint;
  /** Target contract address. */
  target: string;
  /** Calldata (hex 0x...). */
  data: string;
  /** Current nonce from SmartAccount (must match on-chain). */
  nonce: number | string | bigint;
  /** SmartAccount address (optional if set in client config). */
  smartAccount?: string;
}

/**
 * Relayer POST /relay request body.
 */
export interface RelayPayload {
  message: string;
  signature: string;
  /** Send as string to avoid BigInt->Number truncation. */
  nonce: string;
  chainId: string;
  smartAccount: string;
  target: string;
  data: string;
  /** Sent as X-Relayer-API-Key if set. */
  relayerApiKey?: string;
}

/**
 * Relayer POST /relay response.
 */
export interface RelayResponse {
  txHash: string;
}
