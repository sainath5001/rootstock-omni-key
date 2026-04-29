import { ethers } from "ethers";
import type { RelayPayload, RelayResponse } from "./types";

/**
 * Builds the payload hash that SmartAccount.verifyAndExecute / executeByRelayer bind to.
 * Must match on-chain: keccak256(abi.encodePacked(smartAccount, chainId, nonce, target, data, keccak256(message))).
 * The user signs the Ethereum signed message hash of this for verifyAndExecute (personal_sign).
 */
export function buildPayloadHash(
  smartAccount: string,
  chainId: bigint | number | string,
  nonce: bigint | number | string,
  target: string,
  data: string,
  messageHex: string
): string {
  const messageBytes =
    messageHex.startsWith("0x") ? messageHex : ethers.hexlify(ethers.toUtf8Bytes(messageHex));
  const hashedMessage = ethers.keccak256(messageBytes);
  const chainIdBigInt = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  const nonceBigInt = typeof nonce === "bigint" ? nonce : BigInt(nonce);
  return ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "address", "bytes", "bytes32"],
    [smartAccount, chainIdBigInt, nonceBigInt, target, data, hashedMessage]
  );
}

/**
 * Returns the 32-byte hash that Unisat signs (Bitcoin message over this hex string) and that verifyAndExecute uses with Ethereum personal_sign.
 */
export function getMessageToSign(
  smartAccount: string,
  chainId: bigint | number | string,
  nonce: bigint | number | string,
  target: string,
  data: string,
  messageHex: string
): string {
  return buildPayloadHash(smartAccount, chainId, nonce, target, data, messageHex);
}

export async function signMessage(messageHex: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("signMessage is only available in the browser");
  }
  const unisat = (window as Window & { unisat?: { signMessage: (msg: string) => Promise<string> } }).unisat;
  if (!unisat?.signMessage) {
    throw new Error("Unisat wallet not found or signMessage not supported");
  }
  return unisat.signMessage(messageHex);
}

function assertHttpRelayerUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("relayerUrl must be an absolute http(s) URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("relayerUrl must use http: or https:");
  }
}

/**
 * Sends the signed payload to the relayer. Returns the transaction hash.
 */
export async function relayTransaction(
  relayerUrl: string,
  payload: RelayPayload
): Promise<string> {
  assertHttpRelayerUrl(relayerUrl);
  const url = relayerUrl.replace(/\/$/, "") + "/relay";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (payload.relayerApiKey) {
    headers["X-Relayer-API-Key"] = payload.relayerApiKey;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: payload.message,
      signature: payload.signature,
      nonce: payload.nonce,
      chainId: payload.chainId,
      smartAccount: payload.smartAccount,
      target: payload.target,
      data: payload.data,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let errMessage: string;
    try {
      const j = JSON.parse(errBody) as { error?: string };
      errMessage = j.error ?? errBody;
    } catch {
      errMessage = errBody || res.statusText;
    }
    throw new Error(`Relayer error (${res.status}): ${errMessage}`);
  }

  const data = (await res.json()) as RelayResponse;
  return data.txHash;
}
