"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Source = {
  id: string;
  name: string;
  type: "inbound" | "data";
  active: boolean;
};

type Deal = {
  id: string;
  deal_date: string;
  payment_date: string | null;
  phone_number: string | null;
  source_id: string | null;
  total_premium: number;
  status: string | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function csvEscape(value: string | number) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState(todayString());
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: sourceData, error: sourceError } = await supabase
      .from("sources")
      .select("id,name,type,active")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("name", { ascending: true });

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("id,deal_date,payment_date,phone_number,source_id,total_premium,status")
      .eq("office_id", OFFICE_ID);

    if (sourceError) setErrorText(`Source load error: ${sourceError.message}`);
    if (dealError) setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);

    const sourceList = (sourceData ?? []) as Source[];

    setSources(sourceList);
    setDeals((dealData ?? []) as Deal[]);
    setSelectedSourceIds(sourceList.map((source) => source.id));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSource(sourceId: string) {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  }

  function selectAllSources() {
    setSelectedSourceIds(sources.map((source) => source.id));
  }

  function clearSources() {
    setSelectedSourceIds([]);
  }

  function getSourceName(sourceId: string | null) {
    if (!sourceId) return "—";
    return sources.find((source) => source.id === sourceId)?.name ?? "—";
  }

  function isPostDate(deal: Deal) {
    if (!deal.payment_date) return "Yes";
    return deal.payment_date !== deal.deal_date ? "Yes" : "No";
  }

  const filteredDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        const sourceMatch =
          selectedSourceIds.length > 0 &&
          deal.source_id !== null &&
          selectedSourceIds.includes(deal.source_id);

        const dateMatch =
          deal.deal_date >= startDate && deal.deal_date <= endDate;

        const activeMatch = (deal.status ?? "active") !== "cancelled";

        return sourceMatch && dateMatch && activeMatch;
      })
      .sort((a, b) => a.deal_date.localeCompare(b.deal_date));
  }, [deals, selectedSourceIds, startDate, endDate]);

  const totalPremium = useMemo(() => {
    return filteredDeals.reduce(
      (sum, deal) => sum + Number(deal.total_premium || 0),
      0
    );
  }, [filteredDeals]);

  function downloadCsv() {
    const header = ["Phone Number", "Sold Date", "Premium", "Post Date"];

    const rows = filteredDeals.map((deal) => [
      deal.phone_number || "",
      deal.deal_date,
      Number(deal.total_premium || 0).toFixed(2),
      isPostDate(deal),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `lead-source-report-${startDate}-to-${endDate}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="p-6 text-white">Loading reports...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Vendor Reporting
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Reports
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Pull deal reports by lead source and date range. Export includes phone number,
            sold date, premium, and post-date status only.
          </p>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Start Date
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field-input"
            />
          </label>

          <label>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              End Date
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field-input"
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={downloadCsv}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Lead Sources</h2>
              <p className="mt-1 text-sm text-slate-400">
                Select one or multiple sources to combine the report.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={selectAllSources}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
              >
                Select All
              </button>
              <button
                onClick={clearSources}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => (
              <label
                key={source.id}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[15px] text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={() => toggleSource(source.id)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-white">{source.name}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {source.type}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <KpiTile label="Deals" value={String(filteredDeals.length)} />
          <KpiTile label="Premium" value={currency(totalPremium)} />
          <KpiTile label="Sources Selected" value={String(selectedSourceIds.length)} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[16px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-4 font-medium">Phone Number</th>
                  <th className="px-4 py-4 font-medium">Sold Date</th>
                  <th className="px-4 py-4 font-medium">Source</th>
                  <th className="px-4 py-4 text-right font-medium">Premium</th>
                  <th className="px-4 py-4 font-medium">Post Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-5 font-medium text-white">
                      {deal.phone_number || "—"}
                    </td>
                    <td className="px-4 py-5 text-slate-100">{deal.deal_date}</td>
                    <td className="px-4 py-5 text-slate-100">
                      {getSourceName(deal.source_id)}
                    </td>
                    <td className="px-4 py-5 text-right font-medium text-white">
                      {currency(Number(deal.total_premium || 0))}
                    </td>
                    <td className="px-4 py-5 text-slate-100">{isPostDate(deal)}</td>
                  </tr>
                ))}

                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No deals found for the selected sources and date range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .field-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgb(15 23 42);
          padding: 0.85rem 1rem;
          font-size: 15px;
          color: white;
          outline: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .field-input:focus {
          border-color: rgba(148, 163, 184, 0.9);
        }
      `}</style>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}