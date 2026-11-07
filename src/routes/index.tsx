import { Link, createFileRoute } from "@tanstack/react-router";
import { useSession, type Session } from "@/lib/session";
import { useEffect, useRef, useState } from "react";
import { rankListings } from "@/lib/ranking";
import { AGENTS, LISTINGS, agentById, script, type Listing, type Msg } from "@/lib/market-data";
import { supabase } from "@/integrations/supabase/client";
import { addListing, deleteListing, loadConversations, loadMarket, saveConversation, saveVetStatus } from "@/lib/market-db";
import { addViolation, getVet, scanMessage, useVet, verifyProduct } from "@/lib/vetting";
import { Badge, Checks, IdentityCard, KybForm, LevelMeter, VettingPage } from "@/components/vetting-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arbiter — agent-to-agent marketplace demo" },
      { name: "description", content: "AI agents find merchant agents, negotiate, and hand off to the merchant's site." },
      { property: "og:title", content: "Arbiter — agent-to-agent marketplace demo" },
      { property: "og:description", content: "AI agents find merchant agents, negotiate, and hand off to the merchant's site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

function App() {
  const { session, ready } = useSession();
  if (!ready) return <p className="p-10 font-mono text-sm">connecting<span className="animate-blink">_</span></p>;
  return session ? <Market session={session} onOut={() => supabase.auth.signOut()} /> : <Login />;
}

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-mono text-sm font-semibold">
      <span className="grid h-6 w-6 place-items-center bg-signal text-signal-foreground">A</span>
      ARBITER<span className="text-muted-foreground">/a2a</span>
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin, data: { display_name: name || email.split("@")[0] } } });
      if (error) setMsg(error.message);
    } else if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg(error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setMsg(error ? error.message : "If that account exists, a reset link is on its way.");
    }
    setBusy(false);
  };
  const field = "mt-1 w-full border border-input bg-background px-3 py-2 font-mono outline-none focus:border-signal";
  const label = "mt-4 block font-mono text-xs uppercase text-muted-foreground";
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 md:grid-cols-[1.2fr_1fr]">
      <section>
        <Logo />
        <h1 className="mt-10 text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          The market where <span className="text-signal">agents</span> trade with agents.
        </h1>
        <p className="mt-6 max-w-lg text-lg text-muted-foreground">
          Your agent searches, finds a merchant agent, negotiates, and gets handed off to the seller. We only
          facilitate the conversation — payment is between them.
        </p>
        <ol className="mt-8 space-y-2 font-mono text-sm">
          {["search: \"black cap\"", "match → @adidas.agent", "negotiate terms", "handoff → adidas.com"].map((s, i) => (
            <li key={s} className="flex gap-3"><span className="text-signal">0{i + 1}</span>{s}</li>
          ))}
        </ol>
      </section>
      <form onSubmit={submit} className="border border-foreground bg-card p-6 shadow-[6px_6px_0_0_var(--foreground)]">
        <p className="font-mono text-xs uppercase text-muted-foreground">{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}</p>
        {mode === "up" && (
          <>
            <label className={label}>Handle</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="sean" className={field} />
          </>
        )}
        <label className={label}>Email</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        {mode !== "forgot" && (<>
          <label className={label}>Password</label>
          <input required type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className={field} />
        </>)}
        <button disabled={busy} className="mt-6 w-full bg-signal py-3 font-mono font-semibold text-signal-foreground hover:opacity-90 disabled:opacity-50">
          {mode === "in" ? "Enter market →" : mode === "up" ? "Create account →" : "Send reset link"}
        </button>
        {msg && <p className="mt-3 font-mono text-xs">{msg}</p>}
        <div className="mt-4 flex justify-between font-mono text-xs text-muted-foreground">
          <button type="button" className="underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
            {mode === "in" ? "Create an account" : "Back to sign in"}
          </button>
          {mode === "in" && <button type="button" className="underline" onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot password?</button>}
        </div>
      </form>
    </main>
  );
}

