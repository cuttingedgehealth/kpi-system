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
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-slate-400">Manage sources, plan names, and reps.</p>
      </div>

      {errorText ? (
        <div className="rounded bg-red-900/40 px-4 py-3 text-sm text-red-300">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-xl bg-slate-950 p-6">
        <h2 className="mb-4 text-xl font-semibold">Sources</h2>

        <div className="mb-6 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <input
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            placeholder="Add a new source"
            className="rounded bg-slate-800 px-3 py-2"
          />

          <select
            value={newSourceType}
            onChange={(e) => setNewSourceType(e.target.value as "inbound" | "data")}
            className="rounded bg-slate-800 px-3 py-2"
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
            className="rounded bg-slate-800 px-3 py-2"
          />

          <button
            onClick={addSource}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-500"
          >
            Add Source
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="py-2">Name</th>
                <th>Type</th>
                <th>Base CPL</th>
                <th>Status</th>
                <th className="text-right">Options</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b border-slate-900">
                  <td className="py-2">{source.name}</td>
                  <td>{source.type}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={source.base_cpl}
                      onChange={(e) =>
                        updateSource(source.id, {
                          base_cpl: Number(e.target.value || 0),
                        })
                      }
                      className="w-24 rounded bg-slate-800 px-2 py-1"
                    />
                  </td>
                  <td>{source.active ? "Active" : "Inactive"}</td>
                  <td className="text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setOpenSourceMenuId((prev) => (prev === source.id ? null : source.id))
                        }
                        className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
                      >
                        ☰
                      </button>

                      {openSourceMenuId === source.id ? (
                        <div className="absolute right-0 z-10 mt-2 w-40 rounded border border-slate-700 bg-slate-900 p-1 text-left shadow-xl">
                          <button
                            onClick={() => updateSource(source.id, { active: !source.active })}
                            className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800"
                          >
                            {source.active ? "Make Inactive" : "Make Active"}
                          </button>
                          <button
                            onClick={() => deleteSource(source.id, source.name)}
                            className="block w-full rounded px-3 py-2 text-left text-red-400 hover:bg-slate-800"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-slate-950 p-6">
        <h2 className="mb-4 text-xl font-semibold">Plans</h2>

        <div className="mb-4 flex gap-2">
          <input
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            placeholder="Add a new plan"
            className="w-full rounded bg-slate-800 px-3 py-2"
          />
          <button
            onClick={addPlan}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-500"
          >
            Add Plan
          </button>
        </div>

        <div className="space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded bg-slate-900 px-3 py-2"
            >
              <div>
                <span>{plan.name}</span>
                <span className="ml-3 text-sm text-slate-400">
                  {plan.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() =>
                    setOpenPlanMenuId((prev) => (prev === plan.id ? null : plan.id))
                  }
                  className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
                >
                  ☰
                </button>

                {openPlanMenuId === plan.id ? (
                  <div className="absolute right-0 z-10 mt-2 w-40 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl">
                    <button
                      onClick={() => updatePlan(plan.id, { active: !plan.active })}
                      className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800"
                    >
                      {plan.active ? "Make Inactive" : "Make Active"}
                    </button>
                    <button
                      onClick={() => deletePlan(plan.id, plan.name)}
                      className="block w-full rounded px-3 py-2 text-left text-red-400 hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-slate-950 p-6">
        <h2 className="mb-4 text-xl font-semibold">Reps</h2>

        <div className="mb-4 flex gap-2">
          <input
            value={newRep}
            onChange={(e) => setNewRep(e.target.value)}
            placeholder="Add a rep"
            className="w-full rounded bg-slate-800 px-3 py-2"
          />
          <button
            onClick={addRep}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-500"
          >
            Add Rep
          </button>
        </div>

        <div className="space-y-2">
          {reps.map((rep) => (
            <div
              key={rep.id}
              className="flex items-center justify-between rounded bg-slate-900 px-3 py-2"
            >
              <div>
                <span>{rep.name}</span>
                <span className="ml-3 text-sm text-slate-400">
                  {rep.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="relative">
                <button
                  onClick={() =>
                    setOpenRepMenuId((prev) => (prev === rep.id ? null : rep.id))
                  }
                  className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
                >
                  ☰
                </button>

                {openRepMenuId === rep.id ? (
                  <div className="absolute right-0 z-10 mt-2 w-40 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl">
                    <button
                      onClick={() => updateRep(rep.id, { active: !rep.active })}
                      className="block w-full rounded px-3 py-2 text-left hover:bg-slate-800"
                    >
                      {rep.active ? "Make Inactive" : "Make Active"}
                    </button>
                    <button
                      onClick={() => deleteRep(rep.id, rep.name)}
                      className="block w-full rounded px-3 py-2 text-left text-red-400 hover:bg-slate-800"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}