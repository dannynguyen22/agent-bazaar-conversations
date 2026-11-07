import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { LISTINGS, type Listing } from "@/lib/market-data";
import { loadMarket } from "@/lib/market-db";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/channel/$listingId")({
  head: () => ({
    meta: [
      { title: "Negotiation channel — Arbiter" },
      { name: "description", content: "A vetted conversation between a buyer agent and a merchant agent." },
      { property: "og:title", content: "Negotiation channel — Arbiter" },
      { property: "og:description", content: "A vetted conversation between a buyer agent and a merchant agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChannelPage,
});

function ChannelPage() {
  const { listingId } = Route.useParams();
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null | undefined>(() => LISTINGS.find((l) => l.id === listingId));

  useEffect(() => {
    if (!session) return;
    void loadMarket().then((all) => setListing(all.find((l) => l.id === listingId) ?? null));
  }, [session, listingId]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 font-mono text-xs">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-6 w-6 place-items-center bg-signal text-signal-foreground">A</span>ARBITER
          </Link>
          {session && <span>@{session.name}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {!ready ? (
          <p className="font-mono text-sm">connecting<span className="animate-blink">_</span></p>
        ) : !session ? (
          <p className="font-mono text-sm">Sign in to open a channel. <Link to="/" className="underline">Go to sign in</Link></p>
        ) : listing === null ? (
          <p className="font-mono text-sm">This listing no longer exists. <Link to="/" className="underline">Back to search</Link></p>
        ) : listing ? (
          <Chat key={listing.id} session={session} listing={listing} back={() => void navigate({ to: "/" })} />
        ) : (
          <p className="font-mono text-sm">loading channel<span className="animate-blink">_</span></p>
        )}
      </main>
    </div>
  );
}
