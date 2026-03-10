// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint256 public counter;

    event Increment(address indexed caller, uint256 newValue);

    function increment() external {
        unchecked {
            counter += 1;
        }
        emit Increment(msg.sender, counter);
    }
}
