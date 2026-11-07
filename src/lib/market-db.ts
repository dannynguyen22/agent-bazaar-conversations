import { supabase } from "@/integrations/supabase/client";
import { AGENTS, LISTINGS, type Listing, type Msg } from "@/lib/market-data";
import { registerVet, type VetStatus } from "@/lib/vetting";

export type Profile = { id: string; display_name: string; account_type: string; vet_status: string };

/** Loads saved merchants + listings and merges them with the built-in demo merchants. */
export async function loadMarket(): Promise<Listing[]> {
  const [{ data: profiles }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, account_type, vet_status"),
    supabase.from("listings").select("*").order("created_at", { ascending: false }),
  ]);
  for (const p of profiles ?? []) {
    if (!AGENTS.find((a) => a.id === p.id))
      AGENTS.push({ id: p.id, handle: `@${p.display_name}`, company: p.display_name, about: `Registered ${p.account_type} merchant on Agora.`, website: "https://example.com", trust: 70, deals: 0, transact: "Terms agreed directly" });
    registerVet(p.id, p.vet_status as VetStatus);
  }
  const saved: Listing[] = (rows ?? []).map((r) => ({ id: r.id, title: r.title, kind: r.kind as Listing["kind"], price: r.price, tags: r.tags, agentId: r.user_id, saved: true }));
  return [...saved, ...LISTINGS];
}

export async function addListing(userId: string, l: Omit<Listing, "id" | "agentId">) {
  const { error } = await supabase.from("listings").insert({ user_id: userId, title: l.title, kind: l.kind, price: l.price, tags: l.tags });
  if (error) throw error;
}

export async function deleteListing(id: string) {
  await supabase.from("listings").delete().eq("id", id);
}

export async function saveVetStatus(userId: string, status: VetStatus, doc: string, licence: string) {
  await supabase.from("profiles").update({ vet_status: status, doc_name: doc, licence }).eq("id", userId);
}

export async function saveConversation(userId: string, listingTitle: string, handle: string, outcome: string, messages: Msg[]) {
  await supabase.from("conversations").insert({ user_id: userId, listing_title: listingTitle, merchant_handle: handle, outcome, messages });
}

export async function loadConversations() {
  const { data } = await supabase.from("conversations").select("*").order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
