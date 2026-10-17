import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { getTicketAudit, getTicketById, listAgents } from "@/application/tickets/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/inbox/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const ticket = getTicketById(id);
  return { title: ticket ? `${ticket.number} · ${ticket.subject.slice(0, 40)}` : "Ticket" };
}

export default async function TicketPage(props: PageProps<"/inbox/[id]">) {
  const { id } = await props.params;
  const ticket = getTicketById(id);
  if (!ticket) notFound();

  return (
    <TicketDetail key={ticket.id} ticket={ticket} agents={listAgents()} audit={getTicketAudit(id)} />
  );
}