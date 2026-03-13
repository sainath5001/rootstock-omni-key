# Rootstock Omni-Key – Relayer

Backend service that receives signed meta-transactions from clients and submits them to Rootstock. The relayer pays gas and supports both **Ethereum-style** signatures (e.g. MetaMask) and **Bitcoin-style** signatures (e.g. Unisat wallet), with automatic fallback when the contract reverts on the first path.

## Overview

- **Role**: Accepts `POST /relay` payloads (message, signature, nonce, smartAccount, target, data), submits the corresponding transaction to the SmartAccount on Rootstock, and returns the transaction hash.
- **Gas**: The relayer wallet (configured via `RELAYER_PRIVATE_KEY`) pays all gas for relayed transactions.
- **Two paths**:
  1. **Ethereum path**: Calls `SmartAccount.verifyAndExecute(...)`. Use when the client signs with Ethereum `personal_sign` (e.g. MetaMask).
  2. **Unisat path**: If the contract reverts with `InvalidSignature`, the relayer verifies the signature off-chain using the Bitcoin signed-message format, confirms the signer matches the SmartAccount `owner`, then calls `SmartAccount.executeByRelayer(nonce, target, data)`. Use when the client signs with Unisat (Bitcoin-style).

The relayer does not change client or contract logic; it only submits valid requests and normalizes errors for the client.

## Prerequisites

- **Node.js** 18+
- **Rootstock RPC** endpoint (testnet or mainnet)
- **Relayer wallet** with some RBTC for gas
- **SmartAccount** deployed with the correct `owner` (and optionally `relayer` set to this relayer’s address for Unisat flow)

## Installation

```bash
cd relayer
npm install
```

## Configuration

Copy the example env file and set required variables:

```bash
cp .env.example .env
# Edit .env (see table below)
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ROOTSTOCK_RPC_URL` | Yes | Rootstock RPC URL. Testnet: `https://public-node.testnet.rsk.co` or `https://rootstock-testnet.drpc.org`. Mainnet: `https://public-node.rsk.co`. |
| `RELAYER_PRIVATE_KEY` | Yes | Private key of the wallet that pays gas. No `0x` prefix. Must be kept secret. |
| `SMART_ACCOUNT_ADDRESS` | No | Default SmartAccount address if the client does not send `smartAccount`. Leave empty if the client always sends it. |
| `PORT` | No | HTTP server port. Default: `3001`. |

**Security**

- Never commit `.env` or expose `RELAYER_PRIVATE_KEY`.
- In production, restrict CORS and consider rate limiting and authentication for `POST /relay`.

## Running the relayer

**Development**

```bash
npm run dev
```

**Production build and start**

```bash
npm run build
npm start
```

The server listens on `http://localhost:PORT` (default `3001`). For production, run behind a reverse proxy (e.g. nginx) and use a process manager (e.g. PM2).

## API

### `GET /health`

Health check for load balancers and monitoring.

**Response** (200)

```json
{
  "status": "ok",
  "service": "rootstock-omni-key-relayer"
}
```

---

### `POST /relay`

Submit a signed meta-transaction for the SmartAccount to execute.

**Request (JSON body)**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Message (hex `0x...` or UTF-8) used in the signed payload. |
| `signature` | string | Yes | Signature as hex (`0x...`) or base64 (e.g. Unisat). |
| `nonce` | number \| string | Yes | Current SmartAccount nonce (must match on-chain). |
| `smartAccount` | string | If not in env | SmartAccount contract address. |
| `target` | string | Yes | Contract address to call (e.g. Counter). |
| `data` | string | Yes | Calldata for the call (hex `0x...`). |

**Success response** (200)

```json
{
  "txHash": "0x..."
}
```

**Error response** (4xx / 5xx)

```json
{
  "error": "Human-readable message"
}
```

| HTTP | Cause |
|------|--------|
| 400 | Invalid body, missing/invalid fields, or contract revert (e.g. InvalidSignature, InvalidNonce). |
| 500 | Relayer or RPC error (e.g. RPC unreachable, transaction failure). |

The relayer returns user-friendly messages for common cases (e.g. invalid signature, wrong nonce, RPC unreachable). Check the `error` string for details.

## Flow (Unisat)

1. Client builds the same payload hash as the SmartAccount (see SDK).
2. Client signs with Unisat (Bitcoin-style); sends `message`, `signature` (base64), `nonce`, `smartAccount`, `target`, `data` to `POST /relay`.
3. Relayer calls `SmartAccount.verifyAndExecute(...)`. Contract reverts with `InvalidSignature` (Unisat does not use Ethereum `personal_sign`).
4. Relayer loads `SmartAccount.relayer()` and `SmartAccount.owner()`. If relayer is set, it verifies the signature off-chain (Bitcoin message format), checks recovered address == `owner`, then calls `SmartAccount.executeByRelayer(nonce, target, data)`.
5. Relayer returns `txHash` to the client.

The SmartAccount must be deployed with `relayer` set to this relayer’s wallet address (same as the one for `RELAYER_PRIVATE_KEY`) for the Unisat path to work.

## Project structure

```
relayer/
├── src/
│   ├── server.ts          # Express app, CORS, routes
│   ├── config.ts         # Env validation
│   ├── routes/
│   │   └── tx.ts         # POST /relay handler
│   └── services/
│       └── relayerService.ts  # verifyAndExecute + Unisat verification + executeByRelayer
├── .env.example
├── package.json
└── tsconfig.json
```

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **Invalid signature** | SmartAccount `owner` must match the signer. For Unisat, deploy with `SMART_ACCOUNT_OWNER` = Ethereum address derived from the Unisat public key (demo app shows this). |
| **Invalid nonce** | Client must use the current SmartAccount nonce (e.g. fetch before each sign). Refresh and retry. |
| **Contract has no relayer set** | Redeploy SmartAccount with `RELAYER_ADDRESS` in `contracts/.env` set to this relayer’s wallet address. |
| **RPC timeout / unreachable** | Use another RPC in `ROOTSTOCK_RPC_URL` (e.g. `https://rootstock-testnet.drpc.org`). Check firewall and network. |
| **Unisat signer does not match owner** | Ensure the same Unisat key is used to derive the owner and to sign; redeploy SmartAccount with that owner if needed. |

## License

Same as the root repository.
