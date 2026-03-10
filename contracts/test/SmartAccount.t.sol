// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {Counter} from "../src/Counter.sol";

contract SmartAccountTest is Test {
    SmartAccount smartAccount;
    Counter counter;
    address owner;

    function setUp() public {
        owner = vm.addr(1);
        smartAccount = new SmartAccount(owner);
        counter = new Counter();
    }

    function _buildPayload(
        bytes memory message,
        uint256 _nonce,
        address target,
        bytes memory data
    ) internal view returns (bytes32) {
        bytes32 payloadHash = keccak256(
            abi.encodePacked(address(smartAccount), _nonce, target, data, keccak256(message))
        );
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
            );
    }

    function testVerifyAndExecute_IncrementsCounter() public {
        bytes memory message = bytes("omni-key-demo");
        uint256 _nonce = 0;
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);

        bytes32 digest = _buildPayload(message, _nonce, address(counter), data);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        smartAccount.verifyAndExecute(
            message,
            signature,
            _nonce,
            address(counter),
            data
        );

        assertEq(counter.counter(), 1);
        assertEq(smartAccount.nonce(), 1);
    }

    function testVerifyAndExecute_RevertsOnWrongNonce() public {
        bytes memory message = bytes("omni-key-demo");
        uint256 _nonce = 1; // wrong expected nonce
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);

        bytes32 digest = _buildPayload(message, _nonce, address(counter), data);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert();
        smartAccount.verifyAndExecute(
            message,
            signature,
            _nonce,
            address(counter),
            data
        );
    }

    function testVerifyAndExecute_RevertsOnInvalidSignature() public {
        bytes memory message = bytes("omni-key-demo");
        uint256 _nonce = 0;
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);

        bytes32 digest = _buildPayload(message, _nonce, address(counter), data);

        // Sign with a different key (not owner)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(2, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert(SmartAccount.InvalidSignature.selector);
        smartAccount.verifyAndExecute(
            message,
            signature,
            _nonce,
            address(counter),
            data
        );
    }
}

