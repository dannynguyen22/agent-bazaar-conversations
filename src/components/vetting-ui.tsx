import { useState } from "react";
import { AGENTS } from "@/lib/market-data";
import {
  BAN_AT, LADDER, crossCheck, submitKyb, useVet,
  type AgentIdentity, type Check, type Kyb, type VetStatus,
} from "@/lib/vetting";

export function Badge({ id }: { id: string }) {
  const v = useVet()[id];
  if (!v) return null;
  const [label, cls] =
    v.level === "banned" ? ["banned", "bg-destructive text-destructive-foreground"]
    : v.level === "suspended" ? ["suspended", "bg-destructive text-destructive-foreground"]
    : v.status === "verified" ? ["✓ verified", "bg-accent text-accent-foreground"]
    : v.status === "pending" ? ["reviewing…", "bg-secondary text-secondary-foreground"]
    : v.status === "rejected" ? ["rejected", "bg-destructive text-destructive-foreground"]
    : ["unverified", "bg-signal text-signal-foreground"];
  return <span className={`px-1.5 py-0.5 font-mono text-[10px] uppercase ${cls}`}>{label}</span>;
}

export function LevelMeter({ id }: { id: string }) {
  const v = useVet()[id];
  const pts = v?.points ?? 0;
  return (
    <span className="flex items-center gap-2 font-mono text-xs">
      <span className="flex gap-0.5">
        {Array.from({ length: BAN_AT }, (_, i) => <span key={i} className={`h-2.5 w-2.5 ${i < pts ? "bg-destructive" : "bg-secondary"}`} />)}
      </span>
      <span className={pts ? "text-destructive" : ""}>{v?.level ?? "good"}</span>
    </span>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  return (
    <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
      {checks.map((c) => (
        <li key={c.label} className="flex gap-2">
          <span className={c.ok ? "text-accent-foreground" : "text-destructive"}>{c.ok ? "✓" : "✗"}</span>
          <span><b>{c.label}</b> <span className="text-muted-foreground">{c.note}</span></span>
        </li>
      ))}
    </ul>
  );
}

export function IdentityCard({ identity }: { identity: AgentIdentity }) {
  return (
    <div className="border border-foreground bg-card p-4 font-mono text-xs">
      <p className="uppercase text-muted-foreground">Registered agent identity</p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">agent id</dt><dd className="font-semibold">{identity.agentId}</dd></div>
        <div><dt className="text-muted-foreground">version</dt><dd>{identity.version}</dd></div>
        <div><dt className="text-muted-foreground">endpoint</dt><dd className="break-all">{identity.endpoint}</dd></div>
        <div><dt className="text-muted-foreground">permissions</dt><dd>{identity.permissions.join(", ")}</dd></div>
        <div className="sm:col-span-2"><dt className="text-muted-foreground">public key</dt><dd className="break-all">{identity.publicKey}</dd></div>
      </dl>
    </div>
  );
}

const EMPTY: Kyb = { legalName: "", registrationNo: "", licenceNo: "", taxId: "", owners: "", repName: "", repIdDoc: "", licenceDoc: "" };

export function KybForm({ userId, name, onDone }: { userId: string; name: string; onDone: (s: VetStatus, k: Kyb, identity?: AgentIdentity) => void }) {
  const v = useVet()[userId];
  const [k, setK] = useState<Kyb>({ ...EMPTY, legalName: name });
  const [endpoint, setEndpoint] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const status = v?.status ?? "unverified";
  if (status === "verified")
    return (
      <div className="space-y-3">
        <p className="border border-foreground bg-accent p-4 font-mono text-sm text-accent-foreground">✓ Business verified. Your listings are visible to buyer agents.</p>
        {v?.identity && <IdentityCard identity={v.identity} />}
      </div>
    );
  const input = "w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-signal";
  const f = (key: keyof Kyb, ph: string) => <input className={input} placeholder={ph} value={k[key]} onChange={(e) => setK({ ...k, [key]: e.target.value })} />;
  const file = (key: keyof Kyb, label: string) => (
    <label className="block font-mono text-xs text-muted-foreground">{label}
      <input type="file" accept=".pdf,image/*" onChange={(e) => setK({ ...k, [key]: e.target.files?.[0]?.name ?? "" })} className="mt-1 w-full border border-input bg-background px-3 py-2 text-xs" />
    </label>
  );
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submitKyb(userId, k, endpoint, name, (s, c, id) => { setChecks(c); onDone(s, k, id); }); }}
      className="border-2 border-signal bg-card p-5"
    >
      <div className="flex items-center justify-between"><p className="font-semibold">Business verification</p><Badge id={userId} /></div>
      <p className="mt-1 text-sm text-muted-foreground">Required before your listings go live. We cross-check official registries.</p>
      {status === "pending" ? (
        <p className="mt-4 font-mono text-sm">Cross-checking business registry, tax office and ownership records<span className="animate-blink">_</span></p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {f("legalName", "Legal business name")}
          {f("registrationNo", "Business registration no.")}
          {f("licenceNo", "Commercial licence no. (if applicable)")}
          {f("taxId", "VAT / tax ID, e.g. MT12345678")}
          {f("owners", "Beneficial owners (25%+), comma separated")}
          {f("repName", "Authorised representative full name")}
          {file("repIdDoc", "Representative ID document")}
          {file("licenceDoc", "Commercial licence document")}
          <input className={`${input} sm:col-span-2`} placeholder="Agent API endpoint, e.g. https://api.mybrand.com/a2a" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          <button className="bg-signal py-2.5 font-mono text-sm font-semibold text-signal-foreground sm:col-span-2">Submit for verification</button>
        </div>
      )}
      {(checks ?? (status === "rejected" ? crossCheck(k) : null)) && (
        <div className="mt-4"><Checks checks={checks ?? crossCheck(k)} /></div>
      )}
    </form>
  );
}

