"use client";

import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "kpi_system_authenticated";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);

  const correctPassword = "CuttingEdge123!";

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true") {
      setAuthenticated(true);
    }
    setReady(true);
  }, []);

  function handleLogin() {
    if (password === correctPassword) {
      setAuthenticated(true);
      window.localStorage.setItem(STORAGE_KEY, "true");
    } else {
      alert("Wrong password");
    }
  }

  function handleLogout() {
    setAuthenticated(false);
    setPassword("");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (!ready) {
    return (
      <html lang="en">
        <body className="bg-slate-900 text-white" />
      </html>
    );
  }

  if (!authenticated) {
    return (
      <html lang="en">
        <body className="bg-slate-900 text-white flex items-center justify-center min-h-screen">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 p-6 shadow-2xl">
            <h1 className="mb-4 text-xl font-bold text-center">Enter Password</h1>
            <input
              type="password"
              className="mb-3 w-full rounded bg-slate-800 p-2 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
            <button
              className="w-full rounded bg-blue-600 py-2 hover:bg-blue-500"
              onClick={handleLogin}
            >
              Enter
            </button>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-slate-900 text-white">
        <div className="flex min-h-screen">
          <div className="w-64 bg-slate-950 p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold">KPI System</h1>
              <button
                onClick={handleLogout}
                className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
              >
                Logout
              </button>
            </div>

            <nav className="flex flex-col gap-3 text-slate-300">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/daily-sheet">Daily Sheet</Link>
              <Link href="/payroll">Payroll</Link>
              <Link href="/sources">Settings</Link>
              <Link href="/salesboard">Salesboard</Link>
            </nav>
          </div>

          <div className="flex-1 p-6">{children}</div>
        </div>
      </body>
    </html>
  );
}