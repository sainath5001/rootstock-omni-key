// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {Counter} from "../src/Counter.sol";

/**
 * Deploy SmartAccount and Counter to Rootstock.
 *
 * Required env (from .env):
 *   SMART_ACCOUNT_OWNER  - address that will control the SmartAccount (Bitcoin key owner)
 *
 * Run from contracts/ after copying .env.example to .env and filling it:
 *   cd contracts
 *   source .env  # or: set -a && source .env && set +a
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url $ROOTSTOCK_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 *
 * Use ROOTSTOCK_RPC_URL = https://public-node.testnet.rsk.co for testnet (Chain ID 31).
 * Use ROOTSTOCK_RPC_URL = https://public-node.rsk.co for mainnet (Chain ID 30).
 */
contract DeployScript is Script {
    function run() external {
        address owner = vm.envAddress("SMART_ACCOUNT_OWNER");

        vm.startBroadcast();

        Counter counter = new Counter();
        SmartAccount smartAccount = new SmartAccount(owner);

        console2.log("Counter deployed at", address(counter));
        console2.log("SmartAccount deployed at", address(smartAccount));

        vm.stopBroadcast();
    }
}

