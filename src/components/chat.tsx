import { useEffect, useRef, useState } from "react";
import { agentById, script, type Listing, type Msg } from "@/lib/market-data";
import { saveConversation } from "@/lib/market-db";
import type { Session } from "@/lib/session";
import { addViolation, getVet, scanMessage, useVet } from "@/lib/vetting";
import { Badge, LevelMeter } from "@/components/vetting-ui";

export function Chat({ session, listing, back }: { session: Session; listing: Listing; back: () => void }) {
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
  const persist = (outcome: string, all: Msg[]) => void saveConversation(session.id, listing.title, a.handle, outcome, all);
  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = true;
    persist(flagged ? `flagged · merchant ${getVet(a.id)?.level ?? ""}` : `agreed · handed off to ${a.website}`, msgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, flagged]);

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
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, typing]);

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
            <div className="animate-rise space-y-3 border border-foreground bg-background p-4">
              <p className="font-mono text-xs uppercase text-muted-foreground">Handoff — deal made off-platform</p>
              <p className="text-sm">
                Terms agreed. Arbiter never takes payment or holds funds — you and {a.company} settle directly on their site.
              </p>
              <p className="font-mono text-xs text-muted-foreground">Transacts via: <span className="text-foreground">{a.transact}</span></p>
              <a href={a.website} target="_blank" rel="noreferrer" className="block bg-signal p-4 text-center font-mono font-semibold text-signal-foreground">
                Continue on {a.company} → {a.website.replace("https://", "")}
              </a>
            </div>
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

