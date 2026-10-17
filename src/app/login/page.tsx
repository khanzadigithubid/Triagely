import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/infrastructure/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="mx-auto max-w-sm py-10">
      <Card>
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Triagely</h1>
          <p className="mt-1 text-xs text-muted">
            Mutations — replies, triage, priority and assignment changes — require an operator
            account.
          </p>
        </div>
        <LoginForm />
        <p className="mt-4 border-t border-line-soft pt-4 text-[11px] leading-relaxed text-faint">
          First run seeds a bootstrap admin. Default credentials are{" "}
          <span className="font-mono text-muted">admin@triagely.app</span> /{" "}
          <span className="font-mono text-muted">triagely-admin</span> unless{" "}
          <span className="font-mono text-muted">ADMIN_EMAIL</span> /{" "}
          <span className="font-mono text-muted">ADMIN_PASSWORD</span> are set.
        </p>
      </Card>
    </div>
  );
}
