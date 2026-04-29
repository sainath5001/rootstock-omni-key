/**
 * Omni Counter – client-side only. Use from browser (e.g. in useEffect or event handlers).
 */

import { ethers } from "ethers";
import { OmniKeyClient, detectUnisat, getMessageToSign, signMessage, relayTransaction } from "omni-key-sdk";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001";
const RELAYER_API_KEY = process.env.NEXT_PUBLIC_RELAYER_API_KEY || "";
const SMART_ACCOUNT = process.env.NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS || "";
const COUNTER_ADDRESS = process.env.NEXT_PUBLIC_COUNTER_ADDRESS || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co";
const CHAIN_ID_RAW = process.env.NEXT_PUBLIC_CHAIN_ID;
const CHAIN_ID =
  CHAIN_ID_RAW && /^\d+$/.test(CHAIN_ID_RAW.trim())
    ? parseInt(CHAIN_ID_RAW.trim(), 10)
    : RPC_URL.includes("testnet")
      ? 31
      : 30;

const SMART_ACCOUNT_ABI = ["function nonce() view returns (uint256)"];
const COUNTER_ABI = ["function counter() view returns (uint256)", "function increment()"];

let omniClient: OmniKeyClient | null = null;
let provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (typeof window === "undefined") {
    throw new Error("getProvider is only available in the browser");
  }
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function assertContractConfig(): void {
  if (!ethers.isAddress(SMART_ACCOUNT) || SMART_ACCOUNT === ethers.ZeroAddress) {
    throw new Error("Missing or invalid NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS in .env.local");
  }
  if (!ethers.isAddress(COUNTER_ADDRESS) || COUNTER_ADDRESS === ethers.ZeroAddress) {
    throw new Error("Missing or invalid NEXT_PUBLIC_COUNTER_ADDRESS in .env.local");
  }
}

export function getOmniClient(): OmniKeyClient {
  if (typeof window === "undefined") {
    throw new Error("getOmniClient is only available in the browser");
  }
  if (!omniClient) {
    omniClient = new OmniKeyClient({
      relayerUrl: RELAYER_URL,
      smartAccountAddress: SMART_ACCOUNT || undefined,
      relayerApiKey: RELAYER_API_KEY || undefined,
    });
  }
  return omniClient;
}

export function getConfig() {
  return {
    relayerUrl: RELAYER_URL,
    smartAccountAddress: SMART_ACCOUNT,
    counterAddress: COUNTER_ADDRESS,
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
  };
}

export function getExplorerTxUrl(txHash: string): string {
  const base =
    CHAIN_ID === 31 ? "https://explorer.testnet.rootstock.io/tx/" : "https://explorer.rootstock.io/tx/";
  return `${base}${txHash}`;
}

/** True if Unisat extension is available. This app does not use MetaMask. */
export function isUnisatAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return detectUnisat();
}

export async function connectWallet(): Promise<string> {
  const omni = getOmniClient();
  return omni.connectWallet();
}

export async function disconnectWallet(): Promise<void> {
  if (typeof window === "undefined") return;
  const omni = getOmniClient();
  await omni.disconnectWallet();
}

export async function getAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const omni = getOmniClient();
    return await omni.getAddress();
  } catch {
    return null;
  }
}

/** Ethereum address that must be the SmartAccount owner (from Unisat public key). */
export async function getOwnerAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const omni = getOmniClient();
    return await omni.getOwnerAddress();
  } catch {
    return null;
  }
}

export async function getCounterValue(): Promise<bigint> {
  assertContractConfig();
  const contract = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, getProvider());
  return contract.counter();
}

export async function getNonce(): Promise<bigint> {
  assertContractConfig();
  const contract = new ethers.Contract(SMART_ACCOUNT, SMART_ACCOUNT_ABI, getProvider());
  return contract.nonce();
}

const COUNTER_INTERFACE = new ethers.Interface(COUNTER_ABI);

/**
 * @param onSubmitting Called after the wallet signature is obtained, immediately before relay HTTP request.
 */
export async function incrementCounter(onSubmitting?: () => void): Promise<string> {
  assertContractConfig();
  const nonce = await getNonce();
  const data = COUNTER_INTERFACE.encodeFunctionData("increment");
  const messageHex = ethers.hexlify(ethers.toUtf8Bytes("increment counter"));
  const toSign = getMessageToSign(SMART_ACCOUNT, CHAIN_ID, nonce, COUNTER_ADDRESS, data, messageHex);
  const signature = await signMessage(toSign);
  onSubmitting?.();
  return relayTransaction(RELAYER_URL, {
    message: messageHex,
    signature,
    nonce: nonce.toString(),
    chainId: CHAIN_ID.toString(),
    smartAccount: SMART_ACCOUNT,
    target: COUNTER_ADDRESS,
    data,
    relayerApiKey: RELAYER_API_KEY || undefined,
  });
}
