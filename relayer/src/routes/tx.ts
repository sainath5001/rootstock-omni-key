import { Router, Request, Response, NextFunction } from "express";
import { relayTransaction, RelayParams } from "../services/relayerService";
import { config } from "../config";
import { ethers } from "ethers";

const router = Router();

const SMART_ACCOUNT_IFACE = new ethers.Interface([
  "error InvalidSignature()",
  "error InvalidNonce(uint256,uint256)",
]);
const INVALID_SIGNATURE_SELECTOR = SMART_ACCOUNT_IFACE.getError("InvalidSignature")!.selector;
const INVALID_NONCE_SELECTOR = SMART_ACCOUNT_IFACE.getError("InvalidNonce")!.selector;
type AccountRateEntry = { windowStartedAt: number; count: number };
const accountRate = new Map<string, AccountRateEntry>();

function checkAccountQuota(account: string): boolean {
  const now = Date.now();
  const key = account.toLowerCase();
  const current = accountRate.get(key);
  if (!current || now - current.windowStartedAt >= config.rateLimitWindowMs) {
    accountRate.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= config.accountRateLimitMax) return false;
  current.count += 1;
  accountRate.set(key, current);
  return true;
}

function requireRelayApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.relayerApiKey) {
    next();
    return;
  }
  const header = req.get("x-relayer-api-key") ?? req.get("X-Relayer-API-Key");
  const auth = req.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  const key = header ?? bearer;
  if (!key || key !== config.relayerApiKey) {
    res.status(401).json({ error: "Unauthorized: invalid or missing relayer API key" });
    return;
  }
  next();
}

function isHex(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  const trimmed = s.startsWith("0x") ? s.slice(2) : s;
  return /^[0-9a-fA-F]*$/.test(trimmed) && trimmed.length % 2 === 0;
}

/** Normalize to 0x-prefixed hex; accept base64 for signature (e.g. from Unisat). */
function toHex(s: string, allowBase64 = false): string | null {
  const raw = String(s).trim();
  if (!raw) return null;
  let hex: string;
  if (raw.startsWith("0x")) {
    hex = raw;
  } else if (allowBase64 && /^[A-Za-z0-9+/=]+$/.test(raw) && raw.length % 4 !== 1) {
    try {
      const bytes = Buffer.from(raw, "base64");
      hex = "0x" + bytes.toString("hex");
    } catch {
      hex = "0x" + raw.replace(/[^0-9a-fA-F]/g, "");
    }
  } else {
    hex = "0x" + raw.replace(/[^0-9a-fA-F]/g, "");
  }
  return isHex(hex) ? hex : null;
}

function isAddress(s: string): boolean {
  try {
    return ethers.isAddress(s);
  } catch {
    return false;
  }
}

function parseNonce(v: unknown): number | string {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isInteger(n) && n >= 0) return n;
    if (/^\d+$/.test(v)) return v;
  }
  throw new Error("nonce must be a non-negative integer or string");
}

function parseChainId(v: unknown): number | string {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isInteger(n) && n > 0) return n;
    if (/^\d+$/.test(v)) return v;
  }
  throw new Error("chainId must be a positive integer or string");
}

/**
 * POST /relay
 * Body: { message, signature, nonce, chainId, smartAccount?, target, data }
 * smartAccount is optional if SMART_ACCOUNT_ADDRESS is set in env.
 */
