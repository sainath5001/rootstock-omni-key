import type { UnisatProvider } from "./types";

const UNISAT_NAMESPACE = "unisat";

/**
 * Detects if the Unisat Bitcoin wallet is installed (window.unisat).
 */
export function detectUnisat(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as Window & { unisat?: UnisatProvider })[UNISAT_NAMESPACE] !== "undefined";
}

/**
 * Returns the Unisat provider. Throws if not installed.
 */
export function getUnisat(): UnisatProvider {
  if (!detectUnisat()) {
    throw new Error("Unisat wallet not found. Install the Unisat extension.");
  }
  return (window as Window & { unisat: UnisatProvider }).unisat;
}

/**
 * Connects to the Unisat wallet and returns the current Bitcoin address.
 * Triggers the wallet's connection prompt if needed.
 */
export async function connectWallet(): Promise<string> {
  const unisat = getUnisat();
  const accounts = await unisat.requestAccounts();
  if (!accounts?.length) {
    throw new Error("Unisat: no accounts returned");
  }
  return accounts[0];
}

/**
 * Gets the current Bitcoin address from Unisat (no prompt).
 * Returns the first account or throws if not connected.
 */
export async function getAddress(): Promise<string> {
  const unisat = getUnisat();
  const accounts = await unisat.getAccounts();
  if (!accounts?.length) {
    throw new Error("Unisat: not connected. Call connectWallet() first.");
  }
  return accounts[0];
}
