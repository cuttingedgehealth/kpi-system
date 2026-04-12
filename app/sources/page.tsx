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

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newPlan, setNewPlan] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

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

    if (sourceError) console.error("Source load error:", sourceError);
    if (planError) console.error("Plan load error:", planError);

    setSources((sourceData ?? []) as Source[]);
    setPlans((planData ?? []) as Plan[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateSource(id: string, updates: Partial<Source>) {
    const { error } = await supabase.from("sources").update(updates).eq("id", id);
    if (error) console.error("Update source error:", error);
    loadData();
  }

  async function addPlan() {
    if (!newPlan.trim()) return;

    const { error } = await supabase.from("plans").insert({
      office_id: OFFICE_ID,
      name: newPlan.trim(),
      active: true,
      display_order: plans.length + 1,
    });

    if (error) console.error("Add plan error:", error);

    setNewPlan("");
    loadData();
  }

  async function updatePlan(id: string, updates: Partial<Plan>) {
    const { error } = await supabase.from("plans").update(updates).eq("id", id);
    if (error) console.error("Update plan error:", error);
    loadData();
  }

  if (loading) {
    return <div className="p-6 text-white">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 text-white">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-slate-400 mt-1">Manage sources and plan names.</p>
      </div>

      <section className="rounded-xl bg-slate-950 p-6">
        <h2 className="text-xl font-semibold mb-4">Sources</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="py-2">Name</th>
                <th>Type</th>
                <th>Base CPL</th>
                <th>Active</th>
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
                  <td>
                    <input
                      type="checkbox"
                      checked={source.active}
                      onChange={(e) =>
                        updateSource(source.id, {
                          active: e.target.checked,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-slate-950 p-6">
        <h2 className="text-xl font-semibold mb-4">Plans</h2>

        <div className="flex gap-2 mb-4">
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
              <span>{plan.name}</span>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                Active
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(e) =>
                    updatePlan(plan.id, {
                      active: e.target.checked,
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}