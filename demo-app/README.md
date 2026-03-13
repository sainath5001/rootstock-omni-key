# Omni Counter – Demo dApp

Reference frontend for **Rootstock Omni-Key**: users connect with the **Unisat** Bitcoin wallet, and their key controls a SmartAccount on Rootstock. This app demonstrates connecting the wallet, deriving the owner address for deployment, reading an on-chain counter, and sending a signed meta-transaction via the relayer to increment it.

Use this app to verify the full Omni-Key stack (contracts + relayer + SDK) and as a template for your own dApps.

## What this app does

- **Connect Unisat** – Detects the Unisat extension and connects the user’s Bitcoin address.
- **Owner address** – Shows the Ethereum address derived from the user’s Unisat public key. This must be the SmartAccount `owner` (used when deploying the contract).
- **Counter** – Displays the current value from a Counter contract on Rootstock and an **Increment** button.
- **Sign & relay** – On Increment, the app builds the payload, asks Unisat to sign, sends the request to the relayer, and shows the Rootstock transaction link.

The relayer pays gas; the user only signs with their Bitcoin key. No RBTC or MetaMask required.

## Prerequisites

- **Node.js** 18+
- **Relayer** – The Omni-Key relayer must be running (see [relayer/README.md](../relayer/README.md)). Default: `http://localhost:3001`.
- **Deployed contracts** – SmartAccount and Counter on Rootstock (testnet or mainnet). Deploy with [contracts](../contracts) using the same `SMART_ACCOUNT_OWNER` as the address shown in the app (from Unisat) and with `RELAYER_ADDRESS` set.
- **Unisat** – Users need the [Unisat](https://unisat.io/) browser extension. The app uses Unisat only; ignore any “MetaMask” connection errors from other extensions.

## Installation

1. **Install dependencies** (from repo root or `demo-app`):

   ```bash
   cd demo-app
   npm install
   ```

   The app depends on the SDK via `file:../sdk/omni-key-sdk`. From a fresh clone, run `npm install` from `demo-app` so the SDK is linked. If you change the SDK, rebuild it: `cd ../sdk/omni-key-sdk && npm run build`.

2. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your relayer URL, RPC, and contract addresses (see **Configuration** below).

## Configuration

Create `.env.local` (or set env vars) with:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_RELAYER_URL` | No (has default) | Relayer base URL. Default: `http://localhost:3001`. Must be reachable from the user’s browser. |
| `NEXT_PUBLIC_RPC_URL` | No (has default) | Rootstock RPC. Default: `https://public-node.testnet.rsk.co`. |
| `NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS` | Yes* | Deployed SmartAccount contract address. |
| `NEXT_PUBLIC_COUNTER_ADDRESS` | Yes* | Deployed Counter contract address. |

\*Required for the counter flow. If omitted, the app may still connect Unisat but counter and increment will fail.

All variables are prefixed with `NEXT_PUBLIC_` so they are available in the browser.

## Where the SDK is used

This demo-app is a reference for integrating **omni-key-sdk**. The SDK is used as follows:

| SDK API | Used in | Purpose |
|--------|---------|---------|
| `OmniKeyClient`, `detectUnisat` | `services/omni.ts` | Single client and Unisat detection; all SDK calls go through this module. |
| `connectWallet()` | `ConnectWallet.tsx` via `omni.ts` | Connect button: connects Unisat and returns Bitcoin address. |
| `getAddress()` | `ConnectWallet.tsx`, `index.tsx` via `omni.ts` | Show connected address; restore connection on load. |
| `detectUnisat()` → `isUnisatAvailable()` | `index.tsx` | Show “Unisat not installed” banner and disable Connect when Unisat is missing. |
| `getOwnerAddress()` | `index.tsx` via `omni.ts` | Show the Ethereum address that must be SmartAccount `owner` (for deployment). |
| `signAndRelay()` | `Counter.tsx` via `incrementCounter()` in `omni.ts` | Increment button: build payload, sign with Unisat, send to relayer, return tx hash. |

RPC calls (nonce, counter value) use **ethers** in `services/omni.ts`; the SDK handles only wallet connection, owner derivation, signing, and relayer submission.

## Running the app

**You need the relayer running** for connect/counter/increment to work. Start it first (e.g. in another terminal):

```bash
cd relayer && npm run dev
```

Then start the demo-app.

**Development**

```bash
npm run dev
```

Opens at `http://localhost:3000` (or the next free port). Use this while changing code or testing against a local relayer.

**Production build and run**

```bash
npm run build
npm start
```

Serves the built app (default port 3000). Point your reverse proxy or load balancer at this process in production.

## Project structure

```
demo-app/
├── pages/
│   ├── _app.tsx       # App shell, global CSS
│   └── index.tsx      # Main page: connect, owner hint, counter
├── components/
│   ├── ConnectWallet.tsx   # Unisat connect button, connected address
│   └── Counter.tsx        # Counter value, increment button, tx link
├── services/
│   └── omni.ts        # SDK client, config, getNonce/getCounterValue/incrementCounter
├── styles/
│   └── globals.css    # Tailwind, theme (dark + Rootstock orange)
├── .env.example
├── .env.local         # Your config (do not commit)
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

- **`services/omni.ts`** – Single place that reads env, creates `OmniKeyClient`, and exposes `connectWallet`, `getAddress`, `getOwnerAddress`, `getCounterValue`, `getNonce`, `incrementCounter`, and `isUnisatAvailable`. All Unisat/RPC usage goes through here.
- **`pages/index.tsx`** – Layout, Unisat detection, owner address display, and the Connect + Counter card.
- **`components/ConnectWallet`** – Connect button (or truncated address when connected). Handles “Unisat not installed” and MetaMask-message noise.
- **`components/Counter`** – Fetches counter from chain, polls every 5s when connected, calls `incrementCounter()` on button click, shows tx link to Rootstock explorer (testnet).

## User flow

1. Open the app. If Unisat is not installed, a banner explains to install it and that the app does not use MetaMask.
2. Click **Connect Unisat**. Unisat prompts to connect; the app shows the truncated Bitcoin address.
3. After connect, the app shows: **SmartAccount must be deployed with owner:** `0x...`. This is the Ethereum address from the user’s Unisat public key. The same address must be used as `SMART_ACCOUNT_OWNER` when deploying the SmartAccount (and the contract must have the relayer set for Unisat path).
4. **Counter** shows the current value from the Counter contract. **Increment Counter** builds the meta-tx, requests a signature from Unisat, sends to the relayer, then shows the transaction hash and link to the block explorer.

## Using this as a template

- **Env** – Keep relayer, RPC, and contract addresses in `NEXT_PUBLIC_*` and read them in `services/omni.ts` (or your own config module).
- **SDK** – The demo uses `OmniKeyClient` from `omni-key-sdk`: connect, `getOwnerAddress`, and `signAndRelay`. For other actions, still use `getNonce()` from the SmartAccount and encode your own `target`/`data` in `signAndRelay`.
- **Unisat only** – The UI explicitly states that only Unisat is used; MetaMask connection errors from other extensions can be ignored. You can reuse this pattern in your dApp.
- **Styling** – Tailwind with a dark theme and Rootstock-style orange accents. Adjust `tailwind.config.js` and `styles/globals.css` to match your branding.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **“Unisat not installed”** | User must install the [Unisat](https://unisat.io/) extension. The app does not use MetaMask. |
| **“Failed to connect to MetaMask”** in console | Comes from another extension. Ignore it; use **Connect Unisat** in the app. |
| **Console error from MetaMask** (`chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn` or `Object.connect`) and app won’t load | This app does not use MetaMask, but the MetaMask extension injects into the page. If MetaMask is **locked**, it can throw and block the page. Try **unlocking MetaMask** (or disable the extension for this site); then reload. |
| **“Cannot reach the relayer”** | Start the relayer (`cd relayer && npm run dev`). Ensure `NEXT_PUBLIC_RELAYER_URL` is correct and reachable from the browser (e.g. no localhost if the app is on another host). |
| **“SmartAccount owner mismatch” / “Invalid signature”** | The SmartAccount must be deployed with `owner` = the address shown in the app (from `getOwnerAddress()`). Redeploy with that `SMART_ACCOUNT_OWNER` and set `RELAYER_ADDRESS` in contracts. See [contracts/README.md](../contracts/README.md). |
| **Counter stays “—” or increment fails** | Check `NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS`, `NEXT_PUBLIC_COUNTER_ADDRESS`, and `NEXT_PUBLIC_RPC_URL`. Ensure contracts are deployed on the same network as the RPC. |
| **SDK type or build errors** | Rebuild the SDK: `cd sdk/omni-key-sdk && npm run build`, then in `demo-app`: `npm install` and `npm run build`. |

## Related docs

- [SDK README](../sdk/omni-key-sdk/README.md) – API and integration details.
- [Relayer README](../relayer/README.md) – Relayer setup and `/relay` API.
- [Contracts README](../contracts/README.md) – SmartAccount and Counter deployment.

## License

Same as the root repository.