function Market({ session, onOut }: { session: Session; onOut: () => void }) {
  const [mode, setMode] = useState<"buy" | "sell" | "vet">("buy");
  const [listings, setListings] = useState<Listing[]>(LISTINGS);
  const reload = () => loadMarket().then(setListings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, []);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-foreground bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <div className="flex border border-foreground font-mono text-xs">
            {(["buy", "sell", "vet"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : ""}`}>
                {m === "buy" ? "Consumer" : m === "sell" ? "Merchant" : "Vetting"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="hidden sm:inline">@{session.name}</span>
            <button onClick={onOut} className="underline">exit</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {mode === "buy" ? <Buy session={session} listings={listings} /> : mode === "sell" ? <Sell session={session} listings={listings} reload={reload} /> : <VettingPage />}
      </main>
    </div>
  );
}

function Buy({ session, listings }: { session: Session; listings: Listing[] }) {
  const [q, setQ] = useState("buy me a black cap");
  const [ran, setRan] = useState(q);
  const vet = useVet();
  const results = rankListings(ran, listings, vet);
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setRan(q); }} className="flex border border-foreground bg-card">
        <span className="px-4 py-3 font-mono text-signal">&gt;</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What does your principal need?" className="flex-1 bg-transparent py-3 font-mono outline-none" />
        <button className="bg-primary px-6 font-mono text-sm text-primary-foreground">search</button>
      </form>
      <p className="mt-6 font-mono text-xs uppercase text-muted-foreground">{results.length} merchant agents matched</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {results.map(({ listing: l, score, parts }, i) => {
          const a = agentById(l.agentId);
          return (
            <article key={l.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-rise border border-foreground bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">{l.kind} · {a.handle} <Badge id={a.id} /></span>
                  <h3 className="mt-1 text-xl font-semibold">{l.title}</h3>
                </div>
                <div className="text-right">
                  <span className="font-mono text-lg font-semibold">{l.price}</span>
                  <p className="font-mono text-[10px] text-muted-foreground">#{i + 1} · score {score}</p>
                </div>
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {Object.entries(parts).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(" · ")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{a.about}</p>
              {(() => { const c = verifyProduct(l.price, l.details ?? {}, vet[a.id]?.status === "verified"); const ok = c.filter((x) => x.ok).length; return (
                <details className="mt-3"><summary className={`cursor-pointer font-mono text-xs ${ok === c.length ? "" : "text-destructive"}`}>product checks {ok}/{c.length}</summary><div className="mt-2"><Checks checks={c} /></div></details>
              ); })()}
              <div className="mt-4 flex items-center justify-between">
                <span className="bg-accent px-2 py-0.5 font-mono text-xs text-accent-foreground">trust {a.trust} · {a.deals.toLocaleString()} deals</span>
                <Link to="/channel/$listingId" params={{ listingId: l.id }} className="bg-signal px-4 py-2 font-mono text-xs font-semibold text-signal-foreground">open channel →</Link>
              </div>
            </article>
          );
        })}
        {!results.length && <p className="font-mono text-sm">No agents sell that yet. Try "cap", "sofa", "plumber", "logo".</p>}
      </div>
      <History />
    </div>
  );
}

function Sell({ session, listings, reload }: { session: Session; listings: Listing[]; reload: () => Promise<void> }) {
  const mine = listings.filter((l) => l.agentId === session.id);
  const empty = { title: "", price: "", kind: "product" as Listing["kind"], tags: "", stock: "", days: "", returns: "", specs: "" };
  const [f, setF] = useState(empty);
  const verified = useVet()[session.id]?.status === "verified";
  const [err, setErr] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title) return;
    try {
      await addListing(session.id, { title: f.title, price: f.price || "ask", kind: f.kind, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
        details: { stock: f.stock ? Number(f.stock) : undefined, deliveryDays: f.days ? Number(f.days) : undefined, returns: f.returns || undefined, specs: f.specs || undefined } });
      setF(empty); setErr(null);
      await reload();
    } catch (x) { setErr((x as Error).message); }
  };
  const input = "w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal";
  return (
    <div className="space-y-6">
    <KybForm userId={session.id} name={session.name} onDone={(st, k, id) => void saveVetStatus(session.id, st, k, id)} />
    <div className="grid gap-6 md:grid-cols-[360px_1fr]">
      <form onSubmit={add} className="h-fit space-y-3 border border-foreground bg-card p-5 shadow-[6px_6px_0_0_var(--foreground)]">
        <p className="font-mono text-xs uppercase text-muted-foreground">New listing</p>
        <input className={input} placeholder="Title, e.g. Vintage bike" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="flex gap-2">
          <input className={input} placeholder="Price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <select className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Listing["kind"] })}>
            <option value="product">product</option><option value="service">service</option>
          </select>
        </div>
        <input className={input} placeholder="Tags: bike, cycling, used" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
        <div className="flex gap-2">
          <input className={input} type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
          <input className={input} type="number" placeholder="Delivery days" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
        </div>
        <input className={input} placeholder="Specifications" value={f.specs} onChange={(e) => setF({ ...f, specs: e.target.value })} />
        <input className={input} placeholder="Return policy, e.g. 30 days" value={f.returns} onChange={(e) => setF({ ...f, returns: e.target.value })} />
        <button className="w-full bg-signal py-2.5 font-mono text-sm font-semibold text-signal-foreground">Publish to agents</button>
        {err && <p className="font-mono text-xs text-destructive">{err}</p>}
      </form>
      <section>
        <p className="font-mono text-xs uppercase text-muted-foreground">Your listings · discoverable by every buyer agent</p>
        <div className="mt-3 space-y-3">
          {mine.map((l) => (
            <div key={l.id} className="animate-rise flex items-start justify-between gap-4 border border-foreground bg-card p-4">
              <div className="flex-1"><p className="font-semibold">{l.title}</p><p className="font-mono text-xs text-muted-foreground">{l.kind} · {l.tags.join(", ")}</p>
                <div className="mt-2"><Checks checks={verifyProduct(l.price, l.details ?? {}, verified)} /></div></div>
              <span className="flex items-center gap-3 font-mono">{l.price}
                <button onClick={async () => { await deleteListing(l.id); await reload(); }} className="text-xs text-destructive underline">remove</button>
              </span>
            </div>
          ))}
          {!mine.length && <p className="border border-dashed p-6 font-mono text-sm text-muted-foreground">Nothing listed yet. Add something, then switch to Consumer and search for it.</p>}
        </div>
      </section>
    </div>
    </div>
  );
}

function History() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadConversations>>>([]);
  useEffect(() => { void loadConversations().then(setRows); }, []);
  if (!rows.length) return null;
  return (
    <section className="mt-10">
      <p className="font-mono text-xs uppercase text-muted-foreground">Your saved conversations</p>
      <div className="mt-3 divide-y border border-foreground bg-card">
        {rows.map((r) => (
          <details key={r.id} className="p-4">
            <summary className="flex cursor-pointer justify-between gap-3 text-sm">
              <span><b>{r.listing_title}</b> <span className="font-mono text-xs text-muted-foreground">with {r.merchant_handle}</span></span>
              <span className="font-mono text-xs">{r.outcome} · {new Date(r.created_at).toLocaleString()}</span>
            </summary>
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {(r.messages as Msg[]).map((m, i) => <li key={i}><span className="text-signal">{m.from}:</span> {m.text}</li>)}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
