// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @dev Bitcoin signed message format used by Unisat: "\x18Bitcoin Signed Message:\n" + varint(len) + message,
 *      then double-SHA256. Digest is what ECDSA.recover expects (same curve as Ethereum).
 */
library BitcoinMessage {
    bytes private constant _MAGIC = hex"18426974636f696e205369676e6564204d6573736167650a"; // \x18Bitcoin Signed Message:\n

    function encodeVarint(uint256 len) internal pure returns (bytes memory) {
        if (len < 0xfd) {
            bytes memory out = new bytes(1);
            out[0] = bytes1(uint8(len));
            return out;
        }
        if (len <= 0xffff) {
            bytes memory out = new bytes(3);
            out[0] = 0xfd;
            out[1] = bytes1(uint8(len & 0xff));
            out[2] = bytes1(uint8((len >> 8) & 0xff));
            return out;
        }
        if (len <= 0xffffffff) {
            bytes memory out = new bytes(5);
            out[0] = 0xfe;
            out[1] = bytes1(uint8(len & 0xff));
            out[2] = bytes1(uint8((len >> 8) & 0xff));
            out[3] = bytes1(uint8((len >> 16) & 0xff));
            out[4] = bytes1(uint8((len >> 24) & 0xff));
            return out;
        }
        revert("varint: length too large");
    }

    /// @dev Lowercase 0x-prefixed hex of bytes32 (ASCII), matching typical wallet / relayer encoding.
    function payloadHashToSignableUtf8(bytes32 payloadHash) internal pure returns (bytes memory) {
        bytes memory hexSymbols = hex"30313233343536373839616263646566";
        bytes memory out = new bytes(66);
        out[0] = bytes1(0x30); // '0'
        out[1] = bytes1(0x78); // 'x'
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(payloadHash[i]);
            out[2 + 2 * i] = hexSymbols[uint8(b >> 4)];
            out[3 + 2 * i] = hexSymbols[uint8(b & 0x0f)];
        }
        return out;
    }

    function bitcoinSignedDigest(bytes memory messageUtf8) internal pure returns (bytes32) {
        bytes memory vi = encodeVarint(messageUtf8.length);
        bytes memory preimage = abi.encodePacked(_MAGIC, vi, messageUtf8);
        bytes32 first = sha256(preimage);
        return sha256(abi.encodePacked(first));
    }

    function bitcoinSignedDigestNoVarint(bytes memory messageUtf8) internal pure returns (bytes32) {
        bytes memory preimage = abi.encodePacked(_MAGIC, messageUtf8);
        bytes32 first = sha256(preimage);
        return sha256(abi.encodePacked(first));
    }
}
