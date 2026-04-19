"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Rep = {
  id: string;
  name: string;
};

type Deal = {
  id: string;
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

export default function SalesboardPage() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const monday = getMonday(today);

  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return format(d);
  });

  async function load() {
    setLoading(true);

    const { data: repData } = await supabase
      .from("reps")
      .select("id,name")
      .eq("office_id", OFFICE_ID)
      .eq("active", true);

    const { data: dealData } = await supabase
      .from("deals")
      .select("rep_id,payment_date,total_premium")
      .eq("office_id", OFFICE_ID);

    setReps(repData || []);
    setDeals(dealData || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return reps.map((rep) => {
      const daily: Record<string, number> = {};

      for (const day of days) {
        daily[day] = 0;
      }

      for (const deal of deals) {
        if (deal.rep_id !== rep.id) continue;
        if (!deal.payment_date) continue;

        if (days.includes(deal.payment_date)) {
          daily[deal.payment_date] += Number(deal.total_premium || 0);
        }
      }

      const total = Object.values(daily).reduce((a, b) => a + b, 0);

      return {
        rep,
        daily,
        total,
      };
    });
  }, [reps, deals, days]);

  if (loading) {
    return <div className="p-6 text-white">Loading salesboard...</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-xl bg-slate-950 p-6">
        <h1 className="text-3xl font-bold">Salesboard</h1>
        <p className="mt-2 text-slate-400">
          Weekly premium (paid deals only) — Monday through Friday
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-slate-950 p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="py-2">Rep</th>
              <th>Mon</th>
              <th>Tue</th>
              <th>Wed</th>
              <th>Thu</th>
              <th>Fri</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rep.id} className="border-b border-slate-900">
                <td className="py-2 font-medium">{row.rep.name}</td>

                {days.map((day) => (
                  <td key={day}>
                    {row.daily[day] > 0 ? currency(row.daily[day]) : "—"}
                  </td>
                ))}

                <td className="text-right font-semibold">
                  {currency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}