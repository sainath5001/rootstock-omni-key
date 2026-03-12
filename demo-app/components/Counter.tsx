import React, { useState, useEffect, useCallback } from "react";
import { getCounterValue, incrementCounter } from "../services/omni";

interface CounterProps {
  isConnected: boolean;
  ownerAddress?: string | null;
}

export function Counter({ isConnected, ownerAddress }: CounterProps) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounter = useCallback(async () => {
    try {
      const v = await getCounterValue();
      setValue(Number(v));
    } catch {
      setValue(null);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    fetchCounter();
    const interval = setInterval(fetchCounter, 5000);
    return () => clearInterval(interval);
  }, [isConnected, fetchCounter]);

  const handleIncrement = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const hash = await incrementCounter();
      setTxHash(hash);
      await fetchCounter();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Failed to fetch" || msg.includes("fetch")) {
        setError("Cannot reach the relayer. Is it running? Start it with: cd relayer && npm run dev (default: http://localhost:3001)");
      } else if (msg.includes("Invalid signature") && ownerAddress) {
        setError(`SmartAccount owner mismatch. Redeploy with SMART_ACCOUNT_OWNER=${ownerAddress} (see owner above).`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <p style={styles.hint}>Connect your Unisat wallet to see the counter.</p>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.counterBox}>
        <span style={styles.label}>Counter</span>
        <span style={styles.value}>{value !== null ? value : "—"}</span>
      </div>
      <button
        onClick={handleIncrement}
        disabled={loading}
        style={styles.button}
      >
        {loading ? "Signing & sending…" : "Increment Counter"}
      </button>
      {txHash && (
        <p style={styles.tx}>
          Tx: <a href={`https://explorer.testnet.rootstock.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={styles.link}>{txHash.slice(0, 10)}…</a>
        </p>
      )}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: 16 },
  hint: { color: "#666", fontSize: 14 },
  counterBox: {
    padding: 24,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    textAlign: "center",
  },
  label: { display: "block", fontSize: 12, color: "#666", marginBottom: 4 },
  value: { fontSize: 32, fontWeight: 600 },
  button: {
    padding: "12px 24px",
    fontSize: 16,
    cursor: "pointer",
    backgroundColor: "#000",
    color: "#fff",
    border: "none",
    borderRadius: 8,
  },
  tx: { fontSize: 13, color: "#666" },
  link: { color: "#0066cc" },
  error: { color: "#c00", fontSize: 14 },
};
