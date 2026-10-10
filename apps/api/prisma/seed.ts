import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  PrismaClient,
  type Priority,
  type Role,
  type TicketStatus,
} from '../src/generated/prisma/client.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const DEMO_PASSWORD = 'Demo12345!';
const HOUR = 60 * 60 * 1000;

type UserKey = 'admin' | 'agent1' | 'agent2' | 'customer1' | 'customer2' | 'customer3';
type CustomerKey = 'customer1' | 'customer2' | 'customer3';
type AgentKey = 'agent1' | 'agent2';

const USERS: { key: UserKey; email: string; name: string; role: Role }[] = [
  { key: 'admin', email: 'demo.admin@example.com', name: 'Alex Admin', role: 'ADMIN' },
  { key: 'agent1', email: 'demo.agent1@example.com', name: 'Sam Support', role: 'AGENT' },
  { key: 'agent2', email: 'demo.agent2@example.com', name: 'Dana Support', role: 'AGENT' },
  { key: 'customer1', email: 'demo.customer1@example.com', name: 'Linh Tran', role: 'CUSTOMER' },
  { key: 'customer2', email: 'demo.customer2@example.com', name: 'Minh Nguyen', role: 'CUSTOMER' },
  { key: 'customer3', email: 'demo.customer3@example.com', name: 'Hana Sato', role: 'CUSTOMER' },
];

interface SeedComment {
  from: 'customer' | AgentKey;
  body: string;
  minutesAfter: number;
  internal?: boolean;
}

interface SeedTicket {
  customer: CustomerKey;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: Priority;
  assignee?: AgentKey;
  hoursAgo: number;
  comments?: SeedComment[];
}

