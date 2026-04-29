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

function getEnvList(name: string, defaultValue: string): string[] {
  const raw = getEnv(name, defaultValue);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parsePositiveInt(name: string, defaultValue: string): number {
  const raw = getEnv(name, defaultValue);
  const v = parseInt(raw, 10);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return v;
}

function parsePort(name: string, defaultValue: string): number {
  const raw = getEnv(name, defaultValue);
  const v = parseInt(raw, 10);
  if (!Number.isFinite(v) || v < 1 || v > 65535) {
    throw new Error(`${name} must be a TCP port 1–65535 (got "${raw}")`);
  }
  return v;
}

export const config = {
  rootstockRpcUrl: requireEnv("ROOTSTOCK_RPC_URL"),
  relayerPrivateKey: requireEnv("RELAYER_PRIVATE_KEY"),
  smartAccountAddress: getEnv("SMART_ACCOUNT_ADDRESS", ""),
  port: parsePort("PORT", "3001"),
  corsOrigins: getEnvList("CORS_ORIGINS", "http://localhost:3000"),
  rateLimitWindowMs: parsePositiveInt("RATE_LIMIT_WINDOW_MS", "60000"),
  rateLimitMax: parsePositiveInt("RATE_LIMIT_MAX", "30"),
  /** Additional quota per smartAccount (owner account) to reduce drain risk across rotating IPs. */
  accountRateLimitMax: parsePositiveInt("ACCOUNT_RATE_LIMIT_MAX", "20"),
  /** If set, POST /relay requires header X-Relayer-API-Key (or Authorization: Bearer …). */
  relayerApiKey: getEnv("RELAYER_API_KEY", ""),
};
