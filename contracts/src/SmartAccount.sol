// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {BitcoinMessage} from "./BitcoinMessage.sol";

/**
 * @title SmartAccount
 * @notice Minimal AA-style smart account controlled by a Bitcoin secp256k1 key.
 * @dev verifyAndExecute: Ethereum personal_sign. executeByRelayer: Unisat Bitcoin-message signature verified on-chain.
 */
contract SmartAccount {
    using MessageHashUtils for bytes32;

    address public immutable owner;
    address public immutable relayer;
    uint256 public nonce;

    uint256 private constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    event Executed(
        address indexed owner,
        address indexed recoveredSigner,
        address indexed target,
        uint256 nonce,
        bytes data,
        bytes result
    );

    error OwnerZero();
    error NotRelayer();
    error InvalidSignature();
    error InvalidBitcoinSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error CallFailed(bytes returndata);

    constructor(address _owner, address _relayer) {
        if (_owner == address(0)) revert OwnerZero();
        owner = _owner;
        relayer = _relayer;
    }

    function _payloadHash(uint256 _nonce, address target, bytes calldata data, bytes calldata message)
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                _nonce,
                target,
                data,
                keccak256(message)
            )
        );
    }

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

        bytes32 payloadHash = _payloadHash(_nonce, target, data, message);
        bytes32 ethSignedHash = payloadHash.toEthSignedMessageHash();

        address recovered = ECDSA.recover(ethSignedHash, signature);
        if (recovered != owner) {
            revert InvalidSignature();
        }

        nonce = _nonce + 1;

        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            revert CallFailed(result);
        }

        emit Executed(owner, recovered, target, _nonce, data, result);
        return result;
    }

    /**
     * @param bitcoinSig 65 bytes: Unisat layout — byte0 recovery id (ignored for v; we brute v 27/28), bytes 1–32 r, 33–64 s.
     */
    function executeByRelayer(
        uint256 _nonce,
        address target,
        bytes calldata data,
        bytes calldata message,
        bytes calldata bitcoinSig
    ) external returns (bytes memory) {
        if (relayer == address(0) || msg.sender != relayer) revert NotRelayer();
        if (_nonce != nonce) {
            revert InvalidNonce(nonce, _nonce);
        }
        if (bitcoinSig.length != 65) revert InvalidBitcoinSignature();

        address recovered = _recoverBitcoinOwner(owner, _nonce, target, data, message, bitcoinSig);
        if (recovered != owner) revert InvalidBitcoinSignature();

        nonce = _nonce + 1;

        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            revert CallFailed(result);
        }

        emit Executed(owner, recovered, target, _nonce, data, result);
        return result;
    }

    function _recoverBitcoinOwner(
        address expectedOwner,
        uint256 _nonce,
        address target,
        bytes calldata data,
        bytes calldata message,
        bytes calldata bitcoinSig
    ) internal view returns (address) {
        bytes32 payloadHash = _payloadHash(_nonce, target, data, message);
        bytes memory utf8Hex = BitcoinMessage.payloadHashToSignableUtf8(payloadHash);
        bytes32 dVarint = BitcoinMessage.bitcoinSignedDigest(utf8Hex);
        bytes32 dNoVar = BitcoinMessage.bitcoinSignedDigestNoVarint(utf8Hex);

        (bytes32 r, bytes32 sNorm) = _readLowS(bitcoinSig);

        address recovered = _tryRecoverOwner(expectedOwner, dVarint, r, sNorm);
        if (recovered != address(0)) return recovered;
        return _tryRecoverOwner(expectedOwner, dNoVar, r, sNorm);
    }

    function _readLowS(bytes calldata bitcoinSig) internal pure returns (bytes32 r, bytes32 sNorm) {
        bytes32 sRaw;
        assembly ("memory-safe") {
            let base := bitcoinSig.offset
            r := calldataload(add(base, 1))
            sRaw := calldataload(add(base, 33))
        }
        uint256 sVal = uint256(sRaw);
        sNorm = sRaw;
        if (sVal > SECP256K1_N / 2) {
            sNorm = bytes32(SECP256K1_N - sVal);
        }
    }

    function _tryRecoverOwner(address expectedOwner, bytes32 digest, bytes32 r, bytes32 sNorm)
        private
        pure
        returns (address)
    {
        (address a27, ECDSA.RecoverError e27,) = ECDSA.tryRecover(digest, 27, r, sNorm);
        if (e27 == ECDSA.RecoverError.NoError && a27 == expectedOwner) return a27;
        (address a28, ECDSA.RecoverError e28,) = ECDSA.tryRecover(digest, 28, r, sNorm);
        if (e28 == ECDSA.RecoverError.NoError && a28 == expectedOwner) return a28;
        return address(0);
    }
}

