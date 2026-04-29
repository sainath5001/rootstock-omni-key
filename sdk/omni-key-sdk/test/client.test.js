const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

const { OmniKeyClient, getOwnerAddress, relayTransaction } = require("../dist");

test("relayTransaction rejects non-http(s) relayer URL", async () => {
  await assert.rejects(
    relayTransaction("javascript:alert(1)", {
      message: "0x12",
      signature: "0x" + "11".repeat(65),
      nonce: "0",
      chainId: "31",
      smartAccount: "0x1111111111111111111111111111111111111111",
      target: "0x2222222222222222222222222222222222222222",
      data: "0x",
    }),
    /relayerUrl must use http: or https:/
  );
});

test("getOwnerAddress derives Ethereum address from Unisat pubkey", async () => {
  const prevWindow = global.window;
  const signer = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945382d7e5547b8d4f6c9b8b6f5ce4f0b6f9e1");
  const pubKey = signer.signingKey.compressedPublicKey;
  global.window = {
    unisat: {
      getPublicKey: async () => pubKey,
      requestAccounts: async () => ["bc1ptest"],
      getAccounts: async () => ["bc1ptest"],
      signMessage: async () => "sig",
    },
  };
  try {
    const owner = await getOwnerAddress();
    assert.equal(owner.toLowerCase(), signer.address.toLowerCase());
  } finally {
    global.window = prevWindow;
  }
});

test("OmniKeyClient.signAndRelay signs and posts relay payload", async () => {
  const prevWindow = global.window;
  const prevFetch = global.fetch;
  const fetchCalls = [];
  global.window = {
    unisat: {
      requestAccounts: async () => ["bc1ptest"],
      getAccounts: async () => ["bc1ptest"],
      signMessage: async () => "base64sig",
    },
  };
  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ txHash: "0xabc123" }),
    };
  };

  try {
    const client = new OmniKeyClient({
      relayerUrl: "http://localhost:3001",
      smartAccountAddress: "0x1111111111111111111111111111111111111111",
      relayerApiKey: "k_test",
    });
    const txHash = await client.signAndRelay({
      message: "increment counter",
      chainId: 31,
      nonce: 7n,
      target: "0x2222222222222222222222222222222222222222",
      data: "0x1234",
    });
    assert.equal(txHash, "0xabc123");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://localhost:3001/relay");
    assert.equal(fetchCalls[0].init.method, "POST");
    assert.equal(fetchCalls[0].init.headers["X-Relayer-API-Key"], "k_test");
    const body = JSON.parse(fetchCalls[0].init.body);
    assert.equal(body.chainId, "31");
    assert.equal(body.nonce, "7");
    assert.equal(body.signature, "base64sig");
  } finally {
    global.window = prevWindow;
    global.fetch = prevFetch;
  }
});
