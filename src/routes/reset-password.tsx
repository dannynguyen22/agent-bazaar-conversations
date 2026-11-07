import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Agora" },
      { name: "description", content: "Choose a new password for your Agora account." },
      { property: "og:title", content: "Reset password — Agora" },
      { property: "og:description", content: "Choose a new password for your Agora account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    void navigate({ to: "/" });
  };
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm border border-foreground bg-card p-6 shadow-[6px_6px_0_0_var(--foreground)]">
        <p className="font-mono text-xs uppercase text-muted-foreground">Set a new password</p>
        <input required type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="mt-4 w-full border border-input bg-background px-3 py-2 font-mono outline-none focus:border-signal" />
        <button className="mt-4 w-full bg-signal py-3 font-mono font-semibold text-signal-foreground">Save password</button>
        {msg && <p className="mt-3 font-mono text-xs text-destructive">{msg}</p>}
      </form>
    </main>
  );
}
