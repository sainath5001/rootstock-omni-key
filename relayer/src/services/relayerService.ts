import { ethers } from "ethers";
import { config } from "../config";

const SMART_ACCOUNT_ABI = [
  "function verifyAndExecute(bytes calldata message, bytes calldata signature, uint256 nonce, address target, bytes calldata data) external returns (bytes memory)",
] as const;

export interface RelayParams {
  message: string;   // hex (0x...)
  signature: string;  // hex (0x...)
  nonce: number | string;
  smartAccount: string;
  target: string;
  data: string;      // hex (0x...)
}

/**
 * Builds and sends a transaction that calls SmartAccount.verifyAndExecute.
 * Relayer wallet pays gas.
 */
export async function relayTransaction(params: RelayParams): Promise<{ txHash: string }> {
  const provider = new ethers.JsonRpcProvider(config.rootstockRpcUrl);
  const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);

  const smartAccount = new ethers.Contract(
    params.smartAccount,
    SMART_ACCOUNT_ABI,
    wallet
  );

  const messageBytes = ethers.getBytes(params.message);
  const signatureBytes = ethers.getBytes(params.signature);
  const dataBytes = ethers.getBytes(params.data);
  const nonceBigInt = typeof params.nonce === "string" ? BigInt(params.nonce) : BigInt(params.nonce);

  const tx = await smartAccount.verifyAndExecute(
    messageBytes,
    signatureBytes,
    nonceBigInt,
    params.target,
    dataBytes
  );

  const receipt = await tx.wait();
  if (!receipt?.hash) {
    throw new Error("Transaction sent but no hash in receipt");
  }

  return { txHash: receipt.hash };
}