router.post("/relay", requireRelayApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const message = body.message;
    const signature = body.signature;
    const nonce = body.nonce;
    const chainId = body.chainId;
    const smartAccount = body.smartAccount ?? config.smartAccountAddress;
    const target = body.target;
    const data = body.data;

    if (typeof message !== "string" || !message) {
      res.status(400).json({ error: "message is required and must be a hex string (0x...)" });
      return;
    }
    if (typeof signature !== "string" || !signature) {
      res.status(400).json({ error: "signature is required and must be a hex string (0x...)" });
      return;
    }
    if (chainId === undefined || chainId === null) {
      res.status(400).json({ error: "chainId is required (e.g. 31 for Rootstock testnet, 30 for mainnet)" });
      return;
    }
    if (target === undefined || target === null) {
      res.status(400).json({ error: "target is required (contract address)" });
      return;
    }
    if (typeof target !== "string" || !target) {
      res.status(400).json({ error: "target must be a valid address string" });
      return;
    }
    if (typeof data !== "string" || !data) {
      res.status(400).json({ error: "data is required and must be a hex string (0x...)" });
      return;
    }

    if (!smartAccount || typeof smartAccount !== "string") {
      res.status(400).json({
        error: "smartAccount is required (contract address) or set SMART_ACCOUNT_ADDRESS in env",
      });
      return;
    }

    const messageHex = toHex(message, false);
    const signatureHex = toHex(signature, true);
    const dataHex = toHex(data, false);

    if (!messageHex) {
      res.status(400).json({ error: "message must be valid hex (0x...) or UTF-8 string" });
      return;
    }
    if (!signatureHex) {
      res.status(400).json({ error: "signature must be valid hex (0x...) or base64" });
      return;
    }
    if (!dataHex) {
      res.status(400).json({ error: "data must be valid hex (0x...)" });
      return;
    }
    if (!isAddress(smartAccount) || !isAddress(target)) {
      res.status(400).json({ error: "smartAccount and target must be valid Ethereum addresses" });
      return;
    }
    if (!checkAccountQuota(smartAccount)) {
      res.status(429).json({
        error: `Rate limit exceeded for smartAccount. Try again later (max ${config.accountRateLimitMax} per ${config.rateLimitWindowMs}ms).`,
      });
      return;
    }

    let nonceValue: number | string;
    try {
      nonceValue = parseNonce(nonce);
    } catch {
      res.status(400).json({ error: "nonce must be a non-negative integer" });
      return;
    }

    let chainIdValue: number | string;
    try {
      chainIdValue = parseChainId(chainId);
    } catch {
      res.status(400).json({ error: "chainId must be a positive integer" });
      return;
    }

    const params: RelayParams = {
      message: messageHex,
      signature: signatureHex,
      nonce: nonceValue,
      chainId: chainIdValue,
      smartAccount,
      target,
      data: dataHex,
    };

    const result = await relayTransaction(params);
    res.status(200).json({ txHash: result.txHash });
  } catch (err) {
    console.error("[relay] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    const errInfo = err && typeof err === "object" && "info" in err ? (err as { info?: { error?: { data?: string } } }).info : undefined;
    const revertData = errInfo?.error?.data ?? "";
    const errors = err && typeof err === "object" && "errors" in err ? (err as { errors?: unknown[] }).errors : [];
    const subMsg = Array.isArray(errors) && errors.length > 0 && errors[0] instanceof Error ? (errors[0] as Error).message : "";
    const full = message || code || subMsg || (err && typeof err === "object" ? JSON.stringify(err) : "Relayer failed");
    const isRevert =
      full.includes("revert") ||
      full.includes("InvalidSignature") ||
      full.includes("InvalidNonce") ||
      full.includes("CallFailed") ||
      full.includes("InvalidBitcoinSignature");
    const isInvalidSig =
      revertData === INVALID_SIGNATURE_SELECTOR ||
      revertData.startsWith(INVALID_SIGNATURE_SELECTOR) ||
      full.includes("InvalidSignature");
    const isInvalidNonce =
      revertData === INVALID_NONCE_SELECTOR ||
      revertData.startsWith(INVALID_NONCE_SELECTOR) ||
      full.includes("InvalidNonce");
    const isRpc =
      full.includes("detect network") || full.includes("ECONNREFUSED") || full.includes("ENOTFOUND") ||
      full.includes("fetch") || full.includes("NETWORK_ERROR") || full.includes("ETIMEDOUT") || full.includes("ENETUNREACH") ||
      full.includes("eth_getTransactionCount does not exist") || full.includes("method eth_getTransactionCount does not exist") ||
      code === "ETIMEDOUT" || code === "ENETUNREACH" || (typeof message === "string" && (message.includes("ETIMEDOUT") || message.includes("ENETUNREACH")));
    let errorMsg: string;
    if (isRpc)
      errorMsg = "Rootstock RPC error. Your RPC must support standard EVM JSON-RPC methods (e.g. eth_getTransactionCount). Set ROOTSTOCK_RPC_URL in relayer/.env to https://public-node.testnet.rsk.co (testnet) or https://public-node.rsk.co (mainnet).";
    else if (isInvalidSig)
      errorMsg = "Invalid signature: the signer does not match the Smart Account owner. Deploy the SmartAccount with the Ethereum address derived from your Unisat (Bitcoin) public key. See repo README.";
    else if (isInvalidNonce)
      errorMsg = "Invalid nonce. Refresh the page and try again.";
    else
      errorMsg = full || "Unknown relayer error";
    res.status(isRevert ? 400 : 500).json({ error: errorMsg });
  }
});

export default router;
