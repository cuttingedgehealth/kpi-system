"use client";

import { useEffect, useState } from "react";
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

type Plan = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

type Rep = {
  id: string;
  name: string;
  active: boolean;
  display_order: number;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);

  const [newPlan, setNewPlan] = useState("");
  const [newRep, setNewRep] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"inbound" | "data">("inbound");
  const [newSourceCpl, setNewSourceCpl] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [openSourceMenuId, setOpenSourceMenuId] = useState<string | null>(null);
  const [openPlanMenuId, setOpenPlanMenuId] = useState<string | null>(null);
  const [openRepMenuId, setOpenRepMenuId] = useState<string | null>(null);

  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [plansExpanded, setPlansExpanded] = useState(false);
  const [repsExpanded, setRepsExpanded] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const { data: sourceData, error: sourceError } = await supabase
      .from("sources")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .order("display_order", { ascending: true });

    const { data: planData, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .order("display_order", { ascending: true });

    const { data: repData, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("office_id", OFFICE_ID)
      .order("display_order", { ascending: true });

    if (sourceError) setErrorText(`Source load error: ${sourceError.message}`);
    if (planError) setErrorText((prev) => prev || `Plan load error: ${planError.message}`);
    if (repError) setErrorText((prev) => prev || `Rep load error: ${repError.message}`);

    setSources((sourceData ?? []) as Source[]);
    setPlans((planData ?? []) as Plan[]);
    setReps((repData ?? []) as Rep[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateSource(id: string, updates: Partial<Source>) {
    const { error } = await supabase.from("sources").update(updates).eq("id", id);
    if (error) {
      setErrorText(`Update source error: ${error.message}`);
      return;
    }
    loadData();
  }

  async function addSource() {
    setErrorText("");
    if (!newSourceName.trim()) return;

    const { error } = await supabase.from("sources").insert({
      office_id: OFFICE_ID,
      name: newSourceName.trim(),
      type: newSourceType,
      base_cpl: Number(newSourceCpl || 0),
      active: true,
      display_order: sources.length + 1,
    });

    if (error) {
      setErrorText(`Add source error: ${error.message}`);
      return;
    }

    setNewSourceName("");
    setNewSourceType("inbound");
    setNewSourceCpl("");
    loadData();
  }

  async function deleteSource(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete source "${name}"?\n\nThis can remove related daily metric history. Making it inactive is usually safer.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from("sources").delete().eq("id", id);
    if (error) {
      setErrorText(`Delete source error: ${error.message}`);
      return;
    }

    setOpenSourceMenuId(null);
    loadData();
  }

  async function addPlan() {
    setErrorText("");
    if (!newPlan.trim()) return;

    const { error } = await supabase.from("plans").insert({
      office_id: OFFICE_ID,
      name: newPlan.trim(),
      active: true,
      display_order: plans.length + 1,
    });

    if (error) {
      setErrorText(`Add plan error: ${error.message}`);
      return;
    }

    setNewPlan("");
    loadData();
  }

  async function updatePlan(id: string, updates: Partial<Plan>) {
    const { error } = await supabase.from("plans").update(updates).eq("id", id);
    if (error) {
      setErrorText(`Update plan error: ${error.message}`);
      return;
    }
    loadData();
  }

  async function deletePlan(id: string, name: string) {
    const confirmed = window.confirm(`Delete plan "${name}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) {
      setErrorText(`Delete plan error: ${error.message}`);
      return;
    }

    setOpenPlanMenuId(null);
    loadData();
  }

  async function addRep() {
    setErrorText("");
    if (!newRep.trim()) return;

    const { error } = await supabase.from("reps").insert({
      office_id: OFFICE_ID,
      name: newRep.trim(),
      active: true,
      display_order: reps.length + 1,
    });

    if (error) {
      setErrorText(`Add rep error: ${error.message}`);
      return;
    }

    setNewRep("");
    loadData();
  }

  async function updateRep(id: string, updates: Partial<Rep>) {
    const { error } = await supabase.from("reps").update(updates).eq("id", id);
    if (error) {
      setErrorText(`Update rep error: ${error.message}`);
      return;
    }
    loadData();
  }

  async function deleteRep(id: string, name: string) {
    const confirmed = window.confirm(`Delete rep "${name}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("reps").delete().eq("id", id);
    if (error) {
      setErrorText(`Delete rep error: ${error.message}`);
      return;
    }

    setOpenRepMenuId(null);
    loadData();
  }

  if (loading) {
    return <div className="p-6 text-white">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_20%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            System Configuration
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Manage lead sources, plan names, and reps that feed the rest of the system.
          </p>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <CollapsibleSection
        title="Sources"
        expanded={sourcesExpanded}
        onToggle={() => setSourcesExpanded((prev) => !prev)}
      >
        <div className="mb-6 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <input
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="Add a new source"
            className="field-input"
          />

          <select
            value={newSourceType}
            onChange={(e) => setNewSourceType(e.target.value as "inbound" | "data")}
            className="field-input"
          >
            <option value="inbound">Inbound</option>
            <option value="data">Data</option>
          </select>

          <input
            type="number"
            step="0.01"
            value={newSourceCpl}
            onChange={(e) => setNewSourceCpl(e.target.value)}
            placeholder="Base CPL"
            className="field-input"
          />

          <button
            onClick={addSource}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Add Source
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[16px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-4 font-medium">Source</th>
                  <th className="px-4 py-4 font-medium">Type</th>
                  <th className="px-4 py-4 font-medium">Base CPL</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 text-right font-medium">Options</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source, index) => (
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
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Source
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-[15px] capitalize text-slate-100">
                      {source.type}
                    </td>
                    <td className="px-4 py-5">
                      <input
                        type="number"
                        step="0.01"
                        value={source.base_cpl}
                        onChange={(e) =>
                          updateSource(source.id, {
                            base_cpl: Number(e.target.value || 0),
                          })
                        }
                        className="w-28 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-[15px] text-white outline-none transition focus:border-slate-400"
                      />
                    </td>
                    <td className="px-4 py-5">
                      <StatusBadge active={source.active} />
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenSourceMenuId((prev) =>
                              prev === source.id ? null : source.id
                            )
                          }
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
                        >
                          Manage
                        </button>

                        {openSourceMenuId === source.id ? (
                          <div className="absolute right-0 z-10 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                            <button
                              onClick={() =>
                                updateSource(source.id, { active: !source.active })
                              }
                              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                            >
                              {source.active ? "Make Inactive" : "Make Active"}
                            </button>
                            <button
                              onClick={() => deleteSource(source.id, source.name)}
                              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-400 transition hover:bg-white/[0.05]"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No sources added yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Plans"
        expanded={plansExpanded}
        onToggle={() => setPlansExpanded((prev) => !prev)}
      >
        <div className="mb-5 flex gap-3">
          <input
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            placeholder="Add a new plan"
            className="field-input"
          />
          <button
            onClick={addPlan}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Add Plan
          </button>
        </div>

        <div className="space-y-3">
          {plans.map((plan, index) => (
            <ListRow
              key={plan.id}
              index={index + 1}
              name={plan.name}
              active={plan.active}
              menuOpen={openPlanMenuId === plan.id}
              onToggleMenu={() =>
                setOpenPlanMenuId((prev) => (prev === plan.id ? null : plan.id))
              }
              onToggleActive={() => updatePlan(plan.id, { active: !plan.active })}
              onDelete={() => deletePlan(plan.id, plan.name)}
            />
          ))}
          {plans.length === 0 ? <EmptyListState text="No plans added yet." /> : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Reps"
        expanded={repsExpanded}
        onToggle={() => setRepsExpanded((prev) => !prev)}
      >
        <div className="mb-5 flex gap-3">
          <input
            value={newRep}
            onChange={(e) => setNewRep(e.target.value)}
            placeholder="Add a rep"
            className="field-input"
          />
          <button
            onClick={addRep}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Add Rep
          </button>
        </div>

        <div className="space-y-3">
          {reps.map((rep, index) => (
            <ListRow
              key={rep.id}
              index={index + 1}
              name={rep.name}
              active={rep.active}
              menuOpen={openRepMenuId === rep.id}
              onToggleMenu={() =>
                setOpenRepMenuId((prev) => (prev === rep.id ? null : rep.id))
              }
              onToggleActive={() => updateRep(rep.id, { active: !rep.active })}
              onDelete={() => deleteRep(rep.id, rep.name)}
            />
          ))}
          {reps.length === 0 ? <EmptyListState text="No reps added yet." /> : null}
        </div>
      </CollapsibleSection>

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

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <button
          onClick={onToggle}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-slate-400"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ListRow({
  index,
  name,
  active,
  menuOpen,
  onToggleMenu,
  onToggleActive,
  onDelete,
}: {
  index: number;
  name: string;
  active: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300">
          {index}
        </div>
        <div>
          <div className="font-semibold text-[16px] text-white">{name}</div>
          <div className="mt-1">
            <StatusBadge active={active} />
          </div>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={onToggleMenu}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
        >
          Manage
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-10 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
            <button
              onClick={onToggleActive}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
            >
              {active ? "Make Inactive" : "Make Active"}
            </button>
            <button
              onClick={onDelete}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-400 transition hover:bg-white/[0.05]"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyListState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-slate-500">
      {text}
    </div>
  );
}