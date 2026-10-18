"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { ApiKeyView } from "@/infrastructure/auth/api-keys";
import { ROLES, type Role } from "@/infrastructure/auth/types";
import { Card, SectionHeader } from "@/components/ui/card";

interface CreatedKey {
  key: ApiKeyView;
  secret: string;
}

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyView[] }) {
  const [keys, setKeys] = useState<ApiKeyView[]>(initialKeys);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired — sign in again");
      if (!res.ok) throw new Error(data.error ?? "Could not create key");
      setCreated(data as CreatedKey);
      setKeys((prev) => [data.key as ApiKeyView, ...prev]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Session expired — sign in again");
      if (!res.ok) throw new Error(data.error ?? "Could not revoke key");
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-5">
      {created ? <SecretBanner created={created} onDismiss={() => setCreated(null)} /> : null}

      <Card>
        <SectionHeader
          title="Mint a key"
          hint="For machines — CI, Zapier, a backend. The secret is shown once."
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1">
            <span className="mb-1 block text-xs text-faint">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zapier production"
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-faint">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={mint}
            disabled={busy || name.trim().length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {busy ? "Creating…" : "Create key"}
          </button>
        </div>
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      </Card>

      <Card>
        <SectionHeader title="Active keys" hint={`${keys.filter((k) => !k.revoked).length} usable`} />
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <KeyRound className="size-6 text-faint" aria-hidden />
            <p className="text-sm text-muted">No keys yet — mint one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-ink">{k.name}</p>
                    <span className="pill bg-white/5 text-faint">{k.role}</span>
                    {k.revoked ? (
                      <span className="pill bg-rose-500/10 text-rose-300">revoked</span>
                    ) : (
                      <span className="pill bg-emerald-500/10 text-emerald-300">active</span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-faint">
                    tgk_{k.prefix}_•••• · created {new Date(k.createdAt).toLocaleDateString()} ·{" "}
                    {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(k.id)}
                  disabled={k.revoked || revoking === k.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                >
                  {revoking === k.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden />
                  )}
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SecretBanner({ created, onDismiss }: { created: CreatedKey; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            Key “{created.key.name}” created — copy it now
          </p>
          <p className="mt-0.5 text-xs text-muted">
            This is the only time the secret is shown. Store it somewhere safe.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-xs text-ink">
              {created.secret}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/8 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-white/12"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 text-xs text-muted underline-offset-2 hover:underline"
          >
            Done, I saved it
          </button>
        </div>
      </div>
    </div>
  );
}
