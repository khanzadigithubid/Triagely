import type {
  Agent,
  AuditEvent,
  Channel,
  Message,
  Store,
  Ticket,
} from "@/domain/ticket/schemas";
import { triageTicket } from "@/domain/triage/engine";
import { classifyCategory } from "@/domain/triage/classifier";
import { pickAssignee, recomputeOpenWorkloads } from "@/domain/triage/assignment";
import { slaDeadline, evaluateSla } from "@/domain/sla/policy";
import { getEnv } from "@/infrastructure/config/env";

/**
 * Seed store.
 *
 * Realistic, geographically spread inbound tickets fed through the real triage
 * engine, so the seeded data always matches what the live engine produces.
 * Timestamps are offset from "now" at seed time, which makes SLA states vary
 * naturally across within / at-risk / breached.
 */

interface SeedTicket {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  channel?: Channel;
  minutesAgo: number;
  status: "new" | "open" | "pending" | "resolved";
  agentReply?: string;
}

const AGENTS: Agent[] = [
  { id: "ag_aida", name: "Aida Rahman", role: "Frontline Support", specialty: ["general"], languages: ["en", "es"], active: true },
  { id: "ag_marco", name: "Marco Bianchi", role: "Billing Specialist", specialty: ["billing", "refund"], languages: ["en", "de"], active: true },
  { id: "ag_priya", name: "Priya Sharma", role: "Technical Support Engineer", specialty: ["technical", "product"], languages: ["en", "fr"], active: true },
  { id: "ag_tomas", name: "Tomas Nilsson", role: "Solutions Engineer", specialty: ["product", "request"], languages: ["en", "de"], active: true },
  { id: "ag_luisa", name: "Luisa Garcia", role: "Account & Security Lead", specialty: ["account", "billing"], languages: ["en", "es"], active: true },
  { id: "ag_kenji", name: "Kenji Watanabe", role: "API Support Engineer", specialty: ["technical", "account"], languages: ["en", "ja"], active: true },
];

