# omni-key-sdk

TypeScript SDK for **Rootstock Omni-Key**: connect Bitcoin wallets (e.g. [Unisat](https://unisat.io/)) to Rootstock dApps. Users sign messages with their Bitcoin wallet; a relayer submits the transaction to Rootstock; the SmartAccount verifies the signature and executes the call.

## Install

```bash
npm install omni-key-sdk
```

## Quick start

```ts
import { OmniKeyClient } from "omni-key-sdk";

const omni = new OmniKeyClient({
  relayerUrl: "http://localhost:3001",
  smartAccountAddress: "0x...", // optional if passed per call
});

// Connect Unisat
const bitcoinAddress = await omni.connectWallet();

// Sign and relay (e.g. increment counter)
const txHash = await omni.signAndRelay({
  message: "0x", // or any hex/UTF-8 message
  target: "0xCounterAddress",
  data: "0x...", // e.g. Counter.increment() calldata
  nonce: 0,     // current SmartAccount nonce (read from contract)
  smartAccount: "0x...", // optional if set in config
});

console.log("Tx hash:", txHash);
```

## For developers

Use the SDK in your own dApp (React, Next.js, Vite, etc.) as follows.

### What you need

- **Relayer URL** – Your relayer or the Omni-Key relayer (e.g. `https://your-relayer.com` or `http://localhost:3001`).
- **SmartAccount address** – The deployed SmartAccount contract address.
- **Target contract address** – e.g. Counter (or any contract the SmartAccount is allowed to call).
- **Current nonce** – Read from `SmartAccount.nonce()` on-chain (see below).

### Getting the nonce

Read the current nonce from the SmartAccount so each signature uses the next expected value:

```ts
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://public-node.testnet.rsk.co");
const smartAccountAddress = "0x78cb47B2C97922471435d516D17a448BB74015B0";

const abi = ["function nonce() view returns (uint256)"];
const contract = new ethers.Contract(smartAccountAddress, abi, provider);
const nonce = await contract.nonce(); // bigint
```

### Building calldata

Encode the target contract call (e.g. `Counter.increment()`):

```ts
import { ethers } from "ethers";

const counterInterface = new ethers.Interface([
  "function increment()",
]);
const data = counterInterface.encodeFunctionData("increment");
```

### Minimal React example

```tsx
import { useState } from "react";
import { OmniKeyClient } from "omni-key-sdk";
import { ethers } from "ethers";

const RELAYER_URL = "http://localhost:3001";
const SMART_ACCOUNT = "0x78cb47B2C97922471435d516D17a448BB74015B0";
const COUNTER_ADDRESS = "0xf68d5923485aB66E9DFbA3E78e16A133F43Bc5ec";
const RPC = "https://public-node.testnet.rsk.co";

const smartAccountAbi = ["function nonce() view returns (uint256)"];
const counterInterface = new ethers.Interface(["function increment()"]);

export function OmniCounter() {
  const [address, setAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const omni = new OmniKeyClient({ relayerUrl: RELAYER_URL, smartAccountAddress: SMART_ACCOUNT });

  const handleConnect = async () => {
    try {
      setError(null);
      const addr = await omni.connectWallet();
      setAddress(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleIncrement = async () => {
    if (!address) return;
    try {
      setError(null);
      const provider = new ethers.JsonRpcProvider(RPC);
      const smartAccount = new ethers.Contract(SMART_ACCOUNT, smartAccountAbi, provider);
      const nonce = await smartAccount.nonce();
      const data = counterInterface.encodeFunctionData("increment");
      const hash = await omni.signAndRelay({
        message: "0x",
        target: COUNTER_ADDRESS,
        data,
        nonce,
        smartAccount: SMART_ACCOUNT,
      });
      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      {!address ? (
        <button onClick={handleConnect}>Connect Unisat</button>
      ) : (
        <>
          <p>Connected: {address}</p>
          <button onClick={handleIncrement}>Increment</button>
        </>
      )}
      {txHash && <p>Tx: {txHash}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

### Next.js

Use environment variables for URLs and addresses (e.g. `NEXT_PUBLIC_RELAYER_URL`, `NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS`) and ensure the Omni-Key logic runs in the browser (e.g. inside `useEffect` or after checking `typeof window !== "undefined"`), since Unisat is only available on the client.

## API

### `OmniKeyClient(config)`

- **config.relayerUrl** – Base URL of the relayer (e.g. `http://localhost:3001`).
- **config.smartAccountAddress** – (Optional) Default SmartAccount contract address.

### Methods

| Method | Description |
|--------|-------------|
| `connectWallet()` | Prompts Unisat to connect; returns Bitcoin address. |
| `getAddress()` | Returns current Unisat address (no prompt). Throws if not connected. |
| `signMessage(message)` | Signs an arbitrary hex message with Unisat. |
| `signAndRelay(params)` | Builds payload hash, requests signature, sends to relayer; returns tx hash. |
| `relayTransaction(payload)` | Sends an already-signed payload to the relayer. |

### `signAndRelay(params)`

- **params.message** – Message bytes: hex string (`0x...`) or UTF-8 string.
- **params.target** – Target contract address.
- **params.data** – Calldata (hex `0x...`).
- **params.nonce** – Current nonce from `SmartAccount.nonce()`.
- **params.smartAccount** – (Optional) SmartAccount address if not set in config.

### Standalone

```ts
import {
  detectUnisat,
  connectWallet,
  getAddress,
  signMessage,
  relayTransaction,
  buildPayloadHash,
  getMessageToSign,
} from "omni-key-sdk";
```

## Requirements

- Browser environment (Unisat injects `window.unisat`).
- Relayer running and configured with the same SmartAccount.
- User must have Unisat extension installed.

## Build

```bash
npm run build
```

## License

MIT
