# Rootstock Omni-Key

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/rsksmart/rootstock-omni-key/badge)](https://scorecard.dev/viewer/?uri=github.com/rsksmart/rootstock-omni-key)
[![CodeQL](https://github.com/rsksmart/rootstock-omni-key/actions/workflows/codeql.yml/badge.svg)](https://github.com/rsksmart/rootstock-omni-key/actions?query=workflow%3ACodeQL)

<img src="rootstock-logo.png" alt="Rootstock Logo" style="width:100%; height: auto;" />

---

Use a **Bitcoin wallet** (Unisat) to control a smart contract on **Rootstock**. No RBTC in the user’s wallet; the relayer pays gas. Users sign with their Bitcoin key; a backend relayer submits the transaction; the SmartAccount executes the call.

## What this is

**Rootstock Omni-Key** is a full-stack example of **account abstraction** on Rootstock with a Bitcoin key as the signer:

- **Smart contracts** – SmartAccount (owner + optional relayer) and a Counter demo contract.
- **SDK** – TypeScript library for frontends: connect Unisat, derive owner address, sign and send meta-transactions via the relayer.
- **Relayer** – Backend that receives signed payloads and submits them to Rootstock (supports Ethereum-style and Unisat/Bitcoin-style signatures).
- **Demo app** – Next.js app that connects Unisat, shows the counter, and increments it via sign-and-relay.

## Repository structure

| Folder | Description |
|--------|-------------|
| [**contracts/**](contracts/) | Solidity (Foundry): SmartAccount, Counter. Deploy with `forge script`; set owner from Unisat and relayer address. |
| [**sdk/omni-key-sdk/**](sdk/omni-key-sdk/) | TypeScript SDK: Unisat connect, `getOwnerAddress`, `signAndRelay`, relay API. Use this in your dApp. |
| [**relayer/**](relayer/) | Node/Express service: `POST /relay` to submit signed meta-txs; pays gas on Rootstock. |
| [**demo-app/**](demo-app/) | Next.js demo: connect wallet, show owner address, counter value, increment via relayer. |

Each folder has its own **README** with setup, config, and usage.

## Quick start

1. **Deploy contracts** (Rootstock testnet or mainnet)  
   See [contracts/README.md](contracts/README.md). You need:
   - `SMART_ACCOUNT_OWNER` = Ethereum address derived from the user’s Unisat public key (demo-app or SDK can show it).
   - `RELAYER_ADDRESS` = relayer wallet address (for Unisat signing path).

2. **Start the relayer**  
   ```bash
   cd relayer && cp .env.example .env
   # Edit .env: ROOTSTOCK_RPC_URL, RELAYER_PRIVATE_KEY
   npm install && npm run dev
   ```
   See [relayer/README.md](relayer/README.md).

3. **Configure and run the demo-app**  
   ```bash
   cd demo-app && cp .env.example .env.local
   # Edit .env.local: NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS, NEXT_PUBLIC_COUNTER_ADDRESS, NEXT_PUBLIC_RELAYER_URL
   npm install && npm run dev
   ```
   See [demo-app/README.md](demo-app/README.md). **The relayer must be running** for connect/counter/increment to work.

4. **Use Unisat**  
   Install the [Unisat](https://unisat.io/) extension, open the app, connect, then use the counter. The app uses Unisat only (ignore any MetaMask-related messages from other extensions).

## Requirements

- **Node.js** 18+ for relayer and demo-app.
- **Foundry** for building and deploying contracts.
- **Unisat** browser extension for the demo (and for any dApp using the SDK).
- **Rootstock RPC** (e.g. [testnet](https://rootstock.io/developers/)), and a relayer wallet with RBTC for gas.

## Documentation

- [Contracts](contracts/README.md) – SmartAccount, Counter, deploy, env vars.
- [SDK](sdk/omni-key-sdk/README.md) – API, integration, types.
- [Relayer](relayer/README.md) – API, config, Unisat fallback.
- [Demo app](demo-app/README.md) – Run order, where the SDK is used, troubleshooting.

## Badges and logo

- **OpenSSF Scorecard** and **CodeQL** badge URLs use `rsksmart/rootstock-omni-key`. If your repo is under a different org or name, update the URLs in the badges above.
- **Logo**: place `rootstock-logo.png` in the repository root so the image displays correctly.

## License

See [LICENSE](LICENSE) in the repository root, if present; otherwise refer to the project’s license terms.
