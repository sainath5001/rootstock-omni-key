// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {Counter} from "../src/Counter.sol";

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