const SEED_TICKETS: SeedTicket[] = [
  {
    fromName: "Dmitri Volkov",
    fromEmail: "dmitri@northwind-labs.io",
    subject: "URGENT: production API is down — checkout failing for all customers",
    body: "Our production checkout is down right now. Every request to the /v2/payments endpoint returns a 500 error and customers cannot complete orders. This is an emergency, please treat it as P0 and escalate immediately.",
    minutesAgo: 13,
    status: "open",
  },
  {
    fromName: "Sofia Almeida",
    fromEmail: "sofia.almeida@gmail.com",
    subject: "Account was hacked, I am locked out",
    body: "Someone accessed my account and changed the password. I cannot log in and there is suspicious activity on my billing page. I am locked out and worried about unauthorized charges. Please help urgently.",
    minutesAgo: 44,
    status: "open",
  },
  {
    fromName: "Emma Johnson",
    fromEmail: "emma.johnson@brightrete.com",
    subject: "Charged twice this month — very disappointed",
    body: "You charged my credit card twice for the same monthly subscription. The second invoice is a duplicate and I want a refund. This is unacceptable and frankly quite frustrating.",
    minutesAgo: 96,
    status: "open",
  },
  {
    fromName: "Hiroshi Tanaka",
    fromEmail: "h.tanaka@kaizen-dev.jp",
    subject: "Webhook events not firing after migration",
    body: "Since our migration last week, webhook events are not firing. The endpoint is reachable but no sync happens. We see a timeout in our logs. Is this a known issue with the integration?",
    minutesAgo: 210,
    status: "open",
  },
  {
    fromName: "Camille Laurent",
    fromEmail: "camille@atelier-laurent.fr",
    subject: "Does your product support importing from Notion?",
    body: "Bonjour, I would like to know if it is possible to import our Notion workspace into your product. Is this on the roadmap? Merci beaucoup for your help.",
    minutesAgo: 340,
    status: "open",
  },
  {
    fromName: "Ravi Menon",
    fromEmail: "ravi.menon@vertexsystems.in",
    subject: "Requesting an enterprise quote and security questionnaire",
    body: "We are evaluating vendors for our 400-person team. Could we book a demo and get a pricing proposal? We also need a security questionnaire completed before procurement sign-off.",
    minutesAgo: 505,
    status: "open",
  },
  {
    fromName: "Lena Fischer",
    fromEmail: "lena.fischer@deutsche-cloud.de",
    subject: "Bitte um Rückerstattung — Rechnung doppelt abgebucht",
    body: "Guten Tag, die Rechnung wurde doppelt von meinem Konto abgebucht. Ich bitte um eine Rückerstattung des zu viel gezahlten Betrags. Danke im Voraus.",
    minutesAgo: 640,
    status: "pending",
    agentReply:
      "Hallo Lena, vielen Dank für Ihre Nachricht. I've started the refund review for the duplicate charge — you'll get a confirmation here as soon as finance approves it.",
  },
  {
    fromName: "Marcus Bell",
    fromEmail: "marcus.bell@fieldstone.co",
    subject: "CSV export returns a broken file",
    body: "When I export my data to CSV, the download is broken — it looks like a corrupted zip. This is blocking my month-end report and I have a deadline today.",
    minutesAgo: 720,
    status: "open",
  },
  {
    fromName: "Isabella Rossi",
    fromEmail: "isabella@moda-rossi.it",
    subject: "2FA verification code never arrives",
    body: "I enabled two-factor authentication but the verification code never arrives on my phone. I cannot log in to my account. Please help, I need access today.",
    minutesAgo: 1500,
    status: "open",
  },
  {
    fromName: "Nadia Haddad",
    fromEmail: "nadia.haddad@levant-analytics.com",
    subject: "Feature request: dark mode for the mobile app",
    body: "Hello! I love using your product. One small suggestion: could you add dark mode to the mobile app? It would be a great feature. Thanks for the amazing work!",
    minutesAgo: 2600,
    status: "resolved",
    agentReply:
      "Hi Nadia, thank you so much for the kind words and the suggestion — I've logged dark mode as a feature request with our product team. We'll keep you posted!",
  },
  {
    fromName: "Owen Wright",
    fromEmail: "owen.wright@harbor-freight.uk",
    subject: "Cannot log in after password reset",
    body: "I reset my password but the new one does not work and I keep getting an authentication failed error. I am locked out of my account completely.",
    minutesAgo: 3200,
    status: "resolved",
    agentReply:
      "Hi Owen, I've cleared the stuck session and confirmed your new password now works. Please try again and let me know if anything looks off.",
  },
  {
    fromName: "Amara Okafor",
    fromEmail: "amara.okafor@lagostech.ng",
    subject: "Overcharged on the annual plan — need a refund",
    body: "I was charged the enterprise rate on my annual plan but I am on the standard tier. This is a billing error and I want the difference refunded.",
    minutesAgo: 4100,
    status: "open",
  },
  {
    fromName: "Yuki Sato",
    fromEmail: "yuki.sato@sakura-digital.jp",
    subject: "アカウントにログインできません",
    body: "アカウントにログインできません。パスワードをリセットしてもエラーが出ます。至急サポートをお願いします。",
    minutesAgo: 5200,
    status: "open",
  },
  {
    fromName: "Carlos Mendes",
    fromEmail: "carlos.mendes@solucoes.pt",
    subject: "Payment failed but card was charged",
    body: "O pagamento falhou mas o cartão foi debitado. O recibo mostra uma cobrança mas o serviço continua bloqueado. Preciso de ajuda com urgência.",
    minutesAgo: 6100,
    status: "pending",
    agentReply:
      "Olá Carlos, thanks for flagging this. I've escalated the payment reconciliation to our billing team and we'll confirm the correction here shortly.",
  },
  {
    fromName: "Grace Kim",
    fromEmail: "grace.kim@seoulsystems.kr",
    subject: "Great support last week!",
    body: "Just wanted to say thank you — the team resolved my issue so quickly and the product works perfectly now. Best support experience I have had. Keep it up!",
    minutesAgo: 7400,
    status: "resolved",
    agentReply: "Thank you so much, Grace — this made our day. We're always here if you need anything!",
  },
  {
    fromName: "Peter Nowak",
    fromEmail: "peter.nowak@polskabank.pl",
    subject: "API access token expired and cannot be renewed",
    body: "Our integration fails because the access token expired and the renewal endpoint returns an error. This is blocking our nightly sync. Please advise.",
    minutesAgo: 8800,
    status: "resolved",
    agentReply:
      "Hi Peter, we rotated the token and the renewal endpoint is healthy again. Your nightly sync should complete normally tonight.",
  },
  {
    fromName: "Fatima Al-Sayed",
    fromEmail: "fatima@dubai-ventures.ae",
    subject: "Question about GDPR data processing agreement",
    body: "We are onboarding and our legal team needs the GDPR data processing agreement and a record of processing activities. Could you point us to the documentation?",
    minutesAgo: 9600,
    status: "open",
  },
  {
    fromName: "Lucas Ferreira",
    fromEmail: "lucas.ferreira@riotech.br",
    subject: "Slack integration disconnects every few hours",
    body: "The Slack integration keeps disconnecting every few hours and we have to reconnect manually. It is slowing down our team. Can you look into this?",
    minutesAgo: 10200,
    status: "open",
  },
  {
    fromName: "Hannah Müller",
    fromEmail: "hannah@zurich-fintech.ch",
    subject: "Enterprise plan invoice needs our VAT number",
    body: "Our finance team needs the invoice updated with our VAT number. Could you reissue it? Also we would like to speak to sales about adding seats.",
    minutesAgo: 11000,
    status: "resolved",
    agentReply:
      "Hi Hannah, the invoice has been reissued with your VAT number and our sales team will reach out about the additional seats within the hour.",
  },
];

