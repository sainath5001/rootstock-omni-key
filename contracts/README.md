# Rootstock Omni-Key – Smart Contracts

Smart contracts for **Rootstock Omni-Key**: a minimal account-abstraction style flow where a **Bitcoin key** (e.g. Unisat wallet) controls actions on Rootstock. The relayer submits signed payloads; the SmartAccount verifies the signature and executes the requested call.

## Contracts

| Contract        | Description |
|----------------|-------------|
| **SmartAccount** | Account contract controlled by an owner address (derived from a Bitcoin/secp256k1 key). Accepts meta-transactions via `verifyAndExecute` (Ethereum-style signature) or `executeByRelayer` (after relayer verifies Unisat/Bitcoin signature off-chain). Uses a nonce for replay protection. |
| **Counter**      | Simple demo contract with `increment()` and a `counter` value. Used by the demo app to show end-to-end flow. |

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (Forge, Cast, Anvil)
- Rootstock RPC URL (testnet or mainnet)
- Wallet private key for deployment
- **SmartAccount owner**: Ethereum address that corresponds to your Unisat (Bitcoin) public key (see [Owner address](#owner-address--unisat) below)
- **Relayer address** (optional): Ethereum address of the relayer wallet, for Unisat/Bitcoin-style signing via `executeByRelayer`

## Setup

1. **Copy environment file and fill in values**

   ```bash
   cp .env.example .env
   # Edit .env: DEPLOYER_PRIVATE_KEY, SMART_ACCOUNT_OWNER, RELAYER_ADDRESS (optional), ROOTSTOCK_RPC_URL
   ```

2. **Install dependencies** (if not already done)

   ```bash
   forge install
   ```

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

Deploys `Counter` and `SmartAccount` to the network specified by `ROOTSTOCK_RPC_URL`. Use **`--legacy`** for Rootstock (no EIP-1559).

```bash
cd contracts
source .env
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ROOTSTOCK_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --legacy
```

After deployment, note the logged **Counter** and **SmartAccount** addresses and set them in the demo app (`NEXT_PUBLIC_COUNTER_ADDRESS`, `NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS`) and optionally in the relayer config.

## Environment variables

| Variable              | Required | Description |
|-----------------------|----------|-------------|
| `DEPLOYER_PRIVATE_KEY`| Yes      | Private key of the wallet that pays gas and deploys. No `0x` prefix. |
| `SMART_ACCOUNT_OWNER`  | Yes      | Address that will control the SmartAccount. Must be the Ethereum address derived from the same Bitcoin key used in Unisat (see below). |
| `RELAYER_ADDRESS`     | No       | Address of the relayer wallet (same as the one holding `RELAYER_PRIVATE_KEY` in `relayer/.env`). Required for Unisat flow; set to `0x0000000000000000000000000000000000000000` or omit to disable `executeByRelayer`. |
| `ROOTSTOCK_RPC_URL`   | Yes      | Rootstock RPC endpoint. Testnet: `https://public-node.testnet.rsk.co` (Chain ID 31). Mainnet: `https://public-node.rsk.co` (Chain ID 30). |

## Owner address (Unisat)

The SmartAccount checks that the signature’s signer matches `owner`. For the demo app with **Unisat**, `owner` must be the **Ethereum address** derived from the same Bitcoin public key that Unisat uses.

- In the demo app, after connecting Unisat, the UI shows: *“SmartAccount must be deployed with owner: 0x…”*. Use that address as `SMART_ACCOUNT_OWNER` when deploying.
- If you deploy with a different owner and then use Unisat, you will get **Invalid signature** until you redeploy with the correct `SMART_ACCOUNT_OWNER`.

Derivation (for reference): from the **uncompressed** Bitcoin public key (65 bytes), take the last 20 bytes of `keccak256(pubkey[1:65])` and format as `0x` + hex. The SDK/demo can expose this via Unisat’s `getPublicKey()` and `ethers.computeAddress()`.

## Foundry commands

| Command        | Description |
|----------------|-------------|
| `forge build`  | Compile contracts |
| `forge test`   | Run tests |
| `forge fmt`    | Format Solidity |
| `forge snapshot` | Gas snapshots |
| `anvil`        | Local EVM node |
| `cast <subcommand>` | Interact with contracts and chain |

Full docs: [book.getfoundry.sh](https://book.getfoundry.sh/)
