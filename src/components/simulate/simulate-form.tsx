"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";
import type { TicketView } from "@/application/tickets/queries";
import { Card, SectionHeader } from "@/components/ui/card";
import { Avatar, CategoryPill, PriorityPill, SentimentPill, SlaPill, TagList } from "@/components/ui/pills";

interface Draft {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}

const PRESETS: { label: string; draft: Draft }[] = [
  {
    label: "Production outage",
    draft: {
      fromName: "Dmitri Volkov",
      fromEmail: "dmitri@northwind-labs.io",
      subject: "URGENT: checkout is down, 500 errors everywhere",
      body: "Our production checkout is down for all customers right now. The payments endpoint returns a 500 error. This is an emergency — please escalate immediately.",
    },
  },
  {
    label: "Double charge",
    draft: {
      fromName: "Emma Johnson",
      fromEmail: "emma.johnson@brightrete.com",
      subject: "You charged my card twice",
      body: "I was charged twice for the same subscription this month. I want a refund for the duplicate invoice. This is really frustrating.",
    },
  },
  {
    label: "Feature request",
    draft: {
      fromName: "Nadia Haddad",
      fromEmail: "nadia.haddad@levant-analytics.com",
      subject: "Feature idea: dark mode?",
      body: "Hello! I love the product. Could you add dark mode to the mobile app? It would be amazing. Thanks!",
    },
  },
  {
    label: "Spanish account issue",
    draft: {
      fromName: "Carlos Mendes",
      fromEmail: "carlos.mendes@solucoes.pt",
      subject: "No puedo acceder a mi cuenta",
      body: "No puedo acceder a mi cuenta, la contraseña no funciona y me pide un código de verificación. Por favor ayúdenme, es urgente.",
    },
  },
];

export function SimulateForm() {
  const [draft, setDraft] = useState<Draft>({
    fromName: "",
    fromEmail: "",
    subject: "",
    body: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketView | null>(null);

  function update<K extends keyof Draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingest failed");

      const detail = await fetch(`/api/tickets/${data.ticketId}`).then((r) => r.json());
      setResult(detail.ticket as TicketView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const valid = draft.fromName && draft.fromEmail.includes("@") && draft.subject && draft.body;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionHeader
          title="Compose an inbound email"
          hint="Run it through the live triage engine"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setDraft(preset.draft);
                setResult(null);
                setError(null);
              }}
              className="pill bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-ink"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From name">
            <input
              value={draft.fromName}
              onChange={(e) => update("fromName", e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </Field>
          <Field label="From email">
            <input
              value={draft.fromEmail}
              onChange={(e) => update("fromEmail", e.target.value)}
              placeholder="jane@company.com"
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Subject" className="mt-3">
          <input
            value={draft.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="Cannot log in to my account"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </Field>

        <Field label="Message" className="mt-3">
          <textarea
            value={draft.body}
            onChange={(e) => update("body", e.target.value)}
            rows={7}
            placeholder="Describe the customer's message…"
            className="w-full resize-y rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-faint focus:outline-none"
          />
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !valid}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {busy ? "Triaging…" : "Run triage"}
        </button>

        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </Card>

      <Card>
        <SectionHeader title="Triage result" hint="What the automation decided, live" />
        {!result ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
            <Sparkles className="size-6 text-faint" aria-hidden />
            <p className="text-sm text-muted">Run an email to see the classification.</p>
            <p className="max-w-xs text-xs text-faint">
              Category, sentiment, urgency, priority scoring, agent routing, SLA deadline and a
              draft reply are produced in one pass.
            </p>
          </div>
        ) : (
          <div className="animate-rise space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  {result.number} · {result.channel}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-ink">{result.subject}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Avatar name={result.fromName} className="size-5" />
                  {result.fromName}
                </p>
              </div>
              <span className="pill bg-white/5 text-faint">{result.classification.engine}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <CategoryPill category={result.classification.category} />
              <PriorityPill priority={result.classification.priority} />
              <SentimentPill sentiment={result.classification.sentiment} />
              <SlaPill status={result.sla.status} />
            </div>

            <dl className="grid grid-cols-2 gap-3 border-y border-line-soft py-4 text-xs sm:grid-cols-4">
              <Metric label="Priority score" value={result.classification.priorityScore} />
              <Metric label="Urgency" value={result.classification.urgencyScore} />
              <Metric label="Category conf." value={`${Math.round(result.classification.categoryConfidence * 100)}%`} />
              <Metric
                label="Sentiment"
                value={`${result.classification.sentimentScore >= 0 ? "+" : ""}${result.classification.sentimentScore.toFixed(2)}`}
              />
            </dl>

            <div>
              <p className="eyebrow mb-2">Tags</p>
              <TagList tags={result.classification.tags} />
            </div>

            <div className="panel-2 p-3">
              <p className="eyebrow mb-1.5">Routed to</p>
              <p className="text-sm text-ink">
                {result.agent ? `${result.agent.name} · ${result.agent.role}` : "No agent available"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-faint">
                SLA target {result.sla.targetMinutes}m
              </p>
            </div>

            <div className="panel-2 p-3">
              <p className="eyebrow mb-1.5">Draft reply</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted">
                {result.draftReply}
              </p>
            </div>

            <Link
              href={`/inbox/${result.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Open full ticket <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs text-faint">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}