import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/layout/nav";
import { getEnv } from "@/infrastructure/config/env";
import { getSession } from "@/infrastructure/auth/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Triagely — Support Inbox Automation",
    template: "%s — Triagely",
  },
  description:
    "AI support inbox automation: classify, prioritize, route and draft replies for customer tickets, with SLA tracking and analytics.",
  applicationName: "Triagely",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const engine = getEnv().LLM_API_KEY ? "hybrid" : "heuristic";
  const user = await getSession();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <Nav engine={engine} user={user} />
        <main className="shell py-6 md:py-8">{children}</main>
        <footer className="shell pb-8 pt-2">
          <p className="border-t border-line pt-4 font-mono text-[10px] uppercase tracking-wider text-faint">
            Triagely · deterministic triage engine · SLA policy · audit trail
          </p>
        </footer>
      </body>
    </html>
  );
}