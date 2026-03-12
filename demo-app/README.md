# Omni Counter – Demo dApp

Demo dApp for **Rootstock Omni-Key**: connect a Bitcoin wallet (Unisat) and increment a counter on Rootstock. The wallet signs a message; the relayer submits the transaction; the SmartAccount verifies the signature and calls `Counter.increment()`.

## Prerequisites

- Relayer running (see `../relayer`)
- Unisat browser extension
- Contract addresses set in env (or use defaults for testnet)

## Setup

```bash
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_RELAYER_URL, addresses, RPC if needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect Unisat, then click **Increment Counter**.

## Env vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_RELAYER_URL` | Relayer base URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_RPC_URL` | Rootstock RPC (default: testnet) |
| `NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS` | Deployed SmartAccount address |
| `NEXT_PUBLIC_COUNTER_ADDRESS` | Deployed Counter address |

## Flow

1. User clicks **Connect Unisat** → SDK connects to `window.unisat`.
2. Counter value is read from the Counter contract via ethers + RPC.
3. User clicks **Increment Counter** → message `"increment counter"` is signed by Unisat, then sent to the relayer with nonce and calldata.
4. Relayer calls `SmartAccount.verifyAndExecute(...)`; the contract verifies the signature and calls `Counter.increment()`.
