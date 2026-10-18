import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/infrastructure/auth/session";
import { listApiKeys } from "@/infrastructure/auth/api-keys";
import { ApiKeysManager } from "@/components/keys/api-keys-manager";
import { Card, SectionHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "API keys" };

export default async function KeysPage() {
  if (!(await getSession())) redirect("/login");

  const keys = await listApiKeys();

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Developers</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Machine-to-machine credentials for the public REST API. Send one as{" "}
          <span className="font-mono text-muted">x-api-key</span> or{" "}
          <span className="font-mono text-muted">Authorization: Bearer</span>.
        </p>
      </div>

      <ApiKeysManager initialKeys={keys} />

      <Card>
        <SectionHeader title="Endpoints" hint="All require a valid API key" />
        <ul className="space-y-2 font-mono text-xs text-muted">
          {[
            ["GET", "/api/v1/tickets", "list — status, category, priority, q, limit, offset"],
            ["POST", "/api/v1/tickets", "ingest + triage a raw inbound message"],
            ["GET", "/api/v1/tickets/:id", "fetch an enriched ticket"],
            ["PATCH", "/api/v1/tickets/:id", "resolve · reopen · reassign · priority · regenerate_draft"],
            ["POST", "/api/v1/tickets/:id/reply", "send a reply over email"],
            ["GET", "/api/v1/analytics", "aggregate analytics"],
          ].map(([method, route, note]) => (
            <li key={route + method} className="flex flex-wrap items-baseline gap-2">
              <span className="pill bg-white/5 text-ink">{method}</span>
              <span className="text-ink">{route}</span>
              <span className="text-faint">— {note}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
