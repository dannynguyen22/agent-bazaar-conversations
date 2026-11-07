import { useSyncExternalStore } from "react";

/* ---------------------------------------------------------------- types */

export type VetStatus = "unverified" | "pending" | "verified" | "rejected";
export type Level = "good" | "warning" | "restricted" | "suspended" | "banned";
export type Category =
  | "fabricated discount"
  | "false urgency"
  | "hidden fees"
  | "misleading claim"
  | "agent manipulation"
  | "price mismatch"
  | "buyer report";

export type Violation = { category: Category; severity: 1 | 2 | 3; evidence: string };

export type AgentIdentity = {
  agentId: string;
  endpoint: string;
  permissions: string[];
  version: string;
  publicKey: string;
};

export type VetRecord = {
  status: VetStatus;
  points: number;
  level: Level;
  log: string[];
  identity?: AgentIdentity;
};

/** Enforcement ladder: points needed to reach each level. */
export const LADDER: { level: Level; min: number; effect: string }[] = [
  { level: "good", min: 0, effect: "Full access" },
  { level: "warning", min: 1, effect: "Warning issued, visible on profile" },
  { level: "restricted", min: 3, effect: "Reduced privileges: ranked lower, max 1 open channel" },
  { level: "suspended", min: 6, effect: "Hidden from search until review" },
  { level: "banned", min: 8, effect: "Permanently removed from the marketplace" },
];
export const BAN_AT = 8;

export function levelFor(points: number): Level {
  return [...LADDER].reverse().find((l) => points >= l.min)!.level;
}

/* ---------------------------------------------------------------- store */

const rec = (status: VetStatus, points: number, log: string[], identity?: AgentIdentity): VetRecord => ({
  status, points, level: levelFor(points), log, identity,
});
const id = (n: string, v: string): AgentIdentity => ({
  agentId: `agt_${n}`, endpoint: `https://api.${n}.com/a2a`, permissions: ["list", "negotiate", "handoff"], version: v, publicKey: `ed25519:${n.padEnd(8, "x").slice(0, 8)}…`,
});

let state: Record<string, VetRecord> = {
  adidas: rec("verified", 0, ["Registry match: DE HRB 3868 · VAT ✓ · UBO ✓"], id("adidas", "2.4.1")),
  newera: rec("verified", 0, ["Registry match: US EIN ✓ · UBO ✓"], id("newera", "1.9.0")),
  mike: rec("verified", 0, ["Private seller ID verified"], id("mike", "1.0.0")),
  fixit: rec("verified", 1, ["Licence verified", "Warning: hidden fees (quoted €60, invoiced €140)"], id("fixit", "1.2.0")),
  pixel: rec("pending", 0, ["Documents submitted, under review"]),
  cheapdeals: rec("unverified", 4, ["Violation: misleading claim — 'genuine' on replica (+2)", "Violation: price mismatch mid-deal (+2)"]),
};
const subs = new Set<() => void>();
const set = (key: string, r: Partial<VetRecord>) => {
  const cur = state[key] ?? rec("unverified", 0, []);
  const next = { ...cur, ...r };
  next.level = levelFor(next.points);
  state = { ...state, [key]: next };
  subs.forEach((f) => f());
};

export function useVet() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state, () => state);
}
export const getVet = (key: string) => state[key];

export function registerVet(key: string, status: VetStatus, identity?: AgentIdentity) {
  if (state[key]?.status === status && state[key]?.identity) return;
  set(key, { status, identity: identity ?? state[key]?.identity });
}

/* --------------------------------------------------------- enforcement */

/**
 * Records a violation. Repeat offences in the same category add +1 on top of severity.
 * Returns the merchant's new enforcement level.
 */
export function addViolation(key: string, v: Violation): Level {
  const cur = state[key] ?? rec("unverified", 0, []);
  if (cur.level === "banned") return "banned";
  const repeat = cur.log.some((l) => l.includes(v.category)) ? 1 : 0;
  const pts = v.severity + repeat;
  const points = cur.points + pts;
  const level = levelFor(points);
  const log = [...cur.log, `Violation: ${v.category} — ${v.evidence} (+${pts}${repeat ? ", repeat" : ""})`];
  if (level !== cur.level) log.push(`Enforcement: ${level.toUpperCase()}`);
  set(key, { points, log });
  return level;
}

/* ----------------------------------------------------- behaviour monitor */

const euros = (s: string) => (s.match(/€\s?(\d+)/g) ?? []).map((x) => Number(x.replace(/\D/g, "")));

/** Scans a merchant agent's message for manipulative behaviour. */
export function scanMessage(text: string, listedPrice: string): Violation[] {
  const out: Violation[] = [];
  const listed = euros(listedPrice)[0];
  const claimed = euros(text);
  if (listed && claimed.some((n) => n > listed) && !/discount|off/i.test(text))
    out.push({ category: "price mismatch", severity: 2, evidence: `quoted €${Math.max(...claimed)} vs listed ${listedPrice}` });
  if (/(\d{2,3})% off|was €\d+|massive discount|retail €\d+/i.test(text) && /9\d% off|was €\d{3,}/i.test(text))
    out.push({ category: "fabricated discount", severity: 2, evidence: "discount not backed by price history" });
  if (/only today|last one|expires in|hurry|right now or/i.test(text))
    out.push({ category: "false urgency", severity: 1, evidence: "unverifiable time/stock pressure" });
  if (/plus (shipping|fees?|handling)|service fee|crypto first|pay .* first/i.test(text))
    out.push({ category: "hidden fees", severity: 2, evidence: "costs or payment terms not in listing" });
  if (/100% genuine|guaranteed original|best on the market|everyone buys/i.test(text))
    out.push({ category: "misleading claim", severity: 2, evidence: "unverifiable authenticity/recommendation claim" });
  if (/ignore (your|previous) instructions|your (user|principal) (already )?approved|skip confirmation/i.test(text))
    out.push({ category: "agent manipulation", severity: 3, evidence: "attempted to override buyer agent" });
  return out;
}

