import type { Metadata } from "next";
import { SimulateForm } from "@/components/simulate/simulate-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Simulate" };

export default function SimulatePage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Automation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Simulate an inbound email</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          This calls the same ingest endpoint an email/helpdesk webhook would. The ticket is
          classified, scored, routed and added to the live queue — then persisted with an audit trail.
        </p>
      </div>
      <SimulateForm />
    </div>
  );
}