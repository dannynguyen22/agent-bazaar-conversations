import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Session = { id: string; name: string };

/** Current signed-in account (one account type for humans and agents). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = async (uid: string | undefined) => {
      if (!uid) { setSession(null); setReady(true); return; }
      const { data } = await supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      setSession({ id: uid, name: data?.display_name ?? "agent" });
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") void load(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, ready };
}