export function buildSeedStore(nowMs: number = Date.now()): Store {
  const org = getEnv().SUPPORT_ORG;
  const signature = getEnv().SUPPORT_SIGNATURE;
  const tickets: Ticket[] = [];
  const audit: AuditEvent[] = [];
  let roundRobin = 0;

  SEED_TICKETS.forEach((seed, index) => {
    const receivedAtMs = nowMs - seed.minutesAgo * 60_000;

    const workloads = recomputeOpenWorkloads(tickets);
    const category = classifyCategory(seed.subject, seed.body).category;
    const routedAgentId = pickAssignee(AGENTS, category, workloads, roundRobin);
    roundRobin += 1;
    const agent = AGENTS.find((a) => a.id === routedAgentId);

    const triaged = triageTicket(
      { subject: seed.subject, body: seed.body, fromName: seed.fromName },
      { agent, org, signature },
    );

    const deadline = slaDeadline(receivedAtMs, triaged.classification.priority);
    const sla = evaluateSla(
      receivedAtMs,
      Date.parse(deadline.targetAt),
      seed.status === "resolved" ? Date.parse(deadline.targetAt) - 60_000 : nowMs,
    );

    const ticketId = `tkt_${String(index + 1).padStart(4, "0")}`;
    const thread: Message[] = [
      {
        id: `${ticketId}_m1`,
        at: new Date(receivedAtMs).toISOString(),
        from: "customer",
        body: seed.body,
      },
    ];

    if (seed.agentReply) {
      thread.push({
        id: `${ticketId}_m2`,
        at: new Date(receivedAtMs + 25 * 60_000).toISOString(),
        from: "agent",
        body: seed.agentReply,
      });
    }

    const ticket: Ticket = {
      id: ticketId,
      number: `TKT-${1000 + index + 1}`,
      messageId: `seed-${index + 1}@inbound.triagely.test`,
      receivedAt: new Date(receivedAtMs).toISOString(),
      updatedAt: new Date(
        receivedAtMs + (seed.agentReply ? 25 : 0) * 60_000,
      ).toISOString(),
      channel: seed.channel ?? "email",
      fromName: seed.fromName,
      fromEmail: seed.fromEmail,
      subject: seed.subject,
      body: seed.body,
      language: detectLanguageFor(seed),
      classification: triaged.classification,
      sla: { ...deadline, status: sla.status },
      status: seed.status,
      assigneeId: routedAgentId,
      draftReply: triaged.draftReply,
      draftReplyEngine: triaged.draftReplyEngine,
      thread,
      priorityLocked: false,
    };

    tickets.push(ticket);
    audit.push({
      id: `aud_${index + 1}`,
      at: ticket.receivedAt,
      ticketId,
      actor: "triagely",
      action: "auto_triaged",
      detail: `${triaged.classification.category}/${triaged.classification.priority} → ${agent?.name ?? "unassigned"}`,
    });
  });

  return {
    version: 1,
    seededAt: new Date(nowMs).toISOString(),
    org,
    agents: AGENTS,
    tickets,
    audit,
    counters: { nextNumber: 1000 + SEED_TICKETS.length + 1, roundRobin },
  };
}

function detectLanguageFor(seed: SeedTicket): Ticket["language"] {
  const text = `${seed.subject} ${seed.body}`;
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return "ja";
  if (/(rückerstattung|rechnung|bitte|danke|abgebucht|konto)/i.test(text)) return "de";
  if (/(bonjour|merci|aujourd|problème)/i.test(text)) return "fr";
  if (/(pagamento|recibo|cobrança|urgência|não)/i.test(text)) return "es";
  return "en";
}