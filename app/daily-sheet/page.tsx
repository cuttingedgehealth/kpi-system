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

type Rep = {
  id: string;
  name: string;
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

type RowState = {
  metricId: string | null;
  sourceId: string;
  cplOverrideInput: string;
  quantityInput: string;
  spendOverrideInput: string;
};

type Plan = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

type Deal = {
  id: string;
  deal_date: string;
  payment_date: string | null;
  rep_id: string | null;
  member_id: string | null;
  phone_number: string | null;
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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailySheetPage() {
  const [date, setDate] = useState(todayString());
  const [sources, setSources] = useState<Source[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [dealModalOpen, setDealModalOpen] = useState(false);

  const [dealForm, setDealForm] = useState({
    rep_id: "",
    member_id: "",
    phone_number: "",
    source_id: "",
    plan_id: "",
    limited_premium: "",
    addon_premium: "",
    aca_sold: false,
    paid_today: true,
  });

  async function loadData(targetDate: string) {
    setLoading(true);
    setErrorText("");

    const { data: sourceData, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("active", true);

    if (sourceError) {
      setErrorText(`Source load error: ${sourceError.message}`);
      setLoading(false);
      return;
    }

    const sourceList = ((sourceData ?? []) as Source[]).sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
    setSources(sourceList);

    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("display_order", { ascending: true });

    if (repError) {
      setErrorText(`Rep load error: ${repError.message}`);
      setLoading(false);
      return;
    }

    setReps((repData ?? []) as Rep[]);

    const { data: planData, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("display_order", { ascending: true });

    if (planError) {
      setErrorText(`Plan load error: ${planError.message}`);
      setLoading(false);
      return;
    }

    setPlans((planData ?? []) as Plan[]);

    const { data: metricData, error: metricError } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("metric_date", targetDate);

    if (metricError) {
      setErrorText(`Metric load error: ${metricError.message}`);
      setLoading(false);
      return;
    }

    let metricList = (metricData ?? []) as Metric[];

    const existingSourceIds = new Set(metricList.map((m) => m.source_id));
    const missingSources = sourceList.filter((s) => !existingSourceIds.has(s.id));

    if (missingSources.length > 0) {
      const inserts = missingSources.map((s) => ({
        office_id: OFFICE_ID,
        metric_date: targetDate,
        source_id: s.id,
        quantity: 0,
        cpl_override: null,
        spend_override: null,
      }));

      const { error: insertError } = await supabase
        .from("daily_metrics")
        .insert(inserts);

      if (insertError) {
        setErrorText(`Metric insert error: ${insertError.message}`);
        setLoading(false);
        return;
      }

      const { data: reloadedMetrics, error: reloadError } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("office_id", OFFICE_ID)
        .eq("metric_date", targetDate);

      if (reloadError) {
        setErrorText(`Metric reload error: ${reloadError.message}`);
        setLoading(false);
        return;
      }

      metricList = (reloadedMetrics ?? []) as Metric[];
    }

    setMetrics(metricList);

    const rowState: RowState[] = sourceList.map((source) => {
      const metric = metricList.find((m) => m.source_id === source.id);

      return {
        metricId: metric?.id ?? null,
        sourceId: source.id,
        cplOverrideInput:
          metric?.cpl_override == null ? "" : String(metric.cpl_override),
        quantityInput: metric?.quantity == null ? "0" : String(metric.quantity),
        spendOverrideInput:
          metric?.spend_override == null ? "" : String(metric.spend_override),
      };
    });

    setRows(rowState);

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("deal_date", targetDate);

    if (dealError) {
      setErrorText(`Deal load error: ${dealError.message}`);
      setLoading(false);
      return;
    }

    setDeals((dealData ?? []) as Deal[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData(date);
  }, [date]);

  function updateRowInput(sourceId: string, field: keyof RowState, value: string) {
    setRows((prev) =>
      prev.map((row) => (row.sourceId === sourceId ? { ...row, [field]: value } : row))
    );
  }

  async function saveFieldByMetricId(metricId: string, updates: Partial<Metric>) {
    const { error } = await supabase
      .from("daily_metrics")
      .update(updates)
      .eq("id", metricId);

    if (error) {
      setErrorText(`Metric update error: ${error.message}`);
      return false;
    }

    setMetrics((prev) =>
      prev.map((metric) => (metric.id === metricId ? { ...metric, ...updates } : metric))
    );

    return true;
  }

  async function flushPendingEdits() {
    for (const row of rows) {
      if (!row.metricId) continue;

      const ok = await saveFieldByMetricId(row.metricId, {
        cpl_override: row.cplOverrideInput === "" ? null : Number(row.cplOverrideInput),
        quantity: Number(row.quantityInput || 0),
        spend_override: row.spendOverrideInput === "" ? null : Number(row.spendOverrideInput),
      });

      if (!ok) return false;
    }

    return true;
  }

  async function handleDateChange(nextDate: string) {
    const ok = await flushPendingEdits();
    if (!ok) return;
    setDate(nextDate);
  }

  async function saveField(sourceId: string, updates: Partial<Metric>) {
    const row = rows.find((r) => r.sourceId === sourceId);
    if (!row?.metricId) return;
    await saveFieldByMetricId(row.metricId, updates);
  }

  async function saveDeal() {
    setErrorText("");

    if (!dealForm.rep_id) {
      setErrorText("Please select a rep.");
      return;
    }

    if (!dealForm.member_id.trim()) {
      setErrorText("Please enter a Member ID.");
      return;
    }

    if (!dealForm.source_id || !dealForm.plan_id) {
      setErrorText("Please select a lead source and plan.");
      return;
    }

    const limited = Number(dealForm.limited_premium || 0);
    const addon = Number(dealForm.addon_premium || 0);
    const total = limited + addon;
    const paymentDate = dealForm.paid_today ? todayString() : null;

    const { error } = await supabase.from("deals").insert({
      office_id: OFFICE_ID,
      deal_date: date,
      payment_date: paymentDate,
      rep_id: dealForm.rep_id,
      member_id: dealForm.member_id.trim(),
      phone_number: dealForm.phone_number.trim() || null,
      source_id: dealForm.source_id,
      plan_id: dealForm.plan_id,
      limited_premium: limited,
      addon_premium: addon,
      total_premium: total,
      aca_sold: dealForm.aca_sold,
      status: paymentDate ? "active" : "pending",
    });

    if (error) {
      setErrorText(`Save deal error: ${error.message}`);
      return;
    }

    setDealForm({
      rep_id: "",
      member_id: "",
      phone_number: "",
      source_id: "",
      plan_id: "",
      limited_premium: "",
      addon_premium: "",
      aca_sold: false,
      paid_today: true,
    });
    setDealModalOpen(false);
    loadData(date);
  }

  function getMetricForSource(sourceId: string) {
    return metrics.find((m) => m.source_id === sourceId);
  }

  function getRowForSource(sourceId: string) {
    return rows.find((r) => r.sourceId === sourceId);
  }

  function getPaidDealsForSource(sourceId: string) {
    return deals.filter((d) => d.source_id === sourceId && d.payment_date);
  }

  const dailyTotals = useMemo(() => {
    let totalLeads = 0;
    let totalSpend = 0;

    const paidDeals = deals.filter((d) => d.payment_date);
    const totalSales = paidDeals.length;

    let totalPremium = 0;
    let acaWrappedDeals = 0;

    for (const source of sources) {
      const row = getRowForSource(source.id);
      const cplOverride = row?.cplOverrideInput === "" ? null : Number(row?.cplOverrideInput);
      const quantity = Number(row?.quantityInput || 0);
      const spendOverride =
        row?.spendOverrideInput === "" ? null : Number(row?.spendOverrideInput);

      const effectiveCpl = cplOverride ?? source.base_cpl;
      const effectiveSpend = spendOverride ?? quantity * effectiveCpl;

      totalLeads += quantity;
      totalSpend += effectiveSpend;
    }

    for (const deal of paidDeals) {
      totalPremium += Number(deal.total_premium || 0);
      if (deal.aca_sold) acaWrappedDeals += 1;
    }

    const cac = totalSales > 0 ? totalSpend / totalSales : 0;
    const conversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
    const ps = totalSpend > 0 ? totalPremium / totalSpend : 0;
    const acaWrappedPct = totalSales > 0 ? (acaWrappedDeals / totalSales) * 100 : 0;

    return {
      totalLeads,
      totalSpend,
      totalSales,
      totalPremium,
      cac,
      conversion,
      ps,
      acaWrappedPct,
    };
  }, [sources, rows, deals]);

  const inboundSources = useMemo(
    () => sources.filter((source) => source.type === "inbound"),
    [sources]
  );

  const dataSources = useMemo(
    () => sources.filter((source) => source.type === "data"),
    [sources]
  );

  if (loading) {
    return <div className="p-6 text-white">Loading daily sheet...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Daily Performance Input
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Daily Sheet
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Track lead volume, spend, and paid conversions by original sold date without inflating source quality.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Date</div>
              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-400"
              />
            </label>

            <button
              onClick={() => setDealModalOpen(true)}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Enter Deal
            </button>
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Daily Overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Numbers below reflect cleared payments only.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {date}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Spend" value={currency(dailyTotals.totalSpend)} />
          <KpiTile label="Sales" value={String(dailyTotals.totalSales)} />
          <KpiTile label="Premium" value={currency(dailyTotals.totalPremium)} />
          <KpiTile label="Leads" value={String(dailyTotals.totalLeads)} />
          <KpiTile
            label="CAC"
            value={currency(dailyTotals.cac)}
            danger={dailyTotals.totalSales > 0 && dailyTotals.cac > 499.99}
          />
          <KpiTile label="Conversion" value={`${dailyTotals.conversion.toFixed(2)}%`} />
          <KpiTile
            label="P/S Ratio"
            value={`${dailyTotals.ps.toFixed(2)}x`}
            danger={dailyTotals.totalSpend > 0 && dailyTotals.ps < 0.74}
            strong={dailyTotals.ps >= 1.5}
          />
          <KpiTile label="ACA Wrapped %" value={`${dailyTotals.acaWrappedPct.toFixed(2)}%`} />
        </div>
      </section>

      <SourceGroupTable
        title="Inbound Sources"
        subtitle="Alphabetized within inbound lead sources."
        sources={inboundSources}
        getMetricForSource={getMetricForSource}
        getRowForSource={getRowForSource}
        getPaidDealsForSource={getPaidDealsForSource}
        updateRowInput={updateRowInput}
        saveField={saveField}
      />

      <SourceGroupTable
        title="Data Sources"
        subtitle="Alphabetized within data lead sources."
        sources={dataSources}
        getMetricForSource={getMetricForSource}
        getRowForSource={getRowForSource}
        getPaidDealsForSource={getPaidDealsForSource}
        updateRowInput={updateRowInput}
        saveField={saveField}
      />

      {dealModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  New Deal Entry
                </div>
                <h2 className="text-3xl font-semibold tracking-tight">Enter Deal</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Sold date stays tied to this day. Paid deals count only after payment clears.
                </p>
              </div>
              <button
                onClick={() => setDealModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rep">
                <select
                  value={dealForm.rep_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, rep_id: e.target.value }))
                  }
                  className="field-input"
                >
                  <option value="">Select rep</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Member ID">
                <input
                  type="text"
                  value={dealForm.member_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, member_id: e.target.value }))
                  }
                  className="field-input"
                  placeholder="Enter member ID"
                />
              </Field>

              <Field label="Phone Number">
  <input
    type="text"
    value={dealForm.phone_number}
    onChange={(e) =>
      setDealForm((prev) => ({ ...prev, phone_number: e.target.value }))
    }
    className="field-input"
    placeholder="Enter phone number"
  />
</Field>

              <Field label="Plan">
                <select
                  value={dealForm.plan_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, plan_id: e.target.value }))
                  }
                  className="field-input"
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Lead Source">
                <select
                  value={dealForm.source_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, source_id: e.target.value }))
                  }
                  className="field-input"
                >
                  <option value="">Select lead source</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Limited Premium">
                <input
                  type="number"
                  step="0.01"
                  value={dealForm.limited_premium}
                  onChange={(e) =>
                    setDealForm((prev) => ({
                      ...prev,
                      limited_premium: e.target.value,
                    }))
                  }
                  className="field-input"
                />
              </Field>

              <Field label="Add-On Premiums">
                <input
                  type="number"
                  step="0.01"
                  value={dealForm.addon_premium}
                  onChange={(e) =>
                    setDealForm((prev) => ({
                      ...prev,
                      addon_premium: e.target.value,
                    }))
                  }
                  className="field-input"
                />
              </Field>

              <Field label="Total Premium">
                <input
                  type="number"
                  value={
                    Number(dealForm.limited_premium || 0) +
                    Number(dealForm.addon_premium || 0)
                  }
                  readOnly
                  className="field-input field-input-readonly"
                />
              </Field>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Deal Flags
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-[15px] text-slate-200">
                    <input
                      id="aca_sold"
                      type="checkbox"
                      checked={dealForm.aca_sold}
                      onChange={(e) =>
                        setDealForm((prev) => ({ ...prev, aca_sold: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                    ACA Sold?
                  </label>

                  <label className="flex items-center gap-3 text-[15px] text-slate-200">
                    <input
                      id="paid_today"
                      type="checkbox"
                      checked={dealForm.paid_today}
                      onChange={(e) =>
                        setDealForm((prev) => ({ ...prev, paid_today: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-slate-900"
                    />
                    Paid today?
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDealModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={saveDeal}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Save Deal
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

        .field-input-readonly {
          background: rgba(255, 255, 255, 0.03);
          color: rgb(203 213 225);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      {children}
    </div>
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

function SourceGroupTable({
  title,
  subtitle,
  sources,
  getMetricForSource,
  getRowForSource,
  getPaidDealsForSource,
  updateRowInput,
  saveField,
}: {
  title: string;
  subtitle: string;
  sources: Source[];
  getMetricForSource: (sourceId: string) => Metric | undefined;
  getRowForSource: (sourceId: string) => RowState | undefined;
  getPaidDealsForSource: (sourceId: string) => Deal[];
  updateRowInput: (sourceId: string, field: keyof RowState, value: string) => void;
  saveField: (sourceId: string, updates: Partial<Metric>) => Promise<void>;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Cleared payments only
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-[16px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-4 font-medium">Source</th>
                <th className="px-4 py-4 font-medium">Type</th>
                <th className="px-4 py-4 font-medium">Base CPL</th>
                <th className="px-4 py-4 font-medium">CPL</th>
                <th className="px-4 py-4 font-medium">Qty</th>
                <th className="px-4 py-4 font-medium">Spend</th>
                <th className="px-4 py-4 font-medium">Sales</th>
                <th className="px-4 py-4 font-medium">CAC</th>
                <th className="px-4 py-4 font-medium">Premium</th>
                <th className="px-4 py-4 font-medium">P/S</th>
                <th className="px-4 py-4 font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source, index) => {
                const metric = getMetricForSource(source.id);
                const row = getRowForSource(source.id);

                const cplOverride =
                  row?.cplOverrideInput === "" ? null : Number(row?.cplOverrideInput);
                const quantity = Number(row?.quantityInput || 0);
                const spendOverride =
                  row?.spendOverrideInput === "" ? null : Number(row?.spendOverrideInput);

                const effectiveCpl = cplOverride ?? source.base_cpl;
                const effectiveSpend = spendOverride ?? quantity * effectiveCpl;

                const sourceDeals = getPaidDealsForSource(source.id);
                const sales = sourceDeals.length;
                const premium = sourceDeals.reduce(
                  (sum, d) => sum + Number(d.total_premium || 0),
                  0
                );
                const conversion = quantity > 0 ? (sales / quantity) * 100 : 0;
                const cac = sales > 0 ? effectiveSpend / sales : 0;
                const ps = effectiveSpend > 0 ? premium / effectiveSpend : 0;

                const cacDanger = sales > 0 && cac > 499.99;
                const psDanger = effectiveSpend > 0 && ps < 0.74;
                const psStrong = ps >= 1.5;

                return (
                  <tr
                    key={source.id}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-[16px] text-white">
                            {source.name}
                          </div>
                          <div className="text-xs text-slate-500 capitalize">
                            {source.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-[15px] text-slate-100 capitalize">
                      {source.type}
                    </td>
                    <td className="px-4 py-5 text-[15px] text-slate-100">
                      {currency(Number(source.base_cpl))}
                    </td>

                    <td className="px-4 py-5">
                      <input
                        type="number"
                        step="0.01"
                        value={row?.cplOverrideInput ?? ""}
                        placeholder={String(source.base_cpl)}
                        onChange={(e) =>
                          updateRowInput(source.id, "cplOverrideInput", e.target.value)
                        }
                        onBlur={() =>
                          metric &&
                          saveField(source.id, {
                            cpl_override:
                              row?.cplOverrideInput === ""
                                ? null
                                : Number(row?.cplOverrideInput),
                          })
                        }
                        className="w-28 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-[15px] text-white outline-none transition focus:border-slate-400"
                      />
                    </td>

                    <td className="px-4 py-5">
                      <input
                        type="number"
                        value={row?.quantityInput ?? "0"}
                        onChange={(e) =>
                          updateRowInput(source.id, "quantityInput", e.target.value)
                        }
                        onBlur={() =>
                          metric &&
                          saveField(source.id, {
                            quantity: Number(row?.quantityInput || 0),
                          })
                        }
                        className="w-24 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-[15px] text-white outline-none transition focus:border-slate-400"
                      />
                    </td>

                    <td className="px-4 py-5">
                      <input
                        type="number"
                        step="0.01"
                        value={
                          row?.spendOverrideInput !== ""
                            ? row?.spendOverrideInput
                            : String(effectiveSpend)
                        }
                        onChange={(e) =>
                          updateRowInput(source.id, "spendOverrideInput", e.target.value)
                        }
                        onBlur={() =>
                          metric &&
                          saveField(source.id, {
                            spend_override:
                              row?.spendOverrideInput === ""
                                ? null
                                : Number(row?.spendOverrideInput),
                          })
                        }
                        className="w-28 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-[15px] text-white outline-none transition focus:border-slate-400"
                      />
                    </td>

                    <td className="px-4 py-5 text-[15px] text-slate-100">{sales}</td>
                    <td
                      className={`px-4 py-5 text-[15px] font-medium ${
                        cacDanger ? "text-red-400" : "text-slate-100"
                      }`}
                    >
                      {sales > 0 ? currency(cac) : "—"}
                    </td>
                    <td className="px-4 py-5 text-[15px] font-medium text-white">
                      {currency(premium)}
                    </td>
                    <td
                      className={`px-4 py-5 text-[15px] font-semibold ${
                        psStrong ? "text-emerald-400" : psDanger ? "text-red-400" : "text-white"
                      }`}
                    >
                      {effectiveSpend > 0 ? `${ps.toFixed(2)}x` : "—"}
                    </td>
                    <td className="px-4 py-5 text-[15px] text-slate-100">
                      {conversion.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    No sources found in this category.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}