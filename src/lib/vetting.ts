import { useSyncExternalStore } from "react";

export type VetStatus = "unverified" | "pending" | "verified" | "rejected";
export type VetRecord = { status: VetStatus; strikes: number; banned: boolean; log: string[]; doc?: string };

export const STRIKE_LIMIT = 3;

let state: Record<string, VetRecord> = {
  adidas: { status: "verified", strikes: 0, banned: false, log: ["Commercial licence DE-HRB 3868 matched registry"] },
  newera: { status: "verified", strikes: 0, banned: false, log: ["Business licence matched US registry"] },
  mike: { status: "verified", strikes: 0, banned: false, log: ["Private seller ID verified"] },
  fixit: { status: "verified", strikes: 1, banned: false, log: ["Licence verified", "Strike: quoted €60, invoiced €140"] },
  pixel: { status: "pending", strikes: 0, banned: false, log: ["Documents submitted, under review"] },
  cheapdeals: { status: "unverified", strikes: 2, banned: false, log: ["Strike: claimed 'genuine' on replica item", "Strike: changed price mid-deal"] },
  me: { status: "unverified", strikes: 0, banned: false, log: [] },
};
const subs = new Set<() => void>();
const set = (id: string, r: Partial<VetRecord>) => {
  const cur = state[id] ?? { status: "unverified", strikes: 0, banned: false, log: [] };
  state = { ...state, [id]: { ...cur, ...r } };
  subs.forEach((f) => f());
};

export function useVet() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state, () => state);
}
export const getVet = (id: string) => state[id];

/** Adds a strike; bans automatically once the limit is reached. Returns true if now banned. */
export function addStrike(id: string, reason: string) {
  const cur = state[id];
  if (!cur || cur.banned) return cur?.banned ?? false;
  const strikes = cur.strikes + 1;
  const banned = strikes >= STRIKE_LIMIT;
  set(id, { strikes, banned, log: [...cur.log, `Strike ${strikes}/${STRIKE_LIMIT}: ${reason}`, ...(banned ? ["BANNED by vetting engine"] : [])] });
  return banned;
}

export function submitDocs(id: string, doc: string, licence: string) {
  set(id, { status: "pending", doc, log: [...(state[id]?.log ?? []), `Submitted ${doc} (licence ${licence})`] });
  setTimeout(() => {
    const ok = licence.trim().length >= 5;
    set(id, {
      status: ok ? "verified" : "rejected",
      log: [...state[id]!.log, ok ? "Registry match ✓ · document authentic ✓ · name match ✓" : "Rejected: licence number not found in registry"],
    });
  }, 3500);
}

/** Simple bluff detector: flags seller claims that contradict the listing. */
export function detectBluff(sellerText: string, listedPrice: string): string | null {
  const nums = (s: string) => (s.match(/€\s?(\d+)/g) ?? []).map((x) => Number(x.replace(/\D/g, "")));
  const listed = nums(listedPrice)[0];
  const claimed = nums(sellerText);
  if (listed && claimed.some((n) => n > listed)) return `price claim €${Math.max(...claimed)} contradicts listing ${listedPrice}`;
  if (/100% genuine|guaranteed original|only today|last one/i.test(sellerText)) return "unverifiable pressure / authenticity claim";
  return null;
}
