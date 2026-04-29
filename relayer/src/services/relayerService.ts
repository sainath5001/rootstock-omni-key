import { ethers } from "ethers";
import { config } from "../config";
import { buildPayloadHash } from "omni-key-sdk";
import { bitcoinMessageHash, bitcoinMessageHashNoVarint } from "../utils/bitcoin";

const SMART_ACCOUNT_ABI = [
  "function verifyAndExecute(bytes calldata message, bytes calldata signature, uint256 nonce, address target, bytes calldata data) external returns (bytes memory)",
  "function executeByRelayer(uint256 nonce,address target,bytes calldata data,bytes calldata message,bytes calldata bitcoinSig) external returns (bytes memory)",
  "function owner() view returns (address)",
  "function relayer() view returns (address)",
] as const;
const SMART_ACCOUNT_ERRORS_IFACE = new ethers.Interface(["error InvalidSignature()"]);
const INVALID_SIGNATURE_SELECTOR = SMART_ACCOUNT_ERRORS_IFACE.getError("InvalidSignature")!.selector;

const ROOTSTOCK_TESTNET = { name: "rootstock-testnet", chainId: 31 };
const ROOTSTOCK_MAINNET = { name: "rootstock", chainId: 30 };

/** secp256k1 curve order (EIP-2: reject high-S to prevent malleability). */
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

export interface RelayParams {
  message: string;
  signature: string;
  nonce: number | string;
  chainId: number | string;
  smartAccount: string;
  target: string;
  data: string;
}

function isTransientRpcError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENETUNREACH") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("NETWORK_ERROR") ||
    msg.includes("detect network") ||
    msg.includes("fetch failed")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function networkForChainId(chainId: bigint) {
  if (chainId === 31n) return ROOTSTOCK_TESTNET;
  if (chainId === 30n) return ROOTSTOCK_MAINNET;
  throw new Error(`Unsupported chainId ${chainId}; expected 31 (RSK testnet) or 30 (RSK mainnet)`);
}

export function normalizeSignature(sigHex: string): string {
  const bytes = ethers.getBytes(sigHex);
  if (bytes.length !== 65) return sigHex;
  const r = bytes.slice(0, 32);
  const s = bytes.slice(32, 64);
  let v = bytes[64];
  let sBig = BigInt(ethers.hexlify(s));
  if (sBig > SECP256K1_N / 2n) {
    sBig = SECP256K1_N - sBig;
    v = v === 27 ? 28 : 27;
  }
  const sHex = "0x" + sBig.toString(16).padStart(64, "0");
  const sNew = ethers.getBytes(sHex);
  return ethers.hexlify(ethers.concat([r, sNew, new Uint8Array([v])]));
}

export function decodeUnisatSignature(base64Sig: string): { r: string; s: string; recoveryId: number } {
  const buf = Buffer.from(base64Sig, "base64");
  if (buf.length !== 65) throw new Error("Unisat signature must be 65 bytes");
  const recoveryId = buf[0];
  const r = "0x" + buf.slice(1, 33).toString("hex");
  const s = "0x" + buf.slice(33, 65).toString("hex");
  return { r, s, recoveryId };
}

export function recoverAddressFromBitcoinSig(messageStr: string, signatureBase64: string, expectedOwner: string): void {
  const { r, s, recoveryId } = decodeUnisatSignature(signatureBase64);
  const v1 = 27 + (recoveryId & 1);
  const v2 = 28 - (recoveryId & 1);

  const msgVariants = [messageStr, messageStr.replace(/^0x/i, "")].filter((m, i, a) => a.indexOf(m) === i);
  const hashesToTry: Buffer[] = [];
  for (const msg of msgVariants) {
    hashesToTry.push(bitcoinMessageHash(msg), bitcoinMessageHashNoVarint(msg));
  }

  for (const hash of hashesToTry) {
    const hashHex = "0x" + hash.toString("hex");
    for (const v of [v1, v2]) {
      try {
        const sig = ethers.Signature.from({ r, s, v });
        const addr = ethers.recoverAddress(hashHex, sig);
        if (addr.toLowerCase() === expectedOwner.toLowerCase()) return;
      } catch {
        continue;
      }
    }
  }

  throw new Error("Unisat signature verification failed: recovered address did not match owner.");
}

