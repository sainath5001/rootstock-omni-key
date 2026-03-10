/**
 * Relayer configuration from environment variables.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function getEnv(name: string, defaultValue: string): string {
  return (process.env[name] ?? defaultValue).trim();
}

export const config = {
  /** Rootstock RPC URL (testnet or mainnet). */
  rootstockRpcUrl: requireEnv("ROOTSTOCK_RPC_URL"),

  /** Private key of the relayer wallet (pays gas). No 0x prefix. */
  relayerPrivateKey: requireEnv("RELAYER_PRIVATE_KEY"),

  /** Default SmartAccount contract address if not provided in request. */
  smartAccountAddress: getEnv("SMART_ACCOUNT_ADDRESS", ""),

  /** Server port. */
  port: parseInt(getEnv("PORT", "3001"), 10),
};