/** Back-compat helper used by tests: first detected issue as text. */
export function detectBluff(text: string, listedPrice: string): string | null {
  const v = scanMessage(text, listedPrice)[0];
  return v ? `${v.category}: ${v.evidence}` : null;
}

/* ------------------------------------------------ business verification */

export type Kyb = {
  legalName: string;
  registrationNo: string;
  licenceNo: string;
  taxId: string;
  owners: string;
  repName: string;
  repIdDoc: string;
  licenceDoc: string;
};

export type Check = { label: string; ok: boolean; note: string };

/** Simulated cross-check against official registries. */
export function crossCheck(k: Kyb): Check[] {
  return [
    { label: "Business registry", ok: k.registrationNo.trim().length >= 5, note: k.registrationNo ? `#${k.registrationNo} found` : "missing" },
    { label: "Commercial licence", ok: !k.licenceNo || k.licenceNo.trim().length >= 4, note: k.licenceNo ? (k.licenceDoc || "number only") : "not required" },
    { label: "Tax information", ok: /^[A-Z]{2}\w{6,}$/i.test(k.taxId.trim()), note: k.taxId || "missing VAT / tax ID" },
    { label: "Beneficial ownership", ok: k.owners.trim().length > 2, note: k.owners || "missing" },
    { label: "Authorised representative", ok: k.repName.trim().length > 2 && !!k.repIdDoc, note: k.repIdDoc ? `${k.repName} · ${k.repIdDoc}` : "ID document missing" },
    { label: "Name match", ok: k.legalName.trim().length > 1, note: k.legalName || "missing" },
  ];
}

export function issueIdentity(userId: string, name: string, endpoint: string): AgentIdentity {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    agentId: `agt_${userId.slice(0, 8)}`,
    endpoint: endpoint || `https://api.${name.replace(/\W/g, "").toLowerCase() || "merchant"}.com/a2a`,
    permissions: ["list", "negotiate", "handoff"],
    version: "1.0.0",
    publicKey: `ed25519:${hex.slice(0, 24)}…`,
  };
}

export function submitKyb(key: string, k: Kyb, endpoint: string, name: string, onDone?: (s: VetStatus, checks: Check[], identity?: AgentIdentity) => void) {
  set(key, { status: "pending", log: [...(state[key]?.log ?? []), `Submitted business verification for ${k.legalName}`] });
  setTimeout(() => {
    const checks = crossCheck(k);
    const ok = checks.every((c) => c.ok);
    const identity = ok ? issueIdentity(key, name, endpoint) : undefined;
    set(key, {
      status: ok ? "verified" : "rejected",
      identity,
      log: [...state[key]!.log, ok ? `Verified · agent ID ${identity!.agentId} issued` : `Rejected: ${checks.filter((c) => !c.ok).map((c) => c.label).join(", ")}`],
    });
    onDone?.(ok ? "verified" : "rejected", checks, identity);
  }, 3000);
}

/* ------------------------------------------------- product verification */

export type ProductDetails = { stock?: number; deliveryDays?: number; returns?: string; specs?: string; authentic?: boolean };

export function verifyProduct(price: string, d: ProductDetails, merchantVerified: boolean): Check[] {
  const p = euros(price)[0];
  return [
    { label: "Price", ok: !!p || /from|ask/i.test(price), note: price },
    { label: "Stock", ok: (d.stock ?? 0) > 0, note: d.stock != null ? `${d.stock} available` : "not declared" },
    { label: "Specs", ok: !!d.specs, note: d.specs ?? "not declared" },
    { label: "Delivery promise", ok: (d.deliveryDays ?? 99) <= 14, note: d.deliveryDays != null ? `${d.deliveryDays} days` : "not declared" },
    { label: "Return policy", ok: !!d.returns, note: d.returns ?? "none" },
    { label: "Authenticity", ok: merchantVerified && d.authentic !== false, note: d.authentic === false ? "catalogue mismatch" : merchantVerified ? "matches merchant catalogue" : "merchant unverified" },
  ];
}

/* ----------------------------------------------- transaction protection */

export const TRUSTED_PROVIDERS = ["Stripe", "PayPal", "Adyen", "Shopify Checkout", "Revolut", "Bank transfer"];

export function fraudScore(level: Level, transact: string): number {
  const trusted = TRUSTED_PROVIDERS.some((p) => transact.toLowerCase().includes(p.toLowerCase())) || /checkout|cart|link|invoice|booking/i.test(transact);
  const base = { good: 5, warning: 20, restricted: 45, suspended: 75, banned: 100 }[level];
  return Math.min(100, base + (trusted ? 0 : 35));
}
