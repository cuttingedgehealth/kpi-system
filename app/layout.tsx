import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            </nav>
          </div>

          <div className="flex-1 p-6">{children}</div>
        </div>
      </body>
    </html>
  );
}