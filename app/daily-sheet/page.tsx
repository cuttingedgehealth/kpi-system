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
  rep_id: string | null;
  member_id: string | null;
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

export default function DailySheetPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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
    source_id: "",
    plan_id: "",
    limited_premium: "",
    addon_premium: "",
    aca_sold: false,
  });

  async function loadData(targetDate: string) {
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

    const sourceList = (sourceData ?? []) as Source[];
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
        quantityInput:
          metric?.quantity == null ? "0" : String(metric.quantity),
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
      prev.map((row) =>
        row.sourceId === sourceId ? { ...row, [field]: value } : row
      )
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
      prev.map((metric) =>
        metric.id === metricId ? { ...metric, ...updates } : metric
      )
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

    const { error } = await supabase.from("deals").insert({
      office_id: OFFICE_ID,
      deal_date: date,
      rep_id: dealForm.rep_id,
      member_id: dealForm.member_id.trim(),
      source_id: dealForm.source_id,
      plan_id: dealForm.plan_id,
      limited_premium: limited,
      addon_premium: addon,
      total_premium: total,
      aca_sold: dealForm.aca_sold,
    });

    if (error) {
      setErrorText(`Save deal error: ${error.message}`);
      return;
    }

    setDealForm({
      rep_id: "",
      member_id: "",
      source_id: "",
      plan_id: "",
      limited_premium: "",
      addon_premium: "",
      aca_sold: false,
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

  function getDealsForSource(sourceId: string) {
    return deals.filter((d) => d.source_id === sourceId);
  }

  const dailyTotals = useMemo(() => {
    let totalLeads = 0;
    let totalSpend = 0;
    const totalSales = deals.length;
    let totalPremium = 0;
    let acaWrappedDeals = 0;

    for (const source of sources) {
      const row = getRowForSource(source.id);
      const cplOverride =
        row?.cplOverrideInput === "" ? null : Number(row?.cplOverrideInput);
      const quantity = Number(row?.quantityInput || 0);
      const spendOverride =
        row?.spendOverrideInput === "" ? null : Number(row?.spendOverrideInput);

      const effectiveCpl = cplOverride ?? source.base_cpl;
      const effectiveSpend = spendOverride ?? quantity * effectiveCpl;

      totalLeads += quantity;
      totalSpend += effectiveSpend;
    }

    for (const deal of deals) {
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

  if (loading) {
    return <div className="p-6 text-white">Loading daily sheet...</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center gap-4">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded bg-slate-800 p-2"
        />

        <button
          onClick={() => setDealModalOpen(true)}
          className="rounded bg-orange-600 px-4 py-2 hover:bg-orange-500"
        >
          Enter Deal
        </button>

        {errorText ? (
          <div className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tile label="Total Spend" value={currency(dailyTotals.totalSpend)} />
        <Tile label="Total Sales" value={String(dailyTotals.totalSales)} />
        <Tile label="Total Premium" value={currency(dailyTotals.totalPremium)} />
        <Tile label="Total Leads" value={String(dailyTotals.totalLeads)} />
        <Tile
          label="CAC"
          value={currency(dailyTotals.cac)}
          danger={dailyTotals.totalSales > 0 && dailyTotals.cac > 499.99}
        />
        <Tile label="Conversion" value={`${dailyTotals.conversion.toFixed(2)}%`} />
        <Tile
          label="P/S Ratio"
          value={`${dailyTotals.ps.toFixed(2)}x`}
          danger={dailyTotals.totalSpend > 0 && dailyTotals.ps < 0.74}
        />
        <Tile label="ACA Wrapped %" value={`${dailyTotals.acaWrappedPct.toFixed(2)}%`} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left">
            <th className="py-2">Source</th>
            <th>Type</th>
            <th>Base CPL</th>
            <th>CPL</th>
            <th>Qty</th>
            <th>Spend</th>
            <th>Sales</th>
            <th>CAC</th>
            <th>Premium</th>
            <th>P/S</th>
            <th>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const metric = getMetricForSource(source.id);
            const row = getRowForSource(source.id);

            const cplOverride =
              row?.cplOverrideInput === "" ? null : Number(row?.cplOverrideInput);
            const quantity = Number(row?.quantityInput || 0);
            const spendOverride =
              row?.spendOverrideInput === "" ? null : Number(row?.spendOverrideInput);

            const effectiveCpl = cplOverride ?? source.base_cpl;
            const effectiveSpend = spendOverride ?? quantity * effectiveCpl;

            const sourceDeals = getDealsForSource(source.id);
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

            return (
              <tr key={source.id} className="border-b border-slate-800">
                <td className="py-2">{source.name}</td>
                <td>{source.type}</td>
                <td>{currency(Number(source.base_cpl))}</td>

                <td>
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
                          row?.cplOverrideInput === "" ? null : Number(row?.cplOverrideInput),
                      })
                    }
                    className="w-24 rounded bg-slate-800 p-1"
                  />
                </td>

                <td>
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
                    className="w-20 rounded bg-slate-800 p-1"
                  />
                </td>

                <td>
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
                    className="w-24 rounded bg-slate-800 p-1"
                  />
                </td>

                <td>{sales}</td>
                <td className={cacDanger ? "font-semibold text-red-400" : ""}>
                  {sales > 0 ? currency(cac) : "—"}
                </td>
                <td>{currency(premium)}</td>
                <td className={psDanger ? "font-semibold text-red-400" : ""}>
                  {effectiveSpend > 0 ? `${ps.toFixed(2)}x` : "—"}
                </td>
                <td>{conversion.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {dealModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl bg-slate-950 p-6 text-white shadow-2xl">
            <h2 className="mb-6 text-3xl font-bold">Enter Deal</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Rep</label>
                <select
                  value={dealForm.rep_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, rep_id: e.target.value }))
                  }
                  className="w-full rounded bg-slate-800 px-3 py-2"
                >
                  <option value="">Select rep</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Member ID</label>
                <input
                  type="text"
                  value={dealForm.member_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, member_id: e.target.value }))
                  }
                  className="w-full rounded bg-slate-800 px-3 py-2"
                  placeholder="Enter member ID"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Plan</label>
                <select
                  value={dealForm.plan_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, plan_id: e.target.value }))
                  }
                  className="w-full rounded bg-slate-800 px-3 py-2"
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Limited Premium
                </label>
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
                  className="w-full rounded bg-slate-800 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Add-On Premiums
                </label>
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
                  className="w-full rounded bg-slate-800 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Total Premium
                </label>
                <input
                  type="number"
                  value={
                    Number(dealForm.limited_premium || 0) +
                    Number(dealForm.addon_premium || 0)
                  }
                  readOnly
                  className="w-full rounded bg-slate-900 px-3 py-2 text-slate-300"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="aca_sold"
                  type="checkbox"
                  checked={dealForm.aca_sold}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, aca_sold: e.target.checked }))
                  }
                />
                <label htmlFor="aca_sold" className="text-sm text-slate-300">
                  ACA Sold?
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Lead Source</label>
                <select
                  value={dealForm.source_id}
                  onChange={(e) =>
                    setDealForm((prev) => ({ ...prev, source_id: e.target.value }))
                  }
                  className="w-full rounded bg-slate-800 px-3 py-2"
                >
                  <option value="">Select lead source</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDealModalOpen(false)}
                className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={saveDeal}
                className="rounded bg-orange-600 px-4 py-2 hover:bg-orange-500"
              >
                Save Deal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-950 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${danger ? "text-red-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}