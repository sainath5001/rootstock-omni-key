// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SmartAccount
 * @notice Minimal AA-style smart account controlled by a Bitcoin secp256k1 key.
 *         It verifies an ECDSA signature over a message, nonce and call data,
 *         protects against replay with a monotonically increasing nonce,
 *         and performs a call to a target contract if verification succeeds.
 *
 * @dev This contract assumes all signatures are standard ECDSA signatures
 *      that can be recovered via `ecrecover` / OpenZeppelin `ECDSA`.
 *      The owner is an Ethereum-address representation of the controlling
 *      Bitcoin public key. Off-chain logic must ensure correct mapping
 *      from a Bitcoin key to this address.
 */
contract SmartAccount {
    using ECDSA for bytes32;

    /// @notice Address that corresponds to the owner's Bitcoin public key.
    address public immutable owner;

    /// @notice Nonce used to prevent replay of signed messages.
    uint256 public nonce;

    event Executed(
        address indexed owner,
        address indexed target,
        uint256 nonce,
        bytes data,
        bytes result
    );

    error InvalidSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error CallFailed(bytes returndata);

    constructor(address _owner) {
        require(_owner != address(0), "owner zero");
        owner = _owner;
    }

    /**
     * @notice Verifies a signature from the owner and executes a call.
     * @param message Arbitrary message payload (e.g. domain / session info).
     * @param signature ECDSA signature produced by the owner's key.
     * @param _nonce Expected nonce, must match the current `nonce` value.
     * @param target Contract to be called on successful verification.
     * @param data Calldata to send to the target contract.
     */
    function verifyAndExecute(
        bytes calldata message,
        bytes calldata signature,
        uint256 _nonce,
        address target,
        bytes calldata data
    ) external returns (bytes memory) {
        if (_nonce != nonce) {
            revert InvalidNonce(nonce, _nonce);
        }

        // Build the signed payload hash. Off-chain code must sign this exact
        // preimage (or the equivalent Bitcoin message with this hash embedded).
        bytes32 payloadHash = keccak256(
            abi.encodePacked(address(this), _nonce, target, data, keccak256(message))
        );

        // Use Ethereum-style signed message prefix for additional protection.
        bytes32 ethSignedHash = payloadHash.toEthSignedMessageHash();

        address recovered = ethSignedHash.recover(signature);
        if (recovered != owner) {
            revert InvalidSignature();
        }

        // Bump nonce first to prevent reentrancy-based replay.
        nonce = _nonce + 1;

        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            revert CallFailed(result);
        }

        emit Executed(owner, target, _nonce, data, result);
        return result;
    }
}

