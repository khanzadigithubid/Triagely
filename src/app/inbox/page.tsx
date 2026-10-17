import type { Metadata } from "next";
import { InboxView } from "@/components/inbox/inbox-view";
import { listTickets } from "@/application/tickets/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const tickets = await listTickets();
  return <InboxView tickets={tickets} />;
}