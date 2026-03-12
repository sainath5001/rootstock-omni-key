## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ source .env
$ forge script script/Deploy.s.sol:DeployScript --rpc-url $ROOTSTOCK_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast --legacy
```

**SmartAccount owner (Unisat):** The `SMART_ACCOUNT_OWNER` in `.env` must be the **Ethereum address** that corresponds to the same Bitcoin key used in Unisat. If you get "Invalid signature" in the demo app, the owner does not match your Unisat key. To derive the Ethereum address from your Unisat (Bitcoin) public key: use the **uncompressed** public key (65 bytes), take `keccak256(pubkey)[12:32]` (last 20 bytes), and format as `0x` + hex. You can use a small script or an online tool that converts Bitcoin pubkey → Ethereum address; then set that as `SMART_ACCOUNT_OWNER` and redeploy the SmartAccount.

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
