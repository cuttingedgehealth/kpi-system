"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Rep = {
  id: string;
  name: string;
};

type Deal = {
  rep_id: string | null;
  payment_date: string | null;
  total_premium: number;
};

function currency(v: number) {
  return `$${Number(v || 0).toFixed(0)}`;
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function format(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shortDayLabel(index: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] ?? "";
}

function buildDays(start: string, end: string) {
  const days: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const final = new Date(`${end}T00:00:00`);

  while (current <= final) {
    days.push(format(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export default function SalesboardPage() {
  const today = new Date();
  const monday = getMonday(today);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(monday));
  const [endDate, setEndDate] = useState(format(friday));

  const days = useMemo(() => buildDays(startDate, endDate), [startDate, endDate]);

  async function load() {
    setLoading(true);

    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("id,name")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("display_order", { ascending: true });

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("rep_id,payment_date,total_premium")
      .eq("office_id", OFFICE_ID);

    if (repError || dealError) {
      console.error("Salesboard load error:", repError || dealError);
    }

    setReps((repData ?? []) as Rep[]);
    setDeals((dealData ?? []) as Deal[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return reps
      .map((rep) => {
        const daily: Record<string, number> = {};
        for (const day of days) daily[day] = 0;

        for (const deal of deals) {
          if (deal.rep_id !== rep.id) continue;
          if (!deal.payment_date) continue;
          if (!days.includes(deal.payment_date)) continue;

          daily[deal.payment_date] += Number(deal.total_premium || 0);
        }

        const total = Object.values(daily).reduce((a, b) => a + b, 0);

        return {
          rep,
          daily,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [reps, deals, days]);

  const boardTotals = useMemo(() => {
    const totalPremium = rows.reduce((sum, row) => sum + row.total, 0);
    const activeReps = rows.filter((row) => row.total > 0).length;
    const leader = rows[0];
    return {
      totalPremium,
      activeReps,
      leaderName: leader?.rep.name ?? "—",
      leaderTotal: leader?.total ?? 0,
    };
  }, [rows]);

  if (loading) {
    return <div className="p-6 text-white">Loading salesboard...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.09),transparent_20%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Weekly Leaderboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Salesboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Paid premium only. Select a date range to view current or previous weeks.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="Week Total" value={currency(boardTotals.totalPremium)} />
            <HeroMetric label="Active Reps" value={String(boardTotals.activeReps)} />
            <HeroMetric label="Leader" value={boardTotals.leaderName} />
            <HeroMetric label="Leader Total" value={currency(boardTotals.leaderTotal)} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Salesboard Period</h2>
            <p className="mt-2 text-sm text-slate-400">
              Pick a previous week or custom range, then click refresh.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <DateField label="Start" value={startDate} onChange={setStartDate} />
            <DateField label="End" value={endDate} onChange={setEndDate} />
            <div className="flex items-end">
              <button
                onClick={load}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Weekly Premium Board</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ranked by total paid premium for the selected date range.
            </p>
          </div>

          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {days[0]} → {days[days.length - 1]}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[16px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-4 font-medium">Rank</th>
                  <th className="px-4 py-4 font-medium">Rep</th>
                  {days.map((day, index) => (
                    <th key={day} className="px-4 py-4 text-right font-medium">
                      {shortDayLabel(index)}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isLeader = index === 0 && row.total > 0;
                  const isSecond = index === 1 && row.total > 0;
                  const isThird = index === 2 && row.total > 0;

                  return (
                    <tr
                      key={row.rep.id}
                      className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                        isLeader ? "bg-emerald-500/[0.05]" : ""
                      }`}
                    >
                      <td className="px-4 py-5">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold ${
                            isLeader
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : isSecond
                              ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                              : isThird
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                              : "border-white/10 bg-white/[0.03] text-slate-300"
                          }`}
                        >
                          {index + 1}
                        </div>
                      </td>

                      <td className="px-4 py-5">
                        <div className="flex flex-col">
                          <div
                            className={`font-semibold text-[17px] ${
                              isLeader ? "text-emerald-300" : "text-white"
                            }`}
                          >
                            {row.rep.name}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {isLeader
                              ? "Current Leader"
                              : isSecond
                              ? "Chasing"
                              : isThird
                              ? "In Range"
                              : "On Board"}
                          </div>
                        </div>
                      </td>

                      {days.map((day) => (
                        <td
                          key={day}
                          className="px-4 py-5 text-right text-[15px] text-slate-100"
                        >
                          {row.daily[day] > 0 ? currency(row.daily[day]) : "—"}
                        </td>
                      ))}

                      <td
                        className={`px-4 py-5 text-right text-[18px] font-semibold ${
                          isLeader ? "text-emerald-300" : "text-white"
                        }`}
                      >
                        {currency(row.total)}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={days.length + 3}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No reps found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
      />
    </label>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}