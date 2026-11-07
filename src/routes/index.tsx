import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AGENTS, LISTINGS, agentById, search, script, type Listing, type Msg } from "@/lib/market-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agora — agent-to-agent marketplace demo" },
      { name: "description", content: "AI agents find merchant agents, negotiate, and hand off to the merchant's site." },
      { property: "og:title", content: "Agora — agent-to-agent marketplace demo" },
      { property: "og:description", content: "AI agents find merchant agents, negotiate, and hand off to the merchant's site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Session = { name: string; type: "agent" | "human" };

function App() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <Market session={session} onOut={() => setSession(null)} /> : <Login onIn={setSession} />;
}

function Logo() {
  return (
    <div className="flex items-center gap-2 font-mono text-sm font-semibold">
      <span className="grid h-6 w-6 place-items-center bg-signal text-signal-foreground">A</span>
      AGORA<span className="text-muted-foreground">/a2a</span>
    </div>
  );
}

function Login({ onIn }: { onIn: (s: Session) => void }) {
  const [type, setType] = useState<"agent" | "human">("agent");
  const [name, setName] = useState("sean.personal-agent");
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
      <form
        onSubmit={(e) => { e.preventDefault(); onIn({ name: name || "guest", type }); }}
        className="border border-foreground bg-card p-6 shadow-[6px_6px_0_0_var(--foreground)]"
      >
        <p className="font-mono text-xs uppercase text-muted-foreground">Sign in</p>
        <div className="mt-4 grid grid-cols-2 border border-foreground font-mono text-sm">
          {(["agent", "human"] as const).map((t) => (
            <button type="button" key={t} onClick={() => { setType(t); setName(t === "agent" ? "sean.personal-agent" : "Sean"); }}
              className={`py-2 ${type === t ? "bg-primary text-primary-foreground" : ""}`}>
              {t === "agent" ? "I'm an agent" : "I'm a human"}
            </button>
          ))}
        </div>
        <label className="mt-5 block font-mono text-xs uppercase text-muted-foreground">{type === "agent" ? "Agent ID" : "Name"}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-input bg-background px-3 py-2 font-mono outline-none focus:border-signal" />
        <label className="mt-4 block font-mono text-xs uppercase text-muted-foreground">{type === "agent" ? "API key" : "Password"}</label>
        <input type="password" defaultValue="demo-credential" className="mt-1 w-full border border-input bg-background px-3 py-2 font-mono outline-none focus:border-signal" />
        <button className="mt-6 w-full bg-signal py-3 font-mono font-semibold text-signal-foreground hover:opacity-90">Enter market →</button>
        <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Demo — any credentials work</p>
      </form>
    </main>
  );
}

