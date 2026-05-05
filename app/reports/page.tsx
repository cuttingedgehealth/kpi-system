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

type DailyMetric = {
  id: string;
  metric_date: string;
  source_id: string;
  quantity: number;
  cpl_override: number | null;
  spend_override: number | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function csvEscape(value: string | number) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function isPostDate(deal: Deal) {
  if (!deal.payment_date) return "Yes";
  return deal.payment_date !== deal.deal_date ? "Yes" : "No";
}

export default function ReportsPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
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
      .select("id,name,type,base_cpl,active")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("name", { ascending: true });

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("id,deal_date,payment_date,phone_number,source_id,total_premium,status")
      .eq("office_id", OFFICE_ID);

    const { data: metricData, error: metricError } = await supabase
      .from("daily_metrics")
      .select("id,metric_date,source_id,quantity,cpl_override,spend_override")
      .eq("office_id", OFFICE_ID);

    if (sourceError) setErrorText(`Source load error: ${sourceError.message}`);
    if (dealError) setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);
    if (metricError) setErrorText((prev) => prev || `Metric load error: ${metricError.message}`);

    const sourceList = (sourceData ?? []) as Source[];

    setSources(sourceList);
    setDeals((dealData ?? []) as Deal[]);
    setDailyMetrics((metricData ?? []) as DailyMetric[]);
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

  function getMetricSpend(metric: DailyMetric) {
    const source = sources.find((s) => s.id === metric.source_id);
    const effectiveCpl = metric.cpl_override ?? source?.base_cpl ?? 0;
    return metric.spend_override ?? Number(metric.quantity || 0) * effectiveCpl;
  }

  const filteredDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        const sourceMatch =
          selectedSourceIds.length > 0 &&
          deal.source_id !== null &&
          selectedSourceIds.includes(deal.source_id);

        const dateMatch = deal.deal_date >= startDate && deal.deal_date <= endDate;
        const activeMatch = (deal.status ?? "active") !== "cancelled";

        return sourceMatch && dateMatch && activeMatch;
      })
      .sort((a, b) => a.deal_date.localeCompare(b.deal_date));
  }, [deals, selectedSourceIds, startDate, endDate]);

  const filteredMetrics = useMemo(() => {
    return dailyMetrics.filter((metric) => {
      const sourceMatch =
        selectedSourceIds.length > 0 && selectedSourceIds.includes(metric.source_id);

      const dateMatch =
        metric.metric_date >= startDate && metric.metric_date <= endDate;

      return sourceMatch && dateMatch;
    });
  }, [dailyMetrics, selectedSourceIds, startDate, endDate]);

  const reportStats = useMemo(() => {
    const dealCount = filteredDeals.length;

    const totalPremium = filteredDeals.reduce(
      (sum, deal) => sum + Number(deal.total_premium || 0),
      0
    );

    const avgPremium = dealCount > 0 ? totalPremium / dealCount : 0;

    const postDateCount = filteredDeals.filter(
      (deal) => isPostDate(deal) === "Yes"
    ).length;

    const sameDayCount = dealCount - postDateCount;

    const postDatePct = dealCount > 0 ? (postDateCount / dealCount) * 100 : 0;
    const sameDayPct = dealCount > 0 ? (sameDayCount / dealCount) * 100 : 0;

    const totalSpend = filteredMetrics.reduce(
      (sum, metric) => sum + getMetricSpend(metric),
      0
    );

    const cac = dealCount > 0 ? totalSpend / dealCount : 0;
    const ps = totalSpend > 0 ? totalPremium / totalSpend : 0;

    return {
      dealCount,
      totalPremium,
      avgPremium,
      postDateCount,
      sameDayCount,
      postDatePct,
      sameDayPct,
      totalSpend,
      cac,
      ps,
    };
  }, [filteredDeals, filteredMetrics, sources]);

  const sourceBreakdown = useMemo(() => {
    return selectedSourceIds
      .map((sourceId) => {
        const source = sources.find((s) => s.id === sourceId);
        const sourceDeals = filteredDeals.filter((deal) => deal.source_id === sourceId);
        const sourceMetrics = filteredMetrics.filter(
          (metric) => metric.source_id === sourceId
        );

        const dealCount = sourceDeals.length;
        const premium = sourceDeals.reduce(
          (sum, deal) => sum + Number(deal.total_premium || 0),
          0
        );

        const spend = sourceMetrics.reduce(
          (sum, metric) => sum + getMetricSpend(metric),
          0
        );

        const avgPremium = dealCount > 0 ? premium / dealCount : 0;
        const cac = dealCount > 0 ? spend / dealCount : 0;
        const ps = spend > 0 ? premium / spend : 0;

        const postDateCount = sourceDeals.filter(
          (deal) => isPostDate(deal) === "Yes"
        ).length;

        const postDatePct = dealCount > 0 ? (postDateCount / dealCount) * 100 : 0;

        return {
          source,
          dealCount,
          premium,
          spend,
          avgPremium,
          cac,
          ps,
          postDateCount,
          postDatePct,
        };
      })
      .filter((row) => row.source)
      .sort((a, b) => b.premium - a.premium);
  }, [filteredDeals, filteredMetrics, selectedSourceIds, sources]);

  function downloadCsv() {
    const header = ["Phone Number", "Sold Date", "Source", "Premium", "Post Date"];

    const rows = filteredDeals.map((deal) => [
      deal.phone_number || "",
      deal.deal_date,
      getSourceName(deal.source_id),
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
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Vendor Reporting
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Reports
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Analyze deal quality by lead source, then export only the vendor-safe fields:
              phone number, sold date, source, premium, and post-date status.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="Deals" value={String(reportStats.dealCount)} />
            <HeroMetric label="Premium" value={currency(reportStats.totalPremium)} />
            <HeroMetric label="CAC" value={currency(reportStats.cac)} />
            <HeroMetric label="P/S" value={`${reportStats.ps.toFixed(2)}x`} />
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
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
              onClick={loadData}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
            >
              Refresh
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={downloadCsv}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-9">
          <KpiTile label="Deals" value={String(reportStats.dealCount)} />
          <KpiTile label="Premium" value={currency(reportStats.totalPremium)} />
          <KpiTile label="Avg Premium" value={currency(reportStats.avgPremium)} />
          <KpiTile label="Post Dates" value={String(reportStats.postDateCount)} />
          <KpiTile label="Post Date %" value={percent(reportStats.postDatePct)} />
          <KpiTile label="Same Day %" value={percent(reportStats.sameDayPct)} />
          <KpiTile label="Spend" value={currency(reportStats.totalSpend)} />
          <KpiTile label="CAC" value={currency(reportStats.cac)} />
          <KpiTile label="P/S" value={`${reportStats.ps.toFixed(2)}x`} />
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

        <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4">
            <h2 className="text-xl font-semibold tracking-tight">Source Breakdown</h2>
            <p className="mt-1 text-sm text-slate-400">
              Quick source-level read before exporting.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[16px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-4 font-medium">Source</th>
                  <th className="px-4 py-4 font-medium">Type</th>
                  <th className="px-4 py-4 text-right font-medium">Deals</th>
                  <th className="px-4 py-4 text-right font-medium">Premium</th>
                  <th className="px-4 py-4 text-right font-medium">Spend</th>
                  <th className="px-4 py-4 text-right font-medium">CAC</th>
                  <th className="px-4 py-4 text-right font-medium">P/S</th>
                  <th className="px-4 py-4 text-right font-medium">Avg Premium</th>
                  <th className="px-4 py-4 text-right font-medium">Post Date %</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map((row) => (
                  <tr
                    key={row.source!.id}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-5 font-semibold text-white">
                      {row.source!.name}
                    </td>
                    <td className="px-4 py-5 capitalize text-slate-100">
                      {row.source!.type}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-100">
                      {row.dealCount}
                    </td>
                    <td className="px-4 py-5 text-right font-medium text-white">
                      {currency(row.premium)}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-100">
                      {currency(row.spend)}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-100">
                      {row.dealCount > 0 ? currency(row.cac) : "—"}
                    </td>
                    <td className="px-4 py-5 text-right font-semibold text-white">
                      {row.spend > 0 ? `${row.ps.toFixed(2)}x` : "—"}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-100">
                      {currency(row.avgPremium)}
                    </td>
                    <td className="px-4 py-5 text-right text-slate-100">
                      {percent(row.postDatePct)}
                    </td>
                  </tr>
                ))}

                {sourceBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      No selected source data for this date range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4">
            <h2 className="text-xl font-semibold tracking-tight">Export Preview</h2>
            <p className="mt-1 text-sm text-slate-400">
              This preview matches the CSV export fields.
            </p>
          </div>

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