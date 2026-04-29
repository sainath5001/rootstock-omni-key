import React, { useState, useEffect, useCallback } from "react";
import { getCounterValue, incrementCounter, getExplorerTxUrl } from "../services/omni";

interface CounterProps {
  isConnected: boolean;
  ownerAddress?: string | null;
}

export function Counter({ isConnected, ownerAddress }: CounterProps) {
  const [value, setValue] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "signing" | "submitting" | "confirmed">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounter = useCallback(async () => {
    try {
      const v = await getCounterValue();
      setValue(v.toString());
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
    setPhase("signing");
    setError(null);
    setTxHash(null);
    try {
      const hash = await incrementCounter(() => setPhase("submitting"));
      setTxHash(hash);
      setPhase("confirmed");
      await fetchCounter();
      // Keep "confirmed" visible briefly before resetting.
      setTimeout(() => setPhase("idle"), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Failed to fetch" || msg.includes("fetch")) {
        setError("Cannot reach the relayer. Is it running? Start it with: cd relayer && npm run dev (default: http://localhost:3001)");
      } else if (msg.includes("Invalid signature") && ownerAddress) {
        setError(`SmartAccount owner mismatch. Redeploy with SMART_ACCOUNT_OWNER=${ownerAddress} (see owner above).`);
      } else {
        setError(msg);
      }
      setPhase("idle");
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
        type="button"
        onClick={handleIncrement}
        disabled={phase === "signing" || phase === "submitting"}
        className="w-full rounded-lg bg-[#F7931A] px-5 py-3 font-medium text-[#0B0F1A] transition-all duration-200 hover:bg-[#FF9F2E] hover:shadow-md hover:shadow-[#F7931A]/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {phase === "signing"
          ? "Awaiting signature…"
          : phase === "submitting"
            ? "Submitting transaction…"
            : phase === "confirmed"
              ? "Confirmed"
              : "Increment Counter"}
      </button>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {phase === "signing"
          ? "Awaiting wallet signature."
          : phase === "submitting"
            ? "Submitting transaction."
            : phase === "confirmed"
              ? "Transaction confirmed."
              : ""}
      </div>
      {txHash && (
        <p className="text-sm text-[#8A94A6]">
          Tx:{" "}
          <a
            href={getExplorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00D1FF] hover:text-[#33DAFF] underline"
            aria-label={`View transaction ${txHash} on Rootstock explorer`}
          >
            {txHash.slice(0, 8)}…{txHash.slice(-6)}
          </a>
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
