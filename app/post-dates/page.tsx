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
  scheduled_payment_date: string | null;
  remaining_payment_date: string | null;
  balance_paid_date: string | null;
  rep_id: string | null;
  member_id: string | null;
  phone_number: string | null;
  status: string | null;
  source_id: string | null;
  plan_id: string | null;
  limited_premium: number;
  addon_premium: number;
  total_premium: number;
  collected_premium: number | null;
  remaining_balance: number | null;
  last_payment_amount: number | null;
  is_partial: boolean | null;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function currency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function displayDate(value: string | null) {
  if (!value) return "—";
  return value;
}

function getTotal(deal: Deal) {
  const total = Number(deal.total_premium || 0);
  if (total > 0) return total;
  return Number(deal.limited_premium || 0) + Number(deal.addon_premium || 0);
}

function getCollected(deal: Deal) {
  return Number(deal.collected_premium || 0);
}

function getRemaining(deal: Deal) {
  const savedRemaining = Number(deal.remaining_balance || 0);
  if (savedRemaining > 0) return savedRemaining;
  return Math.max(getTotal(deal) - getCollected(deal), 0);
}

export default function PostDatesPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const [
      { data: dealData, error: dealError },
      { data: repData, error: repError },
      { data: sourceData, error: sourceError },
      { data: planData, error: planError },
    ] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .eq("office_id", OFFICE_ID)
        .order("deal_date", { ascending: false }),
      supabase
        .from("reps")
        .select("id,name")
        .eq("office_id", OFFICE_ID)
        .order("display_order", { ascending: true }),
      supabase
        .from("sources")
        .select("id,name")
        .eq("office_id", OFFICE_ID)
        .order("name", { ascending: true }),
      supabase
        .from("plans")
        .select("id,name")
        .eq("office_id", OFFICE_ID)
        .order("display_order", { ascending: true }),
    ]);

    if (dealError || repError || sourceError || planError) {
      setErrorText(
        dealError?.message ||
          repError?.message ||
          sourceError?.message ||
          planError?.message ||
          "Post date tracker load error",
      );
      setLoading(false);
      return;
    }

    setDeals((dealData ?? []) as Deal[]);
    setReps((repData ?? []) as Rep[]);
    setSources((sourceData ?? []) as Source[]);
    setPlans((planData ?? []) as Plan[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const repName = (id: string | null) => reps.find((rep) => rep.id === id)?.name ?? "—";
  const sourceName = (id: string | null) => sources.find((source) => source.id === id)?.name ?? "—";
  const planName = (id: string | null) => plans.find((plan) => plan.id === id)?.name ?? "—";

  function matchesSearch(deal: Deal) {
    const q = search.toLowerCase().trim();
    if (!q) return true;

    return (
      (deal.member_id ?? "").toLowerCase().includes(q) ||
      (deal.phone_number ?? "").toLowerCase().includes(q) ||
      repName(deal.rep_id).toLowerCase().includes(q) ||
      sourceName(deal.source_id).toLowerCase().includes(q)
    );
  }

  function isPostDated(deal: Deal) {
    return deal.status === "pending" && Boolean(deal.scheduled_payment_date);
  }

  function isPartialPay(deal: Deal) {
    return (
      deal.status === "partial_pay" &&
      deal.is_partial === true &&
      Number(deal.remaining_balance || 0) > 0
    );
  }

  const postDatedDeals = useMemo(() => {
    return deals
      .filter((deal) => isPostDated(deal) && matchesSearch(deal))
      .sort((a, b) =>
        (a.scheduled_payment_date ?? "9999-12-31").localeCompare(
          b.scheduled_payment_date ?? "9999-12-31",
        ),
      );
  }, [deals, search, reps, sources]);

  const partialPayDeals = useMemo(() => {
    return deals
      .filter((deal) => isPartialPay(deal) && matchesSearch(deal))
      .sort((a, b) =>
        (a.remaining_payment_date ?? "9999-12-31").localeCompare(
          b.remaining_payment_date ?? "9999-12-31",
        ),
      );
  }, [deals, search, reps, sources]);

  async function markPostDatePaid(deal: Deal) {
    const total = getTotal(deal);
    const paidDate = todayString();

    const ok = window.confirm(
      `Mark this post-dated deal active?\n\nMember ID: ${deal.member_id ?? "—"}\nPremium: ${currency(total)}`,
    );

    if (!ok) return;

    setSavingIds((prev) => ({ ...prev, [deal.id]: true }));

    const { error } = await supabase
      .from("deals")
      .update({
        status: "active",
        payment_date: paidDate,
        scheduled_payment_date: null,
        collected_premium: total,
        remaining_balance: 0,
        last_payment_amount: 0,
        balance_paid_date: null,
        is_partial: false,
      })
      .eq("id", deal.id);

    setSavingIds((prev) => ({ ...prev, [deal.id]: false }));

    if (error) {
      setErrorText(`Mark active error: ${error.message}`);
      return;
    }

    await loadData();
  }

  async function collectPartialBalance(deal: Deal) {
    const total = getTotal(deal);
    const remaining = getRemaining(deal);
    const paidDate = todayString();

    if (remaining <= 0) {
      setErrorText("This partial pay does not have a remaining balance.");
      return;
    }

    const ok = window.confirm(
      `Collect remaining balance and mark active?\n\nMember ID: ${deal.member_id ?? "—"}\nRemaining: ${currency(remaining)}`,
    );

    if (!ok) return;

    setSavingIds((prev) => ({ ...prev, [deal.id]: true }));

    const { error } = await supabase
      .from("deals")
      .update({
        status: "active",
        payment_date: deal.payment_date || paidDate,
        collected_premium: total,
        remaining_balance: 0,
        last_payment_amount: remaining,
        balance_paid_date: paidDate,
        remaining_payment_date: null,
        is_partial: false,
      })
      .eq("id", deal.id);

    setSavingIds((prev) => ({ ...prev, [deal.id]: false }));

    if (error) {
      setErrorText(`Collect balance error: ${error.message}`);
      return;
    }

    await loadData();
  }

  async function cancelDeal(deal: Deal) {
    const ok = window.confirm(`Mark ${deal.member_id ?? "this deal"} cancelled?`);
    if (!ok) return;

    setSavingIds((prev) => ({ ...prev, [deal.id]: true }));

    const { error } = await supabase
      .from("deals")
      .update({
        status: "cancelled",
        scheduled_payment_date: null,
        remaining_payment_date: null,
        is_partial: false,
      })
      .eq("id", deal.id);

    setSavingIds((prev) => ({ ...prev, [deal.id]: false }));

    if (error) {
      setErrorText(`Cancel error: ${error.message}`);
      return;
    }

    await loadData();
  }

  if (loading) {
    return <div className="p-6 text-white">Loading post date tracker...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Cash Collection Tracker
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Post Dates
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Track pending post-dated charges and partial-pay balances. Cancelled and active deals are excluded.
            </p>
          </div>

          <div className="w-full max-w-md">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Search
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Member ID, phone, rep, or source"
              className="field-input"
            />
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <SummaryCards
        postDateCount={postDatedDeals.length}
        postDateAmount={postDatedDeals.reduce((sum, deal) => sum + getTotal(deal), 0)}
        partialCount={partialPayDeals.length}
        partialAmount={partialPayDeals.reduce((sum, deal) => sum + getRemaining(deal), 0)}
      />

      <DealTable
        title="Post-Dated Deals"
        subtitle="No money has been collected yet. These only appear when status is pending and a scheduled payment date exists."
        runDateLabel="Scheduled Run Date"
        emptyText="No true post-dated deals found."
        deals={postDatedDeals}
        reps={reps}
        sources={sources}
        plans={plans}
        savingIds={savingIds}
        dateGetter={(deal) => deal.scheduled_payment_date}
        primaryActionLabel="Mark Active"
        onPrimaryAction={markPostDatePaid}
        onCancel={cancelDeal}
      />

      <DealTable
        title="Partial Pays"
        subtitle="Money was collected, but a balance remains. These only appear when status is partial_pay, is_partial is true, and remaining balance is above $0."
        runDateLabel="Remaining Run Date"
        emptyText="No true partial-pay balances found."
        deals={partialPayDeals}
        reps={reps}
        sources={sources}
        plans={plans}
        savingIds={savingIds}
        dateGetter={(deal) => deal.remaining_payment_date}
        primaryActionLabel="Collect Balance"
        onPrimaryAction={collectPartialBalance}
        onCancel={cancelDeal}
      />

      <style jsx global>{`
        .field-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgb(15 23 42);
          padding: 0.75rem 0.9rem;
          font-size: 14px;
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

function SummaryCards({
  postDateCount,
  postDateAmount,
  partialCount,
  partialAmount,
}: {
  postDateCount: number;
  postDateAmount: number;
  partialCount: number;
  partialAmount: number;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card label="Post Dates" value={String(postDateCount)} />
      <Card label="Post-Date Premium" value={currency(postDateAmount)} />
      <Card label="Partial Pays" value={String(partialCount)} />
      <Card label="Partial Balance" value={currency(partialAmount)} />
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

function DealTable({
  title,
  subtitle,
  runDateLabel,
  emptyText,
  deals,
  reps,
  sources,
  plans,
  savingIds,
  dateGetter,
  primaryActionLabel,
  onPrimaryAction,
  onCancel,
}: {
  title: string;
  subtitle: string;
  runDateLabel: string;
  emptyText: string;
  deals: Deal[];
  reps: Rep[];
  sources: Source[];
  plans: Plan[];
  savingIds: Record<string, boolean>;
  dateGetter: (deal: Deal) => string | null;
  primaryActionLabel: string;
  onPrimaryAction: (deal: Deal) => Promise<void>;
  onCancel: (deal: Deal) => Promise<void>;
}) {
  const repName = (id: string | null) => reps.find((rep) => rep.id === id)?.name ?? "—";
  const sourceName = (id: string | null) => sources.find((source) => source.id === id)?.name ?? "—";
  const planName = (id: string | null) => plans.find((plan) => plan.id === id)?.name ?? "—";

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-xl">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {deals.length} open
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-[14px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-3 py-3">{runDateLabel}</th>
                <th className="px-3 py-3">Sold</th>
                <th className="px-3 py-3">Member ID</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Rep</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Collected</th>
                <th className="px-3 py-3">Remaining</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {deals.map((deal) => {
                const saving = Boolean(savingIds[deal.id]);

                return (
                  <tr
                    key={deal.id}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-3 font-medium text-white">
                      {displayDate(dateGetter(deal))}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{displayDate(deal.deal_date)}</td>
                    <td className="px-3 py-3 text-slate-100">{deal.member_id ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-300">{deal.phone_number ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-300">{repName(deal.rep_id)}</td>
                    <td className="px-3 py-3 text-slate-300">{sourceName(deal.source_id)}</td>
                    <td className="px-3 py-3 text-slate-300">{planName(deal.plan_id)}</td>
                    <td className="px-3 py-3 font-semibold text-white">{currency(getTotal(deal))}</td>
                    <td className="px-3 py-3 text-emerald-300">{currency(getCollected(deal))}</td>
                    <td className="px-3 py-3 text-amber-300">{currency(getRemaining(deal))}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onPrimaryAction(deal)}
                          disabled={saving}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : primaryActionLabel}
                        </button>
                        <button
                          onClick={() => onCancel(deal)}
                          disabled={saving}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {deals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    {emptyText}
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
