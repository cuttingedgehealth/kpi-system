"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("sources")
        .select("*");

      console.log("DATA:", data);
      console.log("ERROR:", error);
    }

    test();
  }, []);

  return <div className="p-10 text-white">Dashboard Connected</div>;
}