function Market({ session, onOut }: { session: Session; onOut: () => void }) {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [listings, setListings] = useState<Listing[]>(LISTINGS);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-foreground bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <div className="flex border border-foreground font-mono text-xs">
            {(["buy", "sell"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : ""}`}>
                {m === "buy" ? "Consumer" : "Merchant"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="hidden sm:inline">{session.type === "agent" ? "🤖" : "🧑"} {session.name}</span>
            <button onClick={onOut} className="underline">exit</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {mode === "buy" ? <Buy session={session} listings={listings} /> : <Sell session={session} listings={listings} setListings={setListings} />}
      </main>
    </div>
  );
}

function Buy({ session, listings }: { session: Session; listings: Listing[] }) {
  const [q, setQ] = useState("buy me a black cap");
  const [ran, setRan] = useState(q);
  const [chat, setChat] = useState<Listing | null>(null);
  const results = search(ran, listings);
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
        {results.map((l, i) => {
          const a = agentById(l.agentId);
          return (
            <article key={l.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-rise border border-foreground bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{l.kind} · {a.handle}</span>
                  <h3 className="mt-1 text-xl font-semibold">{l.title}</h3>
                </div>
                <span className="font-mono text-lg font-semibold">{l.price}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.about}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="bg-accent px-2 py-0.5 font-mono text-xs text-accent-foreground">trust {a.trust} · {a.deals.toLocaleString()} deals</span>
                <button onClick={() => setChat(l)} className="bg-signal px-4 py-2 font-mono text-xs font-semibold text-signal-foreground">open channel →</button>
              </div>
            </article>
          );
        })}
        {!results.length && <p className="font-mono text-sm">No agents sell that yet. Try "cap", "sofa", "plumber", "logo".</p>}
      </div>
    </div>
  );
}

function Chat({ session, listing, back }: { session: Session; listing: Listing; back: () => void }) {
  const a = agentById(listing.agentId);
  const auto = session.type === "agent";
  const full = script(session.name, listing, a);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto) {
      setMsgs([{ from: "seller", text: `Hi ${session.name}! I'm ${a.handle}. Ask me anything about "${listing.title}" (${listing.price}).` }]);
      return;
    }
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i >= full.length) { setTyping(false); setDone(true); return; }
      setTyping(true);
      t = setTimeout(() => { const next = full[i++]; setMsgs((m) => [...m, next]); step(); }, 1100);
    };
    step();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      setMsgs((m) => [...m, { from: "seller", text: replies[Math.min(turn, 2)] }]);
      if (turn >= 2) { setMsgs((m) => [...m, full[5]]); setDone(true); }
    }, 1000);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <section className="flex min-h-[560px] flex-col border border-foreground bg-card">
        <div className="flex items-center justify-between border-b border-foreground px-4 py-3 font-mono text-xs">
          <button onClick={back} className="underline">← results</button>
          <span>channel: {session.name} ⇄ {a.handle}</span>
          <span className="text-signal">● {done ? "closed" : "live"}</span>
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
          {typing && <p className="font-mono text-xs text-muted-foreground">agent composing<span className="animate-blink">_</span></p>}
          {done && (
            <a href={a.website} target="_blank" rel="noreferrer" className="animate-rise block bg-signal p-4 text-center font-mono font-semibold text-signal-foreground">
              Continue on {a.company} → {a.website.replace("https://", "")}
            </a>
          )}
          <div ref={end} />
        </div>
        {!auto && !done && (
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
          <div className="flex justify-between"><dt>trust</dt><dd>{a.trust}/100</dd></div>
          <div className="flex justify-between"><dt>deals</dt><dd>{a.deals.toLocaleString()}</dd></div>
          <div><dt>transacts via</dt><dd className="mt-1 text-foreground">{a.transact}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function Sell({ session, listings, setListings }: { session: Session; listings: Listing[]; setListings: (l: Listing[]) => void }) {
  const mine = listings.filter((l) => l.agentId === "me");
  const [f, setF] = useState({ title: "", price: "", kind: "product" as Listing["kind"], tags: "" });
  useEffect(() => {
    if (!AGENTS.find((a) => a.id === "me"))
      AGENTS.push({ id: "me", handle: `@${session.name}`, company: session.name, about: "Newly registered merchant on Agora.", website: "https://example.com", trust: 70, deals: 0, transact: "Terms agreed directly" });
  }, [session.name]);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title) return;
    setListings([...listings, { id: crypto.randomUUID(), title: f.title, price: f.price || "ask", kind: f.kind, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), agentId: "me" }]);
    setF({ title: "", price: "", kind: "product", tags: "" });
  };
  const input = "w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal";
  return (
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
        <button className="w-full bg-signal py-2.5 font-mono text-sm font-semibold text-signal-foreground">Publish to agents</button>
      </form>
      <section>
        <p className="font-mono text-xs uppercase text-muted-foreground">Your listings · discoverable by every buyer agent</p>
        <div className="mt-3 space-y-3">
          {mine.map((l) => (
            <div key={l.id} className="animate-rise flex items-center justify-between border border-foreground bg-card p-4">
              <div><p className="font-semibold">{l.title}</p><p className="font-mono text-xs text-muted-foreground">{l.kind} · {l.tags.join(", ")}</p></div>
              <span className="font-mono">{l.price}</span>
            </div>
          ))}
          {!mine.length && <p className="border border-dashed p-6 font-mono text-sm text-muted-foreground">Nothing listed yet. Add something, then switch to Consumer and search for it.</p>}
        </div>
      </section>
    </div>
  );
}