// A fictional e-wallet called "PayEase".
const TICKETS: SeedTicket[] = [
  {
    customer: 'customer1',
    subject: 'Withdrawal pending for 3 days',
    body: 'I requested a withdrawal of 5,000,000 VND to my bank account on Monday and it is still pending. The money left my wallet but has not arrived in my bank.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: 'agent1',
    hoursAgo: 70,
    comments: [
      { from: 'agent1', minutesAfter: 30, body: 'Hi Linh, thanks for reaching out. The transfer is waiting on the partner bank and I am escalating it now.' },
      { from: 'agent1', minutesAfter: 35, internal: true, body: 'Partner bank batch failed on Tuesday. Reprocessing requested, ref WD-4821.' },
      { from: 'customer', minutesAfter: 240, body: 'Thank you, please let me know as soon as it arrives.' },
    ],
  },
  {
    customer: 'customer2',
    subject: 'Charged twice for the same payment',
    body: 'I paid 250,000 VND at a coffee shop with a QR code and was charged twice. The shop only received one payment.',
    status: 'OPEN',
    priority: 'HIGH',
    hoursAgo: 5,
  },
  {
    customer: 'customer3',
    subject: 'Cannot log in after changing phone',
    body: 'I got a new phone and the app asks for a code sent to my old number. I no longer have access to my old SIM.',
    status: 'WAITING_CUSTOMER',
    priority: 'MEDIUM',
    assignee: 'agent2',
    hoursAgo: 48,
    comments: [
      { from: 'agent2', minutesAfter: 60, body: 'Hi Hana, to verify it is you, please reply with the last four digits of your ID number and your date of birth.' },
    ],
  },
  {
    customer: 'customer1',
    subject: 'Suspicious login alert from another country',
    body: 'I received an email saying my account was accessed from an unknown device abroad. I did not do this. Please lock my account.',
    status: 'OPEN',
    priority: 'URGENT',
    hoursAgo: 2,
  },
  {
    customer: 'customer2',
    subject: 'Add dark mode to the app',
    body: 'The white screen is very bright at night. It would be great to have a dark theme.',
    status: 'OPEN',
    priority: 'LOW',
    hoursAgo: 120,
  },
  {
    customer: 'customer3',
    subject: 'Refund for cancelled order not received',
    body: 'Order 88231 was cancelled by the merchant 10 days ago. The refund still has not reached my wallet.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    assignee: 'agent1',
    hoursAgo: 96,
    comments: [
      { from: 'agent1', minutesAfter: 120, body: 'Hi Hana, I have contacted the merchant. Refunds normally take 5 to 7 working days after cancellation.' },
      { from: 'agent1', minutesAfter: 125, internal: true, body: 'Merchant says the refund was issued on the 4th. Checking the settlement file.' },
    ],
  },
  {
    customer: 'customer1',
    subject: 'Identity verification stuck on pending',
    body: 'I uploaded my ID three days ago and verification still says pending. I cannot raise my transfer limit.',
    status: 'OPEN',
    priority: 'MEDIUM',
    hoursAgo: 66,
  },
  {
    customer: 'customer2',
    subject: 'App crashes when opening transaction history',
    body: 'Since the last update the app closes immediately when I tap Transaction History. iPhone 13, iOS 18.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assignee: 'agent2',
    hoursAgo: 30,
    comments: [
      { from: 'agent2', minutesAfter: 90, body: 'Thanks Minh, we reproduced the crash and the engineers are working on a fix.' },
      { from: 'agent2', minutesAfter: 95, internal: true, body: 'Crash affects accounts with more than 1000 transactions. Bug filed as ENG-2207.' },
    ],
  },
  {
    customer: 'customer3',
    subject: 'Wrong exchange rate on USD transfer',
    body: 'I sent 100 USD and the rate applied was lower than the rate shown on screen before I confirmed.',
    status: 'RESOLVED',
    priority: 'MEDIUM',
    assignee: 'agent1',
    hoursAgo: 200,
    comments: [
      { from: 'agent1', minutesAfter: 300, body: 'Hi Hana, the displayed rate is indicative and refreshes every 30 seconds; your transfer used the rate at confirmation time. As a goodwill gesture I refunded the 42,000 VND difference.' },
      { from: 'customer', minutesAfter: 400, body: 'Understood, thank you!' },
    ],
  },
  {
    customer: 'customer1',
    subject: 'How do I close my account?',
    body: 'I no longer use the service. What are the steps to close my account and withdraw the remaining balance?',
    status: 'CLOSED',
    priority: 'LOW',
    assignee: 'agent2',
    hoursAgo: 300,
    comments: [
      { from: 'agent2', minutesAfter: 60, body: 'Hi Linh, first withdraw your balance, then go to Settings > Account > Close account. Let us know if you need help.' },
      { from: 'customer', minutesAfter: 600, body: 'Done, thanks.' },
    ],
  },
  {
    customer: 'customer2',
    subject: 'Transfer sent to the wrong account',
    body: 'I typed one wrong digit and sent 3,000,000 VND to the wrong person. Can you reverse it?',
    status: 'OPEN',
    priority: 'URGENT',
    hoursAgo: 1,
  },
  {
    customer: 'customer3',
    subject: 'Question about monthly fees',
    body: 'Is there a fee for receiving money from friends? I could not find it in the app.',
    status: 'RESOLVED',
    priority: 'LOW',
    assignee: 'agent2',
    hoursAgo: 150,
    comments: [
      { from: 'agent2', minutesAfter: 45, body: 'Hi Hana, receiving money is free. Fees only apply to withdrawals above 20 million VND per month.' },
    ],
  },
  {
    customer: 'customer1',
    subject: 'QR payment keeps failing at supermarket',
    body: 'Every QR payment at my supermarket fails with error 4012 but works everywhere else.',
    status: 'WAITING_CUSTOMER',
    priority: 'MEDIUM',
    assignee: 'agent1',
    hoursAgo: 40,
    comments: [
      { from: 'agent1', minutesAfter: 50, body: 'Hi Linh, could you tell us which supermarket branch it is and the time of your last attempt?' },
    ],
  },
  {
    customer: 'customer2',
    subject: 'Export statement as PDF',
    body: 'I need a PDF statement for the last 6 months for a visa application. Is this possible?',
    status: 'IN_PROGRESS',
    priority: 'LOW',
    assignee: 'agent2',
    hoursAgo: 20,
  },
  {
    customer: 'customer3',
    subject: 'Cannot change my phone number',
    body: 'The Change phone number option is greyed out in Settings.',
    status: 'OPEN',
    priority: 'MEDIUM',
    hoursAgo: 10,
  },
  {
    customer: 'customer1',
    subject: 'Cashback not credited',
    body: 'I was promised 5% cashback on my purchase last week and have not received it.',
    status: 'CLOSED',
    priority: 'LOW',
    assignee: 'agent1',
    hoursAgo: 400,
    comments: [{ from: 'agent1', minutesAfter: 100, body: 'The cashback has now been credited, sorry for the delay.' }],
  },
];

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const ids = new Map<UserKey, string>();
  for (const user of USERS) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, isActive: true, passwordHash },
      create: { email: user.email, name: user.name, role: user.role, passwordHash },
    });
    ids.set(user.key, saved.id);
  }
  const idOf = (key: UserKey): string => {
    const id = ids.get(key);
    if (!id) throw new Error(`Unknown user key: ${key}`);
    return id;
  };

  // Running the seed again resets the demo tickets, and only those.
  const customerIds = USERS.filter((u) => u.role === 'CUSTOMER').map((u) => idOf(u.key));
  const old = await prisma.ticket.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const oldIds = old.map((t) => t.id);
  await prisma.auditLog.deleteMany({ where: { entity: 'ticket', entityId: { in: oldIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: oldIds } } });

  // Oldest first, so older tickets get lower ticket numbers.
  const now = Date.now();
  const ordered = [...TICKETS].sort((a, b) => b.hoursAgo - a.hoursAgo);

  for (const t of ordered) {
    const createdAt = new Date(now - t.hoursAgo * HOUR);
    const customerId = idOf(t.customer);

    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        body: t.body,
        status: t.status,
        priority: t.priority,
        customerId,
        assigneeId: t.assignee ? idOf(t.assignee) : null,
        createdAt,
        comments: {
          create: (t.comments ?? []).map((c) => ({
            authorId: idOf(c.from === 'customer' ? t.customer : c.from),
            body: c.body,
            isInternal: c.internal ?? false,
            createdAt: new Date(createdAt.getTime() + c.minutesAfter * 60_000),
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: customerId,
        entity: 'ticket',
        entityId: ticket.id,
        action: 'ticket.created',
        diff: { subject: t.subject },
        createdAt,
      },
    });
  }

  console.log(`Seeded ${USERS.length} users and ${TICKETS.length} tickets.`);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  for (const user of USERS) {
    console.log(`  ${user.role.padEnd(8)} ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());