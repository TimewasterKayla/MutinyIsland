"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminCavePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/map");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data?.is_admin) {
        router.replace("/map");
        return;
      }

      setIsAdmin(true);
      setChecking(false);
    }

    checkAdmin();
  }, [router]);

  if (checking || !isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-10">
      <h1 className="text-4xl font-bold mb-4">Admin Cave</h1>
      <p className="text-zinc-400">
        Placeholder page. Admin tools and controls go here.
      </p>
    </main>
  );
}