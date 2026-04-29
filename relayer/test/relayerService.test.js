const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

process.env.ROOTSTOCK_RPC_URL = process.env.ROOTSTOCK_RPC_URL || "https://public-node.testnet.rsk.co";
process.env.RELAYER_PRIVATE_KEY =
  process.env.RELAYER_PRIVATE_KEY || "11".repeat(32);

const {
  normalizeSignature,
  decodeUnisatSignature,
  recoverAddressFromBitcoinSig,
  bitcoinSig65Hex,
} = require("../dist/services/relayerService");
const { bitcoinMessageHash } = require("../dist/utils/bitcoin");

test("normalizeSignature converts high-S to low-S", () => {
  const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const highSBig = N - 1n;
  const highSHex = highSBig.toString(16).padStart(64, "0");
  const r = "11".repeat(32);
  const sigHex = "0x" + r + highSHex + "1b";
  const normalized = normalizeSignature(sigHex);
  assert.ok(/^0x[0-9a-f]{130}$/i.test(normalized));
  assert.notEqual(normalized.toLowerCase(), sigHex.toLowerCase());
});

test("decodeUnisatSignature parses 65-byte base64 signature", () => {
  const raw = Buffer.concat([
    Buffer.from([1]),
    Buffer.from("11".repeat(32), "hex"),
    Buffer.from("22".repeat(32), "hex"),
  ]);
  const decoded = decodeUnisatSignature(raw.toString("base64"));
  assert.equal(decoded.recoveryId, 1);
  assert.equal(decoded.r, "0x" + "11".repeat(32));
  assert.equal(decoded.s, "0x" + "22".repeat(32));
});

test("recoverAddressFromBitcoinSig accepts valid Unisat-style signature", () => {
  const wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945382d7e5547b8d4f6c9b8b6f5ce4f0b6f9e1");
  const message = "0x" + "12".repeat(32);
  const msgHashHex = "0x" + bitcoinMessageHash(message).toString("hex");
  const sig = wallet.signingKey.sign(msgHashHex);
  const sigBytes = Buffer.concat([
    Buffer.from([sig.yParity ?? 0]),
    Buffer.from(sig.r.slice(2), "hex"),
    Buffer.from(sig.s.slice(2), "hex"),
  ]);
  const sigBase64 = sigBytes.toString("base64");
  assert.doesNotThrow(() => recoverAddressFromBitcoinSig(message, sigBase64, wallet.address));
});

test("bitcoinSig65Hex returns hex input as-is and converts base64", () => {
  const hex65 = "0x" + "11".repeat(65);
  assert.equal(bitcoinSig65Hex(hex65, hex65), hex65);

  const raw = Buffer.from("22".repeat(65), "hex");
  const b64 = raw.toString("base64");
  assert.equal(bitcoinSig65Hex("0x00", b64), "0x" + "22".repeat(65));
});
