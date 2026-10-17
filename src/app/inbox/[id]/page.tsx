import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketDetail } from "@/components/ticket/ticket-detail";
import { getTicketById, getTicketDetail } from "@/application/tickets/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/inbox/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const ticket = await getTicketById(id);
  return { title: ticket ? `${ticket.number} · ${ticket.subject.slice(0, 40)}` : "Ticket" };
}

export default async function TicketPage(props: PageProps<"/inbox/[id]">) {
  const { id } = await props.params;
  const detail = await getTicketDetail(id);
  if (!detail) notFound();

  return (
    <TicketDetail
      key={detail.ticket.id}
      ticket={detail.ticket}
      agents={detail.agents}
      audit={detail.audit}
    />
  );
}