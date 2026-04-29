import { ethers } from "ethers";
import {
  connectWallet as connectWalletFn,
  disconnectWallet as disconnectWalletImpl,
  detectUnisat,
  getAddress,
  getOwnerAddress,
} from "./wallet";
import {
  getMessageToSign,
  signMessage as signMessageFn,
  relayTransaction as relayTransactionFn,
} from "./signer";
import type { OmniKeyClientConfig, SignAndRelayParams, RelayPayload, RelayResponse } from "./types";

export type { OmniKeyClientConfig, SignAndRelayParams, RelayPayload, RelayResponse, UnisatProvider } from "./types";
export { detectUnisat, disconnectWallet, getAddress, getOwnerAddress } from "./wallet";
export { buildPayloadHash, getMessageToSign } from "./signer";
export { connectWalletFn as connectWallet, signMessageFn as signMessage, relayTransactionFn as relayTransaction };

/**
 * Client for Rootstock Omni-Key: connect Bitcoin wallet (Unisat), sign messages, relay txs.
 */
export class OmniKeyClient {
  private readonly relayerUrl: string;
  private readonly defaultSmartAccount?: string;

  private readonly relayerApiKey?: string;

  constructor(config: OmniKeyClientConfig) {
    this.relayerUrl = config.relayerUrl.replace(/\/$/, "");
    this.defaultSmartAccount = config.smartAccountAddress;
    this.relayerApiKey = config.relayerApiKey;
  }

  /**
   * Detects if Unisat is available.
   */
  static detectUnisat(): boolean {
    return detectUnisat();
  }

  /**
   * Connects to the Unisat wallet and returns the Bitcoin address.
   */
  async connectWallet(): Promise<string> {
    return connectWalletFn();
  }

  /** Calls Unisat `disconnect()` when available. */
  async disconnectWallet(): Promise<void> {
    return disconnectWalletImpl();
  }

  /**
   * Returns the current Unisat address (no prompt). Throws if not connected.
   */
  async getAddress(): Promise<string> {
    return getAddress();
  }

  /**
   * Returns the Ethereum address that should be the SmartAccount owner (derived from Unisat public key).
   * Use this when deploying SmartAccount so the contract accepts your Unisat signatures.
   */
  async getOwnerAddress(): Promise<string> {
    return getOwnerAddress();
  }

  /**
   * Signs an arbitrary message with Unisat (personal_sign style).
   */
  async signMessage(message: string): Promise<string> {
    return signMessageFn(message);
  }

  /**
   * Builds the signable payload, requests signature from Unisat, and sends to the relayer.
   * Returns the Rootstock transaction hash.
   */
  async signAndRelay(params: SignAndRelayParams): Promise<string> {
    const smartAccount = params.smartAccount ?? this.defaultSmartAccount;
    if (!smartAccount) {
      throw new Error("smartAccount is required (pass in params or in OmniKeyClient config)");
    }

    const messageHex = params.message.startsWith("0x")
      ? params.message
      : ethers.hexlify(ethers.toUtf8Bytes(params.message));

    const nonce = typeof params.nonce === "bigint" ? params.nonce : BigInt(params.nonce);
    const toSign = getMessageToSign(
      smartAccount,
      params.chainId,
      nonce,
      params.target,
      params.data,
      messageHex
    );

    const signature = await signMessageFn(toSign);

    const payload: RelayPayload = {
      message: messageHex,
      signature,
      nonce: nonce.toString(),
      chainId: (typeof params.chainId === "bigint" ? params.chainId : BigInt(params.chainId)).toString(),
      smartAccount,
      target: params.target,
      data: params.data,
      relayerApiKey: this.relayerApiKey,
    };

    return relayTransactionFn(this.relayerUrl, payload);
  }

  /**
   * Sends an already-signed payload to the relayer (e.g. if you signed elsewhere).
   */
  async relayTransaction(payload: RelayPayload): Promise<string> {
    return relayTransactionFn(this.relayerUrl, payload);
  }
}
