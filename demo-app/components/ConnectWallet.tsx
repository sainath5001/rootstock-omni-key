import React, { useState, useEffect } from "react";
import { connectWallet, getAddress } from "../services/omni";

interface ConnectWalletProps {
  onConnect?: (address: string) => void;
  connectedAddress?: string | null;
  unisatAvailable?: boolean;
}

export function ConnectWallet({ onConnect, connectedAddress, unisatAvailable = true }: ConnectWalletProps) {
  const [address, setAddress] = useState<string | null>(connectedAddress ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddress(connectedAddress ?? null);
  }, [connectedAddress]);

  useEffect(() => {
    if (connectedAddress !== undefined || !unisatAvailable) return;
    getAddress()
      .then((addr) => {
        setAddress(addr);
        if (addr) onConnect?.(addr);
      })
      .catch(() => setAddress(null));
  }, [onConnect, connectedAddress, unisatAvailable]);

  const handleConnect = async () => {
    if (!unisatAvailable) {
      setError("Unisat extension not found. Install Unisat (this app does not use MetaMask).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      onConnect?.(addr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("MetaMask") || msg.includes("ethereum")) {
        setError("This app uses Unisat only. Dismiss any MetaMask popup and use the Unisat extension.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const displayAddress = address ?? connectedAddress;
  if (displayAddress) {
    return (
      <div style={styles.connected}>
        <span style={styles.label}>Connected</span>
        <span style={styles.address} title={displayAddress}>
          {displayAddress.slice(0, 8)}…{displayAddress.slice(-6)}
        </span>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <button onClick={handleConnect} disabled={loading || !unisatAvailable} style={styles.button}>
        {loading ? "Connecting…" : unisatAvailable ? "Connect Unisat" : "Unisat not installed"}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { marginBottom: 16 },
  button: {
    padding: "10px 20px",
    fontSize: 16,
    cursor: "pointer",
    backgroundColor: "#f0f0f0",
    border: "1px solid #ccc",
    borderRadius: 8,
  },
  connected: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 16,
  },
  label: { fontSize: 12, color: "#666" },
  address: { fontFamily: "monospace", fontSize: 14 },
  error: { color: "#c00", fontSize: 14, marginTop: 8 },
};
