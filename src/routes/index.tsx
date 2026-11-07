import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { rankListings } from "@/lib/ranking";
import { AGENTS, LISTINGS, agentById, script, type Listing, type Msg } from "@/lib/market-data";
import { supabase } from "@/integrations/supabase/client";
import { addListing, deleteListing, loadConversations, loadMarket, saveConversation, saveVetStatus } from "@/lib/market-db";
import { addViolation, getVet, scanMessage, useVet, verifyProduct } from "@/lib/vetting";
import { Badge, Checks, IdentityCard, KybForm, LevelMeter, TransactionPanel, VettingPage } from "@/components/vetting-ui";

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

type Session = { id: string; name: string };

function App() {
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
  if (!ready) return <p className="p-10 font-mono text-sm">connecting<span className="animate-blink">_</span></p>;
  return session ? <Market session={session} onOut={() => supabase.auth.signOut()} /> : <Login />;
}

function Logo() {
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
  const [chat, setChat] = useState<Listing | null>(null);
  const vet = useVet();
  const results = rankListings(ran, listings, vet);
  if (chat) return <Chat session={session} listing={chat} back={() => setChat(null)} />;
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
                <button onClick={() => setChat(l)} className="bg-signal px-4 py-2 font-mono text-xs font-semibold text-signal-foreground">open channel →</button>
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

function Chat({ session, listing, back }: { session: Session; listing: Listing; back: () => void }) {
  const a = agentById(listing.agentId);
  const [auto, setAuto] = useState<boolean | null>(null);
  const full = script(session.name, listing, a) as [Msg, Msg, Msg, Msg, Msg, Msg];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const [flagged, setFlagged] = useState(false);
  const vet = useVet()[a.id];
  const saved = useRef(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const persist = (outcome: string, all: Msg[]) => void saveConversation(session.id, listing.title, a.handle, outcome, all);
  useEffect(() => {
    if (!done || saved.current || (!flagged && !receipt)) return;
    saved.current = true;
    persist(flagged ? `flagged · merchant ${getVet(a.id)?.level ?? ""}` : `agreed · receipt ${receipt}`, msgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, flagged, receipt]);

  /** Behaviour monitor: scans a seller message, applies enforcement. Returns true if the channel was terminated. */
  const vetCheck = (text: string) => {
    const found = scanMessage(text, listing.price);
    if (!found.length) return false;
    setFlagged(true);
    let level = getVet(a.id)?.level ?? "good";
    const notes: Msg[] = [];
    for (const v of found) {
      level = addViolation(a.id, v);
      notes.push({ from: "system", text: `⚠ Behaviour monitor: ${v.category} — ${v.evidence}. Merchant now: ${level.toUpperCase()}.` });
    }
    const stop = level === "banned" || level === "suspended";
    if (stop) notes.push({ from: "system", text: `⛔ ${a.handle} ${level === "banned" ? "has been BANNED from Arbiter" : "is SUSPENDED pending review"}. Channel terminated.` });
    setMsgs((m) => [...m, ...notes]);
    if (stop) setDone(true);
    return stop;
  };
  const report = () => {
    setFlagged(true);
    const level = addViolation(a.id, { category: "buyer report", severity: 1, evidence: "buyer flagged misleading behaviour" });
    setMsgs((m) => [...m, { from: "system", text: `Report filed with evidence. Merchant now: ${level.toUpperCase()}.` }]);
    setDone(true);
  };

  useEffect(() => {
    if (auto === null) return;
    if (!auto) {
      setMsgs([{ from: "seller", text: `Hi ${session.name}! I'm ${a.handle}. Ask me anything about "${listing.title}" (${listing.price}).` }]);
      return;
    }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= full.length) { setTyping(false); setDone(true); return; }
      setTyping(true);
      t = setTimeout(() => {
        const next = full[i++] as Msg;
        setMsgs((m) => [...m, next]);
        if (next.from === "seller" && vetCheck(next.text)) { setTyping(false); return; }
        step();
      }, 1100);
    };
    step();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs, typing]);

  const send = () => {
    if (!draft.trim()) return;
    const turn = msgs.filter((m) => m.from === "buyer").length;
    setMsgs((m) => [...m, { from: "buyer", text: draft }]);
    setDraft("");
    setTyping(true);
    const replies = [full[1].text, full[3].text, "Great — terms locked. Here's your handoff link."];
    setTimeout(() => {
      setTyping(false);
      const text = replies[Math.min(turn, 2)] ?? "";
      setMsgs((m) => [...m, { from: "seller", text }]);
      if (vetCheck(text)) return;
      if (turn >= 2) { setMsgs((m) => [...m, full[5]]); setDone(true); }
    }, 1000);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <section className="flex min-h-[560px] flex-col border border-foreground bg-card">
        <div className="flex items-center justify-between border-b border-foreground px-4 py-3 font-mono text-xs">
          <button onClick={back} className="underline">← results</button>
          <span>channel: {session.name} ⇄ {a.handle}</span>
          <span className="flex items-center gap-3">
            {vet?.level === "restricted" && <span className="text-destructive">restricted merchant</span>}
            {!done && <button onClick={report} className="text-destructive underline">report bluff</button>}
            <span className="text-signal">● {done ? "closed" : "live"}</span>
          </span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m, i) => m.from === "system" ? (
            <p key={i} className="animate-rise border-y border-dashed py-2 text-center font-mono text-xs text-muted-foreground">{m.text}</p>
          ) : (
            <div key={i} className={`animate-rise flex ${m.from === "buyer" ? "justify-end" : ""}`}>
              <div className={`max-w-[80%] px-4 py-2 text-sm ${m.from === "buyer" ? "bg-primary text-primary-foreground" : "border border-foreground bg-background"}`}>
                <p className="mb-1 font-mono text-[10px] opacity-60">{m.from === "buyer" ? session.name : a.handle}</p>
                {m.text}
              </div>
            </div>
          ))}
          {auto === null && (
            <div className="grid gap-3 p-6 sm:grid-cols-2">
              <button onClick={() => setAuto(true)} className="bg-signal p-4 font-mono text-sm font-semibold text-signal-foreground">Let my agent negotiate</button>
              <button onClick={() => setAuto(false)} className="border border-foreground p-4 font-mono text-sm">I'll chat myself</button>
            </div>
          )}
          {typing && <p className="font-mono text-xs text-muted-foreground">agent composing<span className="animate-blink">_</span></p>}
          {done && !flagged && (
            <TransactionPanel level={vet?.level ?? "good"} transact={a.transact} website={a.website} company={a.company}
              onConfirm={(r) => setReceipt(r)}
              onDispute={() => { addViolation(a.id, { category: "buyer report", severity: 1, evidence: "dispute opened after checkout" }); persist("dispute opened", msgs); }} />
          )}
          <div ref={end} />
        </div>
        {auto === false && !done && (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex border-t border-foreground">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message the merchant agent…" className="flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
            <button className="bg-primary px-5 font-mono text-xs text-primary-foreground">send</button>
          </form>
        )}
      </section>
      <aside className="h-fit border border-foreground bg-card p-5">
        <p className="font-mono text-xs uppercase text-muted-foreground">Merchant profile</p>
        <h3 className="mt-2 text-2xl font-bold">{a.company}</h3>
        <p className="font-mono text-xs">{a.handle}</p>
        <p className="mt-3 text-sm text-muted-foreground">{a.about}</p>
        <dl className="mt-4 space-y-2 font-mono text-xs">
          <div className="flex justify-between"><dt>vetting</dt><dd><Badge id={a.id} /></dd></div>
          <div className="flex justify-between"><dt>enforcement</dt><dd><LevelMeter id={a.id} /></dd></div>
          <div className="flex justify-between"><dt>agent id</dt><dd>{vet?.identity?.agentId ?? "unregistered"}</dd></div>
          <div className="flex justify-between"><dt>trust</dt><dd>{a.trust}/100</dd></div>
          <div className="flex justify-between"><dt>deals</dt><dd>{a.deals.toLocaleString()}</dd></div>
          <div><dt>transacts via</dt><dd className="mt-1 text-foreground">{a.transact}</dd></div>
        </dl>
      </aside>
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
