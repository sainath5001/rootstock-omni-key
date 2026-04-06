const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPayloadHash } = require("../dist");

test("buildPayloadHash is stable and includes chainId", () => {
  const smartAccount = "0x1111111111111111111111111111111111111111";
  const target = "0x2222222222222222222222222222222222222222";
  const data = "0x1234";
  const messageHex = "0x" + Buffer.from("hello", "utf8").toString("hex");

  const h31 = buildPayloadHash(smartAccount, 31n, 0n, target, data, messageHex);
  const h30 = buildPayloadHash(smartAccount, 30n, 0n, target, data, messageHex);

  assert.ok(/^0x[0-9a-f]{64}$/i.test(h31));
  assert.ok(/^0x[0-9a-f]{64}$/i.test(h30));
  assert.notEqual(h31, h30);
});

test("buildPayloadHash accepts big nonces without Number coercion", () => {
  const smartAccount = "0x1111111111111111111111111111111111111111";
  const target = "0x2222222222222222222222222222222222222222";
  const data = "0x";
  const messageHex = "0x";
  const chainId = 31n;
  const bigNonce = 2n ** 70n;

  const h = buildPayloadHash(smartAccount, chainId, bigNonce, target, data, messageHex);
  assert.ok(/^0x[0-9a-f]{64}$/i.test(h));
});

