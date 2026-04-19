"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Source = {
  id: string;
  name: string;
  type: "inbound" | "data";
  base_cpl: number;
  active: boolean;
  display_order: number;
};

type Metric = {
  id: string;
  office_id: string;
  metric_date: string;
  source_id: string;
  quantity: number;
  cpl_override: number | null;
  spend_override: number | null;
};

type Deal = {
  id: string;
  deal_date: string;
  source_id: string | null;
  plan_id: string | null;
  limited_premium: number;
  addon_premium: number;
  total_premium: number;
  aca_sold: boolean;
};

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

function percent(value: number) {
  return `${value.toFixed(2)}%`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDateForInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inDateRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

export default function DashboardPage() {
  const today = new Date();

  const [sources, setSources] = useState<Source[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [customStart, setCustomStart] = useState(
    formatDateForInput(startOfWeek(today))
  );
  const [customEnd, setCustomEnd] = useState(
    formatDateForInput(endOfWeek(today))
  );

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: sourceData, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("display_order", { ascending: true });

    if (sourceError) {
      setErrorText(`Source load error: ${sourceError.message}`);
      setLoading(false);
      return;
    }

    const { data: metricData, error: metricError } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("office_id", OFFICE_ID);

    if (metricError) {
      setErrorText(`Metric load error: ${metricError.message}`);
      setLoading(false);
      return;
    }

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("office_id", OFFICE_ID);

    if (dealError) {
      setErrorText(`Deal load error: ${dealError.message}`);
      setLoading(false);
      return;
    }

    setSources((sourceData ?? []) as Source[]);
    setMetrics((metricData ?? []) as Metric[]);
    setDeals((dealData ?? []) as Deal[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const weekRange = useMemo(() => {
    return {
      start: formatDateForInput(startOfWeek(today)),
      end: formatDateForInput(endOfWeek(today)),
    };
  }, []);

  const monthRange = useMemo(() => {
    return {
      start: formatDateForInput(startOfMonth(today)),
      end: formatDateForInput(endOfMonth(today)),
    };
  }, []);

  const yearRange = useMemo(() => {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }, []);

  function computeRangeStats(start: string, end: string) {
    const filteredMetrics = metrics.filter((m) =>
      inDateRange(m.metric_date, start, end)
    );
    const filteredDeals = deals.filter((d) =>
      inDateRange(d.deal_date, start, end)
    );

    let totalSpend = 0;
    let totalLeads = 0;
    let inboundLeads = 0;
    let dataLeads = 0;

    for (const metric of filteredMetrics) {
      const source = sources.find((s) => s.id === metric.source_id);
      if (!source) continue;

      const effectiveCpl = metric.cpl_override ?? source.base_cpl;
      const effectiveSpend =
        metric.spend_override ?? Number(metric.quantity || 0) * Number(effectiveCpl || 0);

      totalSpend += Number(effectiveSpend || 0);
      totalLeads += Number(metric.quantity || 0);

      if (source.type === "inbound") inboundLeads += Number(metric.quantity || 0);
      if (source.type === "data") dataLeads += Number(metric.quantity || 0);
    }

    const totalSales = filteredDeals.length;
    const totalPremium = filteredDeals.reduce(
      (sum, deal) => sum + Number(deal.total_premium || 0),
      0
    );
    const acaWrappedDeals = filteredDeals.filter((d) => d.aca_sold).length;

    const cac = totalSales > 0 ? totalSpend / totalSales : 0;
    const conversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
    const ps = totalSpend > 0 ? totalPremium / totalSpend : 0;
    const avgPremium = totalSales > 0 ? totalPremium / totalSales : 0;
    const acaWrappedPct = totalSales > 0 ? (acaWrappedDeals / totalSales) * 100 : 0;

    return {
      totalSpend,
      totalLeads,
      inboundLeads,
      dataLeads,
      totalSales,
      totalPremium,
      cac,
      conversion,
      ps,
      avgPremium,
      acaWrappedPct,
    };
  }

  const weekStats = useMemo(
    () => computeRangeStats(weekRange.start, weekRange.end),
    [metrics, deals, sources]
  );

  const monthStats = useMemo(
    () => computeRangeStats(monthRange.start, monthRange.end),
    [metrics, deals, sources]
  );

  const yearStats = useMemo(
    () => computeRangeStats(yearRange.start, yearRange.end),
    [metrics, deals, sources]
  );

  const customStats = useMemo(
    () => computeRangeStats(customStart, customEnd),
    [metrics, deals, sources, customStart, customEnd]
  );

  const sourceRankings = useMemo(() => {
    return sources
      .map((source) => {
        const sourceMetrics = metrics.filter(
          (m) =>
            m.source_id === source.id &&
            inDateRange(m.metric_date, customStart, customEnd)
        );

        const sourceDeals = deals.filter(
          (d) =>
            d.source_id === source.id &&
            inDateRange(d.deal_date, customStart, customEnd)
        );

        let spend = 0;
        let leads = 0;

        for (const metric of sourceMetrics) {
          const effectiveCpl = metric.cpl_override ?? source.base_cpl;
          const effectiveSpend =
            metric.spend_override ?? Number(metric.quantity || 0) * Number(effectiveCpl || 0);

          spend += Number(effectiveSpend || 0);
          leads += Number(metric.quantity || 0);
        }

        const sales = sourceDeals.length;
        const premium = sourceDeals.reduce(
          (sum, deal) => sum + Number(deal.total_premium || 0),
          0
        );

        const cac = sales > 0 ? spend / sales : 0;
        const ps = spend > 0 ? premium / spend : 0;
        const conversion = leads > 0 ? (sales / leads) * 100 : 0;
        const acaWrappedDeals = sourceDeals.filter((d) => d.aca_sold).length;
        const acaWrappedPct = sales > 0 ? (acaWrappedDeals / sales) * 100 : 0;

        return {
          source,
          spend,
          leads,
          sales,
          premium,
          cac,
          ps,
          conversion,
          acaWrappedPct,
        };
      })
      .sort((a, b) => b.ps - a.ps);
  }, [sources, metrics, deals, customStart, customEnd]);

  if (loading) {
    return <div className="p-6 text-white">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-2xl bg-slate-950 p-6">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Weekly rollups, source rankings, and office economics at a glance.
        </p>
      </div>

      {errorText ? (
        <div className="rounded bg-red-900/40 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <RangeCard title="Current Week" stats={weekStats} />
        <RangeCard title="Month to Date" stats={monthStats} />
        <RangeCard title="Year to Date" stats={yearStats} />
      </div>

      <div className="rounded-2xl bg-slate-950 p-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Custom Range</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use this range for source rankings and summary tiles below.
            </p>
          </div>

          <div className="flex gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Start</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded bg-slate-800 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">End</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded bg-slate-800 px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniTile label="Spend" value={currency(customStats.totalSpend)} />
          <MiniTile label="Sales" value={String(customStats.totalSales)} />
          <MiniTile label="Premium" value={currency(customStats.totalPremium)} />
          <MiniTile label="Leads" value={String(customStats.totalLeads)} />
          <MiniTile label="CAC" value={currency(customStats.cac)} />
          <MiniTile label="Conversion" value={percent(customStats.conversion)} />
          <MiniTile label="P/S Ratio" value={`${customStats.ps.toFixed(2)}x`} />
          <MiniTile label="ACA Wrapped %" value={percent(customStats.acaWrappedPct)} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <MiniStatCard title="Inbound Leads" value={String(customStats.inboundLeads)} />
        <MiniStatCard title="Data Leads" value={String(customStats.dataLeads)} />
        <MiniStatCard title="Avg Premium" value={currency(customStats.avgPremium)} />
        <MiniStatCard title="Total Spend" value={currency(customStats.totalSpend)} />
        <MiniStatCard title="P/S Ratio" value={`${customStats.ps.toFixed(2)}x`} />
      </div>

      <div className="rounded-2xl bg-slate-950 p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Source Rankings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Ranked by P/S ratio for the selected custom range.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="py-2">Source</th>
                <th>Type</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Spend</th>
                <th className="text-right">Sales</th>
                <th className="text-right">CAC</th>
                <th className="text-right">Premium</th>
                <th className="text-right">P/S</th>
                <th className="text-right">Conversion</th>
                <th className="text-right">ACA Wrapped %</th>
              </tr>
            </thead>
            <tbody>
              {sourceRankings.map((row) => {
                const psClass =
                  row.ps >= 1.5
                    ? "text-green-400"
                    : row.ps > 0 && row.ps < 1
                    ? "text-red-400"
                    : "text-white";

                const cacClass =
                  row.sales > 0 && row.cac > 499.99 ? "text-red-400 font-semibold" : "";

                return (
                  <tr key={row.source.id} className="border-b border-slate-900">
                    <td className="py-2">{row.source.name}</td>
                    <td className="capitalize">{row.source.type}</td>
                    <td className="text-right">{row.leads}</td>
                    <td className="text-right">{currency(row.spend)}</td>
                    <td className="text-right">{row.sales}</td>
                    <td className={`text-right ${cacClass}`}>
                      {row.sales > 0 ? currency(row.cac) : "—"}
                    </td>
                    <td className="text-right">{currency(row.premium)}</td>
                    <td className={`text-right font-semibold ${psClass}`}>
                      {row.spend > 0 ? `${row.ps.toFixed(2)}x` : "—"}
                    </td>
                    <td className="text-right">{percent(row.conversion)}</td>
                    <td className="text-right">{percent(row.acaWrappedPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RangeCard({
  title,
  stats,
}: {
  title: string;
  stats: {
    totalSpend: number;
    totalLeads: number;
    inboundLeads: number;
    dataLeads: number;
    totalSales: number;
    totalPremium: number;
    cac: number;
    conversion: number;
    ps: number;
    avgPremium: number;
    acaWrappedPct: number;
  };
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-slate-400">Total Sales</div>
          <div className="mt-1 text-4xl font-bold">{stats.totalSales}</div>
        </div>

        <div>
          <div className="text-sm text-slate-400">Total Premium</div>
          <div className="mt-1 text-4xl font-bold">{currency(stats.totalPremium)}</div>
        </div>

        <div>
          <div className="text-sm text-slate-400">Avg Premium</div>
          <div className="mt-1 text-2xl font-semibold">{currency(stats.avgPremium)}</div>
        </div>

        <div>
          <div className="text-sm text-slate-400">CAC</div>
          <div className={`mt-1 text-2xl font-semibold ${stats.totalSales > 0 && stats.cac > 499.99 ? "text-red-400" : ""}`}>
            {currency(stats.cac)}
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-400">Spend</div>
          <div className="mt-1 text-2xl font-semibold">{currency(stats.totalSpend)}</div>
        </div>

        <div>
          <div className="text-sm text-slate-400">P/S Ratio</div>
          <div className={`mt-1 text-2xl font-semibold ${stats.totalSpend > 0 && stats.ps < 0.74 ? "text-red-400" : ""}`}>
            {stats.ps.toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function MiniStatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950 p-5">
      <div className="text-sm uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}