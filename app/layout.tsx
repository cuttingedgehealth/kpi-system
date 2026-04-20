"use client";

import "./globals.css";
import Link from "next/link";
import { useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const correctPassword = "CuttingEdge123!"; 

  if (!authenticated) {
    return (
      <html lang="en">
        <body className="bg-slate-900 text-white flex items-center justify-center h-screen">
          <div className="bg-slate-800 p-6 rounded-xl w-80 text-center">
            <h1 className="text-xl mb-4">Enter Password</h1>
            <input
              type="password"
              className="w-full p-2 rounded bg-slate-700 mb-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 py-2 rounded"
              onClick={() => {
                if (password === correctPassword) {
                  setAuthenticated(true);
                } else {
                  alert("Wrong password");
                }
              }}
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
            <h1 className="text-xl font-bold">KPI System</h1>

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