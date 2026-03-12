import Head from "next/head";
import { useState, useEffect } from "react";
import { ConnectWallet } from "../components/ConnectWallet";
import { Counter } from "../components/Counter";
import { getAddress, getOwnerAddress, isUnisatAvailable } from "../services/omni";

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [unisatAvailable, setUnisatAvailable] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    setUnisatAvailable(isUnisatAvailable());
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !unisatAvailable || typeof window === "undefined") return;
    getAddress()
      .then(setAddress)
      .catch(() => setAddress(null));
  }, [mounted, unisatAvailable]);

  useEffect(() => {
    if (!address) {
      setOwnerAddress(null);
      return;
    }
    getOwnerAddress()
      .then(setOwnerAddress)
      .catch(() => setOwnerAddress(null));
  }, [address]);

  return (
    <>
      <Head>
        <title>Omni Counter – Rootstock Omni-Key</title>
        <meta name="description" content="Bitcoin wallet controls a Rootstock smart contract" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={styles.main}>
        <h1 style={styles.title}>Omni Counter</h1>
        <p style={styles.subtitle}>
          Use your Bitcoin wallet (Unisat) to increment a counter on Rootstock.
        </p>
        {mounted && (
          <p style={styles.metaHint}>
            This app uses <strong>Unisat only</strong>, not MetaMask. If you see &quot;Failed to connect to MetaMask&quot;, ignore it (from another extension) and click &quot;Connect Unisat&quot;.
          </p>
        )}
        {mounted && !unisatAvailable && (
          <div style={styles.warnBox}>
            <strong>Use Unisat only.</strong> Install the Unisat extension. This app does <strong>not</strong> use MetaMask. If you see &quot;Failed to connect to MetaMask&quot;, ignore it—that is from another extension; click &quot;Connect Unisat&quot; below.
          </div>
        )}
        <div style={styles.card}>
          <ConnectWallet onConnect={setAddress} connectedAddress={address} unisatAvailable={unisatAvailable} />
          {ownerAddress && (
            <p style={styles.ownerHint}>
              SmartAccount must be deployed with owner: <code style={styles.code}>{ownerAddress}</code>
            </p>
          )}
          <Counter isConnected={!!address} ownerAddress={ownerAddress} />
        </div>
      </main>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: 40,
    fontFamily: "system-ui, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
  },
  title: { fontSize: 28, marginBottom: 8 },
  subtitle: { color: "#666", fontSize: 14, marginBottom: 8 },
  metaHint: { color: "#888", fontSize: 12, marginBottom: 24 },
  card: {
    padding: 24,
    border: "1px solid #eee",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  ownerHint: { fontSize: 12, color: "#666", marginBottom: 16, wordBreak: "break-all" as const },
  code: { fontFamily: "monospace", fontSize: 11, backgroundColor: "#f0f0f0", padding: "2px 6px", borderRadius: 4 },
  warnBox: {
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff8e6",
    border: "1px solid #e6c200",
    borderRadius: 8,
    fontSize: 14,
    color: "#333",
  },
};
