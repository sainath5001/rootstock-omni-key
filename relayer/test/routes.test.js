const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

process.env.ROOTSTOCK_RPC_URL = process.env.ROOTSTOCK_RPC_URL || "https://public-node.testnet.rsk.co";
process.env.RELAYER_PRIVATE_KEY =
  process.env.RELAYER_PRIVATE_KEY || "11".repeat(32);

const relayerService = require("../dist/services/relayerService");
const txRouter = require("../dist/routes/tx").default;

function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/", txRouter);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test("POST /relay returns txHash with mocked relay service", async () => {
  const originalRelay = relayerService.relayTransaction;
  relayerService.relayTransaction = async () => ({ txHash: "0xfeed" });
  const server = await startServer();
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/relay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "0x1234",
        signature: "0x" + "11".repeat(65),
        nonce: 0,
        chainId: 31,
        smartAccount: "0x1111111111111111111111111111111111111111",
        target: "0x2222222222222222222222222222222222222222",
        data: "0x",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.txHash, "0xfeed");
  } finally {
    server.close();
    relayerService.relayTransaction = originalRelay;
  }
});
