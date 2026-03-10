import { Router, Request, Response } from "express";
import { relayTransaction, RelayParams } from "../services/relayerService";
import { config } from "../config";
import { ethers } from "ethers";

const router = Router();

function isHex(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  const trimmed = s.startsWith("0x") ? s.slice(2) : s;
  return /^[0-9a-fA-F]*$/.test(trimmed) && trimmed.length % 2 === 0;
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

/**
 * POST /relay
 * Body: { message, signature, nonce, smartAccount?, target, data }
 * smartAccount is optional if SMART_ACCOUNT_ADDRESS is set in env.
 */
router.post("/relay", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const message = body.message;
    const signature = body.signature;
    const nonce = body.nonce;
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

    const messageHex = message.startsWith("0x") ? message : `0x${message}`;
    const signatureHex = signature.startsWith("0x") ? signature : `0x${signature}`;
    const dataHex = data.startsWith("0x") ? data : `0x${data}`;

    if (!isHex(messageHex) || !isHex(signatureHex) || !isHex(dataHex)) {
      res.status(400).json({ error: "message, signature, and data must be valid hex strings" });
      return;
    }
    if (!isAddress(smartAccount) || !isAddress(target)) {
      res.status(400).json({ error: "smartAccount and target must be valid Ethereum addresses" });
      return;
    }

    let nonceValue: number | string;
    try {
      nonceValue = parseNonce(nonce);
    } catch {
      res.status(400).json({ error: "nonce must be a non-negative integer" });
      return;
    }

    const params: RelayParams = {
      message: messageHex,
      signature: signatureHex,
      nonce: nonceValue,
      smartAccount,
      target,
      data: dataHex,
    };

    const result = await relayTransaction(params);
    res.status(200).json({ txHash: result.txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isRevert = message.includes("revert") || message.includes("InvalidSignature") || message.includes("InvalidNonce") || message.includes("CallFailed");
    res.status(isRevert ? 400 : 500).json({ error: message });
  }
});

export default router;
