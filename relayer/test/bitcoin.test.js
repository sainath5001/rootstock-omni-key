const test = require("node:test");
const assert = require("node:assert/strict");

const { encodeBitcoinVarint } = require("../dist/utils/bitcoin");

test("encodeBitcoinVarint encodes single-byte lengths < 253", () => {
  assert.deepEqual([...encodeBitcoinVarint(0)], [0x00]);
  assert.deepEqual([...encodeBitcoinVarint(252)], [0xfc]);
});

test("encodeBitcoinVarint encodes 0xfd (uint16 little-endian) for 253..65535", () => {
  assert.deepEqual([...encodeBitcoinVarint(253)], [0xfd, 0xfd, 0x00]);
  assert.deepEqual([...encodeBitcoinVarint(65535)], [0xfd, 0xff, 0xff]);
});

test("encodeBitcoinVarint encodes 0xfe (uint32 little-endian) for 65536..4294967295", () => {
  assert.deepEqual([...encodeBitcoinVarint(65536)], [0xfe, 0x00, 0x00, 0x01, 0x00]);
  assert.deepEqual([...encodeBitcoinVarint(0xffffffff)], [0xfe, 0xff, 0xff, 0xff, 0xff]);
});

