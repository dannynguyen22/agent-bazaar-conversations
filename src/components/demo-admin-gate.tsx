import { useState, type ReactNode } from "react";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Presentation-only demo access: this never grants an account real admin permissions.
export function DemoAdminGate({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <LockKeyhole className="h-10 w-10 text-signal" aria-hidden="true" />
        <p className="mt-6 font-mono text-xs uppercase text-muted-foreground">Restricted access</p>
        <h2 className="mt-2 text-3xl font-bold">Admin login required</h2>
        <p className="mt-3 text-sm text-muted-foreground">The vetting engine is reserved for administrators.</p>
        <Button onClick={() => setEntered(true)} className="mt-6 bg-signal font-mono text-signal-foreground hover:bg-signal/90">
          <ShieldCheck aria-hidden="true" /> Enter as admin (demo)
        </Button>
        <p className="mt-3 font-mono text-xs text-muted-foreground">Demo access only · no administrator permissions granted</p>
      </section>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-signal" aria-hidden="true" />Admin demo</span>
        <Button variant="outline" size="sm" onClick={() => setEntered(false)} className="font-mono"><LogOut aria-hidden="true" />Exit admin</Button>
      </div>
      {children}
    </>
  );
}