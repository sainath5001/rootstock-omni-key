import React, { useState } from "react";
import { connectWallet } from "../services/omni";

interface ConnectWalletProps {
  onConnect?: (address: string) => void;
  connectedAddress?: string | null;
  unisatAvailable?: boolean;
}

export function ConnectWallet({ onConnect, connectedAddress, unisatAvailable = true }: ConnectWalletProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!unisatAvailable) {
      setError("Unisat extension not found. Install Unisat (this app does not use MetaMask).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const addr = await connectWallet();
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

  const displayAddress = connectedAddress;
  if (displayAddress) {
    return (
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-[#8A94A6]">Connected</span>
        <span className="font-mono text-sm text-white" title={displayAddress}>
          {displayAddress.slice(0, 8)}…{displayAddress.slice(-6)}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <button
        onClick={handleConnect}
        disabled={loading || !unisatAvailable}
        aria-busy={loading}
        className="w-full rounded-lg bg-[#F7931A] px-5 py-3 font-medium text-[#0B0F1A] transition-all duration-200 hover:bg-[#FF9F2E] hover:shadow-md hover:shadow-[#F7931A]/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
      >
        {loading ? "Connecting…" : unisatAvailable ? "Connect Unisat" : "Unisat not installed"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
