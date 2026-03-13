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
      <p className="text-sm text-[#8A94A6]">Connect your Unisat wallet to see the counter.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-[#0B0F1A]/80 px-6 py-8 text-center">
        <span className="block text-xs font-medium uppercase tracking-wider text-[#8A94A6] mb-2">Counter</span>
        <span className="text-4xl font-semibold text-white tabular-nums">{value !== null ? value : "—"}</span>
      </div>
      <button
        onClick={handleIncrement}
        disabled={loading}
        className="w-full rounded-lg bg-[#F7931A] px-5 py-3 font-medium text-[#0B0F1A] transition-all duration-200 hover:bg-[#FF9F2E] hover:shadow-md hover:shadow-[#F7931A]/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {loading ? "Signing & sending…" : "Increment Counter"}
      </button>
      {txHash && (
        <p className="text-sm text-[#8A94A6]">
          Tx:{" "}
          <a
            href={`https://explorer.testnet.rootstock.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00D1FF] hover:text-[#33DAFF] underline"
          >
            {txHash.slice(0, 10)}…
          </a>
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
