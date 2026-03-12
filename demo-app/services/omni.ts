/**
 * Omni Counter – client-side only. Use from browser (e.g. in useEffect or event handlers).
 */

import { ethers } from "ethers";
import { OmniKeyClient, detectUnisat } from "omni-key-sdk";

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3001";
const SMART_ACCOUNT = process.env.NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS || "";
const COUNTER_ADDRESS = process.env.NEXT_PUBLIC_COUNTER_ADDRESS || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://public-node.testnet.rsk.co";

const SMART_ACCOUNT_ABI = ["function nonce() view returns (uint256)"];
const COUNTER_ABI = ["function counter() view returns (uint256)", "function increment()"];

let omniClient: OmniKeyClient | null = null;

export function getOmniClient(): OmniKeyClient {
  if (typeof window === "undefined") {
    throw new Error("getOmniClient is only available in the browser");
  }
  if (!omniClient) {
    omniClient = new OmniKeyClient({
      relayerUrl: RELAYER_URL,
      smartAccountAddress: SMART_ACCOUNT || undefined,
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
  };
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
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(COUNTER_ADDRESS, COUNTER_ABI, provider);
  return contract.counter();
}

export async function getNonce(): Promise<bigint> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(SMART_ACCOUNT, SMART_ACCOUNT_ABI, provider);
  return contract.nonce();
}

const COUNTER_INTERFACE = new ethers.Interface(COUNTER_ABI);

export async function incrementCounter(): Promise<string> {
  const omni = getOmniClient();
  const nonce = await getNonce();
  const data = COUNTER_INTERFACE.encodeFunctionData("increment");
  return omni.signAndRelay({
    message: "increment counter",
    target: COUNTER_ADDRESS,
    data,
    nonce,
    smartAccount: SMART_ACCOUNT || undefined,
  });
}
