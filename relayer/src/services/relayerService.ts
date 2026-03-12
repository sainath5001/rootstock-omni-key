import * as crypto from "crypto";
import { ethers } from "ethers";
import { config } from "../config";

const SMART_ACCOUNT_ABI = [
  "function verifyAndExecute(bytes calldata message, bytes calldata signature, uint256 nonce, address target, bytes calldata data) external returns (bytes memory)",
  "function executeByRelayer(uint256 nonce, address target, bytes calldata data) external returns (bytes memory)",
  "function owner() view returns (address)",
  "function relayer() view returns (address)",
] as const;

/** secp256k1 curve order (EIP-2: reject high S to prevent malleability). */
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

/** Rootstock networks; name + chainId required by ethers Network.from(). */
const ROOTSTOCK_TESTNET = { name: "rootstock-testnet", chainId: 31 };
const ROOTSTOCK_MAINNET = { name: "rootstock", chainId: 30 };

export interface RelayParams {
  message: string;   // hex (0x...)
  signature: string;  // hex (0x...)
  nonce: number | string;
  smartAccount: string;
  target: string;
  data: string;      // hex (0x...)
}

/**
 * Normalize signature to lower-S form. Bitcoin/Unisat may produce high-S signatures;
 * OpenZeppelin ECDSA rejects them (ECDSAInvalidSignatureS). Convert to lower-S so the contract accepts.
 */
function normalizeSignature(sigHex: string): string {
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

/** Build payload hash (same as SDK/contract). */
function buildPayloadHash(
  smartAccount: string,
  nonce: bigint,
  target: string,
  data: string,
  messageHex: string
): string {
  const messageBytes = messageHex.startsWith("0x") ? messageHex : ethers.hexlify(ethers.toUtf8Bytes(messageHex));
  const hashedMessage = ethers.keccak256(messageBytes);
  return ethers.solidityPackedKeccak256(
    ["address", "uint256", "address", "bytes", "bytes32"],
    [smartAccount, nonce, target, data, hashedMessage]
  );
}

/** Bitcoin signed message: prefix + varint(msgLen) + message, double SHA256. */
function bitcoinMessageHash(messageUtf8: string): Buffer {
  const magic = Buffer.from("\x18Bitcoin Signed Message:\n", "utf8");
  const msgBuf = Buffer.from(messageUtf8, "utf8");
  const len = msgBuf.length;
  const lenVarint = len < 0xfd ? Buffer.from([len]) : Buffer.from([0xfd, len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff]);
  const preimage = Buffer.concat([magic, lenVarint, msgBuf]);
  return crypto.createHash("sha256").update(crypto.createHash("sha256").update(preimage).digest()).digest();
}

/** Alternative: some implementations use magic + message only (no varint for message). */
function bitcoinMessageHashNoVarint(messageUtf8: string): Buffer {
  const magic = Buffer.from("\x18Bitcoin Signed Message:\n", "utf8");
  const msgBuf = Buffer.from(messageUtf8, "utf8");
  const preimage = Buffer.concat([magic, msgBuf]);
  return crypto.createHash("sha256").update(crypto.createHash("sha256").update(preimage).digest()).digest();
}

/** Decode Unisat base64 signature to r, s, recoveryId. */
function decodeUnisatSignature(base64Sig: string): { r: string; s: string; recoveryId: number } {
  const buf = Buffer.from(base64Sig, "base64");
  if (buf.length !== 65) throw new Error("Unisat signature must be 65 bytes");
  const recoveryId = buf[0];
  const r = "0x" + buf.slice(1, 33).toString("hex");
  const s = "0x" + buf.slice(33, 65).toString("hex");
  return { r, s, recoveryId };
}

/** Recover Ethereum address from Bitcoin-style signed message. Tries both v values and multiple message formats; returns only if one matches expectedOwner. */
function recoverAddressFromBitcoinSig(messageStr: string, signatureBase64: string, expectedOwner: string): string {
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
        if (addr.toLowerCase() === expectedOwner.toLowerCase()) return addr;
      } catch {
        continue;
      }
    }
  }

  throw new Error("Unisat signature verification failed: recovered address did not match owner. Ensure you signed with the same Unisat key used to derive the SmartAccount owner.");
}

/**
 * Builds and sends a transaction. Tries verifyAndExecute (Ethereum-style) first;
 * if that fails with InvalidSignature, verifies the Unisat (Bitcoin) signature off-chain
 * and calls executeByRelayer if the contract has a relayer set.
 */
export async function relayTransaction(params: RelayParams): Promise<{ txHash: string }> {
  const isTestnet = config.rootstockRpcUrl.includes("testnet");
  const network = isTestnet ? ROOTSTOCK_TESTNET : ROOTSTOCK_MAINNET;
  const provider = new ethers.JsonRpcProvider(config.rootstockRpcUrl, network, { staticNetwork: true });
  const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);

  const smartAccount = new ethers.Contract(params.smartAccount, SMART_ACCOUNT_ABI, wallet);
  const messageBytes = ethers.getBytes(params.message);
  const dataBytes = ethers.getBytes(params.data);
  const nonceBigInt = typeof params.nonce === "string" ? BigInt(params.nonce) : BigInt(params.nonce);

  const signatureHex = params.signature.startsWith("0x")
    ? params.signature
    : (() => {
        try {
          return "0x" + Buffer.from(params.signature, "base64").toString("hex");
        } catch {
          return params.signature;
        }
      })();

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
    if (!receipt?.hash) throw new Error("Transaction sent but no hash in receipt");
    return { txHash: receipt.hash };
  } catch (err: unknown) {
    const errData = err && typeof err === "object" && "info" in err ? (err as { info?: { error?: { data?: string } } }).info?.error?.data : undefined;
    const dataStr = typeof errData === "string" ? errData : "";
    const isRevertFromVerify =
      dataStr === "0x8baa579f" ||
      dataStr === "0xf645eedf" ||
      dataStr.startsWith("0x8baa579f") ||
      dataStr.startsWith("0xf645eedf") ||
      (err instanceof Error && (err.message.includes("InvalidSignature") || err.message.includes("revert")));

    if (!isRevertFromVerify) throw err;

    const relayerAddr = await smartAccount.relayer();
    if (relayerAddr === ethers.ZeroAddress) {
      throw new Error(
        "Invalid signature (Ethereum-style). Contract has no relayer set for Unisat. Redeploy with RELAYER_ADDRESS in contracts/.env."
      );
    }

    const owner = await smartAccount.owner();

    const payloadHash = buildPayloadHash(
      params.smartAccount,
      nonceBigInt,
      params.target,
      params.data,
      params.message
    );
    const messageSignedByUnisat = payloadHash.startsWith("0x") ? payloadHash : "0x" + payloadHash;

    const sigBase64 =
      params.signature.startsWith("0x")
        ? Buffer.from(ethers.getBytes(params.signature)).toString("base64")
        : params.signature;
    let recovered: string;
    try {
      recovered = recoverAddressFromBitcoinSig(messageSignedByUnisat, sigBase64, owner);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg.includes("did not match") ? msg : "Unisat signature verification failed. Ensure you signed the payload with Unisat (Bitcoin-style).");
    }

    const tx = await smartAccount.executeByRelayer(nonceBigInt, params.target, dataBytes);
    const receipt = await tx.wait();
    if (!receipt?.hash) throw new Error("Transaction sent but no hash in receipt");
    return { txHash: receipt.hash };
  }
}