/** 65-byte Unisat layout as hex for contract executeByRelayer. */
export function bitcoinSig65Hex(signatureHex: string, originalSignature: string): string {
  const fromHex = ethers.getBytes(signatureHex);
  if (fromHex.length === 65) return signatureHex;
  const raw = originalSignature.trim();
  if (raw.startsWith("0x")) throw new Error("Signature must be 65-byte Unisat (base64) or 65-byte hex");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 65) throw new Error("Unisat signature must be 65 bytes (base64)");
  return ethers.hexlify(buf);
}

export async function relayTransaction(params: RelayParams): Promise<{ txHash: string }> {
  const nonceBigInt = typeof params.nonce === "string" ? BigInt(params.nonce) : BigInt(params.nonce);
  const chainIdBigInt = typeof params.chainId === "string" ? BigInt(params.chainId) : BigInt(params.chainId);
  const network = networkForChainId(chainIdBigInt);
  const messageBytes = ethers.getBytes(params.message);
  const dataBytes = ethers.getBytes(params.data);

  const signatureHex = params.signature.startsWith("0x")
    ? params.signature
    : (() => {
        try {
          return "0x" + Buffer.from(params.signature, "base64").toString("hex");
        } catch {
          return params.signature;
        }
      })();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= config.rpcMaxRetries; attempt++) {
    try {
      const provider = new ethers.JsonRpcProvider(config.rootstockRpcUrl, network, { staticNetwork: true });
      const net = await provider.getNetwork();
      if (BigInt(net.chainId) !== chainIdBigInt) {
        throw new Error(`chainId mismatch: request ${chainIdBigInt} vs RPC network ${net.chainId}`);
      }

      const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);
      const smartAccount = new ethers.Contract(params.smartAccount, SMART_ACCOUNT_ABI, wallet);
      try {
        const signatureBytes = ethers.getBytes(normalizeSignature(signatureHex));
        const tx = await smartAccount.verifyAndExecute(
          messageBytes,
          signatureBytes,
          nonceBigInt,
          params.target,
          dataBytes
        );
        const receipt = await tx.wait();
        const txHash =
          (receipt as { hash?: string; transactionHash?: string } | null)?.hash ??
          (receipt as { transactionHash?: string } | null)?.transactionHash;
        if (!txHash) throw new Error("Transaction sent but no transaction hash in receipt");
        return { txHash };
      } catch (err: unknown) {
        const errData = err && typeof err === "object" && "info" in err
          ? (err as { info?: { error?: { data?: string } } }).info?.error?.data
          : undefined;
        const dataStr = typeof errData === "string" ? errData : "";
        const isInvalidSigSelector =
          dataStr === INVALID_SIGNATURE_SELECTOR ||
          dataStr.startsWith(INVALID_SIGNATURE_SELECTOR) ||
          (err instanceof Error && err.message.includes("InvalidSignature"));

        if (!isInvalidSigSelector) throw err;

        const relayerAddr = await smartAccount.relayer();
        if (relayerAddr === ethers.ZeroAddress) {
          throw new Error(
            "Invalid signature (Ethereum-style). Contract has no relayer set for Unisat. Redeploy with RELAYER_ADDRESS in contracts/.env."
          );
        }

        const owner = await smartAccount.owner();
        const payloadHash = buildPayloadHash(
          params.smartAccount,
          chainIdBigInt,
          nonceBigInt,
          params.target,
          params.data,
          params.message
        );
        const messageSignedByUnisat = payloadHash.startsWith("0x") ? payloadHash : "0x" + payloadHash;
        const sigBase64 = params.signature.startsWith("0x")
          ? Buffer.from(ethers.getBytes(params.signature)).toString("base64")
          : params.signature;
        recoverAddressFromBitcoinSig(messageSignedByUnisat, sigBase64, owner);

        const bitcoinSigHex = bitcoinSig65Hex(signatureHex, params.signature);
        const bitcoinSigBytes = ethers.getBytes(bitcoinSigHex);
        const tx = await smartAccount.executeByRelayer(nonceBigInt, params.target, dataBytes, messageBytes, bitcoinSigBytes);
        const receipt = await tx.wait();
        const txHash =
          (receipt as { hash?: string; transactionHash?: string } | null)?.hash ??
          (receipt as { transactionHash?: string } | null)?.transactionHash;
        if (!txHash) throw new Error("Transaction sent but no transaction hash in receipt");
        return { txHash };
      }
    } catch (err) {
      lastErr = err;
      if (attempt < config.rpcMaxRetries && isTransientRpcError(err)) {
        await sleep(config.rpcRetryDelayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("RPC request failed");
}
