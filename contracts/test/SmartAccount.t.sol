// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {Counter} from "../src/Counter.sol";
import {BitcoinMessage} from "../src/BitcoinMessage.sol";

contract SmartAccountTest is Test {
    SmartAccount smartAccount;
    Counter counter;
    address owner;
    address relayer;

    function setUp() public {
        owner = vm.addr(1);
        relayer = vm.addr(9);
        smartAccount = new SmartAccount(owner, relayer);
        counter = new Counter();
    }

    function _buildPayload(
        bytes memory message,
        uint256 _nonce,
        address target,
        bytes memory data
    ) internal view returns (bytes32) {
        bytes32 payloadHash = keccak256(
            abi.encodePacked(
                address(smartAccount),
                block.chainid,
                _nonce,
                target,
                data,
                keccak256(message)
            )
        );
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
            );
    }

    function _bitcoinSig65(uint256 pk, bytes memory message, uint256 _nonce, address target, bytes memory data)
        internal
        view
        returns (bytes memory)
    {
        bytes32 ph = keccak256(
            abi.encodePacked(
                address(smartAccount),
                block.chainid,
                _nonce,
                target,
                data,
                keccak256(message)
            )
        );
        bytes32 digest = BitcoinMessage.bitcoinSignedDigest(BitcoinMessage.payloadHashToSignableUtf8(ph));
        (, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(uint8(0), r, s);
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

    function testConstructor_RevertsOwnerZero() public {
        vm.expectRevert(SmartAccount.OwnerZero.selector);
        new SmartAccount(address(0), relayer);
    }

    function testExecuteByRelayer_RevertsForNonRelayer() public {
        bytes memory message = bytes("omni-key-demo");
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);
        bytes memory sig = _bitcoinSig65(1, message, 0, address(counter), data);
        vm.expectRevert(SmartAccount.NotRelayer.selector);
        smartAccount.executeByRelayer(0, address(counter), data, message, sig);
    }

    function testExecuteByRelayer_RevertsWhenRelayerZero() public {
        SmartAccount sa = new SmartAccount(owner, address(0));
        bytes memory message = bytes("x");
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);
        bytes memory sig = new bytes(65);
        vm.expectRevert(SmartAccount.NotRelayer.selector);
        sa.executeByRelayer(0, address(counter), data, message, sig);
    }

    function testExecuteByRelayer_RevertsWrongNonce() public {
        bytes memory message = bytes("omni-key-demo");
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);
        bytes memory sig = _bitcoinSig65(1, message, 1, address(counter), data);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(SmartAccount.InvalidNonce.selector, uint256(0), uint256(1)));
        smartAccount.executeByRelayer(1, address(counter), data, message, sig);
    }

    function testExecuteByRelayer_RevertsBadBitcoinSig() public {
        bytes memory message = bytes("omni-key-demo");
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);
        bytes memory sig = new bytes(65);
        sig[0] = 0x01;
        vm.prank(relayer);
        vm.expectRevert(SmartAccount.InvalidBitcoinSignature.selector);
        smartAccount.executeByRelayer(0, address(counter), data, message, sig);
    }

    function testExecuteByRelayer_WorksWithValidBitcoinSig() public {
        bytes memory message = bytes("omni-key-demo");
        bytes memory data = abi.encodeWithSelector(counter.increment.selector);
        bytes memory sig = _bitcoinSig65(1, message, 0, address(counter), data);
        vm.prank(relayer);
        smartAccount.executeByRelayer(0, address(counter), data, message, sig);
        assertEq(counter.counter(), 1);
        assertEq(smartAccount.nonce(), 1);
    }

    function testVerifyAndExecute_RevertsCallFailed() public {
        bytes memory message = bytes("omni-key-demo");
        uint256 _nonce = 0;
        bytes memory data = abi.encodeWithSignature("nonexistent()");
        bytes32 digest = _buildPayload(message, _nonce, address(counter), data);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.expectRevert();
        smartAccount.verifyAndExecute(message, signature, _nonce, address(counter), data);
    }
}
