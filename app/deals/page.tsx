"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OFFICE_ID } from "@/lib/config";

type Rep = { id: string; name: string };
type Source = { id: string; name: string };
type Plan = { id: string; name: string };

type Deal = {
  id: string;
  deal_date: string;
  payment_date: string | null;
  recovered_date: string | null;
  payroll_paid: boolean;
  rep_id: string | null;
  member_id: string | null;
  phone_number: string | null;
  status: string | null;
  source_id: string | null;
  plan_id: string | null;
  limited_premium: number;
  addon_premium: number;
  total_premium: number;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function currency(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(todayString());
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: dealData, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .gte("deal_date", startDate)
      .lte("deal_date", endDate)
      .order("deal_date", { ascending: false });

    const { data: repData } = await supabase
      .from("reps")
      .select("id,name")
      .eq("office_id", OFFICE_ID)
      .order("display_order", { ascending: true });

    const { data: sourceData } = await supabase
      .from("sources")
      .select("id,name")
      .eq("office_id", OFFICE_ID)
      .order("name", { ascending: true });

    const { data: planData } = await supabase
      .from("plans")
      .select("id,name")
      .eq("office_id", OFFICE_ID)
      .order("display_order", { ascending: true });

    if (dealError) setErrorText(`Deal load error: ${dealError.message}`);

    setDeals((dealData ?? []) as Deal[]);
    setReps((repData ?? []) as Rep[]);
    setSources((sourceData ?? []) as Source[]);
    setPlans((planData ?? []) as Plan[]);
    setLoading(false);
  }

 useEffect(() => {
  loadData();
}, []);

  function updateLocalDeal(id: string, updates: Partial<Deal>) {
    setDeals((prev) =>
      prev.map((deal) => (deal.id === id ? { ...deal, ...updates } : deal))
    );
  }

  function getCurrentDeal(id: string, overrides: Partial<Deal> = {}) {
    const existing = deals.find((deal) => deal.id === id);
    if (!existing) return null;
    return { ...existing, ...overrides };
  }

  async function saveDeal(deal: Deal) {
    setErrorText("");
    setSavingIds((prev) => ({ ...prev, [deal.id]: true }));
    setSavedIds((prev) => ({ ...prev, [deal.id]: false }));

    const limited = Number(deal.limited_premium || 0);
    const addon = Number(deal.addon_premium || 0);
    const total = limited + addon;

    const { error } = await supabase
      .from("deals")
      .update({
        deal_date: deal.deal_date,
        payment_date: deal.payment_date || null,
        recovered_date: deal.recovered_date || null,
        payroll_paid: deal.payroll_paid ?? false,
        rep_id: deal.rep_id || null,
        member_id: deal.member_id?.trim() || null,
        phone_number: deal.phone_number?.trim() || null,
        source_id: deal.source_id || null,
        plan_id: deal.plan_id || null,
        limited_premium: limited,
        addon_premium: addon,
        total_premium: total,
        status: deal.status || "active",
      })
      .eq("id", deal.id);

    setSavingIds((prev) => ({ ...prev, [deal.id]: false }));

    if (error) {
      setErrorText(`Save deal error: ${error.message}`);
      return;
    }

    updateLocalDeal(deal.id, { total_premium: total });
    setSavedIds((prev) => ({ ...prev, [deal.id]: true }));

    window.setTimeout(() => {
      setSavedIds((prev) => ({ ...prev, [deal.id]: false }));
    }, 1200);
  }

  async function updateAndSave(id: string, updates: Partial<Deal>) {
    updateLocalDeal(id, updates);
    const nextDeal = getCurrentDeal(id, updates);
    if (nextDeal) await saveDeal(nextDeal);
  }

  async function saveCurrent(id: string) {
    const current = getCurrentDeal(id);
    if (current) await saveDeal(current);
  }

  const filteredDeals = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return deals;

    return deals.filter((deal) => {
      return (
        (deal.member_id ?? "").toLowerCase().includes(q) ||
        (deal.phone_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [deals, search]);

  if (loading) return <div className="p-6 text-white">Loading deals...</div>;

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Deal Management
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Deals
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Edit existing deals. Text fields auto-save when you click away. Dropdowns save immediately.
          </p>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
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

          <label>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Search
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Member ID or phone"
              className="field-input"
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={loadData}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-[14px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-[0.14em] text-slate-400">
                  <th className="px-3 py-4">Sold</th>
                  <th className="px-3 py-4">Paid</th>
                  <th className="px-3 py-4">Member ID</th>
                  <th className="px-3 py-4">Phone</th>
                  <th className="px-3 py-4">Rep</th>
                  <th className="px-3 py-4">Source</th>
                  <th className="px-3 py-4">Plan</th>
                  <th className="px-3 py-4">Limited</th>
                  <th className="px-3 py-4">Add-On</th>
                  <th className="px-3 py-4">Total</th>
                  <th className="px-3 py-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredDeals.map((deal) => {
                  const total =
                    Number(deal.limited_premium || 0) +
                    Number(deal.addon_premium || 0);

                  return (
                    <tr
                      key={deal.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="date"
                          value={deal.deal_date}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, { deal_date: e.target.value })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-28"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="date"
                          value={deal.payment_date ?? ""}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, {
                              payment_date: e.target.value || null,
                            })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-28"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          value={deal.member_id ?? ""}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, { member_id: e.target.value })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-28"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          value={deal.phone_number ?? ""}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, { phone_number: e.target.value })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-28"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={deal.rep_id ?? ""}
                          onChange={(e) =>
                            updateAndSave(deal.id, { rep_id: e.target.value || null })
                          }
                          className="table-input w-28"
                        >
                          <option value="">No rep</option>
                          {reps.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={deal.source_id ?? ""}
                          onChange={(e) =>
                            updateAndSave(deal.id, { source_id: e.target.value || null })
                          }
                          className="table-input w-32"
                        >
                          <option value="">No source</option>
                          {sources.map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={deal.plan_id ?? ""}
                          onChange={(e) =>
                            updateAndSave(deal.id, { plan_id: e.target.value || null })
                          }
                          className="table-input w-32"
                        >
                          <option value="">No plan</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={deal.limited_premium ?? 0}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, {
                              limited_premium: Number(e.target.value || 0),
                            })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-20"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={deal.addon_premium ?? 0}
                          onChange={(e) =>
                            updateLocalDeal(deal.id, {
                              addon_premium: Number(e.target.value || 0),
                            })
                          }
                          onBlur={() => saveCurrent(deal.id)}
                          className="table-input w-20"
                        />
                      </td>

                      <td className="px-3 py-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{currency(total)}</span>
                          {savingIds[deal.id] ? (
                            <span className="text-xs text-slate-400">...</span>
                          ) : null}
                          {savedIds[deal.id] ? (
                            <span className="text-xs text-emerald-400">✓</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={deal.recovered_date ? "recovered" : deal.status ?? "active"}
                          onChange={(e) => {
                            const nextStatus = e.target.value;

                            if (nextStatus === "recovered") {
                              updateAndSave(deal.id, {
                                status: "cancelled",
                                recovered_date: todayString(),
                                payroll_paid: false,
                              });
                              return;
                            }

                            updateAndSave(deal.id, {
                              status: nextStatus,
                              recovered_date: null,
                            });
                          }}
                          className="table-input w-28"
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="recovered">Recovered</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}

                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                      No deals found.
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
        }

        .table-input {
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgb(15 23 42);
          padding: 0.5rem 0.55rem;
          font-size: 13px;
          color: white;
          outline: none;
        }

        .field-input:focus,
        .table-input:focus {
          border-color: rgba(148, 163, 184, 0.9);
        }
      `}</style>
    </div>
  );
}