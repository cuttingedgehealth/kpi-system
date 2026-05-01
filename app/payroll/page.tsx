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

  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>(
    {}
  );
  const [spiffsInputs, setSpiffsInputs] = useState<Record<string, string>>({});
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({});
  const [advancesInputs, setAdvancesInputs] = useState<Record<string, string>>(
    {}
  );
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

    if (repError)
      setErrorText(`Rep load error: ${repError.message}`);
    if (dealError)
      setErrorText((prev) => prev || `Deal load error: ${dealError.message}`);
    if (planError)
      setErrorText((prev) => prev || `Plan load error: ${planError.message}`);
    if (sourceError)
      setErrorText(
        (prev) => prev || `Source load error: ${sourceError.message}`
      );
    if (payrollError)
      setErrorText(
        (prev) => prev || `Payroll load error: ${payrollError.message}`
      );

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

  async function upsertPayrollEntry(
    repId: string,
    updates: Partial<PayrollEntry>
  ) {
    setErrorText("");
    setSavingMap((prev) => ({ ...prev, [repId]: true }));

    const existing = getPayrollEntry(repId);

    const payload = {
      office_id: OFFICE_ID,
      rep_id: repId,
      period_start: startDate,
      period_end: endDate,
      override_percent:
        updates.override_percent ?? existing?.override_percent ?? null,
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
  const updates = {
    status: nextStatus,
  };

  const { error } = await supabase
    .from("deals")
    .update(updates)
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
        (deal) =>
          deal.rep_id === rep.id && inRange(deal.payment_date, startDate, endDate)
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

     const totalDeals = repDeals.length;

const totalPremium = repDeals.reduce(
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
        savedEntry?.override_percent != null
          ? Number(savedEntry.override_percent) / 100
          : null;

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

  const totals = useMemo(() => {
    return payrollRows.reduce(
      (acc, row) => {
        acc.totalPremium += row.totalPremium;
        acc.totalDeals += row.totalDeals;
        acc.totalOwed += row.totalCommissionOwed;
        acc.totalCancels += row.firstWeekCancels;
        return acc;
      },
      {
        totalPremium: 0,
        totalDeals: 0,
        totalOwed: 0,
        totalCancels: 0,
      }
    );
  }, [payrollRows]);

  if (loading) {
    return <div className="p-6 text-white">Loading payroll...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Cash-Based Payout Review
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Payroll
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Payroll is tied to cleared payment dates, not sold dates. Review paid deals,
              mark post-dates when they clear, and finalize rep payout adjustments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroMetric label="Paid Deals" value={String(totals.totalDeals)} />
            <HeroMetric label="Paid Premium" value={currency(totals.totalPremium)} />
            <HeroMetric label="1st Week Cancels" value={currency(totals.totalCancels)} />
            <HeroMetric label="Commission Owed" value={currency(totals.totalOwed)} />
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Payroll Period</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use Monday–Sunday weekly periods unless you intentionally need a custom range.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateField label="Start" value={startDate} onChange={setStartDate} />
            <DateField label="End" value={endDate} onChange={setEndDate} />
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {payrollRows.map((row) => (
          <section
            key={row.rep.id}
            className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl"
          >
            <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Rep Summary
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {row.rep.name}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Paid Deals: {row.totalDeals} | Paid Premium: {currency(row.totalPremium)} |
                  Avg Premium: {currency(row.avgPremium)}
                </p>
              </div>

              <div className="w-full max-w-[240px]">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Manual Override %
                </div>
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-[15px] text-white outline-none transition focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiTile
                label="Total Commission Written"
                value={currency(row.totalCommissionWritten)}
              />
              <KpiTile
                label="1st Week Cancels"
                value={currency(row.firstWeekCancels)}
                danger={row.firstWeekCancels > 0}
              />
              <KpiTile
                label="Applied Base Rate"
                value={`${(row.appliedBaseRate * 100).toFixed(2)}%`}
              />
              <KpiTile
                label="Tier Rate"
                value={`${(row.tierRate * 100).toFixed(2)}%`}
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FieldCard label="Spiffs">
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
                  className="field-input"
                />
              </FieldCard>

              <FieldCard label={`Bonus (Auto: ${currency(row.autoBonus)})`}>
                <div className="space-y-2">
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
                    className="field-input"
                  />
                </div>
              </FieldCard>

              <FieldCard label="Advances">
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
                  className="field-input"
                />
              </FieldCard>

              <KpiTile
                label="Total Commission Owed"
                value={currency(row.totalCommissionOwed)}
                strong
              />
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                Notes
              </div>
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
                className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-[15px] text-white outline-none transition focus:border-slate-400"
                placeholder="Optional payroll notes"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-400">
                {savingMap[row.rep.id]
                  ? "Saving changes..."
                  : "Adjustments persist for this payroll period."}
              </div>

              <button
                onClick={() =>
                  setExpandedRepId((prev) => (prev === row.rep.id ? null : row.rep.id))
                }
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06]"
              >
                {expandedRepId === row.rep.id ? "Hide Deals" : "Show Deals"}
              </button>
            </div>

            {expandedRepId === row.rep.id ? (
              <div className="mt-8 space-y-8">
                <DealTableSection
                  title="Paid In This Payroll Period"
                  subtitle="These deals are included in this payroll calculation."
                  emptyText="No paid deals for this rep in the selected payroll period."
                  columns={9}
                >
                  {row.repDeals.length === 0 ? (
                    <EmptyRow colSpan={9} text="No paid deals for this rep in the selected payroll period." />
                  ) : (
                    row.repDeals.map((deal) => {
                      const status = deal.status ?? "active";
                      const cancelled = status === "cancelled";

                      return (
                        <tr
                          key={deal.id}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-5 text-[15px] text-slate-100">
                            {deal.member_id || "—"}
                          </td>
                          <td className="px-4 py-5 text-[15px] text-slate-100">
                            {deal.deal_date}
                          </td>
                          <td className="px-4 py-5 text-[15px] text-slate-100">
                            {deal.payment_date || "—"}
                          </td>
                          <td className="px-4 py-5 text-[15px] font-medium text-white">
                            {getPlanName(deal.plan_id)}
                          </td>
                          <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                            {currency(Number(deal.limited_premium || 0))}
                          </td>
                          <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                            {currency(Number(deal.addon_premium || 0))}
                          </td>
                          <td className="px-4 py-5 text-right text-[15px] font-medium text-white">
                            {currency(Number(deal.total_premium || 0))}
                          </td>
                          <td className="px-4 py-5">
                            <select
                              value={status}
                              onChange={(e) => updateDealStatus(deal.id, e.target.value)}
                              className={`w-full rounded-2xl border px-3 py-2 text-[15px] outline-none transition ${
                                cancelled
                                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                                  : "border-white/10 bg-slate-900 text-white focus:border-slate-400"
                              }`}
                            >
                              <option value="active">Active</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-4 py-5 text-[15px] text-slate-100">
                            {getSourceName(deal.source_id)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </DealTableSection>

                <DealTableSection
                  title="Unpaid / Post-Dated Deals"
                  subtitle="These deals are not in payroll yet because payment has not cleared."
                  emptyText="No unpaid deals for this rep."
                  columns={9}
                >
                  {row.unpaidDeals.length === 0 ? (
                    <EmptyRow colSpan={9} text="No unpaid deals for this rep." />
                  ) : (
                    row.unpaidDeals.map((deal) => (
                      <tr
                        key={deal.id}
                        className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-5 text-[15px] text-slate-100">
                          {deal.member_id || "—"}
                        </td>
                        <td className="px-4 py-5 text-[15px] text-slate-100">
                          {deal.deal_date}
                        </td>
                        <td className="px-4 py-5 text-[15px] font-medium text-white">
                          {getPlanName(deal.plan_id)}
                        </td>
                        <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                          {currency(Number(deal.limited_premium || 0))}
                        </td>
                        <td className="px-4 py-5 text-right text-[15px] text-slate-100">
                          {currency(Number(deal.addon_premium || 0))}
                        </td>
                        <td className="px-4 py-5 text-right text-[15px] font-medium text-white">
                          {currency(Number(deal.total_premium || 0))}
                        </td>
                        <td className="px-4 py-5 text-[15px] text-slate-300">
                          {deal.status ?? "pending"}
                        </td>
                        <td className="px-4 py-5 text-[15px] text-slate-100">
                          {getSourceName(deal.source_id)}
                        </td>
                        <td className="px-4 py-5 text-right">
                          <button
                            onClick={() => markDealPaidToday(deal.id)}
                            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                          >
                            Mark Paid Today
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </DealTableSection>
              </div>
            ) : null}
          </section>
        ))}
      </div>

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
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
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

function FieldCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function DealTableSection({
  title,
  subtitle,
  emptyText,
  columns,
  children,
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  columns: number;
  children: React.ReactNode;
}) {
  const isUnpaid = title.toLowerCase().includes("unpaid");

  return (
    <div>
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[16px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                <th className="px-4 py-4 font-medium">Member ID</th>
                <th className="px-4 py-4 font-medium">
                  {isUnpaid ? "Sold Date" : "Sold Date"}
                </th>
                {!isUnpaid ? (
                  <th className="px-4 py-4 font-medium">Paid Date</th>
                ) : null}
                <th className="px-4 py-4 font-medium">Plan Type</th>
                <th className="px-4 py-4 text-right font-medium">Health Premium</th>
                <th className="px-4 py-4 text-right font-medium">Add On Premium</th>
                <th className="px-4 py-4 text-right font-medium">Total Premium</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">
                  {isUnpaid ? "Lead Source" : "Lead Source"}
                </th>
                {isUnpaid ? (
                  <th className="px-4 py-4 text-right font-medium">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
        {text}
      </td>
    </tr>
  );
}