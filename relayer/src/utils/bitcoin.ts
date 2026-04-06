import * as crypto from "crypto";

export function encodeBitcoinVarint(n: number): Buffer {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("varint length must be a non-negative safe integer");
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) return Buffer.from([0xfd, n & 0xff, (n >> 8) & 0xff]);
  if (n <= 0xffffffff) {
    return Buffer.from([
      0xfe,
      n & 0xff,
      (n >> 8) & 0xff,
      (n >> 16) & 0xff,
      (n >> 24) & 0xff,
    ]);
  }
  throw new Error("varint length too large");
}

/** Bitcoin signed message: prefix + varint(msgLen) + message, double SHA256. */
export function bitcoinMessageHash(messageUtf8: string): Buffer {
  const magic = Buffer.from("\x18Bitcoin Signed Message:\n", "utf8");
  const msgBuf = Buffer.from(messageUtf8, "utf8");
  const lenVarint = encodeBitcoinVarint(msgBuf.length);
  const preimage = Buffer.concat([magic, lenVarint, msgBuf]);
  return crypto.createHash("sha256").update(crypto.createHash("sha256").update(preimage).digest()).digest();
}

/** Variant without varint (kept for compatibility with some wallets). */
export function bitcoinMessageHashNoVarint(messageUtf8: string): Buffer {
  const magic = Buffer.from("\x18Bitcoin Signed Message:\n", "utf8");
  const msgBuf = Buffer.from(messageUtf8, "utf8");
  const preimage = Buffer.concat([magic, msgBuf]);
  return crypto.createHash("sha256").update(crypto.createHash("sha256").update(preimage).digest()).digest();
}

