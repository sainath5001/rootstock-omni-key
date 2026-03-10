import { ethers } from "ethers";
import type { RelayPayload, RelayResponse } from "./types";

/**
 * Builds the payload hash that SmartAccount.verifyAndExecute expects.
 * Must match: keccak256(abi.encodePacked(smartAccount, nonce, target, data, keccak256(message))).
 * The user signs the Ethereum signed message hash of this (personal_sign).
 */
export function buildPayloadHash(
  smartAccount: string,
  nonce: bigint | number | string,
  target: string,
  data: string,
  messageHex: string
): string {
  const messageBytes =
    messageHex.startsWith("0x") ? messageHex : ethers.hexlify(ethers.toUtf8Bytes(messageHex));
  const hashedMessage = ethers.keccak256(messageBytes);
  const nonceBigInt = typeof nonce === "bigint" ? nonce : BigInt(nonce);
  return ethers.solidityPackedKeccak256(
    ["address", "uint256", "address", "bytes", "bytes32"],
    [smartAccount, nonceBigInt, target, data, hashedMessage]
  );
}

/**
 * Returns the hex string to be passed to personal_sign / signMessage.
 * This is the 32-byte payload hash; the wallet will prefix with "\x19Ethereum Signed Message:\n32" and sign.
 */
export function getMessageToSign(
  smartAccount: string,
  nonce: bigint | number | string,
  target: string,
  data: string,
  messageHex: string
): string {
  return buildPayloadHash(smartAccount, nonce, target, data, messageHex);
}

/**
 * Requests the Unisat wallet to sign a message (personal_sign style).
 * Pass the payload hash hex; Unisat will add the Ethereum prefix and return the signature.
 */
export async function signMessage(messageHex: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("signMessage is only available in the browser");
  }
  const unisat = (window as Window & { unisat?: { signMessage: (msg: string) => Promise<string> } }).unisat;
  if (!unisat?.signMessage) {
    throw new Error("Unisat wallet not found or signMessage not supported");
  }
  const signature = await unisat.signMessage(messageHex);
  return signature;
}

/**
 * Sends the signed payload to the relayer. Returns the transaction hash.
 */
export async function relayTransaction(
  relayerUrl: string,
  payload: RelayPayload
): Promise<string> {
  const url = relayerUrl.replace(/\/$/, "") + "/relay";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.message,
      signature: payload.signature,
      nonce: typeof payload.nonce === "bigint" ? Number(payload.nonce) : payload.nonce,
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
