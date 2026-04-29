// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Counter {
    uint256 public counter;

    event Increment(address indexed caller, uint256 newValue);

    function increment() external {
        // counter is uint256; Solidity 0.8+ checks overflow without unchecked. unchecked is gas-only;
        // incrementing by 1 cannot overflow in practice.
        unchecked {
            counter += 1;
        }
        emit Increment(msg.sender, counter);
    }
}
