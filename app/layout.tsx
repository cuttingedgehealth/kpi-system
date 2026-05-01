"use client";

import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "kpi_system_authenticated";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily-sheet", label: "Daily Sheet" },
  { href: "/payroll", label: "Payroll" },
  { href: "/salesboard", label: "Salesboard" },
  { href: "/sources", label: "Settings" },
  { href: "/reports", label: "Reports" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
      return;
    }

    alert("Wrong password");
  }

  function handleLogout() {
    setAuthenticated(false);
    setPassword("");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (!ready) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-[#0a0d12]" />
      </html>
    );
  }

  if (!authenticated) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-[#0a0d12] text-white">
          <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                  Cutting Edge Health Advisors
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">KPI System</h1>
                <p className="mt-2 text-sm text-slate-400">
                  Enter the internal access password to continue.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-black/40"
                  placeholder="Password"
                />

                <button
                  onClick={handleLogin}
                  className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
                >
                  Enter
                </button>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0d12] text-white">
        <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-white/10 bg-[#0d1117] lg:min-h-screen lg:border-b-0 lg:border-r">
            <div className="flex h-full flex-col p-5">
              <div className="mb-8 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-slate-500">
                    Internal
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight">KPI System</h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Performance, payroll, and production.
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                >
                  Logout
                </button>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-white text-slate-950 shadow-lg"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          active ? "bg-slate-950" : "bg-slate-700"
                        }`}
                      />
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                  Focus
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Buy smarter. Track paid conversions. Keep payroll tied to cash.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-w-0 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px]">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}