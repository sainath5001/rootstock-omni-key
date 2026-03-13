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
      <main className="min-h-screen bg-[#0B0F1A] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-md">
          <h1 className="font-semibold text-white text-2xl sm:text-3xl tracking-tight mb-2">
            Omni Counter
          </h1>
          <p className="text-[#8A94A6] text-sm sm:text-base mb-2">
            Use your Bitcoin wallet (Unisat) to increment a counter on Rootstock.
          </p>
          {mounted && (
            <p className="text-[#6B7280] text-xs mb-6">
              This app uses <strong className="text-[#8A94A6]">Unisat only</strong>, not MetaMask. If you see &quot;Failed to connect to MetaMask&quot;, ignore it (from another extension) and click &quot;Connect Unisat&quot;.
            </p>
          )}
          {mounted && !unisatAvailable && (
            <div className="mb-6 rounded-lg border border-[#B36B00]/50 bg-[#B36B00]/10 px-4 py-3 text-sm text-[#F7931A]">
              <strong>Use Unisat only.</strong> Install the Unisat extension. This app does <strong>not</strong> use MetaMask. If you see &quot;Failed to connect to MetaMask&quot;, ignore it—that is from another extension; click &quot;Connect Unisat&quot; below.
            </div>
          )}
          <div className="rounded-xl border border-[#2D3748] bg-[#1B2330] p-6 shadow-lg transition-shadow hover:shadow-[0_8px_32px_rgba(247,147,26,0.08)]">
            <ConnectWallet onConnect={setAddress} connectedAddress={address} unisatAvailable={unisatAvailable} />
            {ownerAddress && (
              <p className="mt-4 mb-4 text-xs text-[#8A94A6] break-all">
                SmartAccount must be deployed with owner: <code className="rounded bg-[#0B0F1A] px-1.5 py-0.5 font-mono text-[11px] text-[#00D1FF]">{ownerAddress}</code>
              </p>
            )}
            <Counter isConnected={!!address} ownerAddress={ownerAddress} />
          </div>
        </div>
      </main>
    </>
  );
}
