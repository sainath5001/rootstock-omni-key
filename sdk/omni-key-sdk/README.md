# Omni-Key SDK

TypeScript SDK for **Rootstock Omni-Key**: connect Bitcoin wallets (Unisat) to Rootstock dApps. Your users sign with their Bitcoin key; a relayer submits the transaction to Rootstock; the SmartAccount executes the call. This is the library you integrate into your frontend or Node app when building on Omni-Key.

## Features

- **Unisat wallet** – Connect, get address, sign messages (Bitcoin-style).
- **Owner address** – Derive the Ethereum address that must be the SmartAccount `owner` (for deployment and UX).
- **Sign & relay** – Build the signed payload, send to your relayer, get the Rootstock tx hash.
- **Flexible API** – Use the `OmniKeyClient` class or standalone functions (`connectWallet`, `signMessage`, `relayTransaction`, etc.).
- **TypeScript** – Full types and interfaces exported.

## Requirements

- **Browser** – Unisat injects `window.unisat`; the SDK is intended for browser use (e.g. React, Next.js, Vite). Server-side code can use config and types; `connectWallet` / `signMessage` require a browser.
- **Unisat extension** – Users must have [Unisat](https://unisat.io/) installed. For owner derivation and Unisat-path relay, Unisat must expose `getPublicKey()`.
- **Relayer** – A running Omni-Key relayer (or your own) that accepts `POST /relay` and submits to Rootstock.
- **SmartAccount** – Deployed with `owner` = Ethereum address derived from the user’s Unisat public key (see `getOwnerAddress()`). For Unisat signing, the contract should also have `relayer` set.

## Installation

```bash
npm install omni-key-sdk
```

**Peer dependency:** `ethers` (^6). If your project does not have it:

```bash
npm install ethers
```

**Monorepo / local:** from the repo root you can use the SDK in the demo-app via workspace or `file:../sdk/omni-key-sdk`. For publishing, the package builds with `npm run build` (see **Build** below).

## Quick start

```ts
import { OmniKeyClient } from "omni-key-sdk";

const client = new OmniKeyClient({
  relayerUrl: "https://your-relayer.com",  // or http://localhost:3001
  smartAccountAddress: "0x...",            // optional if you pass it per call
});

// 1) Connect Unisat (shows wallet prompt)
const bitcoinAddress = await client.connectWallet();

// 2) Optional: show users which owner address the SmartAccount must use
const ownerAddress = await client.getOwnerAddress();
// → Use this as SMART_ACCOUNT_OWNER when deploying the SmartAccount

// 3) Sign and relay a meta-tx (e.g. call a contract)
const nonce = 0n; // in practice: read from SmartAccount.nonce()
const data = "0x..."; // e.g. Counter.increment() calldata
const txHash = await client.signAndRelay({
  message: "0x",
  target: "0xCounterAddress",
  data,
  nonce,
  smartAccount: "0x...", // optional if set in config
});
console.log("Tx hash:", txHash);
```

## API reference

### `OmniKeyClient`

Main client for wallet connection, signing, and relaying.

#### Constructor

```ts
const client = new OmniKeyClient(config: OmniKeyClientConfig);
```

| Config field | Type | Required | Description |
|--------------|------|----------|-------------|
| `relayerUrl` | string | Yes | Base URL of the relayer (e.g. `https://relayer.example.com`). Trailing slash is stripped. |
| `smartAccountAddress` | string | No | Default SmartAccount address. Can be overridden per `signAndRelay` / `relayTransaction` call. |

#### Static methods

| Method | Returns | Description |
|--------|--------|-------------|
| `OmniKeyClient.detectUnisat()` | boolean | `true` if `window.unisat` is available (Unisat extension installed). |

#### Instance methods

| Method | Returns | Description |
|--------|--------|-------------|
| `connectWallet()` | `Promise<string>` | Requests Unisat connection; returns the current Bitcoin address. |
| `getAddress()` | `Promise<string>` | Returns current Unisat address without prompting. Throws if not connected. |
| `getOwnerAddress()` | `Promise<string>` | Ethereum address derived from Unisat public key. Use as SmartAccount `owner` when deploying. Requires Unisat `getPublicKey()`. |
| `signMessage(message: string)` | `Promise<string>` | Signs a message (hex string) with Unisat. Returns signature (format depends on Unisat, e.g. base64). |
| `signAndRelay(params)` | `Promise<string>` | Builds payload hash, gets signature from Unisat, sends to relayer. Returns Rootstock tx hash. |
| `relayTransaction(payload)` | `Promise<string>` | Sends an already-built payload to the relayer. Returns tx hash. |

#### `signAndRelay(params: SignAndRelayParams)`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Message bytes: hex (`0x...`) or UTF-8. Often `"0x"` for simple contract calls. |
| `target` | string | Yes | Contract address to call (e.g. Counter). |
| `data` | string | Yes | Calldata (hex `0x...`), e.g. from `interface.encodeFunctionData("increment")`. |
| `nonce` | number \| string \| bigint | Yes | Current SmartAccount nonce (must match on-chain). |
| `smartAccount` | string | No | SmartAccount address; uses client config if omitted. |

### Standalone functions

Use these if you prefer a functional style or need only part of the flow:

```ts
import {
  detectUnisat,
  getAddress,
  getOwnerAddress,
  connectWallet,
  signMessage,
  relayTransaction,
  buildPayloadHash,
  getMessageToSign,
} from "omni-key-sdk";
```

| Function | Description |
|----------|-------------|
| `detectUnisat()` | Returns whether Unisat is available. |
| `connectWallet()` | Connects Unisat; returns Bitcoin address. |
| `getAddress()` | Current Unisat address; throws if not connected. |
| `getOwnerAddress()` | Ethereum address for SmartAccount owner (from Unisat public key). |
| `signMessage(messageHex)` | Signs with Unisat; returns signature. |
| `getMessageToSign(smartAccount, nonce, target, data, messageHex)` | Returns the 32-byte hash that the user must sign (same as SmartAccount/relayer expect). |
| `buildPayloadHash(...)` | Same inputs as `getMessageToSign`; returns the payload hash. |
| `relayTransaction(relayerUrl, payload)` | POSTs `payload` to `relayerUrl/relay`; returns tx hash. |

### TypeScript types

```ts
import type {
  OmniKeyClientConfig,
  SignAndRelayParams,
  RelayPayload,
  RelayResponse,
  UnisatProvider,
} from "omni-key-sdk";
```

- **OmniKeyClientConfig** – Constructor config: `relayerUrl`, optional `smartAccountAddress`.
- **SignAndRelayParams** – `message`, `target`, `data`, `nonce`, optional `smartAccount`.
- **RelayPayload** – Body for `POST /relay`: `message`, `signature`, `nonce`, `smartAccount`, `target`, `data`.
- **RelayResponse** – `{ txHash: string }`.
- **UnisatProvider** – Typing for `window.unisat` (e.g. for custom wrappers).

## Integration guide

### 1. Check for Unisat

Before showing “Connect wallet”, check that Unisat is available:

```ts
if (!OmniKeyClient.detectUnisat()) {
  // Show: "Install Unisat" or hide Connect button
}
```

### 2. Get the SmartAccount nonce

Each meta-tx must use the current nonce. Read it from the chain before each `signAndRelay`:

```ts
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://public-node.testnet.rsk.co");
const abi = ["function nonce() view returns (uint256)"];
const contract = new ethers.Contract(smartAccountAddress, abi, provider);
const nonce = await contract.nonce(); // bigint
```

### 3. Build calldata

Encode the target contract call with ethers:

```ts
const counterInterface = new ethers.Interface(["function increment()"]);
const data = counterInterface.encodeFunctionData("increment");
```

### 4. Deploy SmartAccount with the correct owner

After the user connects, you can show them the address that must be the SmartAccount owner (for deployment or verification):

```ts
const ownerAddress = await client.getOwnerAddress();
// Deploy SmartAccount with constructor(ownerAddress, relayerAddress)
// or check that existing SmartAccount.owner() === ownerAddress
```

If the user’s Unisat key changes or they use another wallet, the owner address changes; the SmartAccount must be deployed (or a new one used) for that owner.

### 5. Handle errors

- **Unisat not found** – `detectUnisat()` false or `connectWallet` / `signMessage` throw. Prompt to install the extension.
- **Not connected** – `getAddress()` / `getOwnerAddress()` throw. Call `connectWallet()` first.
- **Relayer errors** – `signAndRelay` / `relayTransaction` throw with message like `Relayer error (400): Invalid signature...`. Surface the message to the user; often the SmartAccount needs to be redeployed with the owner from `getOwnerAddress()`.
- **getPublicKey not available** – `getOwnerAddress()` throws if Unisat does not expose `getPublicKey`. User needs a compatible Unisat version; otherwise you cannot derive the owner for deployment.

### 6. React / Next.js

- Use env vars for `relayerUrl` and `smartAccountAddress` (e.g. `NEXT_PUBLIC_RELAYER_URL`).
- Run Unisat-dependent code in the browser only (e.g. after mount, inside `useEffect`, or with `typeof window !== "undefined"`). Avoid calling `connectWallet` or `signMessage` during SSR.

## Project structure

```
omni-key-sdk/
├── src/
│   ├── index.ts    # Exports + OmniKeyClient
│   ├── types.ts    # UnisatProvider, config and payload types
│   ├── wallet.ts   # Unisat detection, connect, getAddress, getOwnerAddress
│   └── signer.ts   # buildPayloadHash, getMessageToSign, signMessage, relayTransaction
├── dist/           # Built output (JS + .d.ts)
├── package.json
└── README.md
```

## Build

From the SDK directory:

```bash
npm run build
```

Runs `tsc` and emits to `dist/`. `prepublishOnly` runs build before publish.

## License

MIT
