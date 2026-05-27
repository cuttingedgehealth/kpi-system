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
  payment_date: string | null;
  rep_id: string | null;
  member_id: string | null;
  status: string | null;
  source_id: string | null;
  plan_id: string | null;
  limited_premium: number;
  addon_premium: number;
  total_premium: number;
  aca_sold: boolean;
};

function currency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function inDateRange(dateStr: string | null, start: string, end: string) {
  if (!dateStr) return false;
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
      .order("display_order", { ascending: true });

 const currentYear = new Date().getFullYear();

const { data: metricData, error: metricError } = await supabase
  .from("daily_metrics")
  .select("*")
  .eq("office_id", OFFICE_ID)
  .gte("metric_date", `${currentYear}-01-01`)
  .lte("metric_date", `${currentYear}-12-31`)
  .order("metric_date", { ascending: false })
  .range(0, 5000);

const { data: dealData, error: dealError } = await supabase
  .from("deals")
  .select("*")
  .eq("office_id", OFFICE_ID)
  .gte("payment_date", `${currentYear}-01-01`)
  .lte("payment_date", `${currentYear}-12-31`)
  .order("payment_date", { ascending: false })
  .range(0, 5000);

    if (sourceError) setErrorText(`Source load error: ${sourceError.message}`);
    if (metricError) setErrorText((prev) => prev || `Metric load error: ${metricError.message}`);
    if (dealError) setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);

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
  }, [today]);

  const monthRange = useMemo(() => {
    return {
      start: formatDateForInput(startOfMonth(today)),
      end: formatDateForInput(endOfMonth(today)),
    };
  }, [today]);

  const yearRange = useMemo(() => {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }, [today]);

  function computeRangeStats(start: string, end: string) {
    const filteredMetrics = metrics.filter((m) => inDateRange(m.metric_date, start, end));
    const filteredDeals = deals.filter(
      (d) => inDateRange(d.payment_date, start, end) && (d.status ?? "active") !== "cancelled"
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
    [metrics, deals, sources, weekRange.start, weekRange.end]
  );

  const monthStats = useMemo(
    () => computeRangeStats(monthRange.start, monthRange.end),
    [metrics, deals, sources, monthRange.start, monthRange.end]
  );

  const yearStats = useMemo(
    () => computeRangeStats(yearRange.start, yearRange.end),
    [metrics, deals, sources, yearRange.start, yearRange.end]
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
            inDateRange(d.payment_date, customStart, customEnd) &&
            (d.status ?? "active") !== "cancelled"
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
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Performance Command Center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Office Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Clean weekly decision view across spend, premium, CAC, conversion, and source quality.
              Metrics below are based on cleared payments only.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="Week Spend" value={currency(weekStats.totalSpend)} />
            <HeroMetric label="Week Premium" value={currency(weekStats.totalPremium)} />
            <HeroMetric label="Week P/S" value={`${weekStats.ps.toFixed(2)}x`} />
            <HeroMetric label="Week Sales" value={String(weekStats.totalSales)} />
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        <PeriodCard title="Current Week" subtitle={`${weekRange.start} → ${weekRange.end}`} stats={weekStats} />
        <PeriodCard title="Month to Date" subtitle={`${monthRange.start} → ${monthRange.end}`} stats={monthStats} />
        <PeriodCard title="Year to Date" subtitle={`${yearRange.start} → ${yearRange.end}`} stats={yearStats} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Custom Range</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use this section as your weekly decision board for source buying and pacing.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateField label="Start" value={customStart} onChange={setCustomStart} />
            <DateField label="End" value={customEnd} onChange={setCustomEnd} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Spend" value={currency(customStats.totalSpend)} />
          <KpiTile label="Sales" value={String(customStats.totalSales)} />
          <KpiTile label="Premium" value={currency(customStats.totalPremium)} />
          <KpiTile label="Leads" value={String(customStats.totalLeads)} />
          <KpiTile
            label="CAC"
            value={currency(customStats.cac)}
            danger={customStats.totalSales > 0 && customStats.cac > 499.99}
          />
          <KpiTile label="Conversion" value={percent(customStats.conversion)} />
          <KpiTile
            label="P/S Ratio"
            value={`${customStats.ps.toFixed(2)}x`}
            danger={customStats.totalSpend > 0 && customStats.ps < 0.74}
            strong={customStats.ps >= 1.5}
          />
          <KpiTile label="ACA Wrapped %" value={percent(customStats.acaWrappedPct)} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SubMetric label="Inbound Leads" value={String(customStats.inboundLeads)} />
          <SubMetric label="Data Leads" value={String(customStats.dataLeads)} />
          <SubMetric label="Avg Premium" value={currency(customStats.avgPremium)} />
          <SubMetric label="Spend" value={currency(customStats.totalSpend)} />
          <SubMetric
            label="P/S"
            value={`${customStats.ps.toFixed(2)}x`}
            accent={customStats.ps >= 1.5 ? "good" : customStats.ps > 0 && customStats.ps < 0.74 ? "bad" : "neutral"}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Source Rankings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ranked by P/S ratio for the selected custom range.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Cleared payments only
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[16px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-5 font-medium">Source</th>
                  <th className="px-4 py-5 font-medium">Type</th>
                  <th className="px-4 py-5 text-right font-medium">Leads</th>
                  <th className="px-4 py-5 text-right font-medium">Spend</th>
                  <th className="px-4 py-5 text-right font-medium">Sales</th>
                  <th className="px-4 py-5 text-right font-medium">CAC</th>
                  <th className="px-4 py-5 text-right font-medium">Premium</th>
                  <th className="px-4 py-5 text-right font-medium">P/S</th>
                  <th className="px-4 py-5 text-right font-medium">Conversion</th>
                  <th className="px-4 py-5 text-right font-medium">ACA %</th>
                </tr>
              </thead>
              <tbody>
                {sourceRankings.map((row, index) => {
                  const psBad = row.spend > 0 && row.ps < 0.74;
                  const psStrong = row.ps >= 1.5;
                  const cacBad = row.sales > 0 && row.cac > 499.99;

                  return (
                    <tr
                      key={row.source.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-300">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-[16px] text-white">{row.source.name}</div>
                            <div className="text-xs text-slate-500">
                              {row.source.type === "inbound" ? "Inbound" : "Data"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-slate-300 capitalize">{row.source.type}</td>
                      <td className="px-4 py-5 text-right text-[15px] text-slate-100">{row.leads}</td>
                      <td className="px-4 py-5 text-right text-[15px] text-slate-100">{currency(row.spend)}</td>
                      <td className="px-4 py-5 text-right text-[15px] text-slate-100">{row.sales}</td>
                      <td className={`px-4 py-5 text-right font-medium ${cacBad ? "text-red-400" : "text-slate-200"}`}>
                        {row.sales > 0 ? currency(row.cac) : "—"}
                      </td>
                      <td className="px-4 py-5 text-right font-medium text-slate-100">
                        {currency(row.premium)}
                      </td>
                      <td
                        className={`px-4 py-5 text-right font-semibold ${
                          psStrong ? "text-emerald-400" : psBad ? "text-red-400" : "text-slate-100"
                        }`}
                      >
                        {row.spend > 0 ? `${row.ps.toFixed(2)}x` : "—"}
                      </td>
                      <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                        {percent(row.conversion)}
                      </td>
                      <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                        {percent(row.acaWrappedPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function PeriodCard({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
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
  const psBad = stats.totalSpend > 0 && stats.ps < 0.74;
  const psStrong = stats.ps >= 1.5;
  const cacBad = stats.totalSales > 0 && stats.cac > 499.99;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{subtitle}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MiniPanel label="Sales" value={String(stats.totalSales)} />
        <MiniPanel label="Premium" value={currency(stats.totalPremium)} />
        <MiniPanel label="Avg Premium" value={currency(stats.avgPremium)} />
        <MiniPanel label="Spend" value={currency(stats.totalSpend)} />
        <MiniPanel
          label="CAC"
          value={currency(stats.cac)}
          danger={cacBad}
        />
        <MiniPanel
          label="P/S"
          value={`${stats.ps.toFixed(2)}x`}
          danger={psBad}
          strong={psStrong}
        />
      </div>
    </div>
  );
}

function MiniPanel({
  label,
  value,
  danger = false,
  strong = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div
        className={`mt-2 text-lg font-semibold ${
          strong ? "text-emerald-400" : danger ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
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
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
      />
    </label>
  );
}

function KpiTile({
  label,
  value,
  danger = false,
  strong = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div
        className={`mt-3 text-2xl font-semibold tracking-tight ${
          strong ? "text-emerald-400" : danger ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SubMetric({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "good" | "bad";
}) {
  const accentClass =
    accent === "good"
      ? "text-emerald-400"
      : accent === "bad"
      ? "text-red-400"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}