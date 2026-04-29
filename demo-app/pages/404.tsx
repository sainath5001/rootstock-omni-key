import Head from "next/head";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page not found – Omni Counter</title>
      </Head>
      <main className="min-h-screen bg-[#0B0F1A] px-4 py-16 text-center text-[#8A94A6]">
        <h1 className="text-2xl font-semibold text-white mb-2">404</h1>
        <p className="mb-6">This page does not exist.</p>
        <Link href="/" className="text-[#00D1FF] underline">
          Back to Omni Counter
        </Link>
      </main>
    </>
  );
}
