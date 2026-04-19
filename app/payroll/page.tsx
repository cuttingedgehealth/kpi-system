"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Rep = {
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
  status: string | null;
  source_id: string | null;
  plan_id: string | null;
  limited_premium: number;
  addon_premium: number;
  total_premium: number;
  aca_sold: boolean;
};

type Plan = {
  id: string;
  name: string;
};

type Source = {
  id: string;
  name: string;
};

function currency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

export default function PayrollPage() {
  const today = new Date();

  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [startDate, setStartDate] = useState(formatDate(startOfWeek(today)));
  const [endDate, setEndDate] = useState(formatDate(endOfWeek(today)));

  const [spiffs, setSpiffs] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const [advances, setAdvances] = useState<Record<string, string>>({});
  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [expandedRepId, setExpandedRepId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("active", true)
      .order("display_order", { ascending: true });

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .order("deal_date", { ascending: false });

    const { data: planData, error: planError } = await supabase
      .from("plans")
      .select("id,name")
      .eq("office_id", OFFICE_ID);

    const { data: sourceData, error: sourceError } = await supabase
      .from("sources")
      .select("id,name")
      .eq("office_id", OFFICE_ID);

    if (repError) setErrorText(`Rep load error: ${repError.message}`);
    if (dealError) setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);
    if (planError) setErrorText((prev) => prev || `Plan load error: ${planError.message}`);
    if (sourceError) setErrorText((prev) => prev || `Source load error: ${sourceError.message}`);

    const repList = (repData ?? []) as Rep[];

    setReps(repList);
    setDeals((dealData ?? []) as Deal[]);
    setPlans((planData ?? []) as Plan[]);
    setSources((sourceData ?? []) as Source[]);

    setOverrideInputs((prev) => {
      const next = { ...prev };
      for (const rep of repList) {
        if (!(rep.id in next)) {
          next[rep.id] = manualRates[rep.id] ?? "";
        }
      }
      return next;
    });

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function syncOverrideInput(repId: string, value: string) {
    setOverrideInputs((prev) => ({ ...prev, [repId]: value }));
  }

  function commitManualRate(repId: string) {
    const typedValue = (overrideInputs[repId] ?? "").trim();
    const currentSaved = manualRates[repId] ?? "";

    if (typedValue === currentSaved) return;

    if (typedValue === "") {
      const confirmed = window.confirm(
        "Clear the manual override and go back to the default/tier logic?"
      );
      if (!confirmed) {
        setOverrideInputs((prev) => ({ ...prev, [repId]: currentSaved }));
        return;
      }

      setManualRates((prev) => ({ ...prev, [repId]: "" }));
      return;
    }

    const numericValue = Number(typedValue);

    if (Number.isNaN(numericValue) || numericValue <= 0) {
      setOverrideInputs((prev) => ({ ...prev, [repId]: currentSaved }));
      return;
    }

    const confirmed = window.confirm(
      `Override this rep's base commission rate to ${numericValue}%?`
    );

    if (!confirmed) {
      setOverrideInputs((prev) => ({ ...prev, [repId]: currentSaved }));
      return;
    }

    setManualRates((prev) => ({ ...prev, [repId]: typedValue }));
  }

  async function updateDealStatus(dealId: string, nextStatus: string) {
    const { error } = await supabase
      .from("deals")
      .update({ status: nextStatus })
      .eq("id", dealId);

    if (error) {
      setErrorText(`Status update error: ${error.message}`);
      return;
    }

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, status: nextStatus } : deal
      )
    );
  }

  function getPlanName(planId: string | null) {
    if (!planId) return "—";
    return plans.find((p) => p.id === planId)?.name ?? "—";
  }

  function getSourceName(sourceId: string | null) {
    if (!sourceId) return "—";
    return sources.find((s) => s.id === sourceId)?.name ?? "—";
  }

  const payrollRows = useMemo(() => {
    return reps.map((rep) => {
      const repDeals = deals.filter(
        (deal) => deal.rep_id === rep.id && inRange(deal.deal_date, startDate, endDate)
      );

      const activeDeals = repDeals.filter(
        (deal) => (deal.status ?? "active") !== "cancelled"
      );

      const cancelledDeals = repDeals.filter(
        (deal) => (deal.status ?? "active") === "cancelled"
      );

      const totalDeals = activeDeals.length;
      const totalPremium = activeDeals.reduce(
        (sum, deal) => sum + Number(deal.total_premium || 0),
        0
      );
      const avgPremium = totalDeals > 0 ? totalPremium / totalDeals : 0;

      const totalCancelledPremium = cancelledDeals.reduce(
        (sum, deal) => sum + Number(deal.total_premium || 0),
        0
      );

      const baseRate = 0.4;
      let tierRate = 0.4;

      if (avgPremium >= 375 && totalDeals >= 15) {
        tierRate = 0.5;
      } else if (avgPremium >= 325 && totalDeals >= 10) {
        tierRate = 0.45;
      }

      const manualRateValue = manualRates[rep.id];
      const manualRate =
        manualRateValue !== undefined && manualRateValue !== ""
          ? Number(manualRateValue) / 100
          : null;

      const appliedBaseRate = manualRate ?? baseRate;
      const tierBonusRate = Math.max(tierRate - 0.4, 0);

      const totalCommissionWritten = totalPremium * appliedBaseRate;
      const firstWeekCancels = totalCancelledPremium * appliedBaseRate;

      const autoBonus = manualRate === null ? totalPremium * tierBonusRate : 0;
      const spiffAmount = Number(spiffs[rep.id] || 0);
      const manualBonusAmount = Number(bonuses[rep.id] || 0);
      const advancesAmount = Number(advances[rep.id] || 0);

      const totalCommissionOwed =
        totalCommissionWritten -
        firstWeekCancels +
        autoBonus +
        spiffAmount +
        manualBonusAmount -
        advancesAmount;

      return {
        rep,
        repDeals,
        totalDeals,
        totalPremium,
        avgPremium,
        appliedBaseRate,
        tierRate,
        totalCommissionWritten,
        firstWeekCancels,
        autoBonus,
        totalCommissionOwed,
      };
    });
  }, [reps, deals, startDate, endDate, spiffs, bonuses, advances, manualRates]);

  if (loading) {
    return <div className="p-6 text-white">Loading payroll...</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-2xl bg-slate-950 p-6">
        <h1 className="text-3xl font-bold">Payroll</h1>
        <p className="mt-2 text-slate-400">
          Review rep production, mark active/cancelled deals, and calculate payroll.
        </p>
      </div>

      {errorText ? (
        <div className="rounded bg-red-900/40 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-950 p-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Start</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded bg-slate-800 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">End</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded bg-slate-800 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {payrollRows.map((row) => (
          <div key={row.rep.id} className="rounded-2xl bg-slate-950 p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{row.rep.name}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Deals: {row.totalDeals} | Total Premium: {currency(row.totalPremium)} | Avg Premium:{" "}
                  {currency(row.avgPremium)}
                </p>
              </div>

              <div className="w-full max-w-[220px]">
                <label className="mb-1 block text-sm text-slate-400">
                  Manual Override %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={overrideInputs[row.rep.id] ?? ""}
                  onChange={(e) => syncOverrideInput(row.rep.id, e.target.value)}
                  onBlur={() => commitManualRate(row.rep.id)}
                  placeholder={`${(row.appliedBaseRate * 100).toFixed(0)}`}
                  className="w-full rounded bg-slate-800 px-3 py-2"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 font-medium">Total Commission Written</td>
                    <td className="py-2 text-right">{currency(row.totalCommissionWritten)}</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 font-medium">1st Week Cancels</td>
                    <td className="py-2 text-right">{currency(row.firstWeekCancels)}</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 font-medium">Spiffs</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={spiffs[row.rep.id] ?? ""}
                        onChange={(e) =>
                          setSpiffs((prev) => ({ ...prev, [row.rep.id]: e.target.value }))
                        }
                        className="w-28 rounded bg-slate-800 px-2 py-1 text-right"
                      />
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 font-medium">Bonus</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-slate-400">
                          Auto: {currency(row.autoBonus)}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={bonuses[row.rep.id] ?? ""}
                          onChange={(e) =>
                            setBonuses((prev) => ({ ...prev, [row.rep.id]: e.target.value }))
                          }
                          className="w-28 rounded bg-slate-800 px-2 py-1 text-right"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 font-medium">Advances</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={advances[row.rep.id] ?? ""}
                        onChange={(e) =>
                          setAdvances((prev) => ({ ...prev, [row.rep.id]: e.target.value }))
                        }
                        className="w-28 rounded bg-slate-800 px-2 py-1 text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-lg font-semibold">Total Commission Owed</td>
                    <td className="py-2 text-right text-lg font-semibold">
                      {currency(row.totalCommissionOwed)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Applied Base Rate: {(row.appliedBaseRate * 100).toFixed(2)}% | Tier Rate:{" "}
                {(row.tierRate * 100).toFixed(2)}%
              </div>

              <button
                onClick={() =>
                  setExpandedRepId((prev) => (prev === row.rep.id ? null : row.rep.id))
                }
                className="rounded bg-slate-800 px-4 py-2 hover:bg-slate-700"
              >
                {expandedRepId === row.rep.id ? "Hide Deals" : "Show Deals"}
              </button>
            </div>

            {expandedRepId === row.rep.id ? (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="py-2">Member ID</th>
                      <th>Date Enrolled</th>
                      <th>Plan Type</th>
                      <th className="text-right">Health Premium</th>
                      <th className="text-right">Add On Premium</th>
                      <th className="text-right">Total Premium</th>
                      <th>Status</th>
                      <th>Lead Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.repDeals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          No deals for this rep in the selected range.
                        </td>
                      </tr>
                    ) : (
                      row.repDeals.map((deal) => {
                        const status = deal.status ?? "active";
                        const cancelled = status === "cancelled";

                        return (
                          <tr key={deal.id} className="border-b border-slate-900">
                            <td className="py-2">{deal.member_id || "—"}</td>
                            <td>{deal.deal_date}</td>
                            <td>{getPlanName(deal.plan_id)}</td>
                            <td className="text-right">{currency(Number(deal.limited_premium || 0))}</td>
                            <td className="text-right">{currency(Number(deal.addon_premium || 0))}</td>
                            <td className="text-right">{currency(Number(deal.total_premium || 0))}</td>
                            <td>
                              <select
                                value={status}
                                onChange={(e) => updateDealStatus(deal.id, e.target.value)}
                                className={`rounded px-2 py-1 ${
                                  cancelled
                                    ? "bg-red-900/40 text-red-300"
                                    : "bg-slate-800 text-white"
                                }`}
                              >
                                <option value="active">Active</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td>{getSourceName(deal.source_id)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}