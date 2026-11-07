import { agentById, type Listing } from "@/lib/market-data";
import { verifyProduct, type VetRecord } from "@/lib/vetting";

/**
 * Arbiter search ranking.
 * score = relevance (0–50) + vetting (−30–20) + product checks (0–15) + reputation (0–10) + fit (0–5)
 * Listings with zero relevance, or from suspended/banned merchants, are excluded.
 */

export type Ranked = { listing: Listing; score: number; parts: Record<string, number> };

const STOP = new Set(["buy", "me", "a", "an", "the", "for", "want", "need", "find", "get", "some", "please", "i", "my", "under", "below", "less", "than", "max", "cheap", "fast"]);
const norm = (w: string) => w.toLowerCase().replace(/(ies)$/, "y").replace(/(es|s)$/, "");

export type Query = { words: string[]; maxPrice?: number; kind?: Listing["kind"]; wantsFast: boolean; wantsCheap: boolean };

export function parseQuery(q: string): Query {
  const lower = q.toLowerCase();
  const max = lower.match(/(?:under|below|less than|max|<)\s*€?\s*(\d+)/);
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)).map(norm);
  const q2: Query = { words, wantsFast: /fast|today|urgent|asap|quick/.test(lower), wantsCheap: /cheap|budget|affordable/.test(lower) };
  if (max) q2.maxPrice = Number(max[1]);
  if (/service|repair|fix|design|plumb/.test(lower)) q2.kind = "service";
  return q2;
}

const priceOf = (p: string) => Number((p.match(/\d+/) ?? ["NaN"])[0]);

/** 0–50: title hits weigh 3x, tag hits 2x, word-prefix 1x, full coverage bonus. */
export function relevance(q: Query, l: Listing): number {
  if (!q.words.length) return 10;
  const title = l.title.toLowerCase().split(/[^a-z0-9]+/).map(norm);
  const tags = l.tags.map((t) => norm(t.toLowerCase()));
  let pts = 0, hit = 0;
  for (const w of q.words) {
    if (title.includes(w)) { pts += 3; hit++; }
    else if (tags.includes(w)) { pts += 2; hit++; }
    else if ([...title, ...tags].some((t) => t.length > 3 && (t.startsWith(w) || w.startsWith(t)))) { pts += 1; hit++; }
  }
  if (!hit) return 0;
  const coverage = hit / q.words.length;
  return Math.round(Math.min(50, (pts / (q.words.length * 3)) * 40 + (coverage === 1 ? 10 : 0)));
}

/** −30–20: verified merchants get a boost; enforcement points pull rank down. */
export function vettingScore(v: VetRecord | undefined): number {
  if (!v) return -10;
  const base = v.status === "verified" ? 20 : v.status === "pending" ? 5 : -5;
  const penalty = { good: 0, warning: 8, restricted: 20, suspended: 50, banned: 50 }[v.level];
  return Math.max(-30, base - penalty);
}

export function rankListings(query: string, listings: Listing[], vet: Record<string, VetRecord>): Ranked[] {
  const q = parseQuery(query);
  const out: Ranked[] = [];
  for (const l of listings) {
    const v = vet[l.agentId];
    if (v && (v.level === "banned" || v.level === "suspended")) continue;
    if (l.saved && v?.status !== "verified") continue;
    const rel = relevance(q, l);
    if (rel === 0) continue;
    const price = priceOf(l.price);
    if (q.maxPrice && price > q.maxPrice) continue;

    const checks = verifyProduct(l.price, l.details ?? {}, v?.status === "verified");
    const product = Math.round((checks.filter((c) => c.ok).length / checks.length) * 15);
    const a = agentById(l.agentId);
    const reputation = a ? Math.round((a.trust / 100) * 6 + Math.min(4, Math.log10(a.deals + 1))) : 0;
    let fit = 0;
    if (q.kind && l.kind === q.kind) fit += 2;
    if (q.wantsFast && (l.details?.deliveryDays ?? 99) <= 2) fit += 2;
    if (q.wantsCheap && price <= 20) fit += 1;
    fit = Math.min(5, fit);

    const parts = { relevance: rel, vetting: vettingScore(v), product, reputation, fit };
    out.push({ listing: l, parts, score: Object.values(parts).reduce((s, n) => s + n, 0) });
  }
  return out.sort((x, y) => y.score - x.score);
}