const PILLARS = [
  ["Business verification", "Registration, licences, tax info, beneficial owners and authorised representative ID, cross-checked against registries."],
  ["Agent identity", "Each merchant agent gets a unique ID tied to a verified merchant, with endpoint, permissions, version and public key."],
  ["Product verification", "Price, stock, specs, delivery promise, returns and authenticity checked against the merchant catalogue."],
  ["Behaviour monitoring", "Every message scanned for fabricated discounts, false urgency, hidden fees, misleading claims and agent manipulation."],
  ["Transaction protection", "Trusted payment rails, buyer checkout confirmation, order receipts, disputes and fraud scoring."],
  ["Enforcement", "Warnings, reduced privileges, suspension and bans scaled by severity, evidence and repeat offences."],
];

export function VettingPage() {
  const vet = useVet();
  const rows = AGENTS.filter((a) => vet[a.id]);
  return (
    <div>
      <h2 className="text-3xl font-bold">Vetting engine</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {PILLARS.map(([t, d], i) => (
          <div key={t} className="border border-foreground bg-card p-4">
            <p className="font-mono text-xs text-signal">0{i + 1}</p>
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 font-mono text-xs uppercase text-muted-foreground">Enforcement ladder</p>
      <div className="mt-2 grid gap-2 md:grid-cols-5">
        {LADDER.map((l) => (
          <div key={l.level} className="border border-foreground bg-card p-3 font-mono text-xs">
            <p className="font-semibold uppercase">{l.level}</p>
            <p className="text-muted-foreground">{l.min}+ pts · {l.effect}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 overflow-x-auto border border-foreground bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground font-mono text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Agent</th><th className="p-3">Business</th><th className="p-3">Agent ID</th><th className="p-3">Enforcement</th><th className="p-3">Latest event</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => { const v = vet[a.id]!; return (
              <tr key={a.id} className={`border-b last:border-0 ${v.level === "banned" ? "bg-muted" : ""}`}>
                <td className="p-3"><p className="font-semibold">{a.company}</p><p className="font-mono text-xs text-muted-foreground">{a.handle}</p></td>
                <td className="p-3"><Badge id={a.id} /></td>
                <td className="p-3 font-mono text-xs">{v.identity?.agentId ?? "—"}</td>
                <td className="p-3"><LevelMeter id={a.id} /></td>
                <td className="p-3 font-mono text-xs">{v.log.at(-1) ?? "—"}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-xs text-muted-foreground">Tip: search "cap" and open @cheapdeals.bot to watch enforcement happen live.</p>
    </div>
  );
}
