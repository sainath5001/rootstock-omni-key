import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type BoundaryState = { hasError: boolean; message: string };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: Error): BoundaryState {
    return { hasError: true, message: err.message || "Something went wrong." };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[app]", err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#0B0F1A] px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Something broke</h1>
          <p className="text-sm text-red-400 max-w-md mx-auto" role="alert">
            {this.state.message}
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppErrorBoundary>
      <div className={inter.className}>
        <Component {...pageProps} />
      </div>
    </AppErrorBoundary>
  );
}
