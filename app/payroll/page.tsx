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

type Plan = {
  id: string;
  name: string;
};

type Source = {
  id: string;
  name: string;
};

type PayrollEntry = {
  id: string;
  office_id: string;
  rep_id: string;
  period_start: string;
  period_end: string;
  override_percent: number | null;
  spiffs: number;
  bonus: number;
  advances: number;
  notes: string | null;
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

function inRange(dateStr: string | null, start: string, end: string) {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function PayrollPage() {
  const today = new Date();

  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [errorText, setErrorText] = useState("");

  const [startDate, setStartDate] = useState(formatDate(startOfWeek(today)));
  const [endDate, setEndDate] = useState(formatDate(endOfWeek(today)));

  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [spiffsInputs, setSpiffsInputs] = useState<Record<string, string>>({});
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({});
  const [advancesInputs, setAdvancesInputs] = useState<Record<string, string>>({});
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});

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

    const { data: payrollData, error: payrollError } = await supabase
      .from("payroll_entries")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .eq("period_start", startDate)
      .eq("period_end", endDate);

    if (repError) setErrorText(`Rep load error: ${repError.message}`);
    if (dealError) setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);
    if (planError) setErrorText((prev) => prev || `Plan load error: ${planError.message}`);
    if (sourceError) setErrorText((prev) => prev || `Source load error: ${sourceError.message}`);
    if (payrollError) setErrorText((prev) => prev || `Payroll load error: ${payrollError.message}`);

    const repList = (repData ?? []) as Rep[];
    const payrollList = (payrollData ?? []) as PayrollEntry[];

    setReps(repList);
    setDeals((dealData ?? []) as Deal[]);
    setPlans((planData ?? []) as Plan[]);
    setSources((sourceData ?? []) as Source[]);
    setPayrollEntries(payrollList);

    const overrideNext: Record<string, string> = {};
    const spiffsNext: Record<string, string> = {};
    const bonusNext: Record<string, string> = {};
    const advancesNext: Record<string, string> = {};
    const notesNext: Record<string, string> = {};

    for (const rep of repList) {
      const entry = payrollList.find((p) => p.rep_id === rep.id);
      overrideNext[rep.id] =
        entry?.override_percent != null ? String(entry.override_percent) : "";
      spiffsNext[rep.id] = entry ? String(entry.spiffs ?? 0) : "";
      bonusNext[rep.id] = entry ? String(entry.bonus ?? 0) : "";
      advancesNext[rep.id] = entry ? String(entry.advances ?? 0) : "";
      notesNext[rep.id] = entry?.notes ?? "";
    }

    setOverrideInputs(overrideNext);
    setSpiffsInputs(spiffsNext);
    setBonusInputs(bonusNext);
    setAdvancesInputs(advancesNext);
    setNotesInputs(notesNext);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  function getPlanName(planId: string | null) {
    if (!planId) return "—";
    return plans.find((p) => p.id === planId)?.name ?? "—";
  }

  function getSourceName(sourceId: string | null) {
    if (!sourceId) return "—";
    return sources.find((s) => s.id === sourceId)?.name ?? "—";
  }

  function getPayrollEntry(repId: string) {
    return payrollEntries.find((entry) => entry.rep_id === repId);
  }

  async function upsertPayrollEntry(repId: string, updates: Partial<PayrollEntry>) {
    setErrorText("");
    setSavingMap((prev) => ({ ...prev, [repId]: true }));

    const existing = getPayrollEntry(repId);

    const payload = {
      office_id: OFFICE_ID,
      rep_id: repId,
      period_start: startDate,
      period_end: endDate,
      override_percent: updates.override_percent ?? existing?.override_percent ?? null,
      spiffs: updates.spiffs ?? existing?.spiffs ?? 0,
      bonus: updates.bonus ?? existing?.bonus ?? 0,
      advances: updates.advances ?? existing?.advances ?? 0,
      notes: updates.notes ?? existing?.notes ?? "",
    };

    const query = existing
      ? supabase.from("payroll_entries").update(payload).eq("id", existing.id)
      : supabase.from("payroll_entries").insert(payload);

    const { error } = await query;

    if (error) {
      setErrorText(`Payroll save error: ${error.message}`);
      setSavingMap((prev) => ({ ...prev, [repId]: false }));
      return;
    }

    await loadData();
    setSavingMap((prev) => ({ ...prev, [repId]: false }));
  }

  async function updateDealStatus(dealId: string, nextStatus: string) {
    const updates: { status: string; payment_date?: string | null } = {
      status: nextStatus,
    };

    if (nextStatus === "cancelled") {
      updates.payment_date = null;
    }

    const { error } = await supabase.from("deals").update(updates).eq("id", dealId);

    if (error) {
      setErrorText(`Status update error: ${error.message}`);
      return;
    }

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, ...updates } : deal
      )
    );
  }

  async function markDealPaidToday(dealId: string) {
    const paidDate = todayString();

    const { error } = await supabase
      .from("deals")
      .update({
        payment_date: paidDate,
        status: "active",
      })
      .eq("id", dealId);

    if (error) {
      setErrorText(`Payment update error: ${error.message}`);
      return;
    }

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? { ...deal, payment_date: paidDate, status: "active" }
          : deal
      )
    );
  }

  function commitManualRate(repId: string) {
    const typedValue = (overrideInputs[repId] ?? "").trim();
    const currentSavedEntry = getPayrollEntry(repId);
    const currentSaved =
      currentSavedEntry?.override_percent != null
        ? String(currentSavedEntry.override_percent)
        : "";

    if (typedValue === currentSaved) return;

    if (typedValue === "") {
      const confirmed = window.confirm(
        "Clear the manual override and go back to the default/tier logic?"
      );
      if (!confirmed) {
        setOverrideInputs((prev) => ({ ...prev, [repId]: currentSaved }));
        return;
      }

      upsertPayrollEntry(repId, { override_percent: null });
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

    upsertPayrollEntry(repId, { override_percent: numericValue });
  }

  const payrollRows = useMemo(() => {
    return reps.map((rep) => {
      const repDeals = deals.filter(
        (deal) => deal.rep_id === rep.id && inRange(deal.payment_date, startDate, endDate)
      );

      const activeDeals = repDeals.filter(
        (deal) => (deal.status ?? "active") !== "cancelled"
      );

      const cancelledDeals = repDeals.filter(
        (deal) => (deal.status ?? "active") === "cancelled"
      );

      const unpaidDeals = deals.filter(
        (deal) =>
          deal.rep_id === rep.id &&
          !deal.payment_date &&
          (deal.status ?? "pending") !== "cancelled"
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

      const savedEntry = getPayrollEntry(rep.id);
      const savedOverride =
        savedEntry?.override_percent != null ? Number(savedEntry.override_percent) / 100 : null;

      const baseRate = 0.4;
      let tierRate = 0.4;

      if (avgPremium >= 375 && totalDeals >= 15) {
        tierRate = 0.5;
      } else if (avgPremium >= 325 && totalDeals >= 10) {
        tierRate = 0.45;
      }

      const appliedBaseRate = savedOverride ?? baseRate;
      const tierBonusRate = savedOverride == null ? Math.max(tierRate - 0.4, 0) : 0;

      const totalCommissionWritten = totalPremium * appliedBaseRate;
      const firstWeekCancels = totalCancelledPremium * appliedBaseRate;

      const autoBonus = totalPremium * tierBonusRate;
      const spiffAmount = Number(savedEntry?.spiffs ?? 0);
      const manualBonusAmount = Number(savedEntry?.bonus ?? 0);
      const advancesAmount = Number(savedEntry?.advances ?? 0);

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
        unpaidDeals,
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
  }, [reps, deals, payrollEntries, startDate, endDate]);

  if (loading) {
    return <div className="p-6 text-white">Loading payroll...</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-2xl bg-slate-950 p-6">
        <h1 className="text-3xl font-bold">Payroll</h1>
        <p className="mt-2 text-slate-400">
          Payroll is based on payment date, not sold date.
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
                  Paid Deals: {row.totalDeals} | Paid Premium: {currency(row.totalPremium)} | Avg Premium:{" "}
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
                  onChange={(e) =>
                    setOverrideInputs((prev) => ({
                      ...prev,
                      [row.rep.id]: e.target.value,
                    }))
                  }
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
                        value={spiffsInputs[row.rep.id] ?? ""}
                        onChange={(e) =>
                          setSpiffsInputs((prev) => ({
                            ...prev,
                            [row.rep.id]: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          upsertPayrollEntry(row.rep.id, {
                            spiffs: Number(spiffsInputs[row.rep.id] || 0),
                          })
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
                          value={bonusInputs[row.rep.id] ?? ""}
                          onChange={(e) =>
                            setBonusInputs((prev) => ({
                              ...prev,
                              [row.rep.id]: e.target.value,
                            }))
                          }
                          onBlur={() =>
                            upsertPayrollEntry(row.rep.id, {
                              bonus: Number(bonusInputs[row.rep.id] || 0),
                            })
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
                        value={advancesInputs[row.rep.id] ?? ""}
                        onChange={(e) =>
                          setAdvancesInputs((prev) => ({
                            ...prev,
                            [row.rep.id]: e.target.value,
                          }))
                        }
                        onBlur={() =>
                          upsertPayrollEntry(row.rep.id, {
                            advances: Number(advancesInputs[row.rep.id] || 0),
                          })
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

            <div className="mt-4">
              <label className="mb-1 block text-sm text-slate-400">Notes</label>
              <textarea
                value={notesInputs[row.rep.id] ?? ""}
                onChange={(e) =>
                  setNotesInputs((prev) => ({
                    ...prev,
                    [row.rep.id]: e.target.value,
                  }))
                }
                onBlur={() =>
                  upsertPayrollEntry(row.rep.id, {
                    notes: notesInputs[row.rep.id] ?? "",
                  })
                }
                className="min-h-[80px] w-full rounded bg-slate-800 px-3 py-2"
                placeholder="Optional payroll notes"
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Applied Base Rate: {(row.appliedBaseRate * 100).toFixed(2)}% | Tier Rate:{" "}
                {(row.tierRate * 100).toFixed(2)}%
                {savingMap[row.rep.id] ? " | Saving..." : ""}
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
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Paid In This Payroll Period</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-left">
                          <th className="py-2">Member ID</th>
                          <th>Sold Date</th>
                          <th>Paid Date</th>
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
                            <td colSpan={9} className="py-6 text-center text-slate-400">
                              No paid deals for this rep in the selected payroll period.
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
                                <td>{deal.payment_date || "—"}</td>
                                <td>{getPlanName(deal.plan_id)}</td>
                                <td className="text-right">
                                  {currency(Number(deal.limited_premium || 0))}
                                </td>
                                <td className="text-right">
                                  {currency(Number(deal.addon_premium || 0))}
                                </td>
                                <td className="text-right">
                                  {currency(Number(deal.total_premium || 0))}
                                </td>
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
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold">Unpaid / Post-Dated Deals</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-left">
                          <th className="py-2">Member ID</th>
                          <th>Sold Date</th>
                          <th>Plan Type</th>
                          <th className="text-right">Health Premium</th>
                          <th className="text-right">Add On Premium</th>
                          <th className="text-right">Total Premium</th>
                          <th>Status</th>
                          <th>Lead Source</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.unpaidDeals.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-400">
                              No unpaid deals for this rep.
                            </td>
                          </tr>
                        ) : (
                          row.unpaidDeals.map((deal) => (
                            <tr key={deal.id} className="border-b border-slate-900">
                              <td className="py-2">{deal.member_id || "—"}</td>
                              <td>{deal.deal_date}</td>
                              <td>{getPlanName(deal.plan_id)}</td>
                              <td className="text-right">
                                {currency(Number(deal.limited_premium || 0))}
                              </td>
                              <td className="text-right">
                                {currency(Number(deal.addon_premium || 0))}
                              </td>
                              <td className="text-right">
                                {currency(Number(deal.total_premium || 0))}
                              </td>
                              <td>{deal.status ?? "pending"}</td>
                              <td>{getSourceName(deal.source_id)}</td>
                              <td className="text-right">
                                <button
                                  onClick={() => markDealPaidToday(deal.id)}
                                  className="rounded bg-green-700 px-3 py-1 hover:bg-green-600"
                                >
                                  Mark Paid Today
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}