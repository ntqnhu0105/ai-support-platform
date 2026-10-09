import type { Prisma } from '../generated/prisma/client.js';

export interface AuditEntry {
  actorId: string;
  entity: string;
  entityId: string;
  action: string;
  diff?: Prisma.InputJsonObject;
}

/** Must be called with the transaction client so the log commits together with the change. */
export async function recordAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({ data: entry });
